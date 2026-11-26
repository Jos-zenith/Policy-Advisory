/** Property tests for the needs engine (CLAUDE.md §17). Failing cases are saved as golden tests. */
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { analyse, computeHlv, resolveIncome } from "@/engine";
import { A, C } from "../helpers";
import { assumptionsArb, profileArb, RUNS } from "./arbitraries";

const ok = <T,>(r: { ok: boolean; value?: T }) => (r.ok ? (r as { value: T }).value : null);

describe("needs engine properties", () => {
  it("P-recon: gap = Σ needs − Σ offsets (waterfall identity)", () => {
    fc.assert(
      fc.property(profileArb, assumptionsArb, (p, a) => {
        const an = ok(analyse(p, a, C));
        if (!an) return true;
        const needs = an.needs.components.reduce((s, x) => s + x.amount, 0);
        const offs = an.recon.offsets.reduce((s, x) => s + x.amount, 0);
        return Math.abs(needs - offs - an.recon.gap) <= 1e-6 * Math.max(1, needs) && Math.abs(an.recon.checkResidual) <= 1e-6 * Math.max(1, needs);
      }),
      RUNS,
    );
  });

  it("more existing cover never raises the gap", () => {
    fc.assert(
      fc.property(profileArb, fc.integer({ min: 0, max: 50_000_000 }), fc.constantFrom<"OWN" | "EMPLOYER">("OWN", "EMPLOYER"), (p, extra, kind) => {
        const before = ok(analyse(p, A, C));
        if (!before) return true;
        const more = { ...p, existingCover: [...p.existingCover, { kind, label: "Extra", deathSumAssured: extra }] };
        const after = ok(analyse(more, A, C))!;
        return after.recon.gap <= before.recon.gap + 1e-6;
      }),
      RUNS,
    );
  });

  it("more liability never lowers gross needs", () => {
    fc.assert(
      fc.property(profileArb, fc.integer({ min: 0, max: 50_000_000 }), (p, extra) => {
        const before = ok(analyse(p, A, C));
        if (!before) return true;
        const after = ok(analyse({ ...p, loans: [...p.loans, { label: "New loan", outstanding: extra }] }, A, C))!;
        return after.needs.gross >= before.needs.gross - 1e-6;
      }),
      RUNS,
    );
  });

  it("determinism: same inputs and config → identical output", () => {
    fc.assert(
      fc.property(profileArb, assumptionsArb, (p, a) => {
        const x = analyse(structuredClone(p), { ...a }, C);
        const y = analyse(structuredClone(p), { ...a }, C);
        return JSON.stringify(x) === JSON.stringify(y);
      }),
      { numRuns: 150 },
    );
  });

  it("allocation never exceeds asset value, and each asset is used at most once", () => {
    fc.assert(
      fc.property(profileArb, (p) => {
        const an = ok(analyse(p, A, C));
        if (!an) return true;
        if (an.recon.allocations.length !== p.assets.length) return false;
        return an.recon.allocations.every((x) => x.allocated >= 0 && x.allocated <= Math.max(0, x.value) + 1e-9 && Math.abs(x.allocated + x.unused - x.value) < 1e-6);
      }),
      RUNS,
    );
  });

  it("allocated savings never exceed the need they fund", () => {
    fc.assert(
      fc.property(profileArb, (p) => {
        const an = ok(analyse(p, A, C));
        if (!an) return true;
        for (const comp of an.needs.components) {
          const used = an.recon.allocations.filter((x) => x.target === comp.key).reduce((s, x) => s + x.allocated, 0);
          if (used > comp.amount + 1e-6) return false;
        }
        return true;
      }),
      RUNS,
    );
  });

  // The A-MAX-HORIZON guard caps n only while the real rate is negative (CLAUDE.md §8), which makes
  // HLV jump at r = 0 when working years exceed the cap. The property is therefore checked within a
  // regime (the cap does not change between the two runs); the crossing itself is pinned by the
  // golden test "hlv horizon-cap discontinuity" (DECISIONS D-17).
  it("a higher real discount rate never raises HLV (within one horizon-cap regime)", () => {
    fc.assert(
      fc.property(profileArb, assumptionsArb, fc.integer({ min: 1, max: 50 }).map((x) => x / 1000), (p, a, bump) => {
        if (!ok(analyse(p, a, C))) return true;
        const inc = resolveIncome(p, a, C);
        const lo = computeHlv(p, a, C, inc);
        const hi = computeHlv(p, { ...a, discount: a.discount + bump }, C, inc);
        if (lo.horizonCapped !== hi.horizonCapped) return true;
        return hi.value <= lo.value + 1e-6;
      }),
      RUNS,
    );
  });

  it("analysis never mutates its inputs", () => {
    fc.assert(
      fc.property(profileArb, assumptionsArb, (p, a) => {
        const pc = structuredClone(p);
        const ac = structuredClone(a);
        analyse(p, a, C);
        expect(p).toEqual(pc);
        expect(a).toEqual(ac);
        return true;
      }),
      { numRuns: 100 },
    );
  });
});
