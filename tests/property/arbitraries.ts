import fc from "fast-check";
import type { Assumptions, GoalKind, Profile } from "@/engine";
import { A } from "../helpers";

const money = (max: number) => fc.integer({ min: 0, max });
const goalKind = fc.constantFrom<GoalKind>("EDUCATION", "MARRIAGE", "HEALTH_EMERGENCY", "SPOUSE_RETIREMENT", "OTHER");
const needKey = fc.constantFrom("LOANS", "LIVING", "EDUCATION", "MARRIAGE", "HEALTH_EMERGENCY", "SPOUSE_RETIREMENT", "OTHER", null);

export const profileArb: fc.Arbitrary<Profile> = fc.record({
  id: fc.constant("PB"),
  age: fc.integer({ min: 18, max: 75 }),
  sex: fc.constantFrom<"M" | "F">("M", "F"),
  smoker: fc.boolean(),
  incomeHistory: fc.array(money(10_000_000), { minLength: 1, maxLength: 3 }),
  incomeBasis: fc.constantFrom<"SALARIED" | "SELF_EMPLOYED">("SALARIED", "SELF_EMPLOYED"),
  dependants: fc.array(fc.record({ relation: fc.constantFrom("Spouse", "Child", "Parent"), lifelong: fc.boolean() }), { maxLength: 4 }),
  loans: fc.array(fc.record({ label: fc.constantFrom("Home loan", "Car loan"), outstanding: money(50_000_000) }), { maxLength: 3 }),
  goals: fc.array(fc.record({ kind: goalKind, amount: money(20_000_000) }), { maxLength: 5 }),
  familyCostsPerYear: fc.option(money(3_000_000), { nil: undefined }),
  existingCover: fc.array(
    fc.record({ kind: fc.constantFrom<"OWN" | "EMPLOYER">("OWN", "EMPLOYER"), label: fc.constant("Policy"), deathSumAssured: money(50_000_000) }),
    { maxLength: 3 },
  ),
  assets: fc.array(
    fc.record({ label: fc.constantFrom("MF", "FD", "EPF"), value: money(20_000_000), kind: fc.constantFrom<"LIQUID" | "RETIREMENT">("LIQUID", "RETIREMENT"), allocatedTo: needKey }),
    { maxLength: 4 },
  ),
}) as fc.Arbitrary<Profile>;

const rate = fc.integer({ min: 0, max: 150 }).map((x) => x / 1000);

export const assumptionsArb: fc.Arbitrary<Assumptions> = fc
  .record({
    inflation: rate,
    discount: rate,
    incomeGrowth: rate,
    retirementAge: fc.integer({ min: 45, max: 75 }),
    expenseShare: fc.integer({ min: 0, max: 60 }).map((x) => x / 100),
    lifeYears: fc.integer({ min: 1, max: 40 }),
  })
  .map((o) => ({ ...A, ...o }));

export const RUNS = { numRuns: 300 };
