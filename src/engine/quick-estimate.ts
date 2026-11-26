/**
 * Stage 1 quick estimate (FR-1.1). Range = income × band multiples by age.
 * No premium, no existing cover: those come later.
 */
import { input, makeExplain, q, step } from "./explain";
import { validateAge, validateAmount } from "./validate";
import type { EngineConfig, Explain, Result } from "./types";

export type QuickVerdict = "UNDERINSURED" | "NEEDS_DETAIL";

export interface QuickEstimateInput {
  age: number;
  income: number;
  hasDependants: boolean;
}

export interface QuickEstimate {
  low: number;
  high: number;
  lowMultiple: number;
  highMultiple: number;
  bandId: string;
  bandAgeLabel: string;
  verdict: QuickVerdict;
  reason: ReturnType<typeof step>;
  explain: Explain;
  configVersion: string;
}

export function quickEstimate(inp: QuickEstimateInput, c: EngineConfig): Result<QuickEstimate> {
  const errors = [validateAge(inp.age, c), validateAmount("income", inp.income, c, "Income")].filter((x) => x !== null);
  if (errors.length) return { ok: false, errors };

  const qe = c.bands.quickEstimate;
  let bandId: string;
  let low: number;
  let high: number;
  let bandAgeLabel: string;
  if (inp.hasDependants) {
    const band = qe.withDependants.find((b) => inp.age >= b.minAge && inp.age <= b.maxAge) ?? qe.withDependants[qe.withDependants.length - 1];
    bandId = band.id;
    low = band.low;
    high = band.high;
    bandAgeLabel = band.maxAge >= 120 ? `${band.minAge}+` : `${band.minAge}–${band.maxAge}`;
  } else {
    bandId = qe.noDependants.id;
    low = qe.noDependants.low;
    high = qe.noDependants.high;
    bandAgeLabel = "any age";
  }

  const verdict: QuickVerdict = inp.hasDependants && inp.income > 0 ? "UNDERINSURED" : "NEEDS_DETAIL";
  const lowAmt = inp.income * low;
  const highAmt = inp.income * high;

  let reason;
  if (inp.income <= 0) {
    reason = step("With no income entered there's nothing to multiply yet. Add your family's costs and goals in step 2 to see what they would need.");
  } else if (inp.hasDependants) {
    reason = step(`For someone aged ${bandAgeLabel} with people depending on them, a sensible starting range is {lo} to {hi} times annual income.`, { lo: q(low, "number"), hi: q(high, "number") });
  } else {
    reason = step("With no one depending on your income, the need is usually small: {lo} to {hi} times income, mostly to clear loans and final costs.", { lo: q(low, "number"), hi: q(high, "number") });
  }

  const explain = makeExplain({
    id: "quick",
    title: "Your first estimate",
    result: q(`${lowAmt}–${highAmt}`, "text"),
    summary: reason,
    steps: [
      step("Low: {inc} × {lo} = {lowAmt}", { inc: q(inp.income, "inrExact"), lo: q(low, "multiple"), lowAmt: q(lowAmt, "inrExact") }),
      step("High: {inc} × {hi} = {highAmt}", { inc: q(inp.income, "inrExact"), hi: q(high, "multiple"), highAmt: q(highAmt, "inrExact") }),
    ],
    inputs: [
      input("Your age", q(inp.age, "years"), "you", "Stage 1"),
      input("Annual income", q(inp.income, "inrExact"), "you", "Stage 1"),
      input("Anyone depends on your income", q(inp.hasDependants ? "Yes" : "No", "text"), "you", "Stage 1"),
      input("Starting range for your age band", q(`${low}× to ${high}×`, "text"), "config", bandId),
    ],
    traceIds: ["FR-1.1", bandId],
    source: { configVersion: c.configVersion, note: "Income multiples are placeholders, to be confirmed by a finance reviewer." },
  });

  return {
    ok: true,
    value: { low: lowAmt, high: highAmt, lowMultiple: low, highMultiple: high, bandId, bandAgeLabel, verdict, reason, explain, configVersion: c.configVersion },
  };
}
