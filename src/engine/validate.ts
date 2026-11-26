/**
 * Input validation (TC-12). Returns plain-language issues; never throws.
 * Shared by the UI (field messages) and the API (zod schemas wrap the same rules).
 */
import { realRate } from "./annuity";
import type { Assumptions, EngineConfig, Profile, ValidationIssue } from "./types";

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

export function validateAge(age: unknown, config: EngineConfig): ValidationIssue | null {
  const { minAge, maxAge } = config.rules.limits;
  if (!finite(age)) return { field: "age", code: "V-AGE-01", message: "Enter your age in years." };
  if (!Number.isInteger(age)) return { field: "age", code: "V-AGE-02", message: "Enter your age as a whole number." };
  if (age < minAge || age > maxAge) return { field: "age", code: "V-AGE-03", message: `This calculator works for ages ${minAge} to ${maxAge}.` };
  return null;
}

export function validateAmount(field: string, value: unknown, config: EngineConfig, label = "This amount"): ValidationIssue | null {
  if (!finite(value)) return { field, code: "V-AMT-01", message: `${label} must be a number.` };
  if (value < 0) return { field, code: "V-AMT-02", message: `${label} can't be negative.` };
  if (value > config.rules.limits.maxAmount) return { field, code: "V-AMT-03", message: `${label} looks too large. Please check it.` };
  return null;
}

export function validateAssumptions(a: Assumptions): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const checks: [keyof Assumptions, string][] = [
    ["inflation", "A-INFL"],
    ["discount", "A-DISC"],
    ["incomeGrowth", "A-GROWTH"],
  ];
  for (const [key, id] of checks) {
    const v = a[key];
    if (!finite(v)) issues.push({ field: key, code: "V-ASM-01", message: `${id} must be a number.` });
  }
  if (issues.length) return issues;
  if (realRate(a.discount, a.inflation) <= -1 || 1 + a.inflation <= 0 || 1 + a.discount <= 0) {
    issues.push({ field: "inflation", code: "V-RATE-01", message: "These rates give a real rate of −100% or less, which can't be calculated." });
  }
  if (realRate(a.discount, a.incomeGrowth) <= -1 || 1 + a.incomeGrowth <= 0) {
    issues.push({ field: "incomeGrowth", code: "V-RATE-02", message: "These rates give a real rate of −100% or less, which can't be calculated." });
  }
  if (!finite(a.lifeYears) || a.lifeYears < 0) issues.push({ field: "lifeYears", code: "V-ASM-02", message: "Years of family support can't be negative." });
  if (!finite(a.expenseShare) || a.expenseShare < 0 || a.expenseShare > 1) issues.push({ field: "expenseShare", code: "V-ASM-03", message: "Your own share of spending must be between 0% and 100%." });
  if (!finite(a.retirementAge) || a.retirementAge < 0) issues.push({ field: "retirementAge", code: "V-ASM-04", message: "Retirement age must be a positive number." });
  return issues;
}

export function validateProfile(p: Profile, a: Assumptions, config: EngineConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ageIssue = validateAge(p.age, config);
  if (ageIssue) issues.push(ageIssue);

  if (!Array.isArray(p.incomeHistory) || p.incomeHistory.length === 0) {
    issues.push({ field: "income", code: "V-INC-01", message: "Enter your annual income (0 is allowed)." });
  } else if (p.incomeHistory.length > config.rules.limits.maxIncomeYears) {
    issues.push({ field: "income", code: "V-INC-02", message: `Enter at most ${config.rules.limits.maxIncomeYears} years of income.` });
  } else {
    p.incomeHistory.forEach((v, i) => {
      const iss = validateAmount(`incomeHistory.${i}`, v, config, "Income");
      if (iss) issues.push(iss);
    });
  }
  p.loans.forEach((l, i) => {
    const iss = validateAmount(`loans.${i}`, l.outstanding, config, "A loan amount");
    if (iss) issues.push(iss);
  });
  p.goals.forEach((g, i) => {
    const iss = validateAmount(`goals.${i}`, g.amount, config, "A goal amount");
    if (iss) issues.push(iss);
  });
  if (p.familyCostsPerYear !== undefined) {
    const iss = validateAmount("familyCostsPerYear", p.familyCostsPerYear, config, "Family costs");
    if (iss) issues.push(iss);
  }
  if (p.householdContributionPerYear !== undefined) {
    const iss = validateAmount("householdContributionPerYear", p.householdContributionPerYear, config, "Household contribution");
    if (iss) issues.push(iss);
  }
  p.existingCover.forEach((c, i) => {
    const iss = validateAmount(`existingCover.${i}`, c.deathSumAssured, config, "Cover paid on death");
    if (iss) issues.push(iss);
  });
  p.assets.forEach((s, i) => {
    const iss = validateAmount(`assets.${i}`, s.value, config, "A savings amount");
    if (iss) issues.push(iss);
  });
  issues.push(...validateAssumptions(a));
  return issues;
}

/* ------------------------------------------------------------------ */
/* Existing cover entry (V-COVER-01, TC-13)                             */
/* ------------------------------------------------------------------ */

export type CoverAmountType = "DEATH" | "MATURITY" | "PREMIUM";

export const COVER_PROMPT = "We use the amount paid on death, not maturity value or premiums.";

/**
 * Existing cover accepts the death sum assured only. A maturity value or a
 * premium is rejected with the V-COVER-01 prompt; the caller logs it to the trail.
 */
export function acceptCoverEntry(entry: { amount: number; amountType: CoverAmountType }): { accepted: true } | { accepted: false; code: "V-COVER-01"; message: string } {
  if (entry.amountType !== "DEATH") return { accepted: false, code: "V-COVER-01", message: COVER_PROMPT };
  return { accepted: true };
}
