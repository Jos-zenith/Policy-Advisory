"use client";
/**
 * Journey state (Zustand + sessionStorage). Anonymous session ID only (P5):
 * no name, phone or email is ever stored here. Trail events are buffered
 * client-side and sent to the server only when the customer books and consents.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import personasJson from "@/config/content/personas.json";
import { CONFIG_VERSION } from "@/config";
import type { Assumptions, Frequency, Profile, Provided } from "@/engine";

export interface ExistingPolicyInput {
  name: string;
  category: "ENDOWMENT" | "WHOLE_LIFE";
  deathSumAssured: number;
  annualPremium: number;
  policyTerm: number;
  policyYear: number;
  maturityBenefit?: number;
  surrenderScheduleId: string;
}

export interface OptionsSelection {
  productId?: string;
  cover?: number;
  term?: number;
  frequency: Frequency;
  rider: boolean;
}

export interface TrailEventDraft {
  ts: string;
  event: string;
  detail: Record<string, unknown>;
  ruleId: string;
  configVersion: string;
}

export interface ComprehensionAnswers {
  /** answers per question id: list of option indexes chosen in order (max 2 tries). */
  answers: Record<string, number[]>;
}

export interface Stage1Inputs {
  age: string;
  incomeLakh: string;
  hasDependants: boolean | null;
}

export interface JourneyState {
  sessionId: string | null;
  personaId: string | null;
  stage1: Stage1Inputs;
  profile: Profile;
  provided: Provided;
  assumptions: Partial<Assumptions>;
  employerLostView: boolean;
  options: OptionsSelection;
  existingPolicy: ExistingPolicyInput | null;
  comprehension: ComprehensionAnswers;
  events: TrailEventDraft[];
  /* actions */
  ensureSession: () => string;
  loadPersona: (id: string) => void;
  reset: () => void;
  setStage1: (s: Partial<Stage1Inputs>) => void;
  updateProfile: (fn: (p: Profile) => Profile, section?: keyof Provided) => void;
  markProvided: (section: keyof Provided, v?: boolean) => void;
  setAssumption: <K extends keyof Assumptions>(k: K, v: Assumptions[K]) => void;
  resetAssumptions: () => void;
  setEmployerLostView: (v: boolean) => void;
  setOptions: (o: Partial<OptionsSelection>) => void;
  setExistingPolicy: (p: ExistingPolicyInput | null) => void;
  answer: (qid: string, option: number) => void;
  log: (event: string, detail: Record<string, unknown>, ruleId: string, opts?: { coalesce?: boolean }) => void;
}

export const EMPTY_PROFILE: Profile = {
  id: "P-SESSION",
  age: 30,
  sex: undefined,
  smoker: undefined,
  incomeHistory: [0],
  incomeBasis: "SALARIED",
  dependants: [],
  loans: [],
  goals: [],
  familyCostsPerYear: undefined,
  existingCover: [],
  assets: [],
};

const initial = {
  sessionId: null as string | null,
  personaId: null as string | null,
  stage1: { age: "", incomeLakh: "", hasDependants: null } as Stage1Inputs,
  profile: EMPTY_PROFILE,
  provided: {} as Provided,
  assumptions: {} as Partial<Assumptions>,
  employerLostView: false,
  options: { frequency: "YEARLY", rider: false } as OptionsSelection,
  existingPolicy: null as ExistingPolicyInput | null,
  comprehension: { answers: {} } as ComprehensionAnswers,
  events: [] as TrailEventDraft[],
};

function newSessionId(): string {
  const hex = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().replace(/-/g, "") : Math.random().toString(16).slice(2);
  return `s_${hex.slice(0, 8)}`;
}

