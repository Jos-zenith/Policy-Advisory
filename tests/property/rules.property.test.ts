/** Property tests for rules, eligibility and premiums (CLAUDE.md §17). */
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { analyse, checkEligibility, evaluateRules, priceProduct, type Frequency } from "@/engine";
import { CATALOG } from "@/data/catalog";
import { A, C } from "../helpers";
import { profileArb } from "./arbitraries";

const RUNS = { numRuns: 250 };
const selArb = fc.record({
  cover: fc.option(fc.integer({ min: 0, max: 60 }).map((x) => x * 1_000_000), { nil: undefined }),
  term: fc.option(fc.constantFrom(10, 15, 20, 25, 30, 35, 40), { nil: undefined }),
  frequency: fc.constantFrom<Frequency>("YEARLY", "MONTHLY"),
  rider: fc.boolean(),
});

describe("rule engine properties", () => {
  it("P4: no endowment, ULIP or whole life is recommended while the gap is open; endowment and ULIP stay locked", () => {
    fc.assert(
      fc.property(profileArb, selArb, (p, sel) => {
        const r = analyse(p, A, C);
        if (!r.ok) return true;
        const out = evaluateRules(r.value, p, A, C, CATALOG, sel);
        if (r.value.recon.gap <= 0) return true;
        for (const card of out.cards) {
          if (card.product.category !== "TERM" && card.status === "RECOMMENDED") return false;
          if ((card.product.category === "ENDOWMENT" || card.product.category === "ULIP") && card.status !== "LOCKED" && card.status !== "INELIGIBLE") return false;
        }
        if (out.recommendedId) {
          const rec = CATALOG.products.find((x) => x.id === out.recommendedId)!;
          if (rec.category !== "TERM") return false;
        }
        return true;
      }),
      RUNS,
    );
  });

  it("ineligible products are never recommended", () => {
    fc.assert(
      fc.property(profileArb, (p) => {
        const r = analyse(p, A, C);
        if (!r.ok) return true;
        const out = evaluateRules(r.value, p, A, C, CATALOG);
        if (!out.recommendedId || !out.selection) return true;
        const prod = CATALOG.products.find((x) => x.id === out.recommendedId)!;
        const table = CATALOG.rateTables.find((t) => t.id === prod.rateTableId);
        return checkEligibility(prod, table, { age: p.age, term: out.selection.term }).eligible && out.notShown.every((n) => n.product.id !== out.recommendedId);
      }),
      RUNS,
    );
  });

  it("sliders never mutate base inputs", () => {
    fc.assert(
      fc.property(profileArb, selArb, (p, sel) => {
        const r = analyse(p, A, C);
        if (!r.ok) return true;
        const pBefore = structuredClone(p);
        const anBefore = JSON.stringify(r.value);
        evaluateRules(r.value, p, A, C, CATALOG, sel);
        expect(p).toEqual(pBefore);
        return JSON.stringify(r.value) === anBefore;
      }),
      { numRuns: 120 },
    );
  });

  it("premium never decreases as cover rises within one product (valid grid cells)", () => {
    const products = CATALOG.products.filter((x) => x.category === "TERM" || x.category === "WHOLE_LIFE");
    fc.assert(
      fc.property(
        fc.constantFrom(...products),
        fc.integer({ min: 18, max: 60 }),
        fc.constantFrom<"M" | "F">("M", "F"),
        fc.boolean(),
        fc.constantFrom(10, 15, 20, 25, 30, 35, 40),
        fc.integer({ min: 0, max: 400 }),
        fc.integer({ min: 1, max: 100 }),
        (prod, age, sex, smoker, term, coverStepIdx, delta) => {
          const t = CATALOG.rateTables.find((x) => x.id === prod.rateTableId)!;
          const c1 = prod.cover[0] + coverStepIdx * 500_000;
          const c2 = c1 + delta * 100_000;
          if (c2 > prod.cover[1]) return true;
          const tm = prod.coverToAge !== undefined ? prod.coverToAge - age : term;
          const q1 = priceProduct(prod, t, { age, sex, smoker, term: tm, cover: c1, frequency: "YEARLY", rider: false }, C);
          const q2 = priceProduct(prod, t, { age, sex, smoker, term: tm, cover: c2, frequency: "YEARLY", rider: false }, C);
          if (!q1.ok || !q2.ok) return true;
          return q2.annual >= q1.annual - 1e-9;
        },
      ),
      { numRuns: 600 },
    );
  });

  it("determinism of the rule engine", () => {
    fc.assert(
      fc.property(profileArb, selArb, (p, sel) => {
        const r = analyse(p, A, C);
        if (!r.ok) return true;
        return JSON.stringify(evaluateRules(r.value, p, A, C, CATALOG, sel)) === JSON.stringify(evaluateRules(r.value, structuredClone(p), A, C, CATALOG, { ...sel }));
      }),
      { numRuns: 80 },
    );
  });
});
