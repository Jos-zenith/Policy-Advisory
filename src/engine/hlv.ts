/**
 * Income resolution and Human Life Value (income-based estimate).
 *
 *   HLV = I × (1 − e) × AF_ord(r_real(d, g), nWork)      nWork = retirementAge − age
 *
 * Guards: nWork ≤ 0 → 0 with a message; income 0 → 0; homemaker without a
 * contribution value → "not applicable"; negative real rate → n capped at A-MAX-HORIZON.
 */
import { annuityFactor, guardedHorizon, realRate } from "./annuity";
import { input, makeExplain, q, step } from "./explain";
import type { Assumptions, EngineConfig, Explain, Flag, Profile } from "./types";

export type IncomeBasisUsed = "LATEST" | "LOWER_OF_AVERAGE_AND_LATEST" | "HOUSEHOLD_CONTRIBUTION" | "NONE";

export interface IncomeResolution {
  income: number;
  basis: IncomeBasisUsed;
  latest: number;
  average: number;
  years: number;
  volatile: boolean;
  ratio: number | null;
  explain: Explain;
}

/** incomeHistory is ordered oldest → latest; the last entry is this year. */
export function resolveIncome(p: Profile, a: Assumptions, c: EngineConfig): IncomeResolution {
  const hist = p.incomeHistory.length ? p.incomeHistory : [0];
  const latest = hist[hist.length - 1];
  const average = hist.reduce((s, v) => s + v, 0) / hist.length;
  const max = Math.max(...hist);
  const min = Math.min(...hist);
  const ratio = hist.length > 1 ? (min > 0 ? max / min : max > 0 ? Infinity : 1) : null;
  const volatile = ratio !== null && ratio > a.volRatio;

  let income = latest;
  let basis: IncomeBasisUsed = "LATEST";
  if (hist.length > 1) {
    income = Math.min(average, latest);
    basis = "LOWER_OF_AVERAGE_AND_LATEST";
  }
  const steps =
    basis === "LATEST"
      ? [step("We used this year's income: {inc}.", { inc: q(income, "inrExact") })]
      : [
          step("Average of {n} years = {avg}; latest year = {latest}.", { n: q(hist.length, "number"), avg: q(average, "inrExact"), latest: q(latest, "inrExact") }),
          step("We use the lower of the two: {inc}.", { inc: q(income, "inrExact") }),
        ];
  if (volatile) {
    steps.push(step("Your highest year is {ratio} your lowest, above the {limit} flag level, so an advisor will check this.", { ratio: q(ratio === Infinity ? "many times" : (ratio as number), ratio === Infinity ? "text" : "multiple", 1), limit: q(a.volRatio, "multiple", 1) }));
  }
  const explain = makeExplain({
    id: "income",
    title: "Income used",
    result: q(income, "inrExact"),
    steps,
    inputs: hist.map((v, i) => input(hist.length === 1 ? "Annual income" : `Income, year ${i + 1}`, q(v, "inrExact"), "you", "Stage 1")),
    assumptionIds: volatile ? ["A-VOL-RATIO"] : [],
    traceIds: hist.length > 1 ? ["TC-06"] : ["FR-1.1"],
    source: { configVersion: c.configVersion },
  });
  if (p.isHomemaker) {
    const contrib = p.householdContributionPerYear ?? 0;
    return { income: contrib, basis: contrib > 0 ? "HOUSEHOLD_CONTRIBUTION" : "NONE", latest, average, years: hist.length, volatile: false, ratio: null, explain };
  }
  return { income, basis, latest, average, years: hist.length, volatile, ratio, explain };
}

export type HlvStatus = "OK" | "RETIRED" | "ZERO_INCOME" | "NOT_APPLICABLE";

export interface HlvResult {
  value: number;
  status: HlvStatus;
  income: number;
  nWork: number;
  nUsed: number;
  realRate: number;
  factor: number;
  horizonCapped: boolean;
  explain: Explain;
  flags: Flag[];
}

