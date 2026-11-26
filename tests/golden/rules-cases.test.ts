/** Golden cases for premiums, eligibility and rules (CLAUDE.md §9, §17). */
import { describe, expect, it } from "vitest";
import { analyse, evaluateRules, lookupRate, priceProduct, renderStep, surrenderProfile, earlyYearsRange, inr, type RateTable } from "@/engine";
import { CATALOG } from "@/data/catalog";
import { A, C, must, persona } from "../helpers";

const run = (id: string, sel?: Parameters<typeof evaluateRules>[5]) => {
  const p = persona(id);
  const an = must(analyse(p, A, C));
  return { p, an, out: evaluateRules(an, p, A, C, CATALOG, sel) };
};
const product = (id: string) => CATALOG.products.find((p) => p.id === id)!;
const table = (id: string) => CATALOG.rateTables.find((t) => t.id === id)!;

describe("Arjun: R1 term first, ₹25,920 at ₹2.4 Cr for 25 years", () => {
  const { out } = run("arjun");
  it("recommends TermSecure Plus at ₹2.4 Cr, 25 years, from an exact cell", () => {
    expect(out.state).toBe("R1");
    expect(out.recommendedId).toBe("PR-TS-PLUS");
    expect(out.selection).toMatchObject({ cover: 24_000_000, term: 25, frequency: "YEARLY", rider: false });
    expect(out.quote!.annual).toBeCloseTo(25_920, 6);
    expect(out.quote!.exact).toBe(true);
    expect(out.shareOfIncome! * 100).toBeCloseTo(1.44, 6);
    expect(out.quote!.rateLine).toBe("age 34 · male · non-smoker · term 25 · cover ₹1 Cr and above · ₹1.08 per ₹1,000 · table RT-TS-01 · exact cell");
    expect(out.overBudget).toBe(false);
    expect(out.coversGapPct!).toBeGreaterThan(1);
  });
  it("locks whole life (no lifelong need), endowment and ULIP (gap open)", () => {
    const by = Object.fromEntries(out.cards.map((c) => [c.product.id, c]));
    expect(by["PR-LL-ASSURE"].status).toBe("LOCKED");
    expect(by["PR-LL-ASSURE"].ruleId).toBe("R2");
    expect(by["PR-SS-20"].status).toBe("LOCKED");
    expect(by["PR-GW-LINK"].status).toBe("LOCKED");
    expect(renderStep(by["PR-LL-ASSURE"].unlock!)).toContain("₹2.4 Cr of whole life cover would cost about ₹2,95,000 a year (16% of income)");
  });
  it("lists SmartTerm Young (age) and Elite Term Max (min cover) as not shown, nearest TermSecure Plus", () => {
    const ns = Object.fromEntries(out.notShown.map((n) => [n.product.id, n]));
    expect(ns["PR-ST-YOUNG"].reasons[0]).toEqual({ code: "E-AGE", message: "entry age up to 30, you are 34" });
    expect(ns["PR-ELITE-MAX"].reasons[0]).toEqual({ code: "E-COVER", message: "minimum cover ₹5 Cr" });
    expect(ns["PR-ST-YOUNG"].nearest?.id).toBe("PR-TS-PLUS");
    expect(out.notShown).toHaveLength(2);
  });
  it("writes the trail events of wireframe 07", () => {
    expect(out.trail.map((t) => t.event)).toEqual(["rule.recommend", "rule.lock", "eligibility.reject"]);
    expect(out.trail[0].detail.summary).toBe("Gap > 0 → term first: TermSecure Plus");
  });
  it("monthly payment and rider change the premium as configured", () => {
    const m = run("arjun", { frequency: "MONTHLY", rider: false }).out.quote!;
    expect(m.instalment).toBeCloseTo(25_920 * 0.0875, 6);
    expect(m.annual).toBeCloseTo(25_920 * 1.05, 6);
    const r = run("arjun", { frequency: "YEARLY", rider: true }).out.quote!;
    expect(r.annual).toBeCloseTo(25_920 + 0.4 * 24_000, 6);
  });
});

describe("TC-08 premium over the affordability cap (R5)", () => {
  const { out } = run("farhan");
  it("flags over budget and offers the ladder in order", () => {
    expect(out.state).toBe("R1");
    expect(out.overBudget).toBe(true);
    expect(out.fired).toContain("R5");
    expect(out.ladder!.map((l) => l.id)).toEqual(["LOWER_COVER", "CHANGE_TERM", "DROP_RIDER", "ADVISOR"]);
    const lower = out.ladder![0];
    expect(lower.available).toBe(true);
    expect(lower.premium!).toBeLessThanOrEqual(out.budget);
    expect(lower.cover!).toBeLessThan(out.selection!.cover);
  });
});

describe("TC-09 ineligible by age", () => {
  const { out } = run("gopal");
  it("no term product is open at 63; every product is excluded with a reason", () => {
    expect(out.state).toBe("NO_ELIGIBLE_TERM");
    expect(out.recommendedId).toBeNull();
    expect(out.cards.filter((c) => c.product.category === "TERM").every((c) => c.status === "INELIGIBLE")).toBe(true);
    expect(out.notShown.find((n) => n.product.id === "PR-TS-PLUS")!.reasons[0]).toEqual({ code: "E-AGE", message: "entry age up to 60, you are 63" });
  });
});

