/**
 * Cases found by property tests, saved as golden tests (CLAUDE.md §17).
 */
import { describe, expect, it } from "vitest";
import { computeHlv, resolveIncome } from "@/engine";
import { A, C, blankProfile } from "../helpers";

describe("hlv horizon-cap discontinuity (fast-check seed 993857593, D-17)", () => {
  // age 18, retirement 59 → nWork 41 > A-MAX-HORIZON 40.
  const p = blankProfile({ age: 18, incomeHistory: [1], dependants: [] });
  const a = { ...A, inflation: 0, incomeGrowth: 0.001, retirementAge: 59, expenseShare: 0, lifeYears: 1 };
  const inc = resolveIncome(p, a, C);

  it("negative real rate: n is capped at 40", () => {
    const h = computeHlv(p, { ...a, discount: 0 }, C, inc);
    expect(h.realRate).toBeLessThan(0);
    expect(h.horizonCapped).toBe(true);
    expect(h.nUsed).toBe(40);
  });

  it("zero real rate: the guard no longer applies, so n = 41 and HLV is higher (documented, by spec)", () => {
    const capped = computeHlv(p, { ...a, discount: 0 }, C, inc);
    const uncapped = computeHlv(p, { ...a, discount: 0.001 }, C, inc);
    expect(uncapped.horizonCapped).toBe(false);
    expect(uncapped.nUsed).toBe(41);
    expect(uncapped.value).toBeGreaterThan(capped.value);
  });
});
