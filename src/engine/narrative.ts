/**
 * Plain-language sentences built from engine results (P2: numbers come from
 * data, not from components).
 */
import type { Analysis } from "./analysis";
import { q, step } from "./explain";
import { loanLabel } from "./needs";
import type { ExplainStep, Profile } from "./types";

function joinAnd(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** The paragraph under the big gap figure in Stage 2. */
export function gapParagraph(an: Analysis, p: Profile): ExplainStep {
  const keys = new Set(an.needs.components.map((c) => c.key));
  const cover = an.recon.offsets.filter((o) => o.key === "OWN" || o.key === "EMPLOYER").reduce((s, o) => s + o.amount, 0);
  const savings = an.recon.offsets.find((o) => o.key === "ASSETS")?.amount ?? 0;
  const values: Record<string, ReturnType<typeof q>> = { cover: q(cover, "inr"), sav: q(savings, "inr"), need: q(an.needs.gross, "inr"), surplus: q(-an.recon.gap, "inr") };

  if (an.recon.state === "COVERED") {
    return step(
      cover + savings > 0
        ? "The cover and savings you already have add up to at least the {need} your family needs. There's nothing you need to buy for now; check again if your loans, family or job change."
        : "Based on what you've told us, your family doesn't need extra life cover right now.",
      values,
    );
  }

  const doing: string[] = [];
  if (keys.has("LOANS")) {
    const l = loanLabel(p);
    doing.push(l === "Loans" ? "clear your loans" : `clear the ${l.toLowerCase()}`);
  }
  if (keys.has("LIVING") && an.needs.living) {
    doing.push("keep the household running for {years} years");
    values.years = q(an.needs.living.yearsUsed, "years");
  }
  const goalKeys = ["EDUCATION", "MARRIAGE", "HEALTH_EMERGENCY", "SPOUSE_RETIREMENT", "OTHER"].filter((k) => keys.has(k as never));
  if (goalKeys.length) {
    const first = goalKeys[0];
    const lead = first === "EDUCATION" ? "the children's education" : first === "MARRIAGE" ? "marriage goals" : first === "HEALTH_EMERGENCY" ? "a health and emergency fund" : first === "SPOUSE_RETIREMENT" ? "your spouse's retirement" : "your other goals";
    doing.push(`fund ${lead}${goalKeys.length > 1 ? " and other goals" : ""}`);
  }
  let text = doing.length ? `That would ${joinAnd(doing)}.` : "That is what your family's costs and goals add up to.";
  const counted: string[] = [];
  if (cover > 0) counted.push("the {cover} of cover you have");
  if (savings > 0) counted.push("the {sav} of savings you set aside");
  if (counted.length) text += ` It already counts ${joinAnd(counted)}.`;
  return step(text, values);
}

/** Short reason line for the verdict pill. */
export function verdictLabel(an: Analysis): { tone: "warn" | "green" | "blue"; text: string } {
  if (an.recon.state === "COVERED") return { tone: "green", text: "You appear adequately covered" };
  return { tone: "warn", text: "Likely underinsured" };
}
