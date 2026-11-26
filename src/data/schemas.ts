/**
 * zod schemas for the canonical model (CLAUDE.md §6). Used by the reveal-day
 * adapters, the API, and tests that check the sample data conforms.
 */
import { z } from "zod";

export const CategorySchema = z.enum(["TERM", "WHOLE_LIFE", "ENDOWMENT", "ULIP"]);
const range = z.tuple([z.number(), z.number()]).refine(([a, b]) => a <= b, "range min must be ≤ max");
const money = z.number().finite().nonnegative();

export const ProductSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: CategorySchema,
  isSample: z.boolean(),
  entryAge: range,
  maxMaturityAge: z.number().int().positive(),
  term: range,
  cover: range,
  riders: z.array(z.object({ id: z.string(), name: z.string(), ratePer1000: z.number().nonnegative().optional(), pctLoading: z.number().nonnegative().optional() })),
  savingsShare: z.number().min(0).max(1),
  problemSolved: z.string().min(1),
  surrenderScheduleId: z.string().optional(),
  lockInYears: z.number().int().nonnegative().optional(),
  rateTableId: z.string().min(1),
  coverToAge: z.number().int().positive().optional(),
});

export const RateTableSchema = z.object({
  id: z.string().min(1),
  productId: z.string().min(1),
  version: z.string(),
  dims: z.array(z.string()).min(1),
  cells: z.array(z.object({ key: z.record(z.string(), z.union([z.string(), z.number()])), ratePer1000: z.number().finite().nonnegative() })).min(1),
  coverBands: z.array(z.object({ id: z.string(), min: money, max: money, label: z.string().optional() })).optional(),
});

export const GoalKindSchema = z.enum(["EDUCATION", "MARRIAGE", "HEALTH_EMERGENCY", "SPOUSE_RETIREMENT", "OTHER"]);
export const NeedKeySchema = z.enum(["LOANS", "LIVING", "EDUCATION", "MARRIAGE", "HEALTH_EMERGENCY", "SPOUSE_RETIREMENT", "OTHER"]);

export const ProfileSchema = z.object({
  id: z.string(),
  age: z.number(),
  sex: z.enum(["M", "F"]).optional(),
  smoker: z.boolean().optional(),
  incomeHistory: z.array(z.number()).min(1).max(3),
  incomeBasis: z.enum(["SALARIED", "SELF_EMPLOYED"]),
  dependants: z.array(z.object({ relation: z.string(), lifelong: z.boolean().optional() })),
  loans: z.array(z.object({ label: z.string(), outstanding: z.number() })),
  goals: z.array(z.object({ kind: GoalKindSchema, amount: z.number(), label: z.string().optional() })),
  familyCostsPerYear: z.number().optional(),
  existingCover: z.array(z.object({ kind: z.enum(["OWN", "EMPLOYER"]), label: z.string(), deathSumAssured: z.number(), productCategory: CategorySchema.optional() })),
  assets: z.array(z.object({ label: z.string(), value: z.number(), kind: z.enum(["LIQUID", "RETIREMENT"]), allocatedTo: NeedKeySchema.nullable().optional() })),
  isHomemaker: z.boolean().optional(),
  householdContributionPerYear: z.number().optional(),
  estateNeed: z.boolean().optional(),
});

export const AdvisorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  languages: z.array(z.string()).min(1),
  specialities: z.array(z.string()),
  licenceRef: z.string(),
  licenceValidTo: z.string(),
  isSample: z.boolean(),
});

export const SlotSchema = z.object({
  id: z.string(),
  advisorId: z.string(),
  startUtc: z.string().datetime(),
  endUtc: z.string().datetime(),
  capacity: z.number().int().positive(),
  booked: z.number().int().nonnegative(),
});

export const AssumptionsOverrideSchema = z
  .object({
    inflation: z.number(),
    discount: z.number(),
    incomeGrowth: z.number(),
    retirementAge: z.number(),
    expenseShare: z.number(),
    lifeYears: z.number(),
  })
  .partial();
