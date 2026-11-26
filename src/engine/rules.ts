/**
 * Rule engine (CLAUDE.md §9). Evaluated in order; each fired rule is recorded.
 *
 *  R1  gap > 0                                   → recommend term first
 *  R2  gap > 0 ∧ (lifelong dependant ∨ estate) ∧ affordable → whole life as an add-on, never a substitute
 *  R3  term gap closed (gap ≤ 0) ∧ budget left    → endowment / ULIP as add-ons
 *  R4  gap ≤ 0                                   → "You appear adequately covered"; push nothing
 *  R5  premium > affordability cap               → lower cover → change term → drop riders → advisor
 *  R6  need > insurer cap                        → show both, route to advisor; need never capped
 *  E-* outside product limits                    → excluded with reason + nearest eligible
 *
 * P4: while gap > 0 no endowment, ULIP or whole life is ever the recommendation;
 * endowment and ULIP stay locked.
 */
import type { Analysis } from "./analysis";
import { q, renderStep, step } from "./explain";
import { checkEligibility, eligibilityLine, policyTermFor, validTerms, type EligibilityReason } from "./eligibility";
import { inr, pct } from "./format";
import { CATEGORY_LABELS } from "./labels";
import { priceProduct, type PremiumQuote } from "./premium";
import type { Assumptions, EngineConfig, ExplainStep, Frequency, Product, Profile, RateTable } from "./types";

export interface Catalog {
  products: Product[];
  rateTables: RateTable[];
}

export interface Selection {
  productId?: string;
  cover?: number;
  term?: number;
  frequency: Frequency;
  rider: boolean;
}

export type CardStatus = "RECOMMENDED" | "ELIGIBLE" | "OPTIONAL" | "ADDON" | "LOCKED" | "INELIGIBLE";

export interface ProductCard {
  product: Product;
  status: CardStatus;
  ruleId: string;
  reason?: ExplainStep;
  unlock?: ExplainStep;
  eligibility: { eligible: boolean; reasons: EligibilityReason[] };
  quote?: PremiumQuote;
  quoteError?: string;
}

export interface LadderStep {
  id: "LOWER_COVER" | "CHANGE_TERM" | "DROP_RIDER" | "ADVISOR";
  available: boolean;
  fits: boolean;
  cover?: number;
  term?: number;
  rider?: boolean;
  premium?: number;
  text: ExplainStep;
}

export interface TrailDraft {
  event: string;
  ruleId: string;
  detail: Record<string, unknown>;
}

export interface RulesOutcome {
  state: "R1" | "R4" | "NO_ELIGIBLE_TERM";
  gap: number;
  income: number;
  budget: number;
  fired: string[];
  recommendedId: string | null;
  selection: Required<Selection> | null;
  quote: PremiumQuote | null;
  shareOfIncome: number | null;
  overBudget: boolean;
  coversGapPct: number | null;
  ladder: LadderStep[] | null;
  capRoute: { cap: number; gap: number } | null;
  coverLimitedByCap: boolean;
  cards: ProductCard[];
  notShown: { product: Product; reasons: EligibilityReason[]; nearest: Product | null }[];
  trail: TrailDraft[];
  validTerms: number[];
  coverRange: [number, number] | null;
}

const tableFor = (cat: Catalog, p: Product) => cat.rateTables.find((t) => t.id === p.rateTableId);
const ceilStep = (v: number, s: number) => Math.ceil(v / s) * s;
const floorStep = (v: number, s: number) => Math.floor(v / s) * s;

function quote(p: Product, cat: Catalog, profile: Profile, c: EngineConfig, cover: number, term: number | undefined, frequency: Frequency, rider: boolean) {
  const t = tableFor(cat, p);
  if (!t) return { ok: false as const, code: "E-GRID" as const, reason: `No rate table ${p.rateTableId}` };
  return priceProduct(p, t, { age: profile.age, sex: profile.sex, smoker: profile.smoker, term: policyTermFor(p, profile.age, term), cover, frequency, rider }, c);
}

