"use client";
import { useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { ASSUMPTION_DEFS, DEFAULT_ASSUMPTIONS, ENGINE_CONFIG } from "@/config";
import { analyse, inr, pct, roundTo, type AssumptionDef, type Assumptions, type Profile } from "@/engine";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { StepperInput } from "@/components/ui/stepper-input";
import { Trace } from "@/components/ui/trace";
import { useJourney } from "@/lib/journey-store";
import { cn } from "@/lib/cn";

const ADJUSTABLE = ASSUMPTION_DEFS.filter((d) => d.adjustable);

function show(d: AssumptionDef, v: number): string {
  return d.unit === "pct" ? pct(v, d.step && d.step < 0.01 ? 1 : 0) : String(v);
}

function gapOf(p: Profile, a: Assumptions): number | null {
  const r = analyse(p, a, ENGINE_CONFIG);
  return r.ok ? r.value.recon.gap : null;
}

function AssumptionRows({ profile, a }: { profile: Profile; a: Assumptions }) {
  const setAssumption = useJourney((s) => s.setAssumption);
  const current = gapOf(profile, a);
  return (
    <ul className="divide-y divide-line">
      {ADJUSTABLE.map((d) => {
        const v = a[d.key] as number;
        const def = d.value as number;
        const changed = Math.abs(v - def) > 1e-9;
        // Effect of this one change: current gap vs the same inputs with only this assumption at its default.
        const withoutThis = changed ? gapOf(profile, { ...a, [d.key]: def }) : null;
        const effect = changed && current !== null && withoutThis !== null ? current - withoutThis : null;
        const step = d.step ?? 1;
        const next = (dir: 1 | -1) => roundTo(v + dir * step, 6);
        return (
          <li key={d.id} className="flex items-center justify-between gap-4 py-3.5">
            <div className="min-w-0">
              <p className="font-medium">{d.label}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[13px] text-muted-2">
                <Trace id={d.id} />
                {changed ? (
                  <span className={cn("num", effect !== null && effect > 0 ? "text-warn-ink" : "text-green-ink")}>
                    Default {show(d, def)} · effect on gap {effect === null ? "—" : `${effect >= 0 ? "+" : "−"}${inr(Math.abs(effect))}`}
                  </span>
                ) : (
                  <span>Default</span>
                )}
              </p>
            </div>
            <StepperInput
              label={d.label}
              display={show(d, v)}
              canDec={d.min === undefined || next(-1) >= d.min}
              canInc={d.max === undefined || next(1) <= d.max}
              onDec={() => setAssumption(d.key, next(-1) as never)}
              onInc={() => setAssumption(d.key, next(1) as never)}
            />
          </li>
        );
      })}
    </ul>
  );
}

export function AssumptionsCard({ profile, a }: { profile: Profile; a: Assumptions }) {
  const [open, setOpen] = useState(false);
  const reset = useJourney((s) => s.resetAssumptions);
  const changedCount = ADJUSTABLE.filter((d) => Math.abs((a[d.key] as number) - (d.value as number)) > 1e-9).length;
  const gapNow = useMemo(() => gapOf(profile, a), [profile, a]);
  const gapDefault = useMemo(() => gapOf(profile, DEFAULT_ASSUMPTIONS), [profile]);
  const bands = ENGINE_CONFIG.bands;

  return (
    <section className="card p-6 md:p-7" aria-labelledby="adjust">
      <div className="flex items-center justify-between gap-3">
        <h2 id="adjust" className="font-display text-xl font-semibold">
          Adjust assumptions
        </h2>
        <Button variant="soft" size="sm" className="shrink-0 whitespace-nowrap" onClick={reset} disabled={!changedCount}>
          Reset to defaults
        </Button>
      </div>
      <p className="mt-2 text-[14px] text-muted">
        {changedCount ? `${changedCount} changed from the defaults.` : "Using the default assumptions."} Each change shows its effect on your gap. <Trace id={["FR-2.9", "FR-9.4"]} />
      </p>
      <dl className="mt-4 divide-y divide-line text-[14px]">
        {ADJUSTABLE.map((d) => (
          <div key={d.id} className="flex justify-between py-2">
            <dt className="text-muted">{d.label}</dt>
            <dd className="num font-semibold">{show(d, a[d.key] as number)}</dd>
          </div>
        ))}
      </dl>
      <Button className="mt-4 w-full" variant="outline" onClick={() => setOpen(true)}>
        <SlidersHorizontal className="size-4" aria-hidden /> Adjust assumptions
      </Button>
      <p className="mt-3 text-[13px] text-muted-2">Defaults are placeholders for a finance reviewer to confirm, not industry standards.</p>

      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="Adjust assumptions"
        description="Each change shows its effect on your gap. Everything else stays as entered."
        headerExtra={
          <Button variant="soft" size="sm" onClick={reset} disabled={!changedCount}>
            Reset
          </Button>
        }
      >
        <div className="rounded-2xl bg-bg-alt p-4" aria-live="polite">
          <p className="text-sm text-muted-2">Your gap with these assumptions</p>
          <p className="num font-display text-3xl font-bold">{gapNow === null ? "Check inputs" : inr(gapNow)}</p>
          {gapNow !== null && gapDefault !== null && Math.abs(gapNow - gapDefault) > 0.5 ? (
            <p className="num mt-1 text-sm text-muted">
              With defaults: {inr(gapDefault)} ({gapNow - gapDefault >= 0 ? "+" : "−"}
              {inr(Math.abs(gapNow - gapDefault))})
            </p>
          ) : null}
        </div>
        <AssumptionRows profile={profile} a={a} />
        <div className="mt-6 rounded-2xl border border-line p-4 text-[13px] text-muted">
          <p className="font-semibold text-ink">Fixed placeholders (config {ENGINE_CONFIG.configVersion})</p>
          <p className="mt-2">Stage 1 starting range, with dependants: {bands.quickEstimate.withDependants.map((b) => `${b.minAge}${b.maxAge >= 120 ? "+" : `–${b.maxAge}`}: ${b.low}–${b.high}×`).join(" · ")}. Without dependants: {bands.quickEstimate.noDependants.low}–{bands.quickEstimate.noDependants.high}×.</p>
          <p className="mt-2">Estimated insurer limit: {bands.insurerCap.map((b) => `${b.minAge}${b.maxAge >= 120 ? "+" : `–${b.maxAge}`}: ${b.multiple}×`).join(" · ")} income.</p>
          <p className="mt-2">Budget limit for premiums: {pct(a.affordCap, 0)} of income. To be confirmed by a finance reviewer.</p>
        </div>
      </Sheet>
    </section>
  );
}
