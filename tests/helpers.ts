import personasJson from "@/config/content/personas.json";
import { DEFAULT_ASSUMPTIONS, ENGINE_CONFIG } from "@/config";
import type { Assumptions, Profile } from "@/engine";

export const C = ENGINE_CONFIG;
export const A: Assumptions = DEFAULT_ASSUMPTIONS;

export function persona(id: string): Profile {
  const p = personasJson.personas.find((x) => x.id === id);
  if (!p) throw new Error(`no persona ${id}`);
  return structuredClone(p.profile) as Profile;
}

export function blankProfile(over: Partial<Profile> = {}): Profile {
  return {
    id: "T",
    age: 35,
    sex: "M",
    smoker: false,
    incomeHistory: [1_000_000],
    incomeBasis: "SALARIED",
    dependants: [{ relation: "Spouse" }],
    loans: [],
    goals: [],
    existingCover: [],
    assets: [],
    ...over,
  };
}

export function must<T>(r: { ok: true; value: T } | { ok: false; errors: unknown }): T {
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r.errors)}`);
  return r.value;
}
