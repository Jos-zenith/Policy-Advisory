"use client";
import { useMemo } from "react";
import { DEFAULT_ASSUMPTIONS, ENGINE_CONFIG } from "@/config";
import { analyse, quickEstimate, resultLevel, sensitivity, withOverrides, withoutEmployerCover, type Assumptions } from "@/engine";
import { useJourney } from "./journey-store";

export function useAssumptions(): Assumptions {
  const overrides = useJourney((s) => s.assumptions);
  return useMemo(() => withOverrides(DEFAULT_ASSUMPTIONS, overrides), [overrides]);
}

export function useQuickEstimate(inputs: { age: string; incomeLakh: string; hasDependants: boolean | null }) {
  return useMemo(() => {
    if (inputs.age === "" || inputs.incomeLakh === "" || inputs.hasDependants === null) return null;
    return quickEstimate({ age: Number(inputs.age), income: Number(inputs.incomeLakh) * 100_000, hasDependants: inputs.hasDependants }, ENGINE_CONFIG);
  }, [inputs.age, inputs.incomeLakh, inputs.hasDependants]);
}

export function useAnalysis() {
  const profile = useJourney((s) => s.profile);
  const provided = useJourney((s) => s.provided);
  const a = useAssumptions();
  return useMemo(() => {
    const result = analyse(profile, a, ENGINE_CONFIG);
    const sens = result.ok ? sensitivity(profile, a, ENGINE_CONFIG) : null;
    const employerLost = result.ok && profile.existingCover.some((c) => c.kind === "EMPLOYER") ? analyse(withoutEmployerCover(profile), a, ENGINE_CONFIG) : null;
    return { result, sens, employerLost, level: resultLevel(provided), profile, assumptions: a };
  }, [profile, a, provided]);
}
