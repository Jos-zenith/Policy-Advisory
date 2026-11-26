/**
 * Stage 2 pipeline: income → needs → HLV → reconciliation → insurer cap → flags.
 * Pure and deterministic: same (profile, assumptions, config) → same output.
 */
import { input, makeExplain, q, step } from "./explain";
import { computeHlv, resolveIncome, type HlvResult, type IncomeResolution } from "./hlv";
import { computeNeeds, type NeedsResult } from "./needs";
import { reconcile, type Reconciliation } from "./reconcile";
import { validateProfile } from "./validate";
import type { Assumptions, EngineConfig, Explain, Flag, Profile, Result } from "./types";

export interface CapResult {
  multiple: number;
  bandId: string;
  amount: number;
  /** The new cover needed (the gap) compared with the cap. The need itself is never capped. */
  exceeded: boolean;
  explain: Explain;
}

export interface Analysis {
  configVersion: string;
  income: IncomeResolution;
  needs: NeedsResult;
  hlv: HlvResult;
  recon: Reconciliation;
  cap: CapResult;
  flags: Flag[];
}

export function insurerCap(age: number, income: number, gap: number, c: EngineConfig): CapResult {
  const band = c.bands.insurerCap.find((b) => age >= b.minAge && age <= b.maxAge) ?? c.bands.insurerCap[c.bands.insurerCap.length - 1];
  const amount = income * band.multiple;
  const ageText = band.maxAge >= 120 ? `${band.minAge} and over` : `${band.minAge} to ${band.maxAge}`;
  const exceeded = gap > amount;
  return {
    multiple: band.multiple,
    bandId: band.id,
    amount,
    exceeded,
    explain: makeExplain({
      id: "cap",
      title: "Estimated insurer limit",
      result: q(amount, "inrExact"),
      summary: exceeded
        ? step(`Estimated insurer limit: {cap} ({m} times income at ages ${ageText}). Your gap of {gap} is above it. We still show the full gap; an advisor can talk through phased or spousal cover.`, { cap: q(amount, "inr"), m: q(band.multiple, "number"), gap: q(gap, "inr") })
        : step(`Estimated insurer limit: {cap} ({m} times income at ages ${ageText}). Your gap fits within it.`, { cap: q(amount, "inr"), m: q(band.multiple, "number") }),
      steps: [step("{inc} × {m} = {cap}", { inc: q(income, "inrExact"), m: q(band.multiple, "multiple"), cap: q(amount, "inrExact") })],
      inputs: [input("Income used", q(income, "inrExact"), "you", "Stage 1"), input("Limit multiple for your age", q(band.multiple, "multiple"), "config", band.id)],
      traceIds: ["FR-2.6", exceeded ? "R6" : "FR-2.6"],
      source: { configVersion: c.configVersion, note: "Placeholder multiples, to be confirmed by a finance reviewer." },
    }),
  };
}

export function analyse(p: Profile, a: Assumptions, c: EngineConfig): Result<Analysis> {
  const errors = validateProfile(p, a, c);
  if (errors.length) return { ok: false, errors };

  const income = resolveIncome(p, a, c);
  const needs = computeNeeds(p, a, c);
  const hlv = computeHlv(p, a, c, income);
  const recon = reconcile(p, needs, c);
  const cap = insurerCap(p.age, income.income, recon.gap, c);

  const flags: Flag[] = [...needs.flags, ...hlv.flags, ...recon.flags];
  if (hlv.status === "OK" && needs.gross > hlv.value) {
    flags.push({ id: "NEEDS_ABOVE_HLV", severity: "info", traceId: "FR-2.7", message: step("Your family's needs are higher than the income-based estimate. We don't cut your need down to match; an advisor can talk through options.") });
  }
  const emp = p.existingCover.filter((x) => x.kind === "EMPLOYER").reduce((s, x) => s + x.deathSumAssured, 0);
  if (emp > 0) {
    flags.push({ id: "EMPLOYER_COVER", severity: "info", traceId: "TC-04", message: step("{emp} of cover is employer group cover; it may end with the job.", { emp: q(emp, "inr") }) });
  }
  const traditional = p.existingCover.filter((x) => x.kind === "OWN" && (x.productCategory === "ENDOWMENT" || x.productCategory === "WHOLE_LIFE"));
  if (traditional.length) {
    flags.push({ id: "TRADITIONAL_POLICY", severity: "info", traceId: "FR-6.1", message: step("Holds a traditional savings policy. The bridge suggests keeping it and adding term cover rather than stopping it early.") });
  }
  if (income.volatile) {
    flags.push({ id: "VOLATILE_INCOME", severity: "warn", traceId: "TC-06", message: step("Income varies a lot from year to year (highest year above {r} the lowest). We used the lower of the average and the latest year.", { r: q(a.volRatio, "multiple", 1) }) });
  }
  if (cap.exceeded) {
    flags.push({ id: "CAP_EXCEEDED", severity: "warn", traceId: "R6", message: step("The gap of {gap} is above the estimated insurer limit of {cap}. The need is not capped; an advisor can discuss phased or spousal cover.", { gap: q(recon.gap, "inr"), cap: q(cap.amount, "inr") }) });
  }
  // de-duplicate by id (e.g. negative real rate raised by both needs and HLV)
  const seen = new Set<string>();
  const unique = flags.filter((f) => (seen.has(f.id) ? false : (seen.add(f.id), true)));

  return { ok: true, value: { configVersion: c.configVersion, income, needs, hlv, recon, cap, flags: unique } };
}

/* ------------------------------------------------------------------ */
/* Result level badge (FR-9.1)                                          */
/* ------------------------------------------------------------------ */

export type ProvidedSection = "loans" | "familyCosts" | "goals" | "existingCover" | "assets" | "incomeHistory";
export type Provided = Partial<Record<ProvidedSection, boolean>>;

export interface ResultLevel {
  level: "BASIC" | "REFINED" | "DETAILED";
  skipped: { section: ProvidedSection; effect: "RAISES" | "LOWERS" | "NO_GAP_EFFECT"; text: string }[];
}

const SECTION_TEXT: Record<ProvidedSection, { label: string; effect: "RAISES" | "LOWERS" | "NO_GAP_EFFECT" }> = {
  loans: { label: "Loans", effect: "RAISES" },
  familyCosts: { label: "Family costs", effect: "RAISES" },
  goals: { label: "Goals", effect: "RAISES" },
  existingCover: { label: "Existing cover", effect: "LOWERS" },
  assets: { label: "Savings set aside", effect: "LOWERS" },
  incomeHistory: { label: "Income history", effect: "NO_GAP_EFFECT" },
};

export function resultLevel(provided: Provided): ResultLevel {
  const core: ProvidedSection[] = ["loans", "familyCosts", "goals", "existingCover", "assets"];
  const filled = core.filter((s) => provided[s]);
  const level = filled.length === 0 ? "BASIC" : filled.length === core.length ? "DETAILED" : "REFINED";
  const skipped = (Object.keys(SECTION_TEXT) as ProvidedSection[])
    .filter((s) => !provided[s])
    .map((s) => {
      const t = SECTION_TEXT[s];
      const text = t.effect === "RAISES" ? `${t.label} skipped: adding them can only raise the gap` : t.effect === "LOWERS" ? `${t.label} skipped: adding it can only lower the gap` : `${t.label} skipped: doesn't change the gap`;
      return { section: s, effect: t.effect, text };
    });
  return { level, skipped };
}
