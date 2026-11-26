/** Golden fixture: persona Arjun (CLAUDE.md §8). Tolerance ±₹1. */
import { describe, expect, it } from "vitest";
import { afDue, analyse, inr, quickEstimate, realRate, sensitivity, renderStep } from "@/engine";
import { A, C, must, persona } from "../helpers";

const RUPEE = 1;
const close = (actual: number, expected: number, tol = RUPEE) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tol);

describe("Arjun golden fixture", () => {
  const p = persona("arjun");
  const an = must(analyse(p, A, C));

  it("quick estimate ₹2.7 Cr – ₹3.6 Cr, likely underinsured", () => {
    const qe = must(quickEstimate({ age: 34, income: 1_800_000, hasDependants: true }, C));
    expect(qe.low).toBe(27_000_000);
    expect(qe.high).toBe(36_000_000);
    expect(qe.lowMultiple).toBe(15);
    expect(qe.highMultiple).toBe(20);
    expect(qe.verdict).toBe("UNDERINSURED");
    expect(qe.bandId).toBe("B-AGE-02");
  });

  it("real rate for needs 0.943396% and AF_due(20) 18.32003", () => {
    const r = realRate(0.07, 0.06);
    expect(r * 100).toBeCloseTo(0.943396, 6);
    expect(afDue(r, 20)).toBeCloseTo(18.32003, 5);
  });

  it("family living costs ₹1,31,90,422.81", () => {
    const living = an.needs.components.find((x) => x.key === "LIVING")!;
    close(living.amount, 13_190_422.81, 0.01);
  });

  it("gross needs ₹2,96,90,422.81, offsets ₹58,00,000, gap ₹2,38,90,422.81", () => {
    close(an.needs.gross, 29_690_422.81, 0.01);
    close(an.recon.totalOffsets, 5_800_000, 0);
    close(an.recon.gap, 23_890_422.81, 0.01);
    expect(inr(an.recon.gap)).toBe("₹2.39 Cr");
    expect(an.recon.state).toBe("GAP");
  });

  it("HLV (n = 26) ₹2,74,80,306.24", () => {
    expect(an.hlv.nWork).toBe(26);
    close(an.hlv.value, 27_480_306.24, 0.01);
  });

  it("insurer cap 25× = ₹4,50,00,000, gap fits", () => {
    expect(an.cap.amount).toBe(45_000_000);
    expect(an.cap.multiple).toBe(25);
    expect(an.cap.exceeded).toBe(false);
  });

  it("offsets split: own ₹10 L, employer ₹36 L, savings ₹12 L (EPF not used)", () => {
    const by = Object.fromEntries(an.recon.offsets.map((o) => [o.key, o.amount]));
    expect(by).toEqual({ OWN: 1_000_000, EMPLOYER: 3_600_000, ASSETS: 1_200_000 });
    const epf = an.recon.allocations.find((x) => x.label === "EPF")!;
    expect(epf.allocated).toBe(0);
    expect(epf.note).toBe("RETIREMENT_DEFAULT");
  });

  it("flags: needs above HLV, employer cover, traditional policy", () => {
    const ids = an.flags.map((f) => f.id);
    expect(ids).toContain("NEEDS_ABOVE_HLV");
    expect(ids).toContain("EMPLOYER_COVER");
    expect(ids).toContain("TRADITIONAL_POLICY");
    expect(ids).not.toContain("CAP_EXCEEDED");
  });

  it("sensitivity rows match the fixture (₹ Cr to 4 decimals)", () => {
    const s = sensitivity(p, A, C)!;
    const row = (id: string) => s.rows.find((r) => r.id === id)!;
    const cr = (v: number | null) => Number(((v ?? NaN) / 1e7).toFixed(4));
    expect(cr(row("LIFE_YEARS").lower)).toBe(2.0821);
    expect(cr(row("LIFE_YEARS").higher)).toBe(2.6819);
    expect(cr(row("INFLATION").lower)).toBe(2.2808);
    expect(cr(row("INFLATION").higher)).toBe(2.51);
    expect(cr(row("EMPLOYER").higher)).toBe(2.749);
    expect(cr(row("SPOUSE_RETIREMENT").lower)).toBe(1.989);
  });

  it("runway: ₹1 Cr covers the home loan and about 7½ years", () => {
    const s = sensitivity(p, A, C)!;
    expect(s.runway!.amount).toBe(10_000_000);
    expect(renderStep(s.runway!.funded[0].label)).toBe("Home loan ₹45 L");
    expect(renderStep(s.runway!.funded[1].label)).toBe("About 7½ years of family costs");
    expect(renderStep(s.runway!.summary)).toBe(
      "Then the money runs out. Still unfunded: the last 12½ years of living costs, education (₹50 L), marriage goals (₹20 L), the health fund (₹10 L) and your spouse's retirement (₹40 L).",
    );
  });

  it("living-cost explain line is arithmetically consistent", () => {
    const living = an.needs.components.find((x) => x.key === "LIVING")!;
    const lines = living.explain.steps.map(renderStep);
    expect(lines[0]).toBe("Real rate = (1 + 7%) ÷ (1 + 6%) − 1 = 0.943%");
    expect(lines[2]).toMatch(/^₹7,20,000 × 18\.32\d* = ₹1,31,90,423$/);
    const m = lines[2].match(/× ([\d.]+) =/)!;
    expect(Math.round(720_000 * Number(m[1]))).toBe(13_190_423);
  });

  it("waterfall identity holds", () => {
    expect(Math.abs(an.recon.checkResidual)).toBeLessThan(1e-6);
  });
});
