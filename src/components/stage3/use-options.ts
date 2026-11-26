"use client";
import { useEffect, useMemo, useState } from "react";
import { ENGINE_CONFIG } from "@/config";
import { evaluateRules, type Catalog, type RulesOutcome } from "@/engine";
import type { Catalog as DataCatalog } from "@/data/catalog";
import { useJourney } from "@/lib/journey-store";
import { useAnalysis } from "@/lib/use-engine";

let cached: DataCatalog | null = null;

/** Loads products + rate tables lazily (keeps the 250 KB grid out of the first load). */
export function useCatalog(): DataCatalog | null {
  const [cat, setCat] = useState<DataCatalog | null>(cached);
  useEffect(() => {
    if (cached) return;
    let alive = true;
    import("@/data/catalog").then((m) => {
      cached = m.CATALOG;
      if (alive) setCat(m.CATALOG);
    });
    return () => {
      alive = false;
    };
  }, []);
  return cat;
}

export function useRules(): { rules: RulesOutcome | null; catalog: Catalog | null; analysis: ReturnType<typeof useAnalysis> } {
  const analysis = useAnalysis();
  const catalog = useCatalog();
  const options = useJourney((s) => s.options);
  const rules = useMemo(() => {
    if (!catalog || !analysis.result.ok) return null;
    return evaluateRules(analysis.result.value, analysis.profile, analysis.assumptions, ENGINE_CONFIG, catalog, options);
  }, [catalog, analysis, options]);
  return { rules, catalog, analysis };
}

export interface OptionsSummary {
  productName: string;
  cover: number;
  term: number;
  annualPremium: number;
  shareOfIncome: number;
  rateLine: string;
}

export function useOptionsSummary(): OptionsSummary | null {
  const { rules, catalog } = useRules();
  if (!rules || !catalog || !rules.selection || !rules.quote) return null;
  const p = catalog.products.find((x) => x.id === rules.selection!.productId);
  return {
    productName: p?.name ?? rules.selection.productId,
    cover: rules.selection.cover,
    term: rules.selection.term,
    annualPremium: rules.quote.annual,
    shareOfIncome: rules.shareOfIncome ?? 0,
    rateLine: rules.quote.rateLine,
  };
}
