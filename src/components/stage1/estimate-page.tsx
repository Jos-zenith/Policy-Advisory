"use client";
import { useEffect, useMemo } from "react";
import Link from "next/link";
import copy from "@/config/content/journey.json";
import { ENGINE_CONFIG } from "@/config";
import { inr, inrExact, validateAge, validateAmount } from "@/engine";
import { ClientGate } from "@/components/journey/client-gate";
import { PersonaChips } from "@/components/journey/persona-chips";
import { Segmented } from "@/components/ui/segmented";
import { Trace } from "@/components/ui/trace";
import { useJourney } from "@/lib/journey-store";
import { useDebounced } from "@/lib/use-debounced";
import { useQuickEstimate } from "@/lib/use-engine";
import { QuickResult } from "./quick-result";
import { cn } from "@/lib/cn";

function Inner() {
  const s = copy.stage1;
  const stage1 = useJourney((st) => st.stage1);
  const setStage1 = useJourney((st) => st.setStage1);
  const log = useJourney((st) => st.log);
  const debounced = useDebounced(stage1, 300);
  const result = useQuickEstimate(debounced);

  const ageError = stage1.age === "" ? null : validateAge(Number(stage1.age), ENGINE_CONFIG);
  const incomeRupees = stage1.incomeLakh === "" ? null : Number(stage1.incomeLakh) * 100_000;
  const incomeError = incomeRupees === null ? null : validateAmount("income", incomeRupees, ENGINE_CONFIG, "Income");

  const logKey = useMemo(() => (result && result.ok ? `${debounced.age}|${debounced.incomeLakh}|${debounced.hasDependants}` : null), [result, debounced]);
  useEffect(() => {
    if (!logKey || !result || !result.ok) return;
    const v = result.value;
    log(
      "estimate.basic",
      { age: Number(debounced.age), income: Number(debounced.incomeLakh) * 100_000, dependants: debounced.hasDependants, low: v.low, high: v.high, verdict: v.verdict, summary: `Age ${debounced.age}, income ${inr(Number(debounced.incomeLakh) * 100_000)}, dependants ${debounced.hasDependants ? "yes" : "no"} → ${inr(v.low)}–${inr(v.high)}` },
      v.bandId,
      { coalesce: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logKey]);

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-10 md:px-8 md:py-14">
      <p className="eyebrow">{s.eyebrow}</p>
      <h1 className="mt-3 font-display text-[34px] font-bold leading-[1.1] tracking-tight md:text-[52px]">{s.title}</h1>
      <p className="mt-4 max-w-[600px] text-[17px] leading-7 text-muted md:text-lg">{s.sub}</p>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <section className="card p-6 md:p-8" aria-labelledby="answers">
          <div className="flex items-center justify-between">
            <h2 id="answers" className="font-display text-[22px] font-semibold">
              {s.answersTitle}
            </h2>
            <Trace id="FR-1.1" />
          </div>
          <p className="eyebrow mt-6">{s.personaLabel}</p>
          <div className="mt-3">
            <PersonaChips />
          </div>
          <hr className="my-6 border-line" />
          <form className="space-y-6" onSubmit={(e) => e.preventDefault()} noValidate>
            <div>
              <label htmlFor="age" className="block text-[15px] font-medium">
                {s.ageLabel}
              </label>
              <input
                id="age"
                inputMode="numeric"
                autoComplete="off"
                value={stage1.age}
                onChange={(e) => setStage1({ age: e.target.value.replace(/[^\d.-]/g, "") })}
                aria-invalid={!!ageError}
                aria-describedby={ageError ? "age-err" : undefined}
                className={cn("mt-2 h-[52px] w-full rounded-xl border bg-white px-4 text-lg outline-none focus:border-blue-mid", ageError ? "border-warn" : "border-line")}
              />
              {ageError ? (
                <p id="age-err" className="mt-1.5 text-sm text-warn-ink">
                  {ageError.message} <Trace id={ageError.code} />
                </p>
              ) : null}
            </div>
            <div>
              <label htmlFor="income" className="block text-[15px] font-medium">
                {s.incomeLabel}
              </label>
              <input
                id="income"
                inputMode="decimal"
                autoComplete="off"
                value={stage1.incomeLakh}
                onChange={(e) => setStage1({ incomeLakh: e.target.value.replace(/[^\d.-]/g, "") })}
                aria-invalid={!!incomeError}
                aria-describedby="income-hint"
                className={cn("mt-2 h-[52px] w-full rounded-xl border bg-white px-4 text-lg outline-none focus:border-blue-mid", incomeError ? "border-warn" : "border-line")}
              />
              <p id="income-hint" className={cn("mt-1.5 text-sm", incomeError ? "text-warn-ink" : "text-muted-2")}>
                {incomeError ? (
                  <>
                    {incomeError.message} <Trace id={incomeError.code} />
                  </>
                ) : incomeRupees !== null && Number.isFinite(incomeRupees) ? (
                  `${inrExact(incomeRupees)} a year${incomeRupees >= 100_000 ? ` (${inr(incomeRupees)})` : ""}`
                ) : (
                  "For example 18 for ₹18 lakh"
                )}
              </p>
            </div>
            <div>
              <p id="dep-label" className="text-[15px] font-medium">
                {s.dependantsLabel}
              </p>
              <Segmented
                className="mt-2"
                size="lg"
                label={s.dependantsLabel}
                value={stage1.hasDependants === null ? ("" as "yes" | "no") : stage1.hasDependants ? "yes" : "no"}
                options={[
                  { value: "yes", label: "Yes" },
                  { value: "no", label: "No" },
                ]}
                onChange={(v) => setStage1({ hasDependants: v === "yes" })}
              />
            </div>
          </form>
          <p className="mt-5 text-[13px] text-muted-2">{s.liveNote}</p>
        </section>

        <QuickResult result={result} />
      </div>

      <p className="eyebrow mt-10">{s.nextEyebrow}</p>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {s.next.map((n) => (
          <Link key={n.title} href={n.href} className="card block p-5 transition-colors hover:border-ink/30">
            <h3 className="font-display text-[17px] font-semibold">{n.title}</h3>
            <p className="mt-2 text-[15px] leading-6 text-muted">{n.body}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function EstimatePage() {
  return (
    <ClientGate>
      <Inner />
    </ClientGate>
  );
}
