/**
 * Rate lookup and premium (CLAUDE.md §9).
 *
 *   premium = ratePer1000 × cover / 1000   (+ rider) × frequency factor
 *
 * Lookup is generic over the table's dims:
 *  - exact cell                      → exact: true
 *  - inside the grid, no exact cell  → nearest valid cell, exact: false (rule stated)
 *  - outside the grid                → not priced (E-GRID); never extrapolated
 * Categorical dims the customer hasn't given (e.g. sex) use the higher of the
 * matching rates, so an unknown never makes cover look cheaper.
 *
 * Band boundary rule: if a higher cover band's minimum would cost less than the
 * requested cover, that lower price is used, so premium never falls as cover rises.
 */
import { input, makeExplain, q, step } from "./explain";
import { inr } from "./format";
import type { CellKey, EngineConfig, Explain, Frequency, Product, RateTable } from "./types";

export type DimValue = string | number | undefined;

export type RateLookup =
  | { ok: true; ratePer1000: number; exact: boolean; cell: CellKey; notes: string[] }
  | { ok: false; code: "E-GRID"; reason: string };

function isNumericDim(table: RateTable, dim: string): boolean {
  return table.cells.length > 0 && typeof table.cells[0].key[dim] === "number";
}

const DIM_WORD: Record<string, string> = { age: "age", term: "term", sex: "sex", smoker: "smoker status", coverBand: "cover band", frequency: "payment frequency" };

export function lookupRate(table: RateTable, request: Record<string, DimValue>): RateLookup {
  let cells = table.cells;
  const notes: string[] = [];
  let exact = true;

  // Categorical dims first (exact match when known).
  for (const dim of table.dims) {
    if (isNumericDim(table, dim)) continue;
    const want = request[dim];
    if (want === undefined) {
      exact = false;
      notes.push(`${DIM_WORD[dim] ?? dim} not given: used the higher rate`);
      continue;
    }
    cells = cells.filter((c) => c.key[dim] === want);
    if (!cells.length) return { ok: false, code: "E-GRID", reason: `No rates for ${DIM_WORD[dim] ?? dim} "${String(want)}" in table ${table.id}` };
  }

  // Numeric dims in table order: must sit inside the grid; nearest value, ties go to the higher value.
  for (const dim of table.dims) {
    if (!isNumericDim(table, dim)) continue;
    const want = request[dim];
    if (typeof want !== "number" || !Number.isFinite(want)) return { ok: false, code: "E-GRID", reason: `No ${DIM_WORD[dim] ?? dim} given for table ${table.id}` };
    const all = table.cells.map((c) => c.key[dim] as number);
    const lo = Math.min(...all);
    const hi = Math.max(...all);
    if (want < lo || want > hi) return { ok: false, code: "E-GRID", reason: `${DIM_WORD[dim] ?? dim} ${want} is outside table ${table.id} (${lo}–${hi}); we never extrapolate` };
    const values = Array.from(new Set(cells.map((c) => c.key[dim] as number))).sort((a, b) => a - b);
    if (!values.length) return { ok: false, code: "E-GRID", reason: `No cell in table ${table.id} for this combination` };
    let best = values[0];
    for (const v of values) {
      const d = Math.abs(v - want);
      const bd = Math.abs(best - want);
      if (d < bd || (d === bd && v > best)) best = v;
    }
    if (best !== want) {
      exact = false;
      notes.push(`${DIM_WORD[dim] ?? dim} ${want} not in table: nearest ${best} used`);
    }
    cells = cells.filter((c) => c.key[dim] === best);
  }

  if (!cells.length) return { ok: false, code: "E-GRID", reason: `No cell in table ${table.id} for this combination` };
  const chosen = cells.reduce((m, c) => (c.ratePer1000 > m.ratePer1000 ? c : m), cells[0]);
  return { ok: true, ratePer1000: chosen.ratePer1000, exact, cell: chosen.key, notes };
}

export function coverBandFor(table: RateTable, cover: number): { id: string; min: number; max: number; label?: string } | null {
  if (!table.coverBands?.length) return null;
  return table.coverBands.find((b) => cover >= b.min && cover <= b.max) ?? null;
}

export interface PremiumRequest {
  age: number;
  sex?: "M" | "F";
  smoker?: boolean;
  term?: number;
  cover: number;
  frequency: Frequency;
  rider: boolean;
}

export interface PremiumQuote {
  ok: true;
  productId: string;
  tableId: string;
  annual: number;
  instalment: number;
  periodsPerYear: number;
  base: number;
  riderAnnual: number;
  ratePer1000: number;
  exact: boolean;
  cell: CellKey;
  notes: string[];
  bandRuleApplied: boolean;
  rateLine: string;
  explain: Explain;
}

export type PremiumResult = PremiumQuote | { ok: false; code: "E-GRID"; reason: string };

