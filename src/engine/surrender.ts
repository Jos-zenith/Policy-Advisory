/**
 * Surrender transparency (FR-4.x). Illustrative only.
 *
 *   back(year) = paid(year) × max(GSV%(year), SSV%(year))
 *
 * ULIPs have no GSV/SSV: only lock-in and discontinuance wording.
 * Term cover: "protection-first, low surrender risk" (no savings part to lose).
 */
import { q, step } from "./explain";
import type { EngineConfig, ExplainStep, Product, SurrenderSchedule } from "./types";

export interface SurrenderRow {
  year: number;
  paid: number;
  back: number;
  pct: number;
  basis: "GUARANTEED" | "SPECIAL";
}

function pctFor(s: SurrenderSchedule | undefined, year: number, term: number): number {
  if (!s) return 0;
  if (year >= term && s.lastYear) return s.lastYear;
  const v = s.byYear[String(year)];
  if (v !== undefined) return v;
  const listed = Object.keys(s.byYear).map(Number);
  return year > Math.max(...listed) ? s.afterLastListedYear : 0;
}

export function surrenderPct(c: EngineConfig, scheduleId: string, ssvScheduleId: string, year: number, term: number): { pct: number; basis: "GUARANTEED" | "SPECIAL" } {
  const gsv = pctFor(c.surrender.schedules.find((s) => s.id === scheduleId), year, term);
  const ssv = pctFor(c.surrender.schedules.find((s) => s.id === ssvScheduleId), year, term);
  return ssv > gsv ? { pct: ssv / 100, basis: "SPECIAL" } : { pct: gsv / 100, basis: "GUARANTEED" };
}

/** Year-by-year rows for years 1..term−1 (the final year is maturity, handled by the caller). */
export function surrenderSchedule(c: EngineConfig, scheduleId: string, ssvScheduleId: string, annualPremium: number, term: number): SurrenderRow[] {
  const rows: SurrenderRow[] = [];
  for (let year = 1; year < term; year++) {
    const paid = annualPremium * year;
    const { pct, basis } = surrenderPct(c, scheduleId, ssvScheduleId, year, term);
    rows.push({ year, paid, back: paid * pct, pct, basis });
  }
  return rows;
}

export type SurrenderProfile =
  | { kind: "TERM"; line: ExplainStep }
  | { kind: "ULIP"; lockInYears: number; line: ExplainStep }
  | { kind: "SCHEDULE"; rows: SurrenderRow[]; illustrationPremium: number; line: ExplainStep; note: ExplainStep };

export function surrenderProfile(p: Product, c: EngineConfig, ssvScheduleId: string, illustrationPremium: number, term?: number): SurrenderProfile {
  if (p.category === "TERM") {
    return { kind: "TERM", line: step("If you stop paying: cover simply ends. There's no savings part to lose, so surrender risk is low.") };
  }
  if (p.category === "ULIP") {
    const lock = p.lockInYears ?? 5;
    return {
      kind: "ULIP",
      lockInYears: lock,
      line: step("If you stop early: money is locked in for {n} years. Stopping before then moves it to a discontinuance fund until year {n}. Value depends on markets.", { n: q(lock, "years") }),
    };
  }
  const t = term ?? p.term[0];
  const rows = surrenderSchedule(c, p.surrenderScheduleId ?? "S-GSV-2024", ssvScheduleId, illustrationPremium, t);
  return {
    kind: "SCHEDULE",
    rows,
    illustrationPremium,
    line: step("If you stop early ({prem} a year)", { prem: q(illustrationPremium, "inrExact") }),
    note: step(`Illustrative. Higher of guaranteed and special surrender value; schedule ${p.surrenderScheduleId ?? "S-GSV-2024"} in config.`),
  };
}

/** "about 30 to 50% in years 2 to 7" — derived from the schedule, for comprehension corrections. */
export function earlyYearsRange(c: EngineConfig, scheduleId = "S-GSV-2024"): { from: number; to: number; minPct: number; maxPct: number } {
  const [from, to] = c.surrender.earlyYearsForCopy;
  const s = c.surrender.schedules.find((x) => x.id === scheduleId);
  const vals: number[] = [];
  for (let y = from; y <= to; y++) vals.push(pctFor(s, y, 100));
  return { from, to, minPct: Math.min(...vals) / 100, maxPct: Math.max(...vals) / 100 };
}
