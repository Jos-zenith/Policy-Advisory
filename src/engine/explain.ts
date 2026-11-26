/**
 * Explain helpers (P2). Engine functions build Explain objects with
 * templates + typed values; the UI renders them via renderStep/renderQuantity.
 * No component ever writes a number into explanation text by hand.
 */
import type { Explain, ExplainInput, ExplainStep, Quantity, Unit } from "./types";
import { halfYears, inr, inrExact, inrPaise, num, pct } from "./format";

export const q = (value: number | string, unit: Unit, dp?: number): Quantity => (dp === undefined ? { value, unit } : { value, unit, dp });

export const step = (template: string, values: Record<string, Quantity> = {}): ExplainStep => ({ template, values });

export function renderQuantity(quantity: Quantity): string {
  const { value, unit, dp } = quantity;
  if (typeof value === "string") return value;
  switch (unit) {
    case "inr":
      return inr(value);
    case "inrExact":
      return inrExact(value);
    case "inrPaise":
      return inrPaise(value);
    case "pct":
      return pct(value, dp ?? 1);
    case "pct1":
      return pct(value, 1);
    case "pct3":
      return pct(value, 3);
    case "years":
      return Number.isInteger(value) ? String(value) : halfYears(value);
    case "factor":
      return num(value, dp ?? 2);
    case "factor2":
      return num(value, 2);
    case "multiple":
      return `${num(value, dp ?? 0)}×`;
    case "number":
      return Number.isInteger(value) ? String(value) : num(value, dp ?? 2);
    case "text":
    default:
      return String(value);
  }
}

/** Fill a template's {placeholders}. Unknown placeholders are left visible so they are caught in review. */
export function renderStep(s: ExplainStep): string {
  return s.template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const v = s.values[key];
    return v ? renderQuantity(v) : match;
  });
}

/** Split a template into text and value parts so the UI can style numbers. */
export function stepParts(s: ExplainStep): { text: string; isValue: boolean }[] {
  const parts: { text: string; isValue: boolean }[] = [];
  const re = /\{(\w+)\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s.template)) !== null) {
    if (m.index > last) parts.push({ text: s.template.slice(last, m.index), isValue: false });
    const v = s.values[m[1]];
    parts.push({ text: v ? renderQuantity(v) : m[0], isValue: true });
    last = m.index + m[0].length;
  }
  if (last < s.template.length) parts.push({ text: s.template.slice(last), isValue: false });
  return parts;
}

export function makeExplain(e: Omit<Explain, "assumptionIds"> & { assumptionIds?: string[] }): Explain {
  const fromInputs = e.inputs.filter((i) => i.source === "assumption" && i.ref).map((i) => i.ref as string);
  const ids = Array.from(new Set([...(e.assumptionIds ?? []), ...fromInputs]));
  return { ...e, assumptionIds: ids };
}

export const input = (label: string, quantity: Quantity, source: ExplainInput["source"], ref?: string): ExplainInput =>
  ref === undefined ? { label, q: quantity, source } : { label, q: quantity, source, ref };

/**
 * Choose the fewest decimals (2..8) for a factor so that
 * round(amount × roundedFactor) equals round(product). Keeps the line
 * "₹7,20,000 × 18.32… = ₹1,31,90,423" arithmetically consistent.
 */
export function consistentDecimals(amount: number, factor: number, minDp = 2, maxDp = 8): number {
  const target = Math.round(amount * factor);
  for (let dp = minDp; dp <= maxDp; dp++) {
    const f = Number(factor.toFixed(dp));
    if (Math.round(amount * f) === target) return dp;
  }
  return maxDp;
}