function requestKey(table: RateTable, r: PremiumRequest, cover: number): Record<string, DimValue> | { error: string } {
  const key: Record<string, DimValue> = {};
  for (const dim of table.dims) {
    if (dim === "age") key.age = r.age;
    else if (dim === "term") key.term = r.term;
    else if (dim === "sex") key.sex = r.sex;
    else if (dim === "smoker") key.smoker = r.smoker === undefined ? undefined : r.smoker ? "Y" : "N";
    else if (dim === "frequency") key.frequency = r.frequency;
    else if (dim === "coverBand") {
      const band = coverBandFor(table, cover);
      if (!band) return { error: `cover ${inr(cover)} is outside the bands of table ${table.id}` };
      key.coverBand = band.id;
    } else key[dim] = undefined;
  }
  return key;
}

function rateLine(table: RateTable, r: PremiumRequest, look: { ratePer1000: number; exact: boolean; cell: CellKey }): string {
  const parts: string[] = [];
  const c = look.cell;
  if (c.age !== undefined) parts.push(`age ${c.age}`);
  if (c.sex !== undefined) parts.push(c.sex === "M" ? "male" : "female");
  if (c.smoker !== undefined) parts.push(c.smoker === "Y" ? "smoker" : "non-smoker");
  if (c.term !== undefined) parts.push(`term ${c.term}`);
  if (c.coverBand !== undefined) {
    const band = table.coverBands?.find((b) => b.id === c.coverBand);
    parts.push(`cover ${band?.label ?? c.coverBand}`);
  }
  parts.push(`₹${look.ratePer1000.toFixed(2)} per ₹1,000`);
  parts.push(`table ${table.id}`);
  parts.push(look.exact ? "exact cell" : "nearest cell");
  void r;
  return parts.join(" · ");
}

export function priceProduct(product: Product, table: RateTable, r: PremiumRequest, c: EngineConfig): PremiumResult {
  const key = requestKey(table, r, r.cover);
  if ("error" in key) return { ok: false, code: "E-GRID", reason: key.error as string };
  const look = lookupRate(table, key);
  if (!look.ok) return look;

  let base = (look.ratePer1000 * r.cover) / 1000;
  let bandRuleApplied = false;
  const notes = [...look.notes];
  // Band boundary rule: never charge more than a higher band's minimum cover would cost.
  for (const band of table.coverBands ?? []) {
    if (band.min <= r.cover || band.min > product.cover[1]) continue;
    const k2 = requestKey(table, r, band.min);
    if ("error" in k2) continue;
    const l2 = lookupRate(table, k2);
    if (!l2.ok) continue;
    const alt = (l2.ratePer1000 * band.min) / 1000;
    if (alt < base) {
      base = alt;
      bandRuleApplied = true;
    }
  }
  if (bandRuleApplied) notes.push("a higher cover band would cost less, so its lower price is used");

  let riderAnnual = 0;
  const rider = product.riders[0];
  if (r.rider && rider) {
    if (rider.ratePer1000 !== undefined) riderAnnual += (rider.ratePer1000 * r.cover) / 1000;
    if (rider.pctLoading !== undefined) riderAnnual += base * rider.pctLoading;
  }
  const f = c.rules.frequencies[r.frequency];
  const yearly = base + riderAnnual;
  const instalment = yearly * f.factor;
  const annual = instalment * f.periodsPerYear;
  const line = rateLine(table, r, look);

  const explain = makeExplain({
    id: `premium.${product.id}`,
    title: `${product.name} premium`,
    result: q(annual, "inrExact"),
    summary: step(`Indicative premium from a sample rate table, not a binding quote. ${look.exact ? "The rate comes from an exact cell." : "No exact cell, so the nearest valid cell is used."}`),
    steps: [
      step("{rate} per ₹1,000 × {cover} ÷ 1,000 = {base}", { rate: q(`₹${look.ratePer1000.toFixed(2)}`, "text"), cover: q(r.cover, "inrExact"), base: q(base, "inrExact") }),
      ...(riderAnnual ? [step("+ accidental death rider {rider}", { rider: q(riderAnnual, "inrExact") })] : []),
      ...(r.frequency === "YEARLY" ? [] : [step("{yearly} × {factor} = {inst} a month; × {n} = {annual} a year", { yearly: q(yearly, "inrExact"), factor: q(f.factor, "factor", 4), inst: q(instalment, "inrExact"), n: q(f.periodsPerYear, "number"), annual: q(annual, "inrExact") })]),
    ],
    inputs: [
      input("Rate used", q(line, "text"), "rate-table", table.id),
      input("Cover", q(r.cover, "inrExact"), "you", "Stage 3"),
      ...(r.term !== undefined ? [input("Policy term", q(r.term, "years"), "you", "Stage 3")] : []),
      input("Premium payment", q(f.label, "text"), "config", "frequencies"),
    ],
    traceIds: ["FR-3.4", "FR-3.5", table.id],
    source: { configVersion: c.configVersion, note: notes.length ? notes.join("; ") : undefined },
  });

  return { ok: true, productId: product.id, tableId: table.id, annual, instalment, periodsPerYear: f.periodsPerYear, base, riderAnnual, ratePer1000: look.ratePer1000, exact: look.exact, cell: look.cell, notes, bandRuleApplied, rateLine: line, explain };
}
