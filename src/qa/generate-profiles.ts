/**
 * Seeded generator of ~200 profiles for the QA run (labelled "generated, not
 * the provided data"). Deterministic: same seed → same profiles. Includes a
 * small share of deliberately invalid inputs and edge cases.
 */
import type { GoalKind, Profile } from "@/engine/types";

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateProfiles(n = 200, seed = 20261126): Profile[] {
  const r = mulberry32(seed);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const between = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
  const lakh = (a: number, b: number) => between(a, b) * 100_000;
  const out: Profile[] = [];
  for (let i = 0; i < n; i++) {
    const kind = r();
    // ~4% deliberately invalid (age out of range or negative income)
    if (kind < 0.04) {
      out.push({ id: `G-${i + 1}`, age: pick([15, 16, 80, 90]), incomeHistory: [pick([-200_000, 500_000])], incomeBasis: "SALARIED", dependants: [], loans: [], goals: [], existingCover: [], assets: [] });
      continue;
    }
    const age = r() < 0.85 ? between(22, 55) : pick([18, 19, 20, 21, 56, 58, 60, 62, 65, 68, 72]);
    const selfEmployed = r() < 0.25;
    const homemaker = r() < 0.04;
    const base = homemaker ? 0 : r() < 0.03 ? 0 : lakh(3, 60);
    const incomeHistory = homemaker ? [0] : selfEmployed ? [Math.round(base * (0.6 + r() * 0.9)), Math.round(base * (0.6 + r() * 0.9)), base] : [base];
    const hasDeps = r() < 0.8;
    const dependants = hasDeps ? Array.from({ length: between(1, 4) }, () => ({ relation: pick(["Spouse", "Child", "Parent"]), lifelong: r() < 0.05 })) : [];
    const loans = r() < 0.55 ? [{ label: pick(["Home loan", "Car loan", "Business loan"]), outstanding: lakh(2, age < 45 ? 120 : 40) }] : [];
    const goalKinds: GoalKind[] = ["EDUCATION", "MARRIAGE", "HEALTH_EMERGENCY", "SPOUSE_RETIREMENT"];
    const goals = hasDeps ? goalKinds.filter(() => r() < 0.5).map((k) => ({ kind: k, amount: lakh(3, 60) })) : r() < 0.3 ? [{ kind: "HEALTH_EMERGENCY" as GoalKind, amount: lakh(2, 10) }] : [];
    const familyCostsPerYear = hasDeps ? Math.round((base || lakh(2, 8)) * (0.25 + r() * 0.35)) : undefined;
    const existingCover: Profile["existingCover"] = [];
    if (r() < 0.45) existingCover.push({ kind: "OWN", label: "Policy", deathSumAssured: lakh(5, 150), productCategory: pick(["TERM", "TERM", "ENDOWMENT", "WHOLE_LIFE"]) });
    if (!selfEmployed && r() < 0.5) existingCover.push({ kind: "EMPLOYER", label: "Group cover", deathSumAssured: Math.round(base * pick([1, 2, 3])) });
    const assets: Profile["assets"] = [];
    if (r() < 0.5) assets.push({ label: "Mutual funds", value: lakh(1, 40), kind: "LIQUID", allocatedTo: pick(["EDUCATION", "LOANS", "LIVING", null]) });
    if (r() < 0.4) assets.push({ label: "EPF", value: lakh(1, 50), kind: "RETIREMENT", allocatedTo: null });
    out.push({
      id: `G-${i + 1}`,
      age,
      sex: r() < 0.9 ? pick(["M", "F"]) : undefined,
      smoker: r() < 0.9 ? r() < 0.15 : undefined,
      incomeHistory,
      incomeBasis: selfEmployed ? "SELF_EMPLOYED" : "SALARIED",
      dependants,
      loans,
      goals,
      familyCostsPerYear,
      existingCover,
      assets,
      ...(homemaker ? { isHomemaker: true, householdContributionPerYear: r() < 0.5 ? lakh(1, 4) : undefined } : {}),
    });
  }
  return out;
}
