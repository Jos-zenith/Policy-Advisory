import { describe, expect, it } from "vitest";
import { inr, inrExact, inrPaise, inrRange, pct, num, halfYears, floorHalf, lakhToRupees, roundTo, groupIndian, MINUS } from "@/engine/format";

describe("format.inr (compact)", () => {
  it("crore with up to 2 decimals", () => {
    expect(inr(23_890_422.81)).toBe("₹2.39 Cr");
    expect(inr(29_690_422.81)).toBe("₹2.97 Cr");
    expect(inr(27_000_000)).toBe("₹2.7 Cr");
    expect(inr(36_000_000)).toBe("₹3.6 Cr");
    expect(inr(45_000_000)).toBe("₹4.5 Cr");
    expect(inr(10_000_000)).toBe("₹1 Cr");
    expect(inr(13_190_422.81)).toBe("₹1.32 Cr");
  });
  it("lakh with up to 1 decimal", () => {
    expect(inr(4_600_000)).toBe("₹46 L");
    expect(inr(4_500_000)).toBe("₹45 L");
    expect(inr(1_040_000)).toBe("₹10.4 L");
    expect(inr(250_000)).toBe("₹2.5 L");
    expect(inr(100_000)).toBe("₹1 L");
  });
  it("promotes 99.99 L to crore", () => {
    expect(inr(9_999_999)).toBe("₹1 Cr");
  });
  it("below a lakh uses Indian grouping", () => {
    expect(inr(25_920)).toBe("₹25,920");
    expect(inr(96_000)).toBe("₹96,000");
    expect(inr(0)).toBe("₹0");
    expect(inr(999.6)).toBe("₹1,000");
  });
  it("negatives use a typographic minus", () => {
    expect(inr(-1_000_000)).toBe(`${MINUS} ₹10 L`);
    expect(inr(-0.2)).toBe("₹0");
  });
  it("non-finite shows a dash", () => {
    expect(inr(Number.NaN)).toBe("—");
  });
  it("range", () => {
    expect(inrRange(27_000_000, 36_000_000)).toBe("₹2.7 Cr – ₹3.6 Cr");
  });
});

describe("format.inrExact", () => {
  it("uses en-IN grouping and whole rupees", () => {
    expect(inrExact(13_190_422.81)).toBe("₹1,31,90,423");
    expect(inrExact(1_800_000)).toBe("₹18,00,000");
    expect(inrExact(25_920)).toBe("₹25,920");
    expect(inrExact(-5_800_000)).toBe(`${MINUS}₹58,00,000`);
    expect(groupIndian(123_456_789)).toBe("12,34,56,789");
  });
  it("paise", () => {
    expect(inrPaise(13_190_422.81)).toBe("₹1,31,90,422.81");
    expect(inrPaise(27_480_306.24)).toBe("₹2,74,80,306.24");
  });
});

describe("format misc", () => {
  it("pct", () => {
    expect(pct(0.0144, 1)).toBe("1.4%");
    expect(pct(0.06, 0)).toBe("6%");
    expect(pct(0.00943396, 3)).toBe("0.943%");
    expect(pct(0.05, 1, true)).toBe("5.0%");
  });
  it("num and roundTo avoid binary drift", () => {
    expect(num(18.3200317, 2)).toBe("18.32");
    expect(roundTo(1.005, 2)).toBe(1.01);
    expect(roundTo(-2.5, 0)).toBe(-3);
  });
  it("half years", () => {
    expect(floorHalf(7.88)).toBe(7.5);
    expect(floorHalf(8)).toBe(8);
    expect(halfYears(7.5)).toBe("7½");
    expect(halfYears(12.5)).toBe("12½");
    expect(halfYears(20)).toBe("20");
    expect(halfYears(0.5)).toBe("½");
  });
  it("lakh input", () => {
    expect(lakhToRupees("18")).toBe(1_800_000);
    expect(lakhToRupees("18.5")).toBe(1_850_000);
    expect(lakhToRupees("")).toBeNull();
    expect(lakhToRupees("abc")).toBeNull();
  });
});