/** Stage 1 inputs → the profile fields they own. */
export function applyStage1(p: Profile, s: Stage1Inputs): Profile {
  const age = Number(s.age);
  const income = Number(s.incomeLakh) * 100_000;
  const next: Profile = { ...p };
  if (s.age !== "" && Number.isFinite(age)) next.age = age;
  if (s.incomeLakh !== "" && Number.isFinite(income)) {
    // Stage 1 sets this year's income; an entered history keeps its earlier years.
    const hist = p.incomeHistory.length > 1 ? [...p.incomeHistory.slice(0, -1), income] : [income];
    next.incomeHistory = hist;
  }
  if (s.hasDependants === false) next.dependants = [];
  if (s.hasDependants === true && p.dependants.length === 0) next.dependants = [{ relation: "Family" }];
  return next;
}

export const useJourney = create<JourneyState>()(
  persist(
    (set, get) => ({
      ...initial,
      ensureSession: () => {
        const existing = get().sessionId;
        if (existing) return existing;
        const id = newSessionId();
        set({ sessionId: id });
        get().log("session.created", { note: "Anonymous session; no personal data" }, "FR-1.3");
        if (typeof fetch !== "undefined") {
          fetch("/api/sessions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) }).catch(() => {});
        }
        return id;
      },
      loadPersona: (id) => {
        const p = personasJson.personas.find((x) => x.id === id);
        if (!p) return;
        const stage1: Stage1Inputs = { age: String(p.stage1.age), incomeLakh: String(p.stage1.income / 100_000), hasDependants: p.stage1.hasDependants };
        set({
          personaId: id,
          stage1,
          profile: structuredClone(p.profile) as Profile,
          provided: { ...(p.provided as Provided) },
          assumptions: {},
          employerLostView: false,
          options: { frequency: "YEARLY", rider: false },
          existingPolicy: p.existingPolicy ? (structuredClone(p.existingPolicy) as ExistingPolicyInput) : null,
          comprehension: { answers: {} },
        });
        get().ensureSession();
        get().log("persona.loaded", { persona: p.name }, "DEMO");
      },
      reset: () => {
        set({ ...initial, sessionId: null });
        get().ensureSession();
      },
      setStage1: (s) => {
        const stage1 = { ...get().stage1, ...s };
        set({ stage1, profile: applyStage1(get().profile, stage1), personaId: get().personaId });
      },
      updateProfile: (fn, section) => {
        const profile = fn(get().profile);
        set({ profile, provided: section ? { ...get().provided, [section]: true } : get().provided });
      },
      markProvided: (section, v = true) => set({ provided: { ...get().provided, [section]: v } }),
      setAssumption: (k, v) => set({ assumptions: { ...get().assumptions, [k]: v } }),
      resetAssumptions: () => set({ assumptions: {} }),
      setEmployerLostView: (v) => set({ employerLostView: v }),
      setOptions: (o) => set({ options: { ...get().options, ...o } }),
      setExistingPolicy: (p) => set({ existingPolicy: p }),
      answer: (qid, option) => {
        const prev = get().comprehension.answers[qid] ?? [];
        if (prev.length >= 2) return;
        set({ comprehension: { answers: { ...get().comprehension.answers, [qid]: [...prev, option] } } });
      },
      log: (event, detail, ruleId, opts) => {
        const e: TrailEventDraft = { ts: new Date().toISOString(), event, detail, ruleId, configVersion: CONFIG_VERSION };
        const events = get().events;
        if (opts?.coalesce && events.length && events[events.length - 1].event === event) {
          set({ events: [...events.slice(0, -1), e] });
        } else {
          set({ events: [...events, e].slice(-200) });
        }
      },
    }),
    {
      name: "nf-journey",
      version: 1,
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({
        sessionId: s.sessionId,
        personaId: s.personaId,
        stage1: s.stage1,
        profile: s.profile,
        provided: s.provided,
        assumptions: s.assumptions,
        employerLostView: s.employerLostView,
        options: s.options,
        existingPolicy: s.existingPolicy,
        comprehension: s.comprehension,
        events: s.events,
      }),
    },
  ),
);
