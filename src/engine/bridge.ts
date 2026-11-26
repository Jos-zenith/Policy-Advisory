/**
 * Existing-policy bridge (FR-6.1). Illustrative surrender, paid-up and maturity values.
 *
 *   paid so far      = premium × policy year
 *   back if stopped  = paid × max(GSV%, SSV%)          (surrender.ts)
 *   paid-up SA       = SA × premiums paid ÷ premiums due
 *   option covers    = gap rounded up to the cover step (+ lost death cover where relevant)
 *
 * Term premiums come from a pricing callback so this module stays catalog-free.
 * Always shows: "Don't buy another savings plan to fix a protection gap."
 */
import { q, step } from "./explain";
import { surrenderPct } from "./surrender";
import type { EngineConfig, ExplainStep } from "./types";

export interface BridgeInput {
  name: string;
  deathSumAssured: number;
  annualPremium: number;
  policyTerm: number;
  policyYear: number;
  maturityBenefit?: number;
  surrenderScheduleId: string;
}

export interface BridgeContext {
  /** Gap from Stage 2. It already counts this policy's death cover as an offset. */
  gap: number;
  income: number;
  affordCap: number;
  coverStep: number;
  ssvScheduleId: string;
  /** Annual premium of the recommended term product for a cover, or null if it can't be priced. */
  priceTerm: (cover: number) => number | null;
}

export type BridgeOptionId = "KEEP_ADD_TERM" | "STOP_BUY_TERM" | "PAID_UP_BUY_TERM" | "KEEP_NOTHING";

export interface BridgeOption {
  id: BridgeOptionId;
  title: string;
  tag: string;
  termCover: number;
  termPremium: number | null;
  yearlyOutlay: number | null;
  shareOfIncome: number | null;
  paidIfDie: number;
  paidIfDieParts: { label: string; amount: number }[];
  moneyBack: { amount: number; when: "today" | "maturity"; year: number };
  closesGap: boolean;
  summary: ExplainStep;
  pros: ExplainStep[];
  cons: ExplainStep[];
}

export interface BridgeYearRow {
  year: number;
  paid: number;
  back: number;
  pct: number;
  isToday: boolean;
  isMaturity: boolean;
}

export interface BridgeResult {
  valid: boolean;
  errors: string[];
  paidSoFar: number;
  surrenderToday: number;
  surrenderPctToday: number;
  lossToday: number;
  stillToPay: number;
  yearsLeft: number;
  shareOfIncome: number | null;
  remainingGap: number;
  maturity: number;
  rows: BridgeYearRow[];
  options: BridgeOption[];
  suggested: BridgeOptionId;
  suggestionRule: string;
  timeline: { year: number; label: string; note: ExplainStep; kind: "start" | "now" | "milestone" | "maturity" }[];
  warning: ExplainStep;
}

const ceilStep = (v: number, s: number) => Math.ceil(Math.max(v, 0) / s) * s;

export function validateBridge(i: BridgeInput): string[] {
  const e: string[] = [];
  if (!(i.deathSumAssured > 0)) e.push("Enter the amount paid on death.");
  if (!(i.annualPremium > 0)) e.push("Enter the yearly premium.");
  if (!Number.isInteger(i.policyTerm) || i.policyTerm < 2 || i.policyTerm > 60) e.push("Policy term must be 2 to 60 years.");
  if (!Number.isInteger(i.policyYear) || i.policyYear < 1 || i.policyYear >= i.policyTerm) e.push("Current policy year must be at least 1 and before the last year.");
  if (i.maturityBenefit !== undefined && i.maturityBenefit < 0) e.push("Maturity value can't be negative.");
  return e;
}