describe("R4 adequately covered", () => {
  const { out, an } = run("suresh");
  it("pushes nothing", () => {
    expect(an.recon.state).toBe("COVERED");
    expect(out.state).toBe("R4");
    expect(out.recommendedId).toBeNull();
    expect(out.cards.some((c) => c.status === "RECOMMENDED")).toBe(false);
  });
});

describe("R6 need above the insurer cap (TC-10)", () => {
  const { out, an } = run("neha");
  it("routes to an advisor and limits the suggested cover to the cap, visibly", () => {
    expect(out.fired).toContain("R6");
    expect(out.capRoute).toEqual({ cap: 20_000_000, gap: an.recon.gap });
    expect(out.coverLimitedByCap).toBe(true);
    expect(out.selection!.cover).toBe(20_000_000);
    expect(an.recon.gap).toBeGreaterThan(30_000_000); // need itself not capped
  });
});

describe("rate lookup", () => {
  const t = table("RT-TS-01");
  it("exact cell", () => {
    const r = lookupRate(t, { age: 34, sex: "M", smoker: "N", term: 25, coverBand: "B-1CR" });
    expect(r).toMatchObject({ ok: true, ratePer1000: 1.08, exact: true });
  });
  it("inside the grid without an exact cell → nearest (ties to the higher value), flagged", () => {
    const r = lookupRate(t, { age: 34, sex: "M", smoker: "N", term: 22.5, coverBand: "B-1CR" });
    expect(r.ok && r.exact).toBe(false);
    expect(r.ok && r.cell.term).toBe(25);
    expect(r.ok && r.notes[0]).toBe("term 22.5 not in table: nearest 25 used");
  });
  it("outside the grid → not priced, never extrapolated", () => {
    const r = lookupRate(t, { age: 61, sex: "M", smoker: "N", term: 10, coverBand: "B-1CR" });
    expect(r).toMatchObject({ ok: false, code: "E-GRID" });
  });
  it("unknown sex uses the higher rate", () => {
    const r = lookupRate(t, { age: 34, sex: undefined, smoker: "N", term: 25, coverBand: "B-1CR" });
    expect(r.ok && r.ratePer1000).toBe(1.08);
    expect(r.ok && r.exact).toBe(false);
  });
  it("band boundary rule: ₹99 L never costs more than ₹1 Cr", () => {
    const p = product("PR-TS-PLUS");
    const q99 = priceProduct(p, t, { age: 34, sex: "M", smoker: false, term: 25, cover: 9_900_000, frequency: "YEARLY", rider: false }, C);
    const q100 = priceProduct(p, t, { age: 34, sex: "M", smoker: false, term: 25, cover: 10_000_000, frequency: "YEARLY", rider: false }, C);
    expect(q99.ok && q100.ok && q99.annual <= q100.annual).toBe(true);
    expect(q99.ok && q99.bandRuleApplied).toBe(true);
  });
  it("a table with a different declared dim is not priced", () => {
    const bad: RateTable = { ...t, dims: [...t.dims, "region"] };
    const r = lookupRate(bad, { age: 34, sex: "M", smoker: "N", term: 25, coverBand: "B-1CR", region: "N" });
    expect(r.ok).toBe(false);
  });
});

describe("surrender (illustrative)", () => {
  it("endowment card rows for ₹1,00,000 a year match wireframe 04", () => {
    const s = surrenderProfile(product("PR-SS-20"), C, "SSV-PLACEHOLDER", 100_000, 20);
    if (s.kind !== "SCHEDULE") throw new Error("expected schedule");
    const pick = (y: number) => s.rows.find((r) => r.year === y)!;
    expect([1, 2, 3, 5, 7].map((y) => [pick(y).paid, Math.round(pick(y).back), Math.round(pick(y).pct * 100)])).toEqual([
      [100_000, 15_000, 15],
      [200_000, 60_000, 30],
      [300_000, 105_000, 35],
      [500_000, 250_000, 50],
      [700_000, 350_000, 50],
    ]);
    expect(pick(1).basis).toBe("SPECIAL");
    expect(pick(2).basis).toBe("GUARANTEED");
  });
  it("ULIP has lock-in wording only; term says low surrender risk", () => {
    expect(surrenderProfile(product("PR-GW-LINK"), C, "SSV-PLACEHOLDER", 100_000).kind).toBe("ULIP");
    expect(renderStep(surrenderProfile(product("PR-TS-PLUS"), C, "SSV-PLACEHOLDER", 0).line)).toContain("surrender risk is low");
  });
  it("early-years copy range is derived from the schedule", () => {
    expect(earlyYearsRange(C)).toEqual({ from: 2, to: 7, minPct: 0.3, maxPct: 0.5 });
    expect(inr(1)).toBe("₹1");
  });
});
