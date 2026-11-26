"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import personasJson from "@/config/content/personas.json";
import { ENGINE_CONFIG } from "@/config";
import { inrRange, quickEstimate } from "@/engine";
import { PersonaChips } from "@/components/journey/persona-chips";
import { VerdictPill } from "@/components/stage1/quick-result";
import { useJourney } from "@/lib/journey-store";
import { useMounted } from "@/lib/hooks";

/** Live mini-verdict on the landing page (CLAUDE.md §13.1): real engine output, no invented figures. */
export function MiniVerdict({ title }: { title: string }) {
  const mounted = useMounted();
  const personaId = useJourney((s) => s.personaId);
  const chosen = personasJson.personas.find((p) => p.id === (mounted && personaId ? personaId : "arjun")) ?? personasJson.personas[0];
  const r = quickEstimate({ age: chosen.stage1.age, income: chosen.stage1.income, hasDependants: chosen.stage1.hasDependants }, ENGINE_CONFIG);
  return (
    <div className="card p-6 shadow-[var(--shadow-float)] md:p-8">
      <p className="eyebrow">{title}</p>
      <div className="mt-4">
        <PersonaChips />
      </div>
      <div className="mt-6 rounded-2xl bg-bg-alt p-5" aria-live="polite">
        <p className="text-sm text-muted-2">
          {chosen.name}, {chosen.tagline}
        </p>
        {r.ok ? (
          <>
            <div className="mt-3">
              <VerdictPill verdict={r.value.verdict} />
            </div>
            <p className="num mt-3 font-display text-[34px] font-bold leading-tight">{inrRange(r.value.low, r.value.high)}</p>
            <p className="mt-1 text-sm text-muted">Life cover the family may need, before loans, existing cover and savings.</p>
          </>
        ) : (
          <p className="mt-3 text-warn-ink">This demo input is invalid on purpose.</p>
        )}
      </div>
      <Link href={chosen.id === "invalid" ? "/estimate" : chosen.route} className="mt-5 inline-flex items-center gap-2 font-semibold text-blue hover:underline">
        Open {chosen.name}&apos;s journey <ArrowRight className="size-4" aria-hidden />
      </Link>
    </div>
  );
}
