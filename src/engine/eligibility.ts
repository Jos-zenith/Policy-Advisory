/**
 * Product eligibility (E-AGE / E-TERM / E-COVER). Never silently adjusts a request;
 * callers show the reason and the nearest eligible product.
 */
import { inr } from "./format";
import type { Product, RateTable } from "./types";

export type EligibilityCode = "E-AGE" | "E-TERM" | "E-COVER" | "E-GRID";

export interface EligibilityReason {
  code: EligibilityCode;
  message: string;
}

/** Whole-life products run to a fixed age; others use the chosen term. */
export function policyTermFor(product: Product, age: number, term?: number): number | undefined {
  if (product.coverToAge !== undefined) return product.coverToAge - age;
  return term;
}

/** Terms available in the rate grid for this product and age (within product limits and maturity age). */
export function validTerms(product: Product, table: RateTable | undefined, age: number): number[] {
  if (product.coverToAge !== undefined) {
    const t = product.coverToAge - age;
    return t >= product.term[0] && t <= product.term[1] ? [t] : [];
  }
  const grid = table && table.dims.includes("term") ? Array.from(new Set(table.cells.map((c) => c.key.term as number))).sort((a, b) => a - b) : range(product.term[0], product.term[1]);
  return grid.filter((t) => t >= product.term[0] && t <= product.term[1] && age + t <= product.maxMaturityAge);
}

function range(a: number, b: number): number[] {
  const out: number[] = [];
  for (let i = a; i <= b; i++) out.push(i);
  return out;
}

export function checkEligibility(product: Product, table: RateTable | undefined, req: { age: number; cover?: number; term?: number }): { eligible: boolean; reasons: EligibilityReason[] } {
  const reasons: EligibilityReason[] = [];
  const [minAge, maxAge] = product.entryAge;
  if (req.age < minAge) reasons.push({ code: "E-AGE", message: `entry age from ${minAge}, you are ${req.age}` });
  if (req.age > maxAge) reasons.push({ code: "E-AGE", message: `entry age up to ${maxAge}, you are ${req.age}` });

  if (!reasons.length) {
    const terms = validTerms(product, table, req.age);
    if (!terms.length) {
      reasons.push({ code: "E-TERM", message: `no policy term ends by age ${product.maxMaturityAge} for you` });
    } else if (req.term !== undefined && product.coverToAge === undefined) {
      if (req.term < product.term[0] || req.term > product.term[1]) reasons.push({ code: "E-TERM", message: `term ${product.term[0]} to ${product.term[1]} years` });
      else if (req.age + req.term > product.maxMaturityAge) reasons.push({ code: "E-TERM", message: `cover must end by age ${product.maxMaturityAge}; ${req.term} years takes you to ${req.age + req.term}` });
    }
  }
  if (req.cover !== undefined) {
    if (req.cover < product.cover[0]) reasons.push({ code: "E-COVER", message: `minimum cover ${inr(product.cover[0])}` });
    if (req.cover > product.cover[1]) reasons.push({ code: "E-COVER", message: `maximum cover ${inr(product.cover[1])}` });
  }
  return { eligible: reasons.length === 0, reasons };
}

/** Plain eligibility line for a card: "entry age 18 to 60, term 10 to 30 years, maturity by 65, cover ₹25 L to ₹10 Cr". */
export function eligibilityLine(product: Product): string {
  const term = product.coverToAge !== undefined ? `cover to age ${product.coverToAge}` : `term ${product.term[0]} to ${product.term[1]} years, maturity by ${product.maxMaturityAge}`;
  return `entry age ${product.entryAge[0]} to ${product.entryAge[1]}, ${term}, cover ${inr(product.cover[0])} to ${inr(product.cover[1])}`;
}
