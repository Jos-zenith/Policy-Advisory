"use client";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { ENGINE_CONFIG } from "@/config";
import { inr, inrExact, pct, renderStep, type Product, type RulesOutcome } from "@/engine";
import { Segmented } from "@/components/ui/segmented";
import { Slider } from "@/components/ui/slider";
import { Trace } from "@/components/ui/trace";
import { ExplainView } from "@/components/explain/explain-view";
import { useJourney } from "@/lib/journey-store";
import { setQueryParam } from "@/lib/hooks";
import { AffordMeter, CoverageMeter } from "./meters";
import { cn } from "@/lib/cn";
import { useState } from "react";

export function SliderPanel({ rules, product }: { rules: RulesOutcome; product: Product }) {
  const setOptions = useJourney((s) => s.setOptions);
  const profile = useJourney((s) => s.profile);
  const update = useJourney((s) => s.updateProfile);
  const [showCalc, setShowCalc] = useState(false);
  const sel = rules.selection!;
  const qt = rules.quote;
  const terms = rules.validTerms;
  const [cMin, cMax] = rules.coverRange ?? [product.cover[0], product.cover[1]];
  const step = ENGINE_CONFIG.rules.coverSliderStep;
  const freq = ENGINE_CONFIG.rules.frequencies[sel.frequency];
  const ti = Math.max(0, terms.indexOf(sel.term));

  // slider.final is logged by the options page (debounced), so the trail records the settled values.
  const commit = () => {};

  return (
    <section className="card p-6" aria-labelledby="try">
      <div className="flex items-center justify-between gap-2">
        <h2 id="try" className="font-display text-xl font-semibold">
          Try cover, term and premium
        </h2>
        <Trace id={["FR-3.4", "FR-3.5"]} />
      </div>

      <div className="mt-6">
        <div className="flex items-baseline justify-between">
          <span className="text-[15px] font-medium">Cover amount</span>
          <span className="num font-display text-xl font-semibold">{inr(sel.cover)}</span>
        </div>
        <Slider
          className="mt-3"
          label="Cover amount"
          valueText={inr(sel.cover)}
          value={Math.min(Math.max(sel.cover, cMin), cMax)}
          min={cMin}
          max={cMax}
          step={step}
          onChange={(v) => setOptions({ cover: v, productId: product.id })}
          onCommit={commit}
        />
        <div className="mt-1 flex justify-between text-[12px] text-muted-2">
          <span>{inr(cMin)}</span>
          <span>{inr(cMax)}</span>
        </div>
        {rules.gap > 0 ? (
          <div className="mt-3">
            <CoverageMeter cover={sel.cover} gap={rules.gap} />
          </div>
        ) : null}
        {rules.coverLimitedByCap ? (
          <p className="mt-2 text-[13px] text-warn-ink">
            We started at the estimated insurer limit of {inr(rules.capRoute?.cap ?? 0)}, below your gap of {inr(rules.gap)}. An advisor can talk about phased or spousal cover. <Trace id="R6" />
          </p>
        ) : null}
      </div>

      <div className="mt-6">
        <div className="flex items-baseline justify-between">
          <span className="text-[15px] font-medium">Policy term</span>
          <span className="font-display text-xl font-semibold">
            {sel.term} years · to age {profile.age + sel.term}
          </span>
        </div>
        {terms.length > 1 ? (
          <>
            <Slider className="mt-3" label="Policy term" valueText={`${sel.term} years`} value={ti} min={0} max={terms.length - 1} step={1} onChange={(i) => setOptions({ term: terms[i], productId: product.id })} onCommit={commit} />
            <div className="mt-1 flex justify-between text-[12px] text-muted-2">
              {terms.map((t, i) => (
                <span key={t}>{i === terms.length - 1 ? `${t} years` : t}</span>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-2 text-[13px] text-muted-2">Only one term is available for your age.</p>
        )}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
        <div>
          <p className="mb-2 text-[15px] font-medium">Premium payment</p>
          <Segmented
            label="Premium payment"
            value={sel.frequency}
            options={[
              { value: "YEARLY", label: "Yearly" },
              { value: "MONTHLY", label: "Monthly" },
            ]}
            onChange={(v) => {
              setOptions({ frequency: v, productId: product.id });
            }}
          />
        </div>
        {product.riders.length ? (
          <label className={cn("flex h-11 cursor-pointer items-center gap-2 self-end rounded-full border px-4 text-[14px] font-medium", sel.rider ? "border-ink bg-ink text-white" : "border-line")}>
            <input type="checkbox" className="size-4" checked={sel.rider} onChange={(e) => setOptions({ rider: e.target.checked, productId: product.id })} />
            Add accidental death rider
          </label>
        ) : null}
      </div>

      {qt ? (
        <div className="mt-6 rounded-2xl bg-ink p-5 text-white" aria-live="polite">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[14px] text-white/80">Your premium</p>
              <p className="num font-display text-[30px] font-bold leading-tight" data-testid="premium">
                {sel.frequency === "YEARLY" ? `${inrExact(qt.annual)} a year` : `${inrExact(qt.instalment)} a month`}
              </p>
              <p className="text-[13px] text-white/80">{sel.frequency === "YEARLY" ? freq.note : `${inrExact(qt.annual)} a year · ${freq.note}`}</p>
            </div>
            <div className="text-right">
              <p className="text-[14px] text-white/80">Share of your income</p>
              <p className="num font-display text-[30px] font-bold leading-tight">{rules.shareOfIncome === null ? "—" : pct(rules.shareOfIncome)}</p>
              <p className="text-[13px] text-white/80">Budget limit {pct(rules.budget / Math.max(rules.income, 1), 0)}</p>
            </div>
          </div>
        </div>
      ) : null}

      {qt && rules.shareOfIncome !== null ? (
        <div className="mt-4">
          <AffordMeter share={rules.shareOfIncome} limit={rules.budget / rules.income} max={ENGINE_CONFIG.rules.affordabilityMeterMax} />
        </div>
      ) : null}

      {rules.overBudget && rules.ladder ? (
        <div className="mt-5 rounded-2xl border border-warn bg-warn-soft p-4" role="region" aria-label="Ways to fit your budget">
          <p className="flex items-center gap-2 font-semibold text-warn-ink">
            <TriangleAlert className="size-4" aria-hidden /> This is above your budget limit. Try these, in order: <Trace id={["R5", "TC-08"]} />
          </p>
          <ol className="mt-3 space-y-2">
            {rules.ladder.map((l, i) => (
              <li key={l.id} className={cn("flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-3 text-[14px]", !l.available && "opacity-60")}>
                <span>
                  {i + 1}. {renderStep(l.text)}
                </span>
                {l.available && l.id === "LOWER_COVER" ? (
                  <button type="button" className="rounded-full border border-ink px-3 py-1 text-[13px] font-semibold" onClick={() => setOptions({ cover: l.cover, productId: product.id })}>
                    Use this
                  </button>
                ) : null}
                {l.available && l.id === "CHANGE_TERM" ? (
                  <button type="button" className="rounded-full border border-ink px-3 py-1 text-[13px] font-semibold" onClick={() => setOptions({ term: l.term, productId: product.id })}>
                    Use this
                  </button>
                ) : null}
                {l.available && l.id === "DROP_RIDER" ? (
                  <button type="button" className="rounded-full border border-ink px-3 py-1 text-[13px] font-semibold" onClick={() => setOptions({ rider: false, productId: product.id })}>
                    Use this
                  </button>
                ) : null}
                {l.id === "ADVISOR" ? (
                  <button type="button" className="rounded-full bg-ink px-3 py-1 text-[13px] font-semibold text-white" onClick={() => setQueryParam("book", "1")}>
                    Book a call
                  </button>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {qt ? (
        <div className="mt-4 text-[13px] leading-5 text-muted">
          <p>
            <strong className="text-ink">Rate used:</strong> {qt.rateLine}.{" "}
            {qt.exact ? "We never extrapolate outside the table." : <span className="font-semibold text-warn-ink">No exact cell: the nearest valid cell is used ({qt.notes.join("; ")}). We never extrapolate.</span>}
            {qt.bandRuleApplied ? " A higher cover band costs less here, so its lower price is used." : ""}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="text-muted-2">For the rate table:</span>
            <select aria-label="Sex for the rate table" value={profile.sex ?? ""} onChange={(e) => update((p) => ({ ...p, sex: (e.target.value || undefined) as "M" | "F" | undefined }))} className="h-9 rounded-lg border border-line bg-white px-2">
              <option value="">Sex not given (higher rate)</option>
              <option value="M">Male</option>
              <option value="F">Female</option>
            </select>
            <select aria-label="Smoker for the rate table" value={profile.smoker === undefined ? "" : profile.smoker ? "Y" : "N"} onChange={(e) => update((p) => ({ ...p, smoker: e.target.value === "" ? undefined : e.target.value === "Y" }))} className="h-9 rounded-lg border border-line bg-white px-2">
              <option value="">Smoking not given (higher rate)</option>
              <option value="N">Non-smoker</option>
              <option value="Y">Smoker</option>
            </select>
            <button type="button" className="font-semibold text-blue hover:underline" onClick={() => setShowCalc((x) => !x)} aria-expanded={showCalc}>
              {showCalc ? "Hide the calculation" : "Show how this is calculated"}
            </button>
          </div>
          {showCalc ? (
            <div className="mt-3 rounded-2xl border border-line p-4">
              <ExplainView explain={qt.explain} eyebrow="" compact />
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 text-[14px] text-warn-ink">We can&apos;t price this from the sample rate table for your details, so we won&apos;t guess. An advisor can help.</p>
      )}
      <p className="mt-4 text-[12px] text-muted-2">
        Not ready? <Link href="/gap" className="text-blue underline">Go back to your gap</Link>
      </p>
    </section>
  );
}
