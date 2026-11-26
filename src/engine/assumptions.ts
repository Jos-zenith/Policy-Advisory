/** Build typed Assumptions from config definitions, and diff against defaults. */
import type { AssumptionDef, AssumptionKey, Assumptions } from "./types";

export function defaultAssumptions(defs: AssumptionDef[]): Assumptions {
  const out: Record<string, number | string> = {};
  for (const d of defs) out[d.key] = d.value;
  return out as unknown as Assumptions;
}

export function assumptionId(defs: AssumptionDef[], key: AssumptionKey): string {
  return defs.find((d) => d.key === key)?.id ?? key;
}

export function withOverrides(base: Assumptions, overrides: Partial<Assumptions> | undefined): Assumptions {
  return { ...base, ...(overrides ?? {}) };
}

/** Which assumptions differ from config defaults (for the handoff "Changed from defaults" line). */
export function changedAssumptions(defs: AssumptionDef[], a: Assumptions): { id: string; key: AssumptionKey; from: number | string; to: number | string }[] {
  const out: { id: string; key: AssumptionKey; from: number | string; to: number | string }[] = [];
  for (const d of defs) {
    const v = a[d.key];
    if (typeof v === "number" && typeof d.value === "number" ? Math.abs(v - d.value) > 1e-12 : v !== d.value) {
      out.push({ id: d.id, key: d.key, from: d.value, to: v });
    }
  }
  return out;
}
