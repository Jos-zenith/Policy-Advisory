/**
 * Reveal-day adapters (CLAUDE.md §16): pure mapping + validation.
 * A mapping file says which source column becomes which canonical field
 * (dot paths, e.g. "entryAge.0", "loans.0.outstanding"), plus value maps,
 * constants and simple transforms. Output is validated with the same zod
 * schemas the app uses, and a report lists everything a human should check.
 */
import type { z } from "zod";
import { AdvisorSchema, ProductSchema, ProfileSchema, RateTableSchema } from "@/data/schemas";
import type { RateTable } from "@/engine/types";

export type Entity = "products" | "rates" | "profiles" | "advisors";
export type Row = Record<string, unknown>;

export interface Mapping {
  entity: Entity;
  source?: { file?: string; sheet?: string };
  /** source column → canonical dot path */
  columns: Record<string, string>;
  /** canonical path → { source value → canonical value } */
  valueMaps?: Record<string, Record<string, string | number | boolean>>;
  /** canonical path → transform name */
  transforms?: Record<string, "number" | "lakhToRupees" | "croreToRupees" | "boolean" | "splitList" | "isoDate" | "upper">;
  /** canonical path → constant value, applied before columns */
  constants?: Record<string, unknown>;
  /** rates only: declared dims, and how to name tables */
  rates?: { dims: string[]; tableIdTemplate?: string; version?: string; coverBands?: RateTable["coverBands"] };
  /** profiles/products: drop array items whose `field` is empty or 0 (e.g. unused loan columns) */
  pruneEmpty?: { array: string; field: string }[];
}

export interface Report {
  entity: Entity;
  rows: number;
  produced: number;
  unmappedColumns: string[];
  missingRequired: { row: number; path: string; message: string }[];
  outOfRange: { row: number; path: string; message: string }[];
  nonMonotonic: { table: string; key: string; message: string }[];
  dimMismatch: { table: string; message: string }[];
  unmappedValues: { path: string; value: string }[];
  ok: boolean;
}

function setPath(obj: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split(".");
  let cur: Record<string, unknown> | unknown[] = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    const nextIsIndex = /^\d+$/.test(parts[i + 1]);
    const container = cur as Record<string, unknown>;
    if (container[k] === undefined) container[k] = nextIsIndex ? [] : {};
    cur = container[k] as Record<string, unknown>;
  }
  (cur as Record<string, unknown>)[parts[parts.length - 1]] = value;
}

function transform(v: unknown, t: NonNullable<Mapping["transforms"]>[string]): unknown {
  if (v === null || v === undefined || v === "") return undefined;
  const s = String(v).trim();
  const n = Number(s.replace(/[,₹\s]/g, ""));
  switch (t) {
    case "number":
      return Number.isFinite(n) ? n : v;
    case "lakhToRupees":
      return Number.isFinite(n) ? Math.round(n * 100_000) : v;
    case "croreToRupees":
      return Number.isFinite(n) ? Math.round(n * 10_000_000) : v;
    case "boolean":
      return /^(y|yes|true|1)$/i.test(s);
    case "splitList":
      return s.split(/[;,|]/).map((x) => x.trim()).filter(Boolean);
    case "isoDate": {
      const d = new Date(s);
      return Number.isNaN(d.getTime()) ? v : d.toISOString().slice(0, 10);
    }
    case "upper":
      return s.toUpperCase();
  }
}

function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);
}

export function mapRows(rows: Row[], m: Mapping, report: Report): Record<string, unknown>[] {
  const sourceCols = new Set(rows.flatMap((r) => Object.keys(r)));
  report.unmappedColumns = Array.from(sourceCols).filter((c) => !(c in m.columns));
  const seenUnmapped = new Set<string>();
  return rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [p, v] of Object.entries(m.constants ?? {})) setPath(out, p, structuredClone(v));
    for (const [col, path] of Object.entries(m.columns)) {
      let v: unknown = row[col];
      if (v === undefined || v === null || v === "") continue;
      const vm = m.valueMaps?.[path];
      if (vm) {
        const key = String(v).trim();
        if (key in vm) v = vm[key];
        else if (!seenUnmapped.has(`${path}=${key}`)) {
          seenUnmapped.add(`${path}=${key}`);
          report.unmappedValues.push({ path, value: key });
        }
      }
      const t = m.transforms?.[path];
      if (t) v = transform(v, t);
      setPath(out, path, v);
    }
    for (const pe of m.pruneEmpty ?? []) {
      const arr = getPath(out, pe.array);
      if (Array.isArray(arr)) {
        const kept = arr.filter((x) => {
          // "__self__" prunes holes in plain arrays (e.g. incomeHistory) but keeps a real 0 (TC-11).
          if (pe.field === "__self__") return x !== undefined && x !== null && x !== "";
          const f = x && typeof x === "object" ? (x as Record<string, unknown>)[pe.field] : undefined;
          return f !== undefined && f !== null && f !== "" && f !== 0;
        });
        setPath(out, pe.array, kept);
      }
    }
    return out;
  });
}

function validate<T>(items: Record<string, unknown>[], schema: z.ZodType<T>, report: Report): T[] {
  const good: T[] = [];
  items.forEach((it, i) => {
    const r = schema.safeParse(it);
    if (r.success) good.push(r.data);
    else
      for (const issue of r.error.issues) {
        const entry = { row: i + 2, path: issue.path.join("."), message: issue.message };
        if (issue.code === "invalid_type" && /undefined|received undefined/i.test(issue.message)) report.missingRequired.push(entry);
        else report.outOfRange.push(entry);
      }
  });
  return good;
}