/** Default term: the longest grid term that ends by retirement (and maturity); else the shortest valid one. */
export function defaultTerm(p: Product, table: RateTable | undefined, age: number, a: Assumptions): number | undefined {
  const terms = validTerms(p, table, age);
  if (!terms.length) return undefined;
  const toRetire = terms.filter((t) => age + t <= a.retirementAge);
  return toRetire.length ? toRetire[toRetire.length - 1] : terms[0];
}

/** Default cover: the gap rounded up to the cover step, limited by the insurer cap (stated, not silent) and product range. */
export function defaultCover(p: Product, gap: number, cap: number, c: EngineConfig): { cover: number; limitedByCap: boolean } {
  const s = c.rules.coverStep;
  let cover = ceilStep(Math.max(gap, 0), s);
  let limitedByCap = false;
  if (cover > cap && cap > 0) {
    cover = Math.max(floorStep(cap, s), s);
    limitedByCap = true;
  }
  cover = Math.min(Math.max(cover, p.cover[0]), p.cover[1]);
  return { cover, limitedByCap };
}

export function evaluateRules(an: Analysis, profile: Profile, a: Assumptions, c: EngineConfig, cat: Catalog, sel?: Partial<Selection>): RulesOutcome {
  const gap = an.recon.gap;
  const income = an.income.income;
  const budget = a.affordCap * income;
  const fired: string[] = [];
  const trail: TrailDraft[] = [];
  const age = profile.age;
  const frequency: Frequency = sel?.frequency ?? "YEARLY";
  const rider = sel?.rider ?? false;

  const terms = cat.products.filter((p) => p.category === "TERM");
  const savings = cat.products.filter((p) => p.category !== "TERM");

  /* ---------- R1: choose the term product ---------- */
  let recommended: Product | null = null;
  let selection: Required<Selection> | null = null;
  let mainQuote: PremiumQuote | null = null;
  let coverLimitedByCap = false;

  // Cover we'd like to offer: the gap rounded up, limited (visibly) by the insurer cap.
  const s0 = c.rules.coverStep;
  const capLimited = gap > 0 && an.cap.amount > 0 && ceilStep(gap, s0) > an.cap.amount;
  const wanted = capLimited ? Math.max(floorStep(an.cap.amount, s0), s0) : ceilStep(Math.max(gap, 0), s0);
  const candidates: { p: Product; cover: number; term: number; quote: PremiumQuote; limited: boolean }[] = [];
  // Pass 1: term products that can offer the wanted cover. Pass 2 (only if none): products open to this
  // age and term, with cover moved into the product's range (shown to the customer, never silent).
  for (const pass of [1, 2] as const) {
    for (const p of terms) {
      const t = tableFor(cat, p);
      const term = defaultTerm(p, t, age, a);
      if (term === undefined) continue;
      const cover = pass === 1 ? wanted : Math.min(Math.max(wanted, p.cover[0]), p.cover[1]);
      if (!checkEligibility(p, t, { age, term, cover }).eligible) continue;
      const qt = quote(p, cat, profile, c, cover, term, "YEARLY", false);
      if (qt.ok) candidates.push({ p, cover, term, quote: qt, limited: capLimited });
    }
    if (candidates.length) break;
  }
  candidates.sort((x, y) => x.quote.annual - y.quote.annual || terms.indexOf(x.p) - terms.indexOf(y.p));

  let state: RulesOutcome["state"];
  if (gap > 0) {
    if (candidates.length) {
      state = "R1";
      fired.push("R1");
      const best = candidates[0];
      recommended = best.p;
      coverLimitedByCap = best.limited;
      trail.push({ event: "rule.recommend", ruleId: "R1", detail: { summary: `Gap > 0 → term first: ${best.p.name}`, productId: best.p.id } });
    } else {
      state = "NO_ELIGIBLE_TERM";
      trail.push({ event: "rule.recommend", ruleId: "E-AGE", detail: { summary: "Gap > 0 but no term product is open to you; routed to an advisor" } });
    }
  } else {
    state = "R4";
    fired.push("R4");
    trail.push({ event: "rule.recommend", ruleId: "R4", detail: { summary: "Gap ≤ 0 → you appear adequately covered; nothing pushed" } });
  }

  /* ---------- Selection (customer's sliders, validated against the chosen product) ---------- */
  const chosen = sel?.productId ? terms.find((p) => p.id === sel.productId) ?? recommended : recommended;
  let chosenTerms: number[] = [];
  let coverRange: [number, number] | null = null;
  if (chosen) {
    const t = tableFor(cat, chosen);
    chosenTerms = validTerms(chosen, t, age);
    const base = candidates.find((x) => x.p.id === chosen.id);
    const dCover = base?.cover ?? defaultCover(chosen, gap, an.cap.amount, c).cover;
    const dTerm = base?.term ?? defaultTerm(chosen, t, age, a);
    const cover = sel?.cover !== undefined ? Math.min(Math.max(sel.cover, chosen.cover[0]), chosen.cover[1]) : dCover;
    const term = sel?.term !== undefined && chosenTerms.includes(sel.term) ? sel.term : dTerm;
    coverRange = [Math.max(chosen.cover[0], c.rules.coverSliderMin), Math.min(chosen.cover[1], c.rules.coverSliderMax)];
    if (term !== undefined) {
      selection = { productId: chosen.id, cover, term, frequency, rider: rider && chosen.riders.length > 0 };
      const qt = quote(chosen, cat, profile, c, cover, term, frequency, selection.rider);
      if (qt.ok) mainQuote = qt;
    }
  }

  const shareOfIncome = mainQuote && income > 0 ? mainQuote.annual / income : null;
  const overBudget = !!mainQuote && (income <= 0 || mainQuote.annual > budget);
  const coversGapPct = selection && gap > 0 ? selection.cover / gap : null;

  /* ---------- R5: affordability ladder ---------- */
  let ladder: LadderStep[] | null = null;
  if (mainQuote && selection && chosen && overBudget) {
    fired.push("R5");
    ladder = [];
    const s = c.rules.coverSliderStep;
    // 1. Lower cover (same term, frequency and rider)
    let lowered: { cover: number; premium: number } | null = null;
    for (let cv = floorStep(selection.cover - s, s); cv >= chosen.cover[0]; cv -= s) {
      const qt = quote(chosen, cat, profile, c, cv, selection.term, frequency, selection.rider);
      if (qt.ok && qt.annual <= budget) {
        lowered = { cover: cv, premium: qt.annual };
        break;
      }
    }
    ladder.push(
      lowered
        ? { id: "LOWER_COVER", available: true, fits: true, cover: lowered.cover, premium: lowered.premium, text: step("Lower cover to {cover}: {prem} a year. It covers {pct} of your gap.", { cover: q(lowered.cover, "inr"), prem: q(lowered.premium, "inrExact"), pct: q(gap > 0 ? lowered.cover / gap : 1, "pct", 0) }) }
        : { id: "LOWER_COVER", available: false, fits: false, text: step("Lower cover: even the minimum cover of {min} is above your budget.", { min: q(chosen.cover[0], "inr") }) },
    );
    // 2. Change the term (cheapest valid term at the same cover)
    let bestTerm: { term: number; premium: number } | null = null;
    for (const t of chosenTerms) {
      if (t === selection.term) continue;
      const qt = quote(chosen, cat, profile, c, selection.cover, t, frequency, selection.rider);
      if (qt.ok && qt.annual < mainQuote.annual && (!bestTerm || qt.annual < bestTerm.premium)) bestTerm = { term: t, premium: qt.annual };
    }
    ladder.push(
      bestTerm
        ? { id: "CHANGE_TERM", available: true, fits: bestTerm.premium <= budget, term: bestTerm.term, premium: bestTerm.premium, text: step("Change the term to {t} years: {prem} a year. Cover ends at age {end}.", { t: q(bestTerm.term, "years"), prem: q(bestTerm.premium, "inrExact"), end: q(age + bestTerm.term, "years") }) }
        : { id: "CHANGE_TERM", available: false, fits: false, text: step("Change the term: no valid term is cheaper for you.") },
    );
    // 3. Drop riders
    if (selection.rider) {
      const qt = quote(chosen, cat, profile, c, selection.cover, selection.term, frequency, false);
      ladder.push(qt.ok ? { id: "DROP_RIDER", available: true, fits: qt.annual <= budget, rider: false, premium: qt.annual, text: step("Drop the accidental death rider: {prem} a year.", { prem: q(qt.annual, "inrExact") }) } : { id: "DROP_RIDER", available: false, fits: false, text: step("Drop riders: not available.") });
    } else {
      ladder.push({ id: "DROP_RIDER", available: false, fits: false, text: step("Drop riders: you haven't added any.") });
    }
    // 4. Advisor
    ladder.push({ id: "ADVISOR", available: true, fits: true, text: step("Talk to an advisor about phasing cover or a mix that fits your budget.") });
    trail.push({ event: "rule.afford", ruleId: "R5", detail: { summary: `Premium ${inr(mainQuote.annual)} above budget ${inr(budget)} (${pct(a.affordCap, 0)} of income); fallback ladder offered` } });
  }

  /* ---------- R6: insurer cap ---------- */
  let capRoute: RulesOutcome["capRoute"] = null;
  if (an.cap.exceeded) {
    fired.push("R6");
    capRoute = { cap: an.cap.amount, gap };
    trail.push({ event: "rule.cap", ruleId: "R6", detail: { summary: `Gap ${inr(gap)} above estimated insurer limit ${inr(an.cap.amount)}; need not capped; routed to advisor` } });
  }

  /* ---------- Cards ---------- */
  const cards: ProductCard[] = [];
  const notShown: RulesOutcome["notShown"] = [];
  const termCover = selection?.cover ?? ceilStep(Math.max(gap, 0), c.rules.coverStep);
  const lifelong = profile.dependants.some((d) => d.lifelong) || !!profile.estateNeed;
  const budgetLeft = budget - (gap > 0 ? mainQuote?.annual ?? 0 : 0);
  const locks: string[] = [];

  for (const p of cat.products) {
    const t = tableFor(cat, p);
    const isTerm = p.category === "TERM";
    const term = isTerm ? (p.id === selection?.productId ? selection.term : defaultTerm(p, t, age, a)) : p.category === "WHOLE_LIFE" ? undefined : defaultTerm(p, t, age, a);
    const cover = isTerm ? (p.id === selection?.productId ? selection.cover : Math.min(Math.max(termCover, 0), Number.MAX_SAFE_INTEGER)) : p.category === "WHOLE_LIFE" ? termCover : undefined;
    const elig = checkEligibility(p, t, { age, cover: isTerm || p.category === "WHOLE_LIFE" ? cover : undefined, term });
    if (!elig.eligible) {
      cards.push({ product: p, status: "INELIGIBLE", ruleId: elig.reasons[0].code, eligibility: elig, reason: step(`${p.name}: ${elig.reasons.map((r) => r.message).join("; ")}`) });
      continue;
    }
    if (isTerm) {
      const qt = cover !== undefined ? quote(p, cat, profile, c, cover, term, p.id === selection?.productId ? frequency : "YEARLY", p.id === selection?.productId ? selection!.rider : false) : null;
      const status: CardStatus = p.id === recommended?.id ? "RECOMMENDED" : gap > 0 ? "ELIGIBLE" : "OPTIONAL";
      cards.push({ product: p, status, ruleId: status === "RECOMMENDED" ? "R1" : gap > 0 ? "R1" : "R4", eligibility: elig, quote: qt && qt.ok ? qt : p.id === selection?.productId ? mainQuote ?? undefined : undefined, quoteError: qt && !qt.ok ? qt.reason : undefined });
      continue;
    }
    if (p.category === "WHOLE_LIFE") {
      const qt = quote(p, cat, profile, c, termCover > 0 ? termCover : p.cover[0], undefined, "YEARLY", false);
      const wlPrem = qt.ok ? qt.annual : Infinity;
      const affordable = gap > 0 ? (mainQuote?.annual ?? 0) + wlPrem <= budget : wlPrem <= budget;
      const priceStep = qt.ok ? step("Today, {cover} of whole life cover would cost about {prem} a year ({pct} of income).", { cover: q(termCover > 0 ? termCover : p.cover[0], "inr"), prem: q(Math.round(wlPrem / 1000) * 1000, "inrExact"), pct: q(income > 0 ? wlPrem / income : 0, "pct", 0) }) : step("Not priced for you.");
      if (gap > 0 && lifelong && affordable) {
        fired.push("R2");
        cards.push({ product: p, status: "ADDON", ruleId: "R2", eligibility: elig, quote: qt.ok ? qt : undefined, reason: step("Shown as an add-on for your lifelong need, not instead of term cover."), unlock: priceStep });
      } else if (gap <= 0 && budgetLeft > 0) {
        cards.push({ product: p, status: "ADDON", ruleId: "R3", eligibility: elig, quote: qt.ok ? qt : undefined, reason: step("Optional. Your family is already covered; this only fits a lifelong dependant or an estate plan."), unlock: priceStep });
      } else {
        locks.push(lifelong ? "Whole life (not affordable)" : "Whole life (no lifelong need)");
        cards.push({
          product: p,
          status: "LOCKED",
          ruleId: "R2",
          eligibility: elig,
          quote: qt.ok ? qt : undefined,
          reason: step(lifelong ? "Locked: the premium doesn't fit your budget alongside term cover." : "Locked: you haven't told us about a lifelong dependant or estate need."),
          unlock: step(`you tell us about a lifelong dependant or estate need and the premium fits your budget. ${renderStep(priceStep)}`),
        });
      }
      continue;
    }
    // ENDOWMENT / ULIP
    if (gap > 0) {
      locks.push(CATEGORY_LABELS[p.category].toLowerCase() === "ulip" ? "ULIP (gap open)" : `${CATEGORY_LABELS[p.category].toLowerCase()} (gap open)`);
      cards.push({ product: p, status: "LOCKED", ruleId: "R3", eligibility: elig, reason: step("Locked while your protection gap is open, so it can't replace term cover."), unlock: step("term cover closes your gap and you still have budget left over.") });
    } else if (budgetLeft > 0) {
      fired.push("R3");
      cards.push({ product: p, status: "ADDON", ruleId: "R3", eligibility: elig, reason: step("Optional. Your family is covered and you have {left} a year of budget left; savings plans are add-ons, not protection.", { left: q(budgetLeft, "inr") }) });
    } else {
      cards.push({ product: p, status: "LOCKED", ruleId: "R3", eligibility: elig, reason: step("Locked: no budget left over after protection."), unlock: step("you have budget left over after protection.") });
    }
  }
  if (locks.length) trail.push({ event: "rule.lock", ruleId: "R2, R3", detail: { summary: `${locks.join(", ")} locked` } });

  // Nearest eligible for each excluded product: same category first, then the recommended term product.
  const shownEligible = cards.filter((x) => x.status !== "INELIGIBLE");
  for (const card of cards.filter((x) => x.status === "INELIGIBLE")) {
    const same = shownEligible.find((x) => x.product.category === card.product.category && (x.status === "RECOMMENDED" || x.product.category !== "TERM")) ?? shownEligible.find((x) => x.product.category === card.product.category);
    const nearest = same?.product ?? recommended ?? null;
    notShown.push({ product: card.product, reasons: card.eligibility.reasons, nearest });
  }
  if (notShown.length) {
    trail.push({ event: "eligibility.reject", ruleId: Array.from(new Set(notShown.flatMap((n) => n.reasons.map((r) => r.code)))).join(", "), detail: { summary: notShown.map((n) => `${n.product.name}: ${n.reasons.map((r) => r.message).join("; ")}`).join(". ") } });
  }

  void savings;
  return {
    state,
    gap,
    income,
    budget,
    fired: Array.from(new Set(fired)),
    recommendedId: recommended?.id ?? null,
    selection,
    quote: mainQuote,
    shareOfIncome,
    overBudget,
    coversGapPct,
    ladder,
    capRoute,
    coverLimitedByCap,
    cards,
    notShown,
    trail,
    validTerms: chosenTerms,
    coverRange,
  };
}

export { eligibilityLine };
