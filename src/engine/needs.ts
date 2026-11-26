/**
 * Needs approach (CLAUDE.md §8).
 *
 *   Needs = loans
 *         + familyCostsPerYear × AF_due(r_real(d, i), lifeYears)
 *         + education + marriage + healthEmergency + spouseRetirement (+ other)
 */
import { annuityFactor, guardedHorizon, realRate } from "./annuity";
import { consistentDecimals, input, makeExplain, q, step } from "./explain";
import { GOAL_LABELS, GOAL_ORDER, type NeedKey } from "./labels";
import type { Assumptions, EngineConfig, Explain, Flag, Profile } from "./types";

export interface NeedComponent {
  key: NeedKey;
  label: string;
  amount: number;
  explain: Explain;
}

export interface LivingCosts {
  perYear: number;
  realRate: number;
  years: number;
  yearsUsed: number;
  factor: number;
  amount: number;
  horizonCapped: boolean;
}

export interface NeedsResult {
  components: NeedComponent[];
  living: LivingCosts | null;
  gross: number;
  explain: Explain;
  flags: Flag[];
}

export function loanLabel(p: Profile): string {
  const withAmount = p.loans.filter((l) => l.outstanding > 0);
  if (withAmount.length === 1) return withAmount[0].label || "Loan";
  return "Loans";
}

export function computeLiving(perYear: number, a: Assumptions): LivingCosts {
  const r = realRate(a.discount, a.inflation);
  const { n, capped } = guardedHorizon(r, Math.max(0, a.lifeYears), a.maxHorizon);
  const factor = annuityFactor(r, n, a.needsTiming);
  return { perYear, realRate: r, years: a.lifeYears, yearsUsed: n, factor, amount: perYear * factor, horizonCapped: capped };
}

export function computeNeeds(p: Profile, a: Assumptions, c: EngineConfig): NeedsResult {
  const components: NeedComponent[] = [];
  const flags: Flag[] = [];
  const src = { configVersion: c.configVersion };

  const loansTotal = p.loans.reduce((s, l) => s + l.outstanding, 0);
  if (loansTotal > 0) {
    components.push({
      key: "LOANS",
      label: loanLabel(p),
      amount: loansTotal,
      explain: makeExplain({
        id: "need.loans",
        title: loanLabel(p),
        result: q(loansTotal, "inrExact"),
        summary: step("Clears what you still owe, so your family isn't left with the repayments."),
        steps: p.loans.filter((l) => l.outstanding > 0).map((l) => step(`${l.label || "Loan"}: {amt}`, { amt: q(l.outstanding, "inrExact") })),
        inputs: p.loans.map((l) => input(`${l.label || "Loan"} outstanding`, q(l.outstanding, "inrExact"), "you", "Stage 2")),
        traceIds: ["FR-2.1"],
        source: src,
      }),
    });
  }

  let living: LivingCosts | null = null;
  if (p.familyCostsPerYear !== undefined && p.familyCostsPerYear > 0 && a.lifeYears > 0) {
    living = computeLiving(p.familyCostsPerYear, a);
    const dp = consistentDecimals(living.perYear, living.factor);
    const timingText = a.needsTiming === "due" ? "First year needed now" : "First year needed in a year";
    if (living.horizonCapped) {
      flags.push({ id: "NEGATIVE_REAL_RATE", severity: "warn", traceId: "FR-2.3", message: step("Prices are set to rise faster than savings grow, so the real rate is negative. We limit family support to {max} years.", { max: q(a.maxHorizon, "years") }) });
    }
    components.push({
      key: "LIVING",
      label: "Living costs",
      amount: living.amount,
      explain: makeExplain({
        id: "need.living",
        title: "Family living costs",
        result: q(living.amount, "inrExact"),
        summary: step("Keeps the household running for {n} years at today's prices, after taking out your own spending.", { n: q(living.yearsUsed, "years") }),
        steps: [
          step("Real rate = (1 + {d}) ÷ (1 + {i}) − 1 = {r}", { d: q(a.discount, "pct", 1), i: q(a.inflation, "pct", 1), r: q(living.realRate, "pct3") }),
          step(`Factor (annuity ${a.needsTiming === "due" ? "due" : "ordinary"}, {n} years) = {af}`, { n: q(living.yearsUsed, "years"), af: q(living.factor, "factor", dp) }),
          step("{c} × {af} = {amt}", { c: q(living.perYear, "inrExact"), af: q(living.factor, "factor", dp), amt: q(living.amount, "inrExact") }),
        ],
        inputs: [
          input("Family costs a year, without your spending", q(living.perYear, "inrExact"), "you", "Stage 2"),
          input("Years of support", q(a.lifeYears, "years"), "assumption", "A-LC-YEARS"),
          input("Prices rise each year", q(a.inflation, "pct", 1), "assumption", "A-INFL"),
          input("Return on money set aside", q(a.discount, "pct", 1), "assumption", "A-DISC"),
          input("Timing", q(timingText, "text"), "assumption", "A-TIMING"),
        ],
        traceIds: ["FR-2.1", "FR-2.2"],
        source: src,
      }),
    });
  }

  for (const kind of GOAL_ORDER) {
    const goals = p.goals.filter((g) => g.kind === kind && g.amount > 0);
    const amount = goals.reduce((s, g) => s + g.amount, 0);
    if (amount <= 0) continue;
    components.push({
      key: kind,
      label: GOAL_LABELS[kind],
      amount,
      explain: makeExplain({
        id: `need.${kind.toLowerCase()}`,
        title: GOAL_LABELS[kind],
        result: q(amount, "inrExact"),
        summary: step("A goal you told us about, in today's money."),
        steps: goals.map((g) => step(`${g.label || GOAL_LABELS[kind]}: {amt}`, { amt: q(g.amount, "inrExact") })),
        inputs: goals.map((g) => input(g.label || GOAL_LABELS[kind], q(g.amount, "inrExact"), "you", "Stage 2")),
        traceIds: ["FR-2.1"],
        source: src,
      }),
    });
  }

  const gross = components.reduce((s, x) => s + x.amount, 0);
  const explain = makeExplain({
    id: "need.total",
    title: "What your family needs",
    result: q(gross, "inrExact"),
    summary: step("What your family's costs and goals add up to. We use this one."),
    steps: [
      step(components.map((x) => `{${x.key}}`).join(" + ") + (components.length ? " = {total}" : "{total}"), {
        ...Object.fromEntries(components.map((x) => [x.key, q(x.amount, "inr")])),
        total: q(gross, "inrExact"),
      }),
    ],
    inputs: components.map((x) => input(x.label, q(x.amount, "inrExact"), "derived")),
    traceIds: ["FR-2.1"],
    source: src,
  });

  return { components, living, gross, explain, flags };
}
