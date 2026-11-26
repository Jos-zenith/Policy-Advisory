/**
 * "Why ₹X and not ₹Y?" (FR-2.11).
 *  - One-at-a-time sensitivity: re-run the base case with exactly one change.
 *  - Runway: what a smaller amount (default ₹1 Cr) would fund on its own,
 *    in order: loans → years of living costs → goals; then what stays unfunded.
 */
import { realRate, yearsFunded } from "./annuity";
import { analyse } from "./analysis";
import { q, renderStep, step } from "./explain";
import { floorHalf } from "./format";
import { GOAL_LABELS, GOAL_ORDER, type NeedKey } from "./labels";
import { computeLiving } from "./needs";
import type { Assumptions, EngineConfig, ExplainStep, Profile } from "./types";

export interface SensitivityRow {
  id: "LIFE_YEARS" | "INFLATION" | "EMPLOYER" | "SPOUSE_RETIREMENT";
  label: ExplainStep;
  lower: number | null;
  higher: number | null;
  /** What changed, for the trace/judge view. */
  change: string;
}

export interface RunwaySegment {
  key: NeedKey;
  label: ExplainStep;
  amount: number;
  /** For LIVING: years funded (rounded down to a half year for display). */
  years?: number;
  full: boolean;
}

export interface Runway {
  amount: number;
  funded: RunwaySegment[];
  unfunded: RunwaySegment[];
  summary: ExplainStep;
}

export interface SensitivityResult {
  baseGap: number;
  rows: SensitivityRow[];
  runway: Runway | null;
  note: ExplainStep;
}

function gapOf(p: Profile, a: Assumptions, c: EngineConfig): number | null {
  const r = analyse(p, a, c);
  return r.ok ? r.value.recon.gap : null;
}

export function sensitivity(p: Profile, a: Assumptions, c: EngineConfig): SensitivityResult | null {
  const baseGap = gapOf(p, a, c);
  if (baseGap === null) return null;
  const { lifeYearsDelta, inflationDelta } = c.rules.sensitivity;
  const rows: SensitivityRow[] = [];

  const loYears = Math.max(1, a.lifeYears - lifeYearsDelta);
  const hiYears = a.lifeYears + lifeYearsDelta;
  rows.push({
    id: "LIFE_YEARS",
    label: step("Years of family support ({lo} / {hi})", { lo: q(loYears, "years"), hi: q(hiYears, "years") }),
    lower: gapOf(p, { ...a, lifeYears: loYears }, c),
    higher: gapOf(p, { ...a, lifeYears: hiYears }, c),
    change: "A-LC-YEARS",
  });

  const loInf = Math.max(0, a.inflation - inflationDelta);
  const hiInf = a.inflation + inflationDelta;
  rows.push({
    id: "INFLATION",
    label: step("Prices rise each year ({lo} / {hi})", { lo: q(loInf, "pct", 1), hi: q(hiInf, "pct", 1) }),
    lower: gapOf(p, { ...a, inflation: loInf }, c),
    higher: gapOf(p, { ...a, inflation: hiInf }, c),
    change: "A-INFL",
  });

  const hasEmployer = p.existingCover.some((x) => x.kind === "EMPLOYER" && x.deathSumAssured > 0);
  if (hasEmployer) {
    rows.push({
      id: "EMPLOYER",
      label: step("Employer cover (kept / lost)"),
      lower: baseGap,
      higher: gapOf(withoutEmployerCover(p), a, c),
      change: "existingCover.EMPLOYER = 0",
    });
  }

  const hasSpouseRet = p.goals.some((g) => g.kind === "SPOUSE_RETIREMENT" && g.amount > 0);
  if (hasSpouseRet) {
    rows.push({
      id: "SPOUSE_RETIREMENT",
      label: step("Spouse retirement goal (left out)"),
      lower: gapOf({ ...p, goals: p.goals.filter((g) => g.kind !== "SPOUSE_RETIREMENT") }, a, c),
      higher: null,
      change: "goals.SPOUSE_RETIREMENT removed",
    });
  }

  return {
    baseGap,
    rows,
    runway: runway(p, a, c, baseGap),
    note: step("Base case {base}. Each row changes one thing and keeps everything else as entered.", { base: q(baseGap, "inr") }),
  };
}

