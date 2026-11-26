/** Canonical plain-language labels for engine-produced segments. */
import type { Category, GoalKind } from "./types";

export const GOAL_LABELS: Record<GoalKind, string> = {
  EDUCATION: "Education",
  MARRIAGE: "Marriage goals",
  HEALTH_EMERGENCY: "Health & emergency",
  SPOUSE_RETIREMENT: "Spouse retirement",
  OTHER: "Other goals",
};

export const GOAL_ORDER: GoalKind[] = ["EDUCATION", "MARRIAGE", "HEALTH_EMERGENCY", "SPOUSE_RETIREMENT", "OTHER"];

export const CATEGORY_LABELS: Record<Category, string> = {
  TERM: "Term life",
  WHOLE_LIFE: "Whole life",
  ENDOWMENT: "Endowment",
  ULIP: "ULIP",
};

export const NEED_KEYS = ["LOANS", "LIVING", ...GOAL_ORDER] as const;
export type NeedKey = (typeof NEED_KEYS)[number];

export const NEED_TARGET_LABELS: Record<NeedKey, string> = {
  LOANS: "loans",
  LIVING: "living costs",
  EDUCATION: "education",
  MARRIAGE: "marriage goals",
  HEALTH_EMERGENCY: "health & emergency",
  SPOUSE_RETIREMENT: "spouse retirement",
  OTHER: "other goals",
};
