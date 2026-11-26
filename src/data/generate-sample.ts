/**
 * Generates SAMPLE rate tables (src/data/canonical/rate-tables.json).
 * Formula-based and deterministic, so the sample grid is dense, monotonic in
 * age and term, and hits the golden reference cell exactly:
 *   RT-TS-01 · age 34 · M · non-smoker · term 25 · ₹1 Cr+ → ₹1.08 per ₹1,000.
 * Run: npm run gen:data
 */
import fs from "node:fs";
import path from "node:path";
import productsJson from "./canonical/products.json";
import type { CellKey, Product, RateTable } from "@/engine/types";

const products = productsJson.products as Product[];
const r2 = (x: number) => Math.round(x * 100) / 100;

type Cell = { key: CellKey; ratePer1000: number };

const TERM_BANDS = [
  { id: "B-LT1CR", min: 2_500_000, max: 9_999_999, label: "below ₹1 Cr" },
  { id: "B-1CR", min: 10_000_000, max: 250_000_000, label: "₹1 Cr and above" },
];

function termTable(p: Product, id: string, base: number, terms: number[], bands = TERM_BANDS, bandFactor: Record<string, number> = { "B-LT1CR": 1.15, "B-1CR": 1 }): RateTable {
  const cells: Cell[] = [];
  for (let age = p.entryAge[0]; age <= p.entryAge[1]; age++) {
    for (const term of terms) {
      if (age + term > p.maxMaturityAge) continue;
      for (const sex of ["M", "F"]) {
        for (const smoker of ["N", "Y"]) {
          for (const band of bands) {
            const rate = base * Math.pow(1.065, age - 34) * (1 + 0.025 * (term - 25)) * (sex === "F" ? 0.85 : 1) * (smoker === "Y" ? 1.8 : 1) * (bandFactor[band.id] ?? 1);
            cells.push({ key: { age, sex, smoker, term, coverBand: band.id }, ratePer1000: r2(rate) });
          }
        }
      }
    }
  }
  return { id, productId: p.id, version: "sample-2026.11", dims: ["age", "sex", "smoker", "term", "coverBand"], cells, coverBands: bands };
}

function wholeLifeTable(p: Product, id: string): RateTable {
  const bands = [
    { id: "B-LT1CR", min: 2_500_000, max: 9_999_999, label: "below ₹1 Cr" },
    { id: "B-1CR", min: 10_000_000, max: 50_000_000, label: "₹1 Cr and above" },
  ];
  const cells: Cell[] = [];
  for (let age = p.entryAge[0]; age <= p.entryAge[1]; age++) {
    for (const sex of ["M", "F"]) {
      for (const smoker of ["N", "Y"]) {
        for (const band of bands) {
          const rate = 12.29 * Math.pow(1.045, age - 34) * (sex === "F" ? 0.92 : 1) * (smoker === "Y" ? 1.35 : 1) * (band.id === "B-LT1CR" ? 1.05 : 1);
          cells.push({ key: { age, sex, smoker, coverBand: band.id }, ratePer1000: r2(rate) });
        }
      }
    }
  }
  return { id, productId: p.id, version: "sample-2026.11", dims: ["age", "sex", "smoker", "coverBand"], cells, coverBands: bands };
}

function savingsTable(p: Product, id: string, terms: number[], rate: (age: number, term: number) => number): RateTable {
  const cells: Cell[] = [];
  for (let age = p.entryAge[0]; age <= p.entryAge[1]; age++) {
    for (const term of terms) {
      if (age + term > p.maxMaturityAge) continue;
      cells.push({ key: { age, term }, ratePer1000: r2(rate(age, term)) });
    }
  }
  return { id, productId: p.id, version: "sample-2026.11", dims: ["age", "term"], cells };
}

const byId = (id: string) => products.find((p) => p.id === id)!;

const tables: RateTable[] = [
  termTable(byId("PR-TS-PLUS"), "RT-TS-01", 1.08, [10, 15, 20, 25, 30]),
  termTable(byId("PR-ST-YOUNG"), "RT-STY-01", 0.98, [10, 15, 20, 25, 30, 35, 40], [
    { id: "B-LT1CR", min: 2_500_000, max: 9_999_999, label: "below ₹1 Cr" },
    { id: "B-1CR", min: 10_000_000, max: 20_000_000, label: "₹1 Cr and above" },
  ]),
  termTable(byId("PR-ELITE-MAX"), "RT-ETM-01", 1.0, [10, 15, 20, 25, 30], [{ id: "B-5CR", min: 50_000_000, max: 250_000_000, label: "₹5 Cr and above" }], { "B-5CR": 1 }),
  wholeLifeTable(byId("PR-LL-ASSURE"), "RT-LLA-01"),
  savingsTable(byId("PR-SS-20"), "RT-SS20-01", [20], (age) => 50 + 0.15 * (age - 18)),
  savingsTable(byId("PR-GW-LINK"), "RT-GWL-01", [10, 15, 20, 25, 30], (age) => 100 + 0.2 * Math.max(0, age - 40)),
];

const out = { version: "sample-2026.11", isSample: true, note: "Generated sample rate tables (src/data/generate-sample.ts). Not real prices.", tables };
const file = path.join(process.cwd(), "src/data/canonical/rate-tables.json");
fs.writeFileSync(file, JSON.stringify(out) + "\n");
const ref = tables[0].cells.find((c) => c.key.age === 34 && c.key.sex === "M" && c.key.smoker === "N" && c.key.term === 25 && c.key.coverBand === "B-1CR");
console.log(`wrote ${tables.length} tables, ${tables.reduce((s, t) => s + t.cells.length, 0)} cells → ${path.relative(process.cwd(), file)}`);
console.log(`reference cell RT-TS-01 age 34 M N 25 B-1CR = ${ref?.ratePer1000}`);