export function bridge(i: BridgeInput, ctx: BridgeContext, c: EngineConfig): BridgeResult {
  const errors = validateBridge(i);
  const empty: BridgeResult = {
    valid: false,
    errors,
    paidSoFar: 0,
    surrenderToday: 0,
    surrenderPctToday: 0,
    lossToday: 0,
    stillToPay: 0,
    yearsLeft: 0,
    shareOfIncome: null,
    remainingGap: ctx.gap,
    maturity: 0,
    rows: [],
    options: [],
    suggested: "KEEP_ADD_TERM",
    suggestionRule: "R-BR1",
    timeline: [],
    warning: step("Don't buy another savings plan to fix a protection gap. It costs more and covers far less."),
  };
  if (errors.length) return empty;

  const yr = i.policyYear;
  const T = i.policyTerm;
  const P = i.annualPremium;
  // Sample default when the maturity value isn't known: premiums due, no growth (labelled illustrative).
  const maturity = i.maturityBenefit ?? P * T;
  const paidSoFar = P * yr;
  const today = surrenderPct(c, i.surrenderScheduleId, ctx.ssvScheduleId, yr, T);
  const surrenderToday = paidSoFar * today.pct;
  const lossToday = paidSoFar - surrenderToday;
  const yearsLeft = T - yr;
  const stillToPay = P * yearsLeft;
  const share = (x: number | null) => (x === null || ctx.income <= 0 ? null : x / ctx.income);
  const gap = Math.max(ctx.gap, 0);
  const budget = ctx.affordCap * ctx.income;

  const rows: BridgeYearRow[] = [];
  for (let y = 1; y <= T; y++) {
    const paid = P * y;
    const isMaturity = y === T;
    const pc = isMaturity ? (paid > 0 ? maturity / paid : 0) : surrenderPct(c, i.surrenderScheduleId, ctx.ssvScheduleId, y, T).pct;
    rows.push({ year: y, paid, back: isMaturity ? maturity : paid * pc, pct: pc, isToday: y === yr, isMaturity });
  }

  const paidUpSA = i.deathSumAssured * (yr / T);
  const paidUpMaturity = maturity * (yr / T);

  const mk = (id: BridgeOptionId, title: string, tag: string, termCover: number, keepPremium: number, paidIfDieParts: { label: string; amount: number }[], moneyBack: BridgeOption["moneyBack"], closesGap: boolean, summary: ExplainStep, pros: ExplainStep[], cons: ExplainStep[]): BridgeOption => {
    const termPremium = termCover > 0 ? ctx.priceTerm(termCover) : 0;
    const outlay = termPremium === null ? null : keepPremium + termPremium;
    return { id, title, tag, termCover, termPremium, yearlyOutlay: outlay, shareOfIncome: share(outlay), paidIfDie: paidIfDieParts.reduce((s, x) => s + x.amount, 0), paidIfDieParts, moneyBack, closesGap, summary, pros, cons };
  };

  const keepCover = ceilStep(gap, ctx.coverStep);
  const stopCover = ceilStep(gap + i.deathSumAssured, ctx.coverStep);
  const puCover = ceilStep(gap + i.deathSumAssured - paidUpSA, ctx.coverStep);
  const keepTermPrem = ctx.priceTerm(keepCover) ?? 0;

  const options: BridgeOption[] = [
    mk(
      "KEEP_ADD_TERM",
      "Keep it and add term cover",
      "Suggested",
      keepCover,
      P,
      [
        { label: "Term cover", amount: keepCover },
        { label: i.name, amount: i.deathSumAssured },
      ],
      { amount: maturity, when: "maturity", year: T },
      true,
      step(`You keep paying {p} for ${i.name} and add {tp} a year of term cover. Your family is fully covered and you avoid a surrender loss.`, { p: q(P, "inrExact"), tp: q(keepTermPrem, "inrExact") }),
      [step("No surrender loss: you keep the {loss} you'd lose today", { loss: q(lossToday, "inrExact") }), step("Your whole {gap} gap is covered", { gap: q(gap, "inr") }), step("A lump sum of about {m} at maturity", { m: q(maturity, "inr") })],
      [step("Highest yearly outlay of the four"), step("Only works if both premiums stay affordable for {n} more years", { n: q(yearsLeft, "years") })],
    ),
    mk(
      "STOP_BUY_TERM",
      "Stop it now and buy term",
      "If cash is tight",
      stopCover,
      0,
      [{ label: "Term cover", amount: stopCover }],
      { amount: surrenderToday, when: "today", year: yr },
      true,
      step(`You stop ${i.name}, take back about {back} today and buy {cover} of term cover to replace its death cover too.`, { back: q(surrenderToday, "inrExact"), cover: q(stopCover, "inr") }),
      [step("Lowest yearly outlay"), step("Your whole gap, plus the lost {sa} of death cover, is covered", { sa: q(i.deathSumAssured, "inr") })],
      [step("You lose {loss} of what you've paid, for good", { loss: q(lossToday, "inrExact") }), step("No lump sum at maturity")],
    ),
    mk(
      "PAID_UP_BUY_TERM",
      "Make it paid-up and buy term",
      "Middle ground",
      puCover,
      0,
      [
        { label: "Term cover", amount: puCover },
        { label: `${i.name} (paid-up)`, amount: paidUpSA },
      ],
      { amount: paidUpMaturity, when: "maturity", year: T },
      true,
      step(`You stop paying but keep ${i.name} as a smaller paid-up policy ({pu} of cover), and buy {cover} of term cover.`, { pu: q(paidUpSA, "inr"), cover: q(puCover, "inr") }),
      [step("No surrender loss today; the policy carries on at a smaller size"), step("Low yearly outlay")],
      [step("Maturity shrinks to about {m}", { m: q(paidUpMaturity, "inr") }), step("Paid-up rules vary by insurer; check your exact figures")],
    ),
    mk(
      "KEEP_NOTHING",
      "Keep it, add nothing",
      "Leaves gap open",
      0,
      P,
      [{ label: i.name, amount: i.deathSumAssured }],
      { amount: maturity, when: "maturity", year: T },
      false,
      step(`You keep paying ${i.name} and add no cover. Your family would still be short by {gap}.`, { gap: q(gap, "inr") }),
      [step("Nothing new to set up")],
      [step("Leaves your {gap} gap open", { gap: q(gap, "inr") })],
    ),
  ];

  // R-BR1: keep + term if both premiums fit the budget; otherwise paid-up + term; otherwise stop + term.
  const fits = (o: BridgeOption) => o.yearlyOutlay !== null && o.yearlyOutlay <= budget;
  const suggested: BridgeOptionId = gap <= 0 ? "KEEP_NOTHING" : fits(options[0]) ? "KEEP_ADD_TERM" : fits(options[2]) ? "PAID_UP_BUY_TERM" : "STOP_BUY_TERM";
  for (const o of options) o.tag = o.id === suggested ? "Suggested" : o.id === "KEEP_ADD_TERM" ? "Highest outlay" : o.tag;

  const pctAt = (y: number) => surrenderPct(c, i.surrenderScheduleId, ctx.ssvScheduleId, y, T).pct;
  const timeline: BridgeResult["timeline"] = [{ year: 1, label: "Year 1 · started", note: step("Only a small special value if you stop"), kind: "start" }];
  if (yr !== 2) timeline.push({ year: 2, label: "Year 2", note: step("Guaranteed value starts at {p} of premiums", { p: q(pctAt(2), "pct", 0) }), kind: "milestone" });
  timeline.push({ year: yr, label: `Year ${yr} · you are here`, note: step("{p} back: {back} of {paid}", { p: q(today.pct, "pct", 0), back: q(surrenderToday, "inrExact"), paid: q(paidSoFar, "inrExact") }), kind: "now" });
  if (10 > yr && 10 < T - 1) timeline.push({ year: 10, label: "Year 10", note: step("About {p} back", { p: q(pctAt(10), "pct", 0) }), kind: "milestone" });
  const high = rows.find((r) => !r.isMaturity && r.year > yr && r.pct >= 0.9);
  if (high && high.year < T) timeline.push({ year: high.year, label: `Years ${high.year} to ${T}`, note: step("90% or more back"), kind: "milestone" });
  timeline.push({ year: T, label: `Year ${T} · maturity`, note: step("About {m} paid out (illustrative)", { m: q(maturity, "inr") }), kind: "maturity" });

  return {
    valid: true,
    errors: [],
    paidSoFar,
    surrenderToday,
    surrenderPctToday: today.pct,
    lossToday,
    stillToPay,
    yearsLeft,
    shareOfIncome: share(P),
    remainingGap: gap,
    maturity,
    rows,
    options,
    suggested,
    suggestionRule: "R-BR1",
    timeline,
    warning: empty.warning,
  };
}
