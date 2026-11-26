"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Info } from "lucide-react";
import copy from "@/config/content/journey.json";
import { inrRange, renderStep, type QuickEstimate, type Result } from "@/engine";
import { Pill } from "@/components/ui/pill";
import { Button } from "@/components/ui/button";
import { Trace } from "@/components/ui/trace";
import { ExplainView } from "@/components/explain/explain-view";

export function VerdictPill({ verdict }: { verdict: keyof typeof copy.verdicts }) {
  const v = copy.verdicts[verdict];
  return <Pill tone={v.tone as "warn" | "green" | "blue"}>{v.label}</Pill>;
}

export function QuickResult({ result }: { result: Result<QuickEstimate> | null }) {
  const [open, setOpen] = useState(false);
  const s = copy.stage1;
  return (
    <section className="card flex flex-col p-6 md:p-8" aria-live="polite" aria-labelledby="first-estimate">
      <div className="flex items-start justify-between gap-3">
        <h2 id="first-estimate" className="font-display text-[22px] font-semibold">
          {s.resultTitle}
        </h2>
        <Pill tone="neutral">Basic result</Pill>
      </div>
      {!result ? (
        <p className="mt-6 text-muted">{s.empty}</p>
      ) : !result.ok ? (
        <p className="mt-6 rounded-2xl bg-warn-soft p-4 text-warn-ink">
          {s.invalid} <Trace id="TC-12" />
        </p>
      ) : (
        <>
          <div className="mt-5">
            <VerdictPill verdict={result.value.verdict} />
          </div>
          <p className="mt-5 text-[15px] text-muted">{s.needLabel}</p>
          <p className="num mt-1 font-display text-[40px] font-bold leading-[1.1] tracking-tight md:text-[56px]" data-testid="quick-range">
            {inrRange(result.value.low, result.value.high)}
          </p>
          <p className="mt-4 text-[17px] leading-7 text-muted">
            {renderStep(result.value.reason)} <Trace id={result.value.bandId} />
          </p>
          <div className="mt-5 flex gap-3 rounded-2xl bg-bg-alt p-4 text-[14px] leading-6 text-muted">
            <Info className="mt-0.5 size-5 shrink-0 text-blue" aria-hidden />
            <p>
              <strong className="text-ink">{s.leftOut}</strong> {s.leftOutBody}
            </p>
          </div>
          <p className="mt-3 text-[14px] font-medium text-ink">{s.gapNote}</p>
          <div className="mt-4">
            <button type="button" className="font-semibold text-blue hover:underline" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              {open ? "Hide the calculation" : "Show how this is calculated"}
            </button>
            {open ? (
              <div className="mt-4 rounded-2xl border border-line p-4">
                <ExplainView explain={result.value.explain} eyebrow="" compact />
              </div>
            ) : null}
          </div>
        </>
      )}
      <div className="mt-auto pt-8">
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/gap">
              {s.refine} <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/summary">{s.save}</Link>
          </Button>
        </div>
        <p className="mt-4 text-[13px] text-muted-2">
          {s.stopNote} <Trace id="FR-1.2" />
        </p>
      </div>
    </section>
  );
}