/** Premium must not fall as cover rises: compare the premium at each cover band's minimum, same other dims. */
export function checkMonotonic(t: RateTable): Report["nonMonotonic"] {
  const out: Report["nonMonotonic"] = [];
  if (!t.coverBands?.length || !t.dims.includes("coverBand")) return out;
  const bandMin = new Map(t.coverBands.map((b) => [b.id, b.min]));
  const groups = new Map<string, { min: number; premium: number; band: string }[]>();
  for (const c of t.cells) {
    const k = t.dims.filter((d) => d !== "coverBand").map((d) => `${d}=${c.key[d]}`).join(",");
    const min = bandMin.get(String(c.key.coverBand));
    if (min === undefined) continue;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push({ min, premium: (c.ratePer1000 * min) / 1000, band: String(c.key.coverBand) });
  }
  for (const [k, list] of groups) {
    list.sort((a, b) => a.min - b.min);
    for (let i = 1; i < list.length; i++) {
      if (list[i].premium < list[i - 1].premium) out.push({ table: t.id, key: k, message: `premium at ${list[i].band} minimum is below ${list[i - 1].band} minimum` });
    }
  }
  return out;
}

export function checkDims(t: RateTable): Report["dimMismatch"] {
  const declared = [...t.dims].sort().join(",");
  const bad = t.cells.find((c) => Object.keys(c.key).sort().join(",") !== declared);
  return bad ? [{ table: t.id, message: `cell keys [${Object.keys(bad.key).join(", ")}] differ from declared dims [${t.dims.join(", ")}]` }] : [];
}

export function adapt(rows: Row[], m: Mapping): { output: unknown[]; report: Report } {
  const report: Report = { entity: m.entity, rows: rows.length, produced: 0, unmappedColumns: [], missingRequired: [], outOfRange: [], nonMonotonic: [], dimMismatch: [], unmappedValues: [], ok: false };
  const mapped = mapRows(rows, m, report);
  let output: unknown[] = [];
  if (m.entity === "products") {
    output = validate(mapped, ProductSchema, report);
    for (const p of output as z.infer<typeof ProductSchema>[]) {
      if (p.entryAge[1] > p.maxMaturityAge) report.outOfRange.push({ row: 0, path: `${p.id}.entryAge`, message: "max entry age is above the maturity age" });
    }
  } else if (m.entity === "advisors") {
    output = validate(mapped, AdvisorSchema, report);
  } else if (m.entity === "profiles") {
    output = validate(mapped, ProfileSchema, report);
  } else {
    // rates: each row is one cell {productId, key.*, ratePer1000}; group into tables.
    const dims = m.rates?.dims ?? [];
    const byProduct = new Map<string, RateTable>();
    mapped.forEach((r, i) => {
      const productId = String(r.productId ?? "");
      const rate = Number(r.ratePer1000);
      if (!productId) return report.missingRequired.push({ row: i + 2, path: "productId", message: "missing product" });
      if (!Number.isFinite(rate) || rate < 0) return report.outOfRange.push({ row: i + 2, path: "ratePer1000", message: `invalid rate ${String(r.ratePer1000)}` });
      const id = (m.rates?.tableIdTemplate ?? "RT-{productId}").replace("{productId}", productId);
      if (!byProduct.has(productId)) byProduct.set(productId, { id, productId, version: m.rates?.version ?? "reveal", dims, cells: [], coverBands: m.rates?.coverBands });
      const key = (r.key ?? {}) as Record<string, string | number>;
      byProduct.get(productId)!.cells.push({ key, ratePer1000: rate });
    });
    const tables = Array.from(byProduct.values());
    for (const t of tables) {
      report.dimMismatch.push(...checkDims(t));
      report.nonMonotonic.push(...checkMonotonic(t));
    }
    output = validate(tables as unknown as Record<string, unknown>[], RateTableSchema, report);
  }
  report.produced = output.length;
  report.ok = report.missingRequired.length === 0 && report.outOfRange.length === 0 && report.dimMismatch.length === 0 && report.nonMonotonic.length === 0 && output.length > 0;
  return { output, report };
}

export function formatReport(r: Report): string {
  const lines = [`[import:${r.entity}] ${r.produced} produced from ${r.rows} rows · ${r.ok ? "OK" : "NEEDS ATTENTION"}`];
  const sec = (title: string, items: unknown[], fmt: (x: never) => string) => {
    if (!items.length) return;
    lines.push(`  ${title} (${items.length}):`);
    for (const x of items.slice(0, 20)) lines.push(`    - ${fmt(x as never)}`);
    if (items.length > 20) lines.push(`    … ${items.length - 20} more`);
  };
  sec("Unmapped columns", r.unmappedColumns, (x: string) => x);
  sec("Unmapped values", r.unmappedValues, (x: { path: string; value: string }) => `${x.path}: "${x.value}"`);
  sec("Missing required fields", r.missingRequired, (x: { row: number; path: string; message: string }) => `row ${x.row} ${x.path}: ${x.message}`);
  sec("Out-of-range values", r.outOfRange, (x: { row: number; path: string; message: string }) => `row ${x.row} ${x.path}: ${x.message}`);
  sec("Non-monotonic premiums", r.nonMonotonic, (x: { table: string; key: string; message: string }) => `${x.table} [${x.key}]: ${x.message}`);
  sec("Rate tables whose dims differ from declared dims", r.dimMismatch, (x: { table: string; message: string }) => `${x.table}: ${x.message}`);
  return lines.join("\n");
}
