/**
 * Golden cases for the needs engine (CLAUDE.md §17). Config snapshot fixed at v2026.11-s1.
 * Expected values were computed independently from the §8 formulas, not from the engine.
 */
import { describe, expect, it } from "vitest";
import { acceptCoverEntry, analyse, quickEstimate, sensitivity, withoutEmployerCover, COVER_PROMPT } from "@/engine";
import { A, C, blankProfile, must, persona } from "../helpers";

const close = (a: number, e: number, tol = 0.01) => expect(Math.abs(a - e)).toBeLessThanOrEqual(tol);

describe("config snapshot", () => {
  it("is v2026.11-s1 with the §7 defaults", () => {
    expect(C.configVersion).toBe("v2026.11-s1");
    expect(A).toMatchObject({ inflation: 0.06, discount: 0.07, incomeGrowth: 0.05, retirementAge: 60, expenseShare: 0.25, lifeYears: 20, needsTiming: "due", hlvTiming: "ordinary", maxHorizon: 40, affordCap: 0.06, volRatio: 1.5 });
  });
});

describe("TC-01 single earner", () => {
  const p = blankProfile({ age: 35, incomeHistory: [1_000_000], loans: [{ label: "Home loan", outstanding: 2_000_000 }], familyCostsPerYear: 400_000 });
  const an = must(analyse(p, A, C));
  it("needs = loan + living costs; no offsets", () => {
    close(an.needs.components.find((x) => x.key === "LIVING")!.amount, 7_328_012.67);
    close(an.recon.gap, 9_328_012.67);
    expect(an.recon.offsets).toHaveLength(0);
  });
  it("HLV for 25 working years", () => {
    expect(an.hlv.nWork).toBe(25);
    close(an.hlv.value, 14_807_633.69);
  });
});

describe("TC-03 existing cover exceeds need", () => {
  const p = blankProfile({ loans: [{ label: "Loan", outstanding: 1_000_000 }], existingCover: [{ kind: "OWN", label: "Term plan", deathSumAssured: 5_000_000, productCategory: "TERM" }] });
  const an = must(analyse(p, A, C));
  it("gap is negative and the state is adequately covered", () => {
    expect(an.recon.gap).toBe(-4_000_000);
    expect(an.recon.state).toBe("COVERED");
  });
});

describe("TC-04 employer cover is a separate line", () => {
  const an = must(analyse(persona("arjun"), A, C));
  it("OWN and EMPLOYER are distinct offsets", () => {
    expect(an.recon.offsets.map((o) => o.key)).toEqual(["OWN", "EMPLOYER", "ASSETS"]);
    expect(an.recon.offsets.find((o) => o.key === "EMPLOYER")!.label).toBe("Employer cover");
    expect(an.flags.some((f) => f.id === "EMPLOYER_COVER")).toBe(true);
  });
});

describe("TC-05 homemaker", () => {
  const base = blankProfile({ age: 32, incomeHistory: [0], isHomemaker: true, familyCostsPerYear: 300_000 });
  it("HLV is not applicable without a contribution value", () => {
    const an = must(analyse(base, A, C));
    expect(an.hlv.status).toBe("NOT_APPLICABLE");
    expect(an.hlv.value).toBe(0);
    expect(an.recon.gap).toBeGreaterThan(0); // needs path still runs
  });
  it("uses the household contribution when given", () => {
    const an = must(analyse({ ...base, householdContributionPerYear: 300_000 }, A, C));
    expect(an.hlv.status).toBe("OK");
    close(an.hlv.value, 6_463_861.5);
  });
});

describe("TC-06 irregular income", () => {
  const an = must(analyse(persona("meena"), A, C));
  it("uses the lower of the 3-year average and the latest year, and flags volatility", () => {
    expect(an.income.average).toBeCloseTo(1_233_333.33, 1);
    expect(an.income.income).toBe(1_200_000);
    expect(an.income.basis).toBe("LOWER_OF_AVERAGE_AND_LATEST");
    expect(an.income.volatile).toBe(true);
    expect(an.flags.some((f) => f.id === "VOLATILE_INCOME")).toBe(true);
  });
});

describe("TC-07 no dependants", () => {
  it("quick estimate is 0–3× and neutral", () => {
    const qe = must(quickEstimate({ age: 27, income: 900_000, hasDependants: false }, C));
    expect([qe.low, qe.high]).toEqual([0, 2_700_000]);
    expect(qe.verdict).toBe("NEEDS_DETAIL");
  });
  it("Kavya's employer cover more than meets a minimal need", () => {
    const an = must(analyse(persona("kavya"), A, C));
    expect(an.recon.state).toBe("COVERED");
  });
});

describe("TC-10 need above insurer cap", () => {
  const an = must(analyse(persona("neha"), A, C));
  it("shows the full need next to the cap; never caps it", () => {
    close(an.needs.gross, 32_992_019.01);
    close(an.recon.gap, 32_992_019.01);
    expect(an.cap.amount).toBe(20_000_000);
    expect(an.cap.exceeded).toBe(true);
    expect(an.flags.some((f) => f.id === "CAP_EXCEEDED")).toBe(true);
  });
});

describe("TC-11 zero income", () => {
  const an = must(analyse(blankProfile({ incomeHistory: [0], familyCostsPerYear: 300_000 }), A, C));
  it("HLV is 0 with a message and the needs path still runs", () => {
    expect(an.hlv.value).toBe(0);
    expect(an.hlv.status).toBe("ZERO_INCOME");
    expect(an.recon.gap).toBeGreaterThan(0);
    expect(an.cap.amount).toBe(0);
  });
  it("quick estimate does not crash", () => {
    const qe = must(quickEstimate({ age: 30, income: 0, hasDependants: true }, C));
    expect(qe.verdict).toBe("NEEDS_DETAIL");
  });
});

