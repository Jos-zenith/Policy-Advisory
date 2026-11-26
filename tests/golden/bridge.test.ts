/** FR-6.1 bridge: Arjun's SureSave 16 (₹48,000 a year, year 4 of 16, death ₹10 L, maturity ₹10.4 L). */
import { describe, expect, it } from "vitest";
import { analyse, bridge, evaluateRules, priceProduct, renderStep } from "@/engine";
import { CATALOG } from "@/data/catalog";
import personasJson from "@/config/content/personas.json";
import { A, C, must, persona } from "../helpers";

const p = persona("arjun");
const an = must(analyse(p, A, C));
const rules = evaluateRules(an, p, A, C, CATALOG);
const prod = CATALOG.products.find((x) => x.id === rules.recommendedId)!;
const table = CATALOG.rateTables.find((t) => t.id === prod.rateTableId)!;
const priceTerm = (cover: number) => {
  const r = priceProduct(prod, table, { age: p.age, sex: p.sex, smoker: p.smoker, term: rules.selection!.term, cover, frequency: "YEARLY", rider: false }, C);
  return r.ok ? r.annual : null;
};
const ep = personasJson.personas.find((x) => x.id === "arjun")!.existingPolicy!;
const r = bridge(ep, { gap: an.recon.gap, income: an.income.income, affordCap: A.affordCap, coverStep: C.rules.coverStep, ssvScheduleId: A.ssvScheduleId, priceTerm }, C);

describe("bridge golden (wireframe 05 numbers)", () => {
  it("summary strip", () => {
    expect(r.valid).toBe(true);
    expect(r.paidSoFar).toBe(192_000);
    expect(r.surrenderToday).toBe(96_000);
    expect(r.surrenderPctToday).toBe(0.5);
    expect(r.lossToday).toBe(96_000);
    expect(r.stillToPay).toBe(576_000);
    expect(r.shareOfIncome! * 100).toBeCloseTo(2.6667, 3);
  });
  it("four options", () => {
    const by = Object.fromEntries(r.options.map((o) => [o.id, o]));
    expect(by.KEEP_ADD_TERM.yearlyOutlay).toBeCloseTo(73_920, 6);
    expect(by.KEEP_ADD_TERM.paidIfDie).toBe(25_000_000);
    expect(by.KEEP_ADD_TERM.moneyBack).toEqual({ amount: 1_040_000, when: "maturity", year: 16 });
    expect(by.STOP_BUY_TERM.termCover).toBe(25_000_000);
    expect(by.STOP_BUY_TERM.yearlyOutlay).toBeCloseTo(27_000, 6);
    expect(by.STOP_BUY_TERM.moneyBack.amount).toBe(96_000);
    expect(by.PAID_UP_BUY_TERM.termCover).toBe(25_000_000);
    expect(by.PAID_UP_BUY_TERM.paidIfDie).toBe(25_250_000);
    expect(by.PAID_UP_BUY_TERM.moneyBack.amount).toBe(260_000);
    expect(by.KEEP_NOTHING.yearlyOutlay).toBe(48_000);
    expect(by.KEEP_NOTHING.paidIfDie).toBe(1_000_000);
    expect(by.KEEP_NOTHING.closesGap).toBe(false);
  });
  it("suggests keeping it and adding term (R-BR1) and always warns", () => {
    expect(r.suggested).toBe("KEEP_ADD_TERM");
    expect(renderStep(r.warning)).toBe("Don't buy another savings plan to fix a protection gap. It costs more and covers far less.");
  });
  it("timeline milestones", () => {
    expect(r.timeline.map((t) => t.label)).toEqual(["Year 1 · started", "Year 2", "Year 4 · you are here", "Year 10", "Years 15 to 16", "Year 16 · maturity"]);
    expect(renderStep(r.timeline[2].note)).toBe("50% back: ₹96,000 of ₹1,92,000");
  });
  it("rejects impossible inputs instead of guessing", () => {
    const bad = bridge({ ...ep, policyYear: 16 }, { gap: 1, income: 1, affordCap: 0.06, coverStep: 1e6, ssvScheduleId: "SSV-PLACEHOLDER", priceTerm }, C);
    expect(bad.valid).toBe(false);
    expect(bad.errors[0]).toMatch(/before the last year/);
  });
});
