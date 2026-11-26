/** zod schema for POST /api/bookings, shared by the drawer (client) and the route (server). */
import { z } from "zod";
import { AssumptionsOverrideSchema, ProfileSchema } from "@/data/schemas";

export const MOBILE_RE = /^[6-9]\d{9}$/;

export function normaliseMobile(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

export const CustomerSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  mobile: z.string().regex(MOBILE_RE, "Enter a 10-digit Indian mobile number"),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email or leave it blank")]).optional(),
  language: z.string().min(2).max(30),
});

export const ConsentsSchema = z.object({
  prepare: z.literal(true),
  share: z.literal(true),
  contact: z.literal(true),
  version: z.string(),
});

export const TrailDraftSchema = z.object({
  ts: z.string().datetime(),
  event: z.string().min(1).max(40),
  detail: z.record(z.string(), z.unknown()),
  ruleId: z.string().max(60),
  configVersion: z.string().max(30),
});

export const BookingRequestSchema = z.object({
  sessionId: z.string().regex(/^s_[a-z0-9]{4,32}$/i),
  slotId: z.string().min(3).max(60),
  customer: CustomerSchema,
  consents: ConsentsSchema,
  journey: z.object({
    profile: ProfileSchema,
    assumptions: AssumptionsOverrideSchema,
    provided: z.record(z.string(), z.boolean()),
    options: z.object({
      productId: z.string().optional(),
      cover: z.number().optional(),
      term: z.number().optional(),
      frequency: z.enum(["YEARLY", "MONTHLY"]),
      rider: z.boolean(),
    }),
    comprehension: z.record(z.string(), z.array(z.number().int().min(0).max(5)).max(2)),
    existingPolicy: z
      .object({ name: z.string(), category: z.string(), deathSumAssured: z.number(), annualPremium: z.number(), policyTerm: z.number(), policyYear: z.number() })
      .passthrough()
      .nullable(),
  }),
  events: z.array(TrailDraftSchema).max(200),
});

export type BookingRequest = z.infer<typeof BookingRequestSchema>;
