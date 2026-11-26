/** Reveal-day adapters: mapping, validation report, monotonic and dims checks (CLAUDE.md §16). */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { adapt, checkMonotonic, formatReport, type Mapping } from "@/adapters/core";
import { CATALOG } from "@/data/catalog";
import { analyse, evaluateRules, type Product, type Profile, type RateTable } from "@/engine";
import { A, C } from "../helpers";

const load = (e: string) => JSON.parse(fs.readFileSync(path.join(process.cwd(), `src/adapters/mapping.${e}.json`), "utf8")) as Mapping;

describe("products adapter", () => {
  const rows = [
    { "Product Code": "P1", "Product Name": "Real Term", "Product Type": "Term Life", "Min Entry Age": "18", "Max Entry Age": "60", "Max Maturity Age": "75", "Min Term": "5", "Max Term": "40", "Min Sum Assured": "2500000", "Max Sum Assured": "200000000", Purpose: "Income replacement", "Rate Table": "RT-P1", "Marketing Blurb": "ignored" },
    { "Product Code": "P2", "Product Name": "Broken", "Product Type": "Annuity", "Min Entry Age": "18", "Max Entry Age": "60", "Max Maturity Age": "75", "Min Term": "5", "Max Term": "40", "Min Sum Assured": "1", "Max Sum Assured": "2", "Rate Table": "RT-P2" },
  ];
  const { output, report } = adapt(rows, load("products"));
  it("maps a valid row into the canonical schema", () => {
    expect(output).toHaveLength(1);
    expect(output[0]).toMatchObject({ id: "P1", category: "TERM", entryAge: [18, 60], cover: [2_500_000, 200_000_000], isSample: false, savingsShare: 0 });
  });
  it("reports unmapped columns, unmapped values and missing required fields", () => {
    expect(report.unmappedColumns).toContain("Marketing Blurb");
    expect(report.unmappedValues).toContainEqual({ path: "category", value: "Annuity" });
    expect(report.missingRequired.some((x) => x.path === "problemSolved")).toBe(true);
    expect(report.ok).toBe(false);
    expect(formatReport(report)).toMatch(/NEEDS ATTENTION/);
  });
});

describe("rates adapter", () => {
  const cell = (age: number, band: string, rate: number) => ({ "Product Code": "P1", Age: String(age), Gender: "Male", Smoker: "No", "Policy Term": "20", "SA Band": band, "Rate per 1000": String(rate) });
  it("groups rows into tables with the declared dims", () => {
    const { output, report } = adapt([cell(30, "B-LT1CR", 1.2), cell(30, "B-1CR", 1.0)], load("rates"));
    expect(report.dimMismatch).toEqual([]);
    expect(report.nonMonotonic).toEqual([]);
    expect((output as RateTable[])[0]).toMatchObject({ id: "RT-P1", productId: "P1", dims: ["age", "sex", "smoker", "term", "coverBand"] });
    expect((output as RateTable[])[0].cells[0].key).toEqual({ age: 30, sex: "M", smoker: "N", term: 20, coverBand: "B-LT1CR" });
  });
  it("flags non-monotonic premiums (premium falls as cover rises)", () => {
    // ₹1 Cr × 0.2/1000 = ₹2,000 < ₹25 L × 1.2/1000 = ₹3,000
    const { report } = adapt([cell(30, "B-LT1CR", 1.2), cell(30, "B-1CR", 0.2)], load("rates"));
    expect(report.nonMonotonic).toHaveLength(1);
    expect(report.ok).toBe(false);
  });
  it("flags tables whose cells differ from the declared dims", () => {
    const m = { ...load("rates"), rates: { ...load("rates").rates!, dims: ["age", "sex", "smoker", "term", "coverBand", "frequency"] } };
    const { report } = adapt([cell(30, "B-1CR", 1.0)], m);
    expect(report.dimMismatch).toHaveLength(1);
  });
  it("the sample tables already pass the same checks", () => {
    for (const t of CATALOG.rateTables) expect(checkMonotonic(t)).toEqual([]);
  });
});

describe("profiles adapter feeds the engine unchanged", () => {
  const rows = [{ "Profile ID": "R-1", Age: "34", Gender: "Male", Smoker: "No", "Income Y1": "1800000", "Home Loan": "4500000", "Other Loans": "", "Family Expenses": "720000", "Education Goal": "5000000", "Own Life Cover": "1000000", "Employer Cover": "3600000", "Liquid Savings": "", Employment: "Salaried" }];
  const { output, report } = adapt(rows, load("profiles"));
  it("prunes unused columns and validates", () => {
    expect(report.ok).toBe(true);
    const p = output[0] as Profile;
    expect(p.loans).toEqual([{ label: "Home loan", outstanding: 4_500_000 }]);
    expect(p.goals).toEqual([{ kind: "EDUCATION", amount: 5_000_000 }]);
    expect(p.incomeHistory).toEqual([1_800_000]);
    expect(p.assets).toEqual([]);
  });
  it("runs through analyse and rules", () => {
    const p = output[0] as Profile;
    const an = analyse(p, A, C);
    expect(an.ok).toBe(true);
    if (an.ok) expect(evaluateRules(an.value, p, A, C, CATALOG).state).toBe("R1");
  });
});

describe("advisors adapter", () => {
  it("splits lists and normalises dates", () => {
    const { output, report } = adapt([{ "Advisor ID": "A1", Name: "Test Advisor", Languages: "English; Hindi", Specialities: "Protection", "Licence No": "L-1", "Licence Valid To": "2027-06-30" }], load("advisors"));
    expect(report.ok).toBe(true);
    expect(output[0]).toMatchObject({ languages: ["English", "Hindi"], specialities: ["Protection"], licenceValidTo: "2027-06-30" });
  });
});

void ({} as Product);
