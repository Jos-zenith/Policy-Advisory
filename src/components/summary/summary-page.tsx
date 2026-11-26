"use client";
import Link from "next/link";
import { Printer } from "lucide-react";
import { CONFIG_VERSION } from "@/config";
import { changedAssumptions, inr, inrExact, inrRange, pct, renderStep, type Assumptions } from "@/engine";
import { ASSUMPTION_DEFS } from "@/config";
import { ClientGate } from "@/components/journey/client-gate";
import { Button } from "@/components/ui/button";
import { useJourney } from "@/lib/journey-store";
import { useAnalysis, useQuickEstimate } from "@/lib/use-engine";
import { useOptionsSummary } from "@/components/stage3/use-options";

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line py-2 text-[14px]">
      <dt className="text-muted">{k}</dt>
      <dd className={strong ? "num font-semibold" : "num"}>{v}</dd>
    </div>
  );
}

function Inner() {
  const stage1 = useJourney((s) => s.stage1);
  const sessionId = useJourney((s) => s.sessionId);
  const qe = useQuickEstimate(stage1);
  const { result, sens, assumptions } = useAnalysis();
  const opt = useOptionsSummary();
  const an = result.ok ? result.value : null;
  const changed = changedAssumptions(ASSUMPTION_DEFS, assumptions as Assumptions);
  const printedAt = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="mx-auto max-w-[860px] px-4 py-8 md:px-8">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/gap" className="font-semibold text-blue hover:underline">
          ← Back
        </Link>
        <Button onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden /> Print or save as PDF
        </Button>
      </div>
      <article className="card p-6 md:p-10">
        <p className="eyebrow">Needs Finder · summary</p>
        <h1 className="mt-2 font-display text-3xl font-bold">Could your family carry on without you?</h1>
        <p className="mt-2 text-sm text-muted-2">
          Printed {printedAt} IST · anonymous session {sessionId} · config {CONFIG_VERSION}. No name, phone or email is included.
        </p>

        <section className="mt-8">
          <h2 className="font-display text-xl font-semibold">1 · First estimate</h2>
          {qe && qe.ok ? (
            <dl className="mt-2">
              <Row k="Age · income · dependants" v={`${stage1.age} · ${inr(Number(stage1.incomeLakh) * 100_000)} · ${stage1.hasDependants ? "yes" : "no"}`} />
              <Row k="Starting range" v={inrRange(qe.value.low, qe.value.high)} strong />
              <Row k="Why" v={renderStep(qe.value.reason)} />
            </dl>
          ) : (
            <p className="mt-2 text-muted">Not completed.</p>
          )}
        </section>

        {an ? (
          <section className="mt-8">
            <h2 className="font-display text-xl font-semibold">2 · Your gap</h2>
            <dl className="mt-2">
              {an.needs.components.map((c) => (
                <Row key={c.key} k={c.label} v={inrExact(c.amount)} />
              ))}
              <Row k="What your family needs" v={inrExact(an.needs.gross)} strong />
              {an.recon.offsets.map((o) => (
                <Row key={o.key} k={o.label} v={`− ${inrExact(o.amount)}`} />
              ))}
              <Row k={an.recon.gap > 0 ? "Your gap" : "Surplus"} v={`${inrExact(Math.abs(an.recon.gap))} (${inr(Math.abs(an.recon.gap))})`} strong />
              <Row k="Income-based estimate" v={an.hlv.status === "NOT_APPLICABLE" ? "Not applicable" : inrExact(an.hlv.value)} />
              <Row k="Estimated insurer limit" v={inrExact(an.cap.amount)} />
            </dl>
            {sens ? (
              <>
                <h3 className="mt-5 font-semibold">If an assumption changes</h3>
                <dl className="mt-1">
                  {sens.rows.map((r) => (
                    <Row key={r.id} k={renderStep(r.label)} v={`${r.lower === null ? "—" : inr(r.lower)} / ${r.higher === null ? "—" : inr(r.higher)}`} />
                  ))}
                </dl>
              </>
            ) : null}
            <h3 className="mt-5 font-semibold">Assumptions</h3>
            <p className="mt-1 text-[14px] text-muted">
              Prices rise {pct(assumptions.inflation)} · return on savings {pct(assumptions.discount)} · income growth {pct(assumptions.incomeGrowth)} · retirement age {assumptions.retirementAge} · own spending {pct(assumptions.expenseShare, 0)} · {assumptions.lifeYears} years of support.{" "}
              {changed.length ? `Changed from defaults: ${changed.map((c) => c.id).join(", ")}.` : "All defaults (placeholders, to be confirmed by a finance reviewer)."}
            </p>
          </section>
        ) : null}

        {opt ? (
          <section className="mt-8">
            <h2 className="font-display text-xl font-semibold">3 · Option you looked at</h2>
            <dl className="mt-2">
              <Row k="Product (sample)" v={opt.productName} />
              <Row k="Cover · term" v={`${inr(opt.cover)} · ${opt.term} years`} />
              <Row k="Indicative premium" v={`${inrExact(opt.annualPremium)} a year · ${pct(opt.shareOfIncome)} of income`} strong />
              <Row k="Rate used" v={opt.rateLine} />
            </dl>
            <p className="mt-2 text-[13px] text-muted-2">Indicative premium from a sample rate table, not a binding quote.</p>
          </section>
        ) : null}

        <p className="mt-10 border-t border-line pt-4 text-[12px] text-muted-2">
          Educational calculator, not financial advice. Figures use sample data and placeholder assumptions (config {CONFIG_VERSION}). Products are fictional. Rounded for display; full precision is kept internally.
        </p>
      </article>
    </div>
  );
}

export function SummaryPage() {
  return (
    <ClientGate>
      <Inner />
    </ClientGate>
  );
}
