/**
 * Annuity primitives (CLAUDE.md §8). Full precision; no rounding here.
 *
 *   r_real(d, x) = (1 + d) / (1 + x) − 1
 *   AF_ord(r, n) = (1 − (1 + r)^−n) / r      if |r| > 1e-9, else n
 *   AF_due(r, n) = AF_ord(r, n) × (1 + r)
 */
import type { AnnuityTiming } from "./types";

export const ZERO_RATE_EPS = 1e-9;

/** Real rate from a nominal rate d and a growth/inflation rate x. */
export function realRate(d: number, x: number): number {
  return (1 + d) / (1 + x) - 1;
}

/** Present value of 1 a year for n years, paid at the end of each year. */
export function afOrdinary(r: number, n: number): number {
  if (n <= 0) return 0;
  if (Math.abs(r) <= ZERO_RATE_EPS) return n;
  return (1 - Math.pow(1 + r, -n)) / r;
}

/** Present value of 1 a year for n years, paid at the start of each year. */
export function afDue(r: number, n: number): number {
  return afOrdinary(r, n) * (1 + r);
}

export function annuityFactor(r: number, n: number, timing: AnnuityTiming): number {
  return timing === "due" ? afDue(r, n) : afOrdinary(r, n);
}

/**
 * Guard for negative real rates: compute, but cap the horizon at maxHorizon.
 * r ≤ −1 is rejected by validation before we get here.
 */
export function guardedHorizon(r: number, n: number, maxHorizon: number): { n: number; capped: boolean } {
  if (r < 0 && n > maxHorizon) return { n: maxHorizon, capped: true };
  return { n, capped: false };
}

/**
 * Inverse of the annuity factor: how many years of `perYear` does `amount` fund?
 * Solves amount = perYear × AF(r, n) for n. Returns Infinity if the amount funds a perpetuity.
 */
export function yearsFunded(amount: number, perYear: number, r: number, timing: AnnuityTiming): number {
  if (perYear <= 0) return Infinity;
  if (amount <= 0) return 0;
  const k = timing === "due" ? amount / (perYear * (1 + r)) : amount / perYear;
  if (Math.abs(r) <= ZERO_RATE_EPS) return k;
  const inner = 1 - k * r;
  if (inner <= 0) return Infinity;
  return -Math.log(inner) / Math.log(1 + r);
}
