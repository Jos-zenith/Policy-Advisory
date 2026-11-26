/**
 * Canonical domain model (CLAUDE.md §6) plus the engine's input/output types.
 * Pure types only: no runtime imports.
 */

export type Category = "TERM" | "WHOLE_LIFE" | "ENDOWMENT" | "ULIP";

export interface Rider {
  id: string;
  name: string;
  ratePer1000?: number;
  pctLoading?: number;
}

export interface Product {
  id: string;
  name: string;
  category: Category;
  isSample: boolean;
  entryAge: [number, number];
  maxMaturityAge: number;
  term: [number, number];
  cover: [number, number];
  riders: Rider[];
  savingsShare: number;
  problemSolved: string;
  surrenderScheduleId?: string;
  lockInYears?: number;
  rateTableId: string;
  /** Whole-life products run to a fixed age instead of a chosen term. */
  coverToAge?: number;
}

export type CellKey = Record<string, string | number>;

export interface RateTable {
  id: string;
  productId: string;
  version: string;
  dims: string[];
  cells: { key: CellKey; ratePer1000: number }[];
  coverBands?: { id: string; min: number; max: number; label?: string }[];
}

export type GoalKind = "EDUCATION" | "MARRIAGE" | "HEALTH_EMERGENCY" | "SPOUSE_RETIREMENT" | "OTHER";

export interface Profile {
  id: string;
  age: number;
  sex?: "M" | "F";
  smoker?: boolean;
  incomeHistory: number[];
  incomeBasis: "SALARIED" | "SELF_EMPLOYED";
  dependants: { relation: string; lifelong?: boolean }[];
  loans: { label: string; outstanding: number }[];
  goals: { kind: GoalKind; amount: number; label?: string }[];
  familyCostsPerYear?: number;
  existingCover: { kind: "OWN" | "EMPLOYER"; label: string; deathSumAssured: number; productCategory?: Category }[];
  assets: { label: string; value: number; kind: "LIQUID" | "RETIREMENT"; allocatedTo?: string | null }[];
  /* ---- Extensions (DECISIONS.md D-08) ---- */
  /** Homemaker / no earned income: HLV is "not applicable" unless a contribution is given. */
  isHomemaker?: boolean;
  /** Yearly value of a homemaker's household contribution (used as HLV income). */
  householdContributionPerYear?: number;
  /** The customer wants to leave an estate (enables R2 together with affordability). */
  estateNeed?: boolean;
}

export interface Advisor {
  id: string;
  name: string;
  languages: string[];
  specialities: string[];
  licenceRef: string;
  licenceValidTo: string;
  isSample: boolean;
}

export interface Slot {
  id: string;
  advisorId: string;
  startUtc: string;
  endUtc: string;
  capacity: number;
  booked: number;
}

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */

export type AnnuityTiming = "due" | "ordinary";

export interface Assumptions {
  inflation: number; // A-INFL
  discount: number; // A-DISC
  incomeGrowth: number; // A-GROWTH
  retirementAge: number; // A-RETAGE
  expenseShare: number; // A-EXP-SHARE
  lifeYears: number; // A-LC-YEARS
  needsTiming: AnnuityTiming; // A-TIMING
  hlvTiming: AnnuityTiming; // A-HLV-TIMING
  maxHorizon: number; // A-MAX-HORIZON
  affordCap: number; // A-AFFORD-CAP
  volRatio: number; // A-VOL-RATIO
  ssvScheduleId: string; // A-SSV
}

export type AssumptionKey = keyof Assumptions;

export interface AssumptionDef {
  id: string;
  key: AssumptionKey;
  label: string;
  symbol: string;
  unit: "pct" | "years" | "text" | "factor";
  value: number | string;
  step?: number;
  min?: number;
  max?: number;
  adjustable: boolean;
  placeholder: boolean;
}

export interface QuickBand {
  id: string;
  minAge: number;
  maxAge: number;
  low: number;
  high: number;
}

export interface CapBand {
  id: string;
  minAge: number;
  maxAge: number;
  multiple: number;
}

export interface SurrenderSchedule {
  id: string;
  label: string;
  note?: string;
  byYear: Record<string, number>;
  afterLastListedYear: number;
  lastYear: number;
}

export interface FrequencyDef {
  label: string;
  periodsPerYear: number;
  factor: number;
  note: string;
}

export type Frequency = "YEARLY" | "MONTHLY";

export interface EngineConfig {
  configVersion: string;
  assumptionDefs: AssumptionDef[];
  bands: {
    quickEstimate: { withDependants: QuickBand[]; noDependants: { id: string; low: number; high: number } };
    insurerCap: CapBand[];
  };
  surrender: {
    schedules: SurrenderSchedule[];
    earlyYearsForCopy: [number, number];
    cardDisplayYears: number[];
    illustrative: boolean;
  };
  rules: {
    coverStep: number;
    coverSliderStep: number;
    coverSliderMin: number;
    coverSliderMax: number;
    frequencies: Record<Frequency, FrequencyDef>;
    sensitivity: { lifeYearsDelta: number; inflationDelta: number };
    runway: { compareAmount: number; minGapForDefault: number; fallbackShare: number; fallbackRoundTo: number };
    affordabilityMeterMax: number;
    accessDaysAfterCall: number;
    limits: { minAge: number; maxAge: number; maxAmount: number; maxIncomeYears: number };
  };
}

/* ------------------------------------------------------------------ */
/* Explain (P2)                                                        */
/* ------------------------------------------------------------------ */

export type Unit = "inr" | "inrExact" | "inrPaise" | "pct" | "pct1" | "pct3" | "years" | "factor" | "factor2" | "number" | "text" | "multiple";

export interface Quantity {
  value: number | string;
  unit: Unit;
  /** Decimals for factor-style units; chosen by the engine for arithmetic consistency. */
  dp?: number;
}

/** A sentence or formula line with {placeholders} filled from `values` at render time. */
export interface ExplainStep {
  template: string;
  values: Record<string, Quantity>;
}

export type InputSource = "you" | "assumption" | "config" | "derived" | "product" | "rate-table";

export interface ExplainInput {
  label: string;
  q: Quantity;
  source: InputSource;
  /** Assumption ID (A-INFL), stage label ("Stage 2"), rule or table ID. */
  ref?: string;
}

export interface Explain {
  id: string;
  title: string;
  result: Quantity;
  summary?: ExplainStep;
  steps: ExplainStep[];
  inputs: ExplainInput[];
  assumptionIds: string[];
  traceIds: string[];
  source: { configVersion: string; note?: string };
}

/* ------------------------------------------------------------------ */
/* Engine outputs                                                      */
/* ------------------------------------------------------------------ */

export type FlagId =
  | "NEEDS_ABOVE_HLV"
  | "EMPLOYER_COVER"
  | "TRADITIONAL_POLICY"
  | "VOLATILE_INCOME"
  | "COMPREHENSION_CORRECTED"
  | "CAP_EXCEEDED"
  | "NEGATIVE_REAL_RATE"
  | "HLV_RETIRED"
  | "HLV_ZERO_INCOME"
  | "HLV_NOT_APPLICABLE"
  | "ALLOCATION_TRIMMED"
  | "ALLOCATION_BLOCKED"
  | "COVER_VALUE_PROMPT"
  | "NON_EXACT_RATE"
  | "OVER_BUDGET";

export interface Flag {
  id: FlagId;
  severity: "info" | "warn";
  message: ExplainStep;
  traceId: string;
}

export interface ValidationIssue {
  field: string;
  code: string;
  message: string;
}

export type Result<T> = { ok: true; value: T } | { ok: false; errors: ValidationIssue[] };
