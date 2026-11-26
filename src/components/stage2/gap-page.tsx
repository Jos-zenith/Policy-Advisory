"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Info, TriangleAlert } from "lucide-react";
import { gapParagraph, inr, inrExact, renderStep, verdictLabel, type Analysis, type Explain } from "@/engine";
import { ClientGate } from "@/components/journey/client-gate";
import { ExplainView } from "@/components/explain/explain-view";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { Sheet } from "@/components/ui/sheet";
import { Trace } from "@/components/ui/trace";
import { Term } from "@/components/ui/tooltip";
import { useJourney } from "@/lib/journey-store";
import { useAnalysis } from "@/lib/use-engine";
import { cn } from "@/lib/cn";
import { Waterfall, buildBars } from "./waterfall";
import { YourDetails } from "./details";
import { AssumptionsCard } from "./assumptions";
import { WhyNot } from "./why-not";

const LEVEL_TEXT = { BASIC: "Basic result", REFINED: "Refined result", DETAILED: "Detailed result" } as const;

function useIsDesktop() {
  const [desk, setDesk] = useState(() => (typeof window === "undefined" ? true : window.matchMedia("(min-width: 1024px)").matches));
  useEffect(() => {
    const m = window.matchMedia("(min-width: 1024px)");
    const on = () => setDesk(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return desk;
}

function Hero({ an, level }: { an: Analysis; level: ReturnType<typeof useAnalysis>["level"] }) {
  const profile = useJourney((s) => s.profile);
  const v = verdictLabel(an);
  const covered = an.recon.state === "COVERED";
  const [showHlv, setShowHlv] = useState(false);
  const above = an.flags.find((f) => f.id === "NEEDS_ABOVE_HLV");
  return (
    <section className="card grid gap-8 p-6 md:p-8 lg:grid-cols-[1.15fr_1fr]" aria-labelledby="gap-hero">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={v.tone}>{v.text}</Pill>
          <Pill tone="neutral">{LEVEL_TEXT[level.level]}</Pill>
          <Trace id="FR-9.1" />
        </div>
        <p className="mt-5 text-lg text-muted">{covered ? "Compared with what your family needs, you have about" : "Your family would need about"}</p>
        <p id="gap-hero" className={cn("num font-display text-[56px] font-bold leading-[1.05] tracking-tight md:text-[76px]", covered ? "text-green-ink" : "text-warn")} data-testid="gap-figure">
          {inr(Math.abs(an.recon.gap))}
        </p>
        <p className="font-display text-xl font-semibold">{covered ? "more cover and savings than needed" : "more life cover"}</p>
        <p className="mt-4 text-[17px] leading-7 text-muted">{renderStep(gapParagraph(an, profile))}</p>
        {level.skipped.filter((s) => s.effect !== "NO_GAP_EFFECT").length ? (
          <details className="mt-3 text-[14px]">
            <summary className="font-medium text-blue">What&apos;s not included yet</summary>
            <ul className="mt-2 space-y-1 text-muted">
              {level.skipped.map((s) => (
                <li key={s.section}>• {s.text}</li>
              ))}
            </ul>
          </details>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/options">
              {covered ? "See options anyway" : "See what fits this gap"} <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/options?book=1">Talk to an advisor</Link>
          </Button>
        </div>
      </div>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border-2 border-ink p-4">
            <p className="eyebrow">Needs-based estimate</p>
            <p className="num mt-2 font-display text-2xl font-bold">{inr(an.needs.gross)}</p>
            <p className="mt-1 text-[13px] leading-5 text-muted">What your family&apos;s costs and goals add up to. We use this one.</p>
          </div>
          <div className="rounded-2xl border border-line p-4">
            <p className="eyebrow">Income-based estimate</p>
            <p className="num mt-2 font-display text-2xl font-bold">{an.hlv.status === "NOT_APPLICABLE" ? "Not applicable" : inr(an.hlv.value)}</p>
            <p className="mt-1 text-[13px] leading-5 text-muted">What your future earnings are worth in today&apos;s money.</p>
          </div>
        </div>
        {above ? (
          <p className="flex gap-2.5 rounded-2xl bg-bg-alt p-4 text-[14px] leading-6 text-muted">
            <Info className="mt-0.5 size-4 shrink-0 text-blue" aria-hidden />
            <span>
              {renderStep(above.message)} <Trace id="FR-2.7" />
            </span>
          </p>
        ) : null}
        {an.hlv.flags.length ? (
          <p className="flex gap-2.5 rounded-2xl bg-bg-alt p-4 text-[14px] leading-6 text-muted">
            <Info className="mt-0.5 size-4 shrink-0 text-blue" aria-hidden />
            <span>
              {renderStep(an.hlv.flags[0].message)} <Trace id={an.hlv.flags[0].traceId} />
            </span>
          </p>
        ) : null}
        <p className={cn("flex gap-2.5 rounded-2xl p-4 text-[14px] leading-6", an.cap.exceeded ? "bg-warn-soft text-warn-ink" : "bg-bg-alt text-muted")}>
          {an.cap.exceeded ? <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> : <Check className="mt-0.5 size-4 shrink-0 text-green-ink" aria-hidden />}
          <span>
            {renderStep(an.cap.explain.summary!)} <Trace id={an.cap.exceeded ? ["FR-2.6", "R6", "TC-10"] : "FR-2.6"} />
          </span>
        </p>
        {an.income.volatile ? (
          <p className="flex gap-2.5 rounded-2xl bg-warn-soft p-4 text-[14px] leading-6 text-warn-ink">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {renderStep(an.flags.find((f) => f.id === "VOLATILE_INCOME")!.message)} <Trace id="TC-06" />
            </span>
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-line px-4 py-3">
          <button type="button" onClick={() => setShowHlv(true)} className="text-left text-[14px] font-semibold text-blue hover:underline">
            How the income-based estimate works
          </button>
          <span className="text-[12px] text-muted-2">
            Also called <Term k="hlv">HLV</Term>
          </span>
        </div>
        <Sheet open={showHlv} onOpenChange={setShowHlv} title="Income-based estimate" description="Also called Human Life Value (HLV).">
          <ExplainView explain={an.hlv.explain} eyebrow="" />
        </Sheet>
      </div>
    </section>
  );
}

function Inner() {
  const { result, sens, employerLost, level, profile, assumptions } = useAnalysis();
  const log = useJourney((s) => s.log);
  const sessionId = useJourney((s) => s.sessionId);
  const desktop = useIsDesktop();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const an = result.ok ? result.value : null;
  const bars = useMemo(() => (an ? buildBars(an) : []), [an]);
  const selected = bars.find((b) => b.id === selectedId) ?? bars.find((b) => b.id === "need.LIVING") ?? bars[0];

  // Decision trail (buffered client-side until booking): calc.result + flags, debounced.
  const logKey = an ? `${Math.round(an.recon.gap)}|${an.flags.map((f) => f.id).join(",")}` : null;
  useEffect(() => {
    if (!an) return;
    const t = setTimeout(() => {
      log(
        "calc.result",
        { summary: `Need ${inrExact(an.needs.gross)} − offsets ${inrExact(an.recon.totalOffsets)} = gap ${inrExact(an.recon.gap)}; HLV ${inrExact(an.hlv.value)}`, need: an.needs.gross, offsets: an.recon.totalOffsets, gap: an.recon.gap, hlv: an.hlv.value },
        "FR-2.1–2.7",
        { coalesce: true },
      );
      const already = new Set(
        useJourney
          .getState()
          .events.filter((e) => e.event === "flag.raised")
          .map((e) => String(e.detail.flag)),
      );
      for (const f of an.flags) if (!already.has(f.id)) log("flag.raised", { flag: f.id, summary: renderStep(f.message) }, f.traceId);
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logKey]);

  if (!result.ok) {
    return (
      <div className="mx-auto max-w-[800px] px-4 py-16 md:px-8">
        <div className="card p-8">
          <h1 className="font-display text-2xl font-semibold">Let&apos;s check a few answers first</h1>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-warn-ink">
            {result.errors.map((e) => (
              <li key={e.code + e.field}>
                {e.message} <Trace id={e.code} />
              </li>
            ))}
          </ul>
          <Button asChild className="mt-6">
            <Link href="/estimate">Back to step 1</Link>
          </Button>
        </div>
      </div>
    );
  }
  const a = an!;
  const panel = selected ? <ExplainView explain={selected.explain as Explain} /> : null;

  return (
    <div className="mx-auto max-w-[1240px] space-y-6 px-4 py-8 md:px-8 md:py-10">
      <Hero an={a} level={level} />

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        <section className="card min-w-0 p-6 md:p-7" aria-labelledby="how-we-got">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 id="how-we-got" className="font-display text-xl font-semibold">
              How we got to {inr(a.recon.gap)}
            </h2>
            <Trace id={["FR-2.8", "FR-2.10"]} />
          </div>
          <p className="mt-1 text-[14px] text-muted">Tap any bar to see exactly how it was worked out.</p>
          <div className="mt-5">
            <Waterfall
              an={a}
              selected={selected?.id ?? ""}
              onSelect={(b) => {
                setSelectedId(b.id);
                if (!desktop) setSheetOpen(true);
              }}
            />
          </div>
        </section>
        <aside className="card hidden p-6 lg:sticky lg:top-24 lg:block" aria-label="Calculation panel">
          {panel}
        </aside>
        <Sheet open={sheetOpen && !desktop} onOpenChange={setSheetOpen} title={selected?.label ?? "Calculation"} description="Show how this is calculated">
          {panel}
        </Sheet>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        <YourDetails an={a} a={assumptions} employerLost={employerLost} />
        <AssumptionsCard profile={profile} a={assumptions} />
      </div>

      {sens ? <WhyNot gap={a.recon.gap} sens={sens} /> : null}

      <div className="no-print flex flex-wrap justify-end gap-3">
        <Button asChild variant="outline" size="lg">
          <Link href="/summary">Print summary</Link>
        </Button>
        <Button asChild size="lg">
          <Link href="/options">
            {a.recon.state === "COVERED" ? "See options anyway" : "See what fits this gap"} <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Button>
      </div>
      <p className="sr-only">Session {sessionId}</p>
    </div>
  );
}

export function GapPage() {
  return (
    <ClientGate>
      <Inner />
    </ClientGate>
  );
}