export function withoutEmployerCover(p: Profile): Profile {
  return { ...p, existingCover: p.existingCover.filter((x) => x.kind !== "EMPLOYER") };
}

/** Pick the comparison amount: ₹1 Cr by default, or half the gap (rounded down) for smaller gaps. */
export function runwayAmount(gap: number, c: EngineConfig): number {
  const r = c.rules.runway;
  if (gap > r.minGapForDefault) return r.compareAmount;
  const half = Math.floor((gap * r.fallbackShare) / r.fallbackRoundTo) * r.fallbackRoundTo;
  return half > 0 ? half : 0;
}

export function runway(p: Profile, a: Assumptions, c: EngineConfig, gap: number, amountOverride?: number): Runway | null {
  const amount = amountOverride ?? runwayAmount(gap, c);
  if (amount <= 0) return null;
  let left = amount;
  const funded: RunwaySegment[] = [];
  const unfunded: RunwaySegment[] = [];

  const loans = p.loans.reduce((s, l) => s + l.outstanding, 0);
  const loanName = p.loans.filter((l) => l.outstanding > 0).length === 1 ? p.loans.find((l) => l.outstanding > 0)!.label : "Loans";
  if (loans > 0) {
    const used = Math.min(left, loans);
    left -= used;
    if (used > 0) funded.push({ key: "LOANS", label: step(`${loanName} {amt}`, { amt: q(used, "inr") }), amount: used, full: used >= loans });
    if (used < loans) unfunded.push({ key: "LOANS", label: step(`the rest of the ${loanName.toLowerCase()} ({amt})`, { amt: q(loans - used, "inr") }), amount: loans - used, full: false });
  }

  if (p.familyCostsPerYear && p.familyCostsPerYear > 0 && a.lifeYears > 0) {
    const living = computeLiving(p.familyCostsPerYear, a);
    const r = realRate(a.discount, a.inflation);
    if (left >= living.amount) {
      left -= living.amount;
      funded.push({ key: "LIVING", label: step("All {n} years of family costs", { n: q(living.yearsUsed, "years") }), amount: living.amount, years: living.yearsUsed, full: true });
    } else {
      const exactYears = Math.min(living.yearsUsed, yearsFunded(left, p.familyCostsPerYear, r, a.needsTiming));
      const shown = floorHalf(exactYears);
      if (left > 0) funded.push({ key: "LIVING", label: step("About {n} years of family costs", { n: q(shown, "years") }), amount: left, years: shown, full: false });
      unfunded.push({ key: "LIVING", label: step(shown > 0 ? "the last {n} years of living costs" : "all {n} years of living costs", { n: q(living.yearsUsed - shown, "years") }), amount: living.amount - left, years: living.yearsUsed - shown, full: false });
      left = 0;
    }
  }

  const goalText: Record<string, string> = {
    EDUCATION: "education ({amt})",
    MARRIAGE: "marriage goals ({amt})",
    HEALTH_EMERGENCY: "the health fund ({amt})",
    SPOUSE_RETIREMENT: "your spouse's retirement ({amt})",
    OTHER: "other goals ({amt})",
  };
  for (const kind of GOAL_ORDER) {
    const amt = p.goals.filter((g) => g.kind === kind).reduce((s, g) => s + g.amount, 0);
    if (amt <= 0) continue;
    const used = Math.min(left, amt);
    left -= used;
    if (used > 0) funded.push({ key: kind, label: step(`${GOAL_LABELS[kind]} {amt}`, { amt: q(used, "inr") }), amount: used, full: used >= amt });
    if (used < amt) unfunded.push({ key: kind, label: step(goalText[kind], { amt: q(amt - used, "inr") }), amount: amt - used, full: false });
  }

  const summary = unfunded.length
    ? step(`Then the money runs out. Still unfunded: ${joinList(unfunded.map((u, i) => `{u${i}}`))}.`, Object.fromEntries(unfunded.map((u, i) => [`u${i}`, q(renderStep(u.label), "text")])))
    : step("{amt} on its own would cover everything listed.", { amt: q(amount, "inr") });
  return { amount, funded, unfunded, summary };
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