describe("TC-12 invalid inputs", () => {
  it("rejects age, income and impossible rates with codes, never throws", () => {
    const r = analyse(persona("invalid"), A, C);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.map((e) => e.code).sort()).toEqual(["V-AGE-03", "V-AMT-02"]);
    const q1 = quickEstimate({ age: 34.5, income: 1_000_000, hasDependants: true }, C);
    expect(q1.ok ? [] : q1.errors.map((e) => e.code)).toEqual(["V-AGE-02"]);
    const q2 = quickEstimate({ age: Number.NaN, income: Number.NaN, hasDependants: true }, C);
    expect(q2.ok ? [] : q2.errors.map((e) => e.code)).toEqual(["V-AGE-01", "V-AMT-01"]);
    const r3 = analyse(blankProfile(), { ...A, discount: -1.5 }, C);
    expect(r3.ok ? [] : r3.errors.map((e) => e.code)).toContain("V-RATE-01");
  });
});

describe("TC-13 multiple policies; maturity value rejected", () => {
  const p = blankProfile({
    loans: [{ label: "Loan", outstanding: 9_000_000 }],
    existingCover: [
      { kind: "OWN", label: "Endowment", deathSumAssured: 1_000_000, productCategory: "ENDOWMENT" },
      { kind: "OWN", label: "Term plan", deathSumAssured: 1_500_000, productCategory: "TERM" },
    ],
  });
  it("sums own policies into one offset with both listed", () => {
    const an = must(analyse(p, A, C));
    const own = an.recon.offsets.find((o) => o.key === "OWN")!;
    expect(own.amount).toBe(2_500_000);
    expect(own.explain.steps).toHaveLength(2);
  });
  it("rejects a maturity value or premium with V-COVER-01", () => {
    expect(acceptCoverEntry({ amount: 1_040_000, amountType: "MATURITY" })).toEqual({ accepted: false, code: "V-COVER-01", message: COVER_PROMPT });
    expect(acceptCoverEntry({ amount: 48_000, amountType: "PREMIUM" })).toMatchObject({ accepted: false });
    expect(acceptCoverEntry({ amount: 1_000_000, amountType: "DEATH" })).toEqual({ accepted: true });
  });
});

describe("TC-14 asset allocation", () => {
  const p = blankProfile({
    goals: [{ kind: "EDUCATION", amount: 5_000_000 }],
    loans: [{ label: "Loan", outstanding: 300_000 }],
    assets: [
      { label: "MF", value: 6_000_000, kind: "LIQUID", allocatedTo: "EDUCATION" },
      { label: "FD", value: 500_000, kind: "LIQUID", allocatedTo: "LOANS" },
      { label: "Gold", value: 200_000, kind: "LIQUID", allocatedTo: "MARRIAGE" },
      { label: "PPF", value: 900_000, kind: "RETIREMENT", allocatedTo: null },
    ],
  });
  const an = must(analyse(p, A, C));
  const by = Object.fromEntries(an.recon.allocations.map((x) => [x.label, x]));
  it("never allocates above the asset value or the need", () => {
    expect(by.MF.allocated).toBe(5_000_000);
    expect(by.MF.note).toBe("TRIMMED");
    expect(by.FD.allocated).toBe(300_000);
    expect(by.Gold.note).toBe("NO_SUCH_NEED");
    expect(by.PPF.note).toBe("RETIREMENT_DEFAULT");
    expect(an.recon.offsets.find((o) => o.key === "ASSETS")!.amount).toBe(5_300_000);
    expect(an.recon.gap).toBe(0);
    expect(an.recon.state).toBe("COVERED");
  });
});

describe("TC-15 employer cover lost", () => {
  const p = persona("arjun");
  it("removing employer cover raises the gap by exactly that amount", () => {
    const base = must(analyse(p, A, C)).recon.gap;
    const lost = must(analyse(withoutEmployerCover(p), A, C)).recon.gap;
    close(lost - base, 3_600_000);
    const row = sensitivity(p, A, C)!.rows.find((r) => r.id === "EMPLOYER")!;
    close(row.higher!, lost);
    close(row.lower!, base);
  });
});

describe("guards", () => {
  it("negative real rate: computes, warns and caps n at A-MAX-HORIZON", () => {
    const an = must(analyse(blankProfile({ familyCostsPerYear: 100_000 }), { ...A, inflation: 0.1, discount: 0.02, lifeYears: 50 }, C));
    expect(an.needs.living!.yearsUsed).toBe(40);
    expect(an.flags.some((f) => f.id === "NEGATIVE_REAL_RATE")).toBe(true);
  });
  it("nWork ≤ 0 gives HLV 0 with a message", () => {
    const an = must(analyse(blankProfile({ age: 62, familyCostsPerYear: 100_000 }), A, C));
    expect(an.hlv.value).toBe(0);
    expect(an.hlv.status).toBe("RETIRED");
    expect(an.recon.gap).toBeGreaterThan(0);
  });
  it("zero real rate uses AF = n", () => {
    const an = must(analyse(blankProfile({ familyCostsPerYear: 100_000 }), { ...A, inflation: 0.07, discount: 0.07, needsTiming: "ordinary" }, C));
    close(an.needs.living!.amount, 2_000_000);
  });
});
