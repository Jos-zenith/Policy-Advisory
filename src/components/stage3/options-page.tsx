"use client";
import { useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight, FileText, TriangleAlert } from "lucide-react";
import { inr, inrExact, pct } from "@/engine";
import { ClientGate, PageSkeleton } from "@/components/journey/client-gate";
import { Button } from "@/components/ui/button";
import { Trace } from "@/components/ui/trace";
import { useJourney } from "@/lib/journey-store";
import { setQueryParam, useSearch } from "@/lib/hooks";
import { useRules } from "./use-options";
import { NotShown, SavingsCard, TermCard } from "./cards";
import { SliderPanel } from "./slider-panel";

const BookingDrawer = dynamic(() => import("@/components/booking/booking-drawer").then((m) => m.BookingDrawer), { ssr: false });
const BridgePanel = dynamic(() => import("@/components/bridge/bridge-panel").then((m) => m.BridgePanel), { ssr: false, loading: () => <PageSkeleton /> });

function Inner() {
  const { rules, catalog, analysis } = useRules();
  const search = new URLSearchParams(useSearch());
  const log = useJourney((s) => s.log);
  const book = search.get("book") === "1";
  const panel = search.get("panel");

  // Trail: rule events once per outcome; slider.final when the selection settles.
  const ruleKey = rules ? rules.trail.map((t) => `${t.event}:${t.ruleId}:${String(t.detail.summary)}`).join("|") : "";
  useEffect(() => {
    if (!rules) return;
    const prior = new Set(useJourney.getState().events.map((e) => `${e.event}:${e.ruleId}:${String(e.detail.summary)}`));
    for (const t of rules.trail) if (!prior.has(`${t.event}:${t.ruleId}:${String(t.detail.summary)}`)) log(t.event, t.detail, t.ruleId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruleKey]);
  const selKey = rules?.selection && rules.quote ? `${rules.selection.productId}|${rules.selection.cover}|${rules.selection.term}|${rules.selection.frequency}|${rules.selection.rider}` : "";
  useEffect(() => {
    if (!rules?.selection || !rules.quote) return;
    const t = setTimeout(() => {
      const r = rules;
      log(
        "slider.final",
        {
          summary: `${inr(r.selection!.cover)} · ${r.selection!.term} yrs · ${r.selection!.frequency.toLowerCase()} · ${r.selection!.rider ? "rider" : "no rider"} → ${inrExact(r.quote!.annual)} (${r.shareOfIncome !== null ? pct(r.shareOfIncome) : "—"}); rate cell ${r.quote!.exact ? "exact" : "nearest"}`,
          ...r.selection!,
          premium: r.quote!.annual,
        },
        r.quote!.tableId,
        { coalesce: true },
      );
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selKey]);

  if (!analysis.result.ok) {
    return (
      <div className="mx-auto max-w-[800px] px-4 py-16 md:px-8">
        <div className="card p-8">
          <h1 className="font-display text-2xl font-semibold">Let&apos;s work out your gap first</h1>
          <p className="mt-2 text-muted">Some answers need checking before we can show options.</p>
          <Button asChild className="mt-6">
            <Link href="/estimate">Back to step 1</Link>
          </Button>
        </div>
      </div>
    );
  }
  if (!rules || !catalog) return <PageSkeleton />;

  if (panel === "policy") return <BridgePanel />;

  const an = analysis.result.value;
  const termCard = rules.cards.find((c) => c.product.id === rules.selection?.productId) ?? rules.cards.find((c) => c.status === "RECOMMENDED");
  const savings = rules.cards.filter((c) => c.product.category !== "TERM" && c.status !== "INELIGIBLE");
  const chosenProduct = termCard?.product;

  const heading =
    rules.state === "R4"
      ? { eyebrow: "Your cover already meets your family's needs", title: "You appear adequately covered", sub: "There's nothing you need to buy for now. Your reconciliation and the sensitivity table are on the previous step. If your loans, family or job change, check again." }
      : rules.state === "NO_ELIGIBLE_TERM"
        ? { eyebrow: `For your gap of ${inr(rules.gap)}`, title: "Let's find the right cover with an advisor", sub: "None of the sample term products accept new cover at your age, so we won't show a price. An advisor can look at what is available to you." }
        : { eyebrow: `For your gap of ${inr(rules.gap)}`, title: "Start with term life cover", sub: "Term cover gives your family the most protection for each rupee. Savings plans come after the gap is closed, never instead of it." };

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-8 md:px-8 md:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-[720px]">
          <p className="eyebrow">{heading.eyebrow}</p>
          <h1 className="mt-2 font-display text-[32px] font-bold leading-tight tracking-tight md:text-[44px]">{heading.title}</h1>
          <p className="mt-3 text-[17px] leading-7 text-muted">
            {heading.sub} <Trace id={rules.state === "R4" ? "R4" : rules.state === "R1" ? "R1" : "TC-09"} />
          </p>
        </div>
        <Button variant="outline" size="lg" onClick={() => setQueryParam("panel", "policy")}>
          <FileText className="size-4" aria-hidden /> I already have a policy <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>

      {rules.capRoute ? (
        <p className="mt-6 flex gap-2.5 rounded-2xl border border-warn bg-warn-soft p-4 text-[15px] text-warn-ink">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          <span>
            Your gap of {inr(rules.capRoute.gap)} is above the estimated insurer limit of {inr(rules.capRoute.cap)}. We show both and never cut your need down. An advisor can talk about phased cover or cover for your spouse.{" "}
            <button type="button" className="font-semibold underline" onClick={() => setQueryParam("book", "1")}>
              Book a call
            </button>{" "}
            <Trace id={["R6", "TC-10"]} />
          </span>
        </p>
      ) : null}

      {termCard && chosenProduct && rules.selection ? (
        <div className="mt-8 grid items-stretch gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <TermCard card={termCard} />
          <SliderPanel rules={rules} product={chosenProduct} />
        </div>
      ) : null}

      {savings.length ? (
        <section className="mt-12" aria-labelledby="other-types">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="other-types" className="font-display text-2xl font-semibold">
              Other policy types
            </h2>
            <Trace id={["FR-3.2", "FR-3.7", "FR-3.8"]} />
          </div>
          <p className="mt-2 max-w-[900px] text-[15px] leading-6 text-muted">
            {an.recon.gap > 0
              ? "These mix protection with savings. While your gap is open they stay locked, so they can't replace term cover. Each one shows what it is for, where the money goes and what you'd get back if you stopped early."
              : "These mix protection with savings. Your family is covered, so they are optional add-ons. Each one shows what it is for, where the money goes and what you'd get back if you stopped early."}
          </p>
          <div className="mt-5 grid items-start gap-5 md:grid-cols-2 lg:grid-cols-3">
            {savings.map((c) => (
              <SavingsCard key={c.product.id} card={c} />
            ))}
          </div>
        </section>
      ) : null}

      <div className="mt-8">
        <NotShown items={rules.notShown} />
      </div>

      <div className="no-print mt-8 flex flex-wrap justify-end gap-3">
        <Button asChild variant="outline" size="lg">
          <Link href="/summary">Print summary</Link>
        </Button>
        <Button size="lg" onClick={() => setQueryParam("book", "1")}>
          Book a free advisor call <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>

      {book ? <BookingDrawer rules={rules} onClose={() => setQueryParam("book", null)} /> : null}
    </div>
  );
}

export function OptionsPage() {
  return (
    <ClientGate>
      <Inner />
    </ClientGate>
  );
}