export function computeHlv(p: Profile, a: Assumptions, c: EngineConfig, inc: IncomeResolution): HlvResult {
  const r = realRate(a.discount, a.incomeGrowth);
  const nWork = a.retirementAge - p.age;
  const { n, capped } = guardedHorizon(r, Math.max(0, nWork), a.maxHorizon);
  const flags: Flag[] = [];
  const homemaker = !!p.isHomemaker;
  const share = homemaker ? 0 : a.expenseShare;
  const I = inc.income;

  let status: HlvStatus = "OK";
  let value = 0;
  let factor = 0;
  if (homemaker && I <= 0) {
    status = "NOT_APPLICABLE";
    flags.push({ id: "HLV_NOT_APPLICABLE", severity: "info", traceId: "TC-05", message: step("The income-based estimate doesn't apply without earned income. Add the yearly value of your work at home to include it.") });
  } else if (nWork <= 0) {
    status = "RETIRED";
    flags.push({ id: "HLV_RETIRED", severity: "info", traceId: "FR-2.3", message: step("You're at or past the retirement age ({ret}), so the income-based estimate is ₹0. Your family's needs still count.", { ret: q(a.retirementAge, "years") }) });
  } else if (I <= 0) {
    status = "ZERO_INCOME";
    flags.push({ id: "HLV_ZERO_INCOME", severity: "info", traceId: "TC-11", message: step("With no income entered, the income-based estimate is ₹0. Your family's needs still count.") });
  } else {
    factor = annuityFactor(r, n, a.hlvTiming);
    value = I * (1 - share) * factor;
  }
  if (capped && status === "OK") {
    flags.push({ id: "NEGATIVE_REAL_RATE", severity: "warn", traceId: "FR-2.3", message: step("Income growth is above the return on savings, so the real rate is negative. We limit the horizon to {max} years.", { max: q(a.maxHorizon, "years") }) });
  }

  const steps =
    status === "OK"
      ? [
          step("Real rate = (1 + {d}) ÷ (1 + {g}) − 1 = {r}", { d: q(a.discount, "pct", 1), g: q(a.incomeGrowth, "pct", 1), r: q(r, "pct3") }),
          step("Factor (ordinary annuity, {n} years) = {af}", { n: q(n, "years"), af: q(factor, "factor", 4) }),
          homemaker
            ? step("{I} × {af} = {hlv}", { I: q(I, "inrExact"), af: q(factor, "factor", 4), hlv: q(value, "inrExact") })
            : step("{I} × (1 − {e}) × {af} = {hlv}", { I: q(I, "inrExact"), e: q(share, "pct", 0), af: q(factor, "factor", 4), hlv: q(value, "inrExact") }),
        ]
      : [flags[0].message];

  const explain = makeExplain({
    id: "hlv",
    title: "Income-based estimate",
    result: q(value, "inrExact"),
    summary: step("What your future earnings are worth in today's money, after your own spending, until age {ret}.", { ret: q(a.retirementAge, "years") }),
    steps,
    inputs: [
      input(homemaker ? "Household contribution a year" : "Income used", q(I, "inrExact"), "you", "Stage 1"),
      ...(homemaker ? [] : [input("Your own share of spending", q(a.expenseShare, "pct", 0), "assumption", "A-EXP-SHARE")]),
      input("Your income grows each year", q(a.incomeGrowth, "pct", 1), "assumption", "A-GROWTH"),
      input("Return on money set aside", q(a.discount, "pct", 1), "assumption", "A-DISC"),
      input("Years to retirement", q(Math.max(0, nWork), "years"), "derived", "A-RETAGE"),
      input("Timing", q("End of each year", "text"), "assumption", "A-HLV-TIMING"),
    ],
    assumptionIds: ["A-RETAGE"],
    traceIds: ["FR-2.3"],
    source: { configVersion: c.configVersion },
  });

  return { value, status, income: I, nWork, nUsed: n, realRate: r, factor, horizonCapped: capped, explain, flags };
}
