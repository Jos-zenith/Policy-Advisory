/**
 * Advisor handoff snapshot (FR-7.4). Built once at booking time from the same
 * pure engine; stored encrypted and never changed. Contains no contact details.
 */
import type { Analysis } from "./analysis";
import { changedAssumptions } from "./assumptions";
import { buildQuestions, describeResult, evaluateComprehension, type ComprehensionResult } from "./comprehension";
import { renderStep, step, q } from "./explain";
import { inr } from "./format";
import type { RulesOutcome } from "./rules";
import type { Assumptions, EngineConfig, Profile } from "./types";

export interface ExistingPolicyLite {
  name: string;
  category: string;
  deathSumAssured: number;
  annualPremium: number;
  policyTerm: number;
  policyYear: number;
}

export interface HandoffSnapshot {
  configVersion: string;
  builtAt: string;
  needs: { components: { label: string; amount: number }[]; gross: number };
  offsets: { key: string; label: string; amount: number }[];
  gap: number;
  state: "GAP" | "COVERED";
  hlv: { value: number; status: string };
  cap: { amount: number; multiple: number; exceeded: boolean };
  income: { used: number; basis: string; volatile: boolean };
  assumptions: Assumptions;
  changedFromDefaults: { id: string; from: number | string; to: number | string }[];
  resultLevel: string;
  choice: {
    productId: string | null;
    productName: string | null;
    category: string | null;
    cover: number | null;
    term: number | null;
    frequency: string | null;
    rider: boolean;
    annualPremium: number | null;
    shareOfIncome: number | null;
    rateLine: string | null;
    exactCell: boolean | null;
    ruleState: string;
    fired: string[];
  };
  shownButLocked: string[];
  filteredOut: { name: string; reason: string }[];
  comprehension: (ComprehensionResult & { summary: string; topics: { id: string; topic: string }[] }) | null;
  existingPolicy: ExistingPolicyLite | null;
  flags: { id: string; text: string; ruleId: string }[];
}

export function buildHandoffSnapshot(args: {
  analysis: Analysis;
  rules: RulesOutcome;
  profile: Profile;
  assumptions: Assumptions;
  config: EngineConfig;
  productNames: Record<string, { name: string; category: string }>;
  comprehensionAnswers: Record<string, number[]>;
  existingPolicy: ExistingPolicyLite | null;
  resultLevel: string;
  now: string;
}): HandoffSnapshot {
  const { analysis: an, rules, assumptions: a, config: c } = args;
  const sel = rules.selection;
  const prod = sel ? args.productNames[sel.productId] : null;

  let comprehension: HandoffSnapshot["comprehension"] = null;
  if (sel && prod) {
    const qs = buildQuestions({ cover: sel.cover, category: prod.category as never }, c);
    const res = evaluateComprehension(qs, args.comprehensionAnswers);
    comprehension = { ...res, summary: describeResult(qs, res), topics: qs.map((x) => ({ id: x.id, topic: x.topic })) };
  }

  const flags: HandoffSnapshot["flags"] = [];
  const push = (id: string, s: ReturnType<typeof step>, ruleId: string) => flags.push({ id, text: renderStep(s), ruleId });
  if (an.flags.some((f) => f.id === "NEEDS_ABOVE_HLV")) push("NEEDS_ABOVE_HLV", step("Needs are above the income-based estimate. Not capped."), "FR-2.7");
  const emp = args.profile.existingCover.filter((x) => x.kind === "EMPLOYER").reduce((s, x) => s + x.deathSumAssured, 0);
  if (emp > 0) push("EMPLOYER_COVER", step("{emp} of cover is employer group cover; it may end with the job.", { emp: q(emp, "inr") }), "TC-04");
  const trad = args.existingPolicy ?? null;
  if (trad) push("TRADITIONAL_POLICY", step(`Holds ${trad.category === "WHOLE_LIFE" ? "a whole life policy" : "an endowment"} in year {y}. Bridge path suggests keeping it.`, { y: q(trad.policyYear, "number") }), "FR-6.1");
  else if (an.flags.some((f) => f.id === "TRADITIONAL_POLICY")) push("TRADITIONAL_POLICY", step("Holds a traditional savings policy. Bridge path suggests keeping it."), "FR-6.1");
  if (an.income.volatile) push("VOLATILE_INCOME", step("Income varies a lot between years; the lower of the average and the latest year was used."), "TC-06");
  if (comprehension?.needsFollowUp) push("COMPREHENSION_CORRECTED", step("Reality check needed a correction. Go over it on the call."), "FR-5.2");
  if (an.cap.exceeded) push("CAP_EXCEEDED", step("The gap of {gap} is above the estimated insurer limit of {cap}. Discuss phased or spousal cover.", { gap: q(an.recon.gap, "inr"), cap: q(an.cap.amount, "inr") }), "R6");
  if (rules.overBudget) push("OVER_BUDGET", step("The chosen premium is above the budget limit; the customer saw the fallback options."), "R5");

  return {
    configVersion: c.configVersion,
    builtAt: args.now,
    needs: { components: an.needs.components.map((x) => ({ label: x.label, amount: x.amount })), gross: an.needs.gross },
    offsets: an.recon.offsets.map((o) => ({ key: o.key, label: o.label, amount: o.amount })),
    gap: an.recon.gap,
    state: an.recon.state,
    hlv: { value: an.hlv.value, status: an.hlv.status },
    cap: { amount: an.cap.amount, multiple: an.cap.multiple, exceeded: an.cap.exceeded },
    income: { used: an.income.income, basis: an.income.basis, volatile: an.income.volatile },
    assumptions: a,
    changedFromDefaults: changedAssumptions(c.assumptionDefs, a).map((x) => ({ id: x.id, from: x.from, to: x.to })),
    resultLevel: args.resultLevel,
    choice: {
      productId: sel?.productId ?? null,
      productName: prod?.name ?? null,
      category: prod?.category ?? null,
      cover: sel?.cover ?? null,
      term: sel?.term ?? null,
      frequency: sel?.frequency ?? null,
      rider: sel?.rider ?? false,
      annualPremium: rules.quote?.annual ?? null,
      shareOfIncome: rules.shareOfIncome,
      rateLine: rules.quote?.rateLine ?? null,
      exactCell: rules.quote?.exact ?? null,
      ruleState: rules.state,
      fired: rules.fired,
    },
    shownButLocked: rules.cards.filter((x) => x.status === "LOCKED").map((x) => x.product.name),
    filteredOut: rules.notShown.map((n) => ({ name: n.product.name, reason: n.reasons.map((r) => r.message).join("; ") })),
    comprehension,
    existingPolicy: trad,
    flags,
  };
}

/** One-line summary used in the booking list. */
export function snapshotHeadline(s: HandoffSnapshot): string {
  return s.state === "GAP" ? `Gap ${inr(s.gap)}` : "Adequately covered";
}
