/**
 * Display formatting. This is the ONLY place where numbers are rounded.
 * The engine keeps full floating-point precision; components call these
 * helpers (or the explain renderer, which calls them) at the last moment.
 *
 *   ≥ 1 crore  → "₹2.39 Cr"   (up to 2 decimals, trailing zeros dropped)
 *   ≥ 1 lakh   → "₹46 L"      (up to 1 decimal, trailing zeros dropped)
 *   otherwise  → "₹25,920"    (Indian grouping, whole rupees)
 *   exact      → "₹1,31,90,423" (Indian grouping, whole rupees)
 */

export const LAKH = 100_000;
export const CRORE = 10_000_000;
export const MINUS = "−"; // typographic minus used in the wireframes

const groupFmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** Round half away from zero to `dp` decimals without binary drift (1.005 → 1.01). */
export function roundTo(value: number, dp: number): number {
  if (!Number.isFinite(value)) return value;
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  const rounded = Number(Math.round(Number(`${abs}e${dp}`)) + `e-${dp}`);
  return sign * rounded;
}

function trimZeros(s: string): string {
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
}

/** Whole rupees with Indian digit grouping: 1,31,90,423 (no symbol). */
export function groupIndian(value: number): string {
  // Intl rounds half-even on some engines; normalise first.
  const r = roundTo(value, 0);
  return groupFmt.format(Object.is(r, -0) ? 0 : r);
}

/** ₹ with Indian grouping, whole rupees. Negative values get a typographic minus. */
export function inrExact(value: number): string {
  const r = roundTo(value, 0);
  if (r < 0) return `${MINUS}₹${groupIndian(-r)}`;
  return `₹${groupIndian(r)}`;
}

/** Exact rupees with paise, used only in golden-test style displays: ₹1,31,90,422.81 */
export function inrPaise(value: number): string {
  const r = roundTo(value, 2);
  const whole = Math.trunc(Math.abs(r));
  const paise = Math.round((Math.abs(r) - whole) * 100);
  const s = `₹${groupIndian(whole)}.${String(paise).padStart(2, "0")}`;
  return r < 0 ? `${MINUS}${s}` : s;
}

/** Compact rupees: ₹2.39 Cr / ₹46 L / ₹25,920. */
export function inr(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const neg = value < 0;
  const abs = Math.abs(value);
  let body: string;
  if (abs >= CRORE) {
    body = `₹${trimZeros(roundTo(abs / CRORE, 2).toFixed(2))} Cr`;
  } else if (abs >= LAKH) {
    const l = roundTo(abs / LAKH, 1);
    // 99.99 lakh rounds to 100 L: promote to crore so we never print "₹100 L".
    body = l >= 100 ? `₹${trimZeros(roundTo(abs / CRORE, 2).toFixed(2))} Cr` : `₹${trimZeros(l.toFixed(1))} L`;
  } else {
    body = `₹${groupIndian(abs)}`;
  }
  if (neg && body !== "₹0") return `${MINUS} ${body}`;
  return body;
}

/** Compact range: "₹2.7 Cr – ₹3.6 Cr". */
export function inrRange(low: number, high: number): string {
  return `${inr(low)} – ${inr(high)}`;
}

/** Percent from a fraction: pct(0.0144, 1) → "1.4%". Trailing zeros dropped unless keepZeros. */
export function pct(fraction: number, dp = 1, keepZeros = false): string {
  if (!Number.isFinite(fraction)) return "—";
  const s = roundTo(fraction * 100, dp).toFixed(dp);
  return `${keepZeros ? s : trimZeros(s)}%`;
}

/** Plain number with fixed decimals: num(18.320032, 2) → "18.32". */
export function num(value: number, dp = 2): string {
  if (!Number.isFinite(value)) return "—";
  return roundTo(value, dp).toFixed(dp);
}

/** Years, with halves shown as ½: years(7.5) → "7½", years(20) → "20". */
export function halfYears(value: number): string {
  const whole = Math.floor(value);
  const frac = value - whole;
  if (frac >= 0.5 - 1e-9) return whole === 0 ? "½" : `${whole}½`;
  return String(whole);
}

/** Round DOWN to the nearest half (used for "about 7½ years"). */
export function floorHalf(value: number): number {
  return Math.floor(value * 2 + 1e-9) / 2;
}

/** Income input helper: lakh string → rupees. "18" → 1800000, "18.5" → 1850000. */
export function lakhToRupees(input: string): number | null {
  const cleaned = input.replace(/[,\s₹]/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return roundTo(n * LAKH, 0);
}

/** "₹18,00,000 a year" style words for an amount, with lakh/crore hint. */
export function inrWords(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return inrExact(Math.max(0, value || 0));
  return `${inrExact(value)} (${inr(value)})`;
}
