"use client";
import { useMemo, useState } from "react";
import * as Accordion from "@radix-ui/react-accordion";
import { ArrowLeft, Check, ChevronDown, TriangleAlert } from "lucide-react";
import personasJson from "@/config/content/personas.json";
import { ENGINE_CONFIG } from "@/config";
import { bridge, inr, inrExact, pct, priceProduct, renderStep, type BridgeOptionId } from "@/engine";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { Trace } from "@/components/ui/trace";
import { Term } from "@/components/ui/tooltip";
import { MoneyField } from "@/components/ui/money-field";
import { useJourney, type ExistingPolicyInput } from "@/lib/journey-store";
import { setQueryParam } from "@/lib/hooks";
import { useRules } from "@/components/stage3/use-options";
import { cn } from "@/lib/cn";

const SAMPLE = personasJson.personas.find((p) => p.id === "arjun")!.existingPolicy as ExistingPolicyInput;

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "warn" }) {
  return (
    <div className="card p-4">
      <p className="eyebrow">{label}</p>
      <p className={cn("num mt-1.5 font-display text-[22px] font-bold", tone === "warn" && "text-warn")}>{value}</p>
      <p className="mt-0.5 text-[13px] leading-5 text-muted">{sub}</p>
    </div>
  );
}

function Chart({ rows, maturityYear }: { rows: ReturnType<typeof bridge>["rows"]; maturityYear: number }) {
  const max = Math.max(...rows.map((r) => Math.max(r.paid, r.back)), 1);
  const W = 640;
  const H = 220;
  const bw = W / rows.length;
  const y = (v: number) => H - (v / max) * (H - 10);
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H + 34}`} className="w-full" role="img" aria-label="Paid so far and money back if you stop, year by year">
        {rows.map((r, i) => {
          const x = i * bw;
          const backColor = r.isMaturity ? "#15803d" : r.isToday ? "#c2410c" : "#2f6fd1";
          return (
            <g key={r.year}>
              <rect x={x + bw * 0.12} y={y(r.paid)} width={bw * 0.76} height={H - y(r.paid)} rx={4} fill="#e1e6ef" />
              <rect x={x + bw * 0.28} y={y(r.back)} width={bw * 0.44} height={Math.max(1, H - y(r.back))} rx={3} fill={backColor} />
              <text x={x + bw / 2} y={H + 16} textAnchor="middle" fontSize="12" fill="#4a5468">
                {r.year}
              </text>
              {r.isToday || r.isMaturity ? (
                <text x={x + bw / 2} y={H + 30} textAnchor="middle" fontSize="10" fontWeight="700" fill={r.isToday ? "#c2410c" : "#15803d"}>
                  {r.isToday ? "TODAY" : "END"}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-4 text-[12px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-line" /> Paid so far
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-blue-mid" /> Back if you stop
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-warn" /> Today
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-[#15803d]" /> Maturity (year {maturityYear})
        </span>
      </figcaption>
      <details className="mt-2 text-[13px]">
        <summary className="font-medium text-blue">View as a table</summary>
        <div className="scroll-x mt-2">
          <table className="w-full min-w-[360px] text-left">
            <thead>
              <tr className="border-b border-line text-muted-2">
                <th className="py-1.5">Year</th>
                <th className="py-1.5">Paid by then</th>
                <th className="py-1.5">Back if you stop</th>
                <th className="py-1.5 text-right">%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.year} className="border-b border-line">
                  <td className="py-1.5">
                    {r.year}
                    {r.isToday ? " (today)" : r.isMaturity ? " (maturity)" : ""}
                  </td>
                  <td className="num py-1.5">{inrExact(r.paid)}</td>
                  <td className="num py-1.5">{inrExact(r.back)}</td>
                  <td className="num py-1.5 text-right">{pct(r.pct, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

export function BridgePanel() {
  const { rules, catalog, analysis } = useRules();
  const stored = useJourney((s) => s.existingPolicy);
  const setExisting = useJourney((s) => s.setExistingPolicy);
  const profile = useJourney((s) => s.profile);
  const [chosen, setChosen] = useState<BridgeOptionId | null>(null);
  const ep = stored ?? null;

  const result = useMemo(() => {
    if (!ep || !rules || !catalog || !analysis.result.ok) return null;
    const prod = catalog.products.find((p) => p.id === (rules.recommendedId ?? rules.selection?.productId));
    const table = prod ? catalog.rateTables.find((t) => t.id === prod.rateTableId) : undefined;
    const term = rules.selection?.term;
    const priceTerm = (cover: number) => {
      if (!prod || !table) return null;
      const r = priceProduct(prod, table, { age: profile.age, sex: profile.sex, smoker: profile.smoker, term, cover: Math.min(Math.max(cover, prod.cover[0]), prod.cover[1]), frequency: "YEARLY", rider: false }, ENGINE_CONFIG);
      return r.ok ? r.annual : null;
    };
    return {
      r: bridge(ep, { gap: analysis.result.value.recon.gap, income: analysis.result.value.income.income, affordCap: analysis.assumptions.affordCap, coverStep: ENGINE_CONFIG.rules.coverStep, ssvScheduleId: analysis.assumptions.ssvScheduleId, priceTerm }, ENGINE_CONFIG),
      prodName: prod?.name ?? "term cover",
      tableId: prod?.rateTableId ?? "",
      term,
    };
  }, [ep, rules, catalog, analysis, profile]);

  const set = (patch: Partial<ExistingPolicyInput>) => setExisting({ ...(ep ?? SAMPLE), ...patch });

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-8 md:px-8 md:py-10">
      <button type="button" onClick={() => setQueryParam("panel", null)} className="inline-flex items-center gap-1.5 font-semibold text-blue hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Back to options
      </button>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">
            Existing policy <Trace id={["FR-6.1", "CUJ-3"]} />
          </p>
          <h1 className="mt-1 font-display text-[30px] font-bold leading-tight md:text-[40px]">{ep ? `${ep.name} · ${ep.category === "WHOLE_LIFE" ? "Whole life" : "Endowment"}` : "Review a policy you already have"}</h1>
          <p className="mt-2 text-[15px] text-muted">Sample policy. 2024 surrender rules, illustrative. Ask your insurer for your exact figures.</p>
        </div>
      </div>

      <section className="card mt-6 p-5 md:p-6" aria-labelledby="policy-inputs">
        <h2 id="policy-inputs" className="font-display text-lg font-semibold">
          Your policy
        </h2>
        {!ep ? (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <p className="text-muted">Enter the figures from your policy document, or start from the sample.</p>
            <Button variant="outline" onClick={() => setExisting(SAMPLE)}>
              Use the sample policy (SureSave 16)
            </Button>
          </div>
        ) : (
          <div className="mt-3 grid gap-x-4 sm:grid-cols-2 lg:grid-cols-5">
            <MoneyField label="Paid if you die (death cover)" value={ep.deathSumAssured} onChange={(v) => set({ deathSumAssured: v ?? 0 })} />
            <MoneyField label="Premium a year" value={ep.annualPremium} onChange={(v) => set({ annualPremium: v ?? 0 })} />
            <label className="block text-[13px] font-medium text-muted">
              Policy term (years)
              <input type="number" min={2} max={60} value={ep.policyTerm} onChange={(e) => set({ policyTerm: Number(e.target.value) })} className="mt-1 h-11 w-full rounded-xl border border-line px-3 text-ink" />
            </label>
            <label className="block text-[13px] font-medium text-muted">
              Current policy year
              <input type="number" min={1} max={ep.policyTerm - 1} value={ep.policyYear} onChange={(e) => set({ policyYear: Number(e.target.value) })} className="mt-1 h-11 w-full rounded-xl border border-line px-3 text-ink" />
            </label>
            <MoneyField label="Maturity value (optional)" value={ep.maturityBenefit ?? null} onChange={(v) => set({ maturityBenefit: v ?? undefined })} hint="Sample default if left blank" />
          </div>
        )}
        {result && !result.r.valid ? (
          <ul className="mt-2 list-disc pl-5 text-[14px] text-warn-ink" role="alert">
            {result.r.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : null}
      </section>

      {result && result.r.valid && ep ? (
        <BridgeBody r={result.r} ep={ep} prodName={result.prodName} tableId={result.tableId} age={profile.age} term={result.term} chosen={chosen ?? result.r.suggested} onChoose={setChosen} />
      ) : null}
    </div>
  );
}

function BridgeBody({ r, ep, prodName, tableId, age, term, chosen, onChoose }: { r: ReturnType<typeof bridge>; ep: ExistingPolicyInput; prodName: string; tableId: string; age: number; term?: number; chosen: BridgeOptionId; onChoose: (id: BridgeOptionId) => void }) {
  const opt = r.options.find((o) => o.id === chosen)!;
  const sug = r.options.find((o) => o.id === r.suggested)!;
  const today = r.rows.find((x) => x.isToday)!;
  return (
    <>
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Stat label="Paid so far" value={inrExact(r.paidSoFar)} sub={`${ep.policyYear} of ${ep.policyTerm} yearly premiums`} />
        <Stat label="Back if you stop today" value={inrExact(r.surrenderToday)} sub={`${pct(r.surrenderPctToday, 0)} of what you've paid`} />
        <Stat label="Lost if you stop today" value={inrExact(r.lossToday)} sub="Gone for good" tone="warn" />
        <Stat label="Paid if you die" value={inrExact(ep.deathSumAssured)} sub="Already in your gap sum" />
        <Stat label="Still to pay" value={inrExact(r.stillToPay)} sub={`${r.yearsLeft} more years × ${inrExact(ep.annualPremium)}`} />
        <Stat label="Share of income" value={r.shareOfIncome === null ? "—" : pct(r.shareOfIncome)} sub={`${inrExact(ep.annualPremium)} a year`} />
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="card p-5 md:p-6" aria-labelledby="yby">
            <h2 id="yby" className="font-display text-lg font-semibold">
              What you&apos;d get back, year by year
            </h2>
            <div className="mt-4">
              <Chart rows={r.rows} maturityYear={ep.policyTerm} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-bg-alt p-4 text-[14px] md:grid-cols-4">
              <div>
                <dt className="eyebrow">Year {today.year} · today</dt>
                <dd className="mt-1 font-semibold">{pct(today.pct, 0)} of what you paid</dd>
              </div>
              <div>
                <dt className="eyebrow">Paid by then</dt>
                <dd className="num mt-1 font-semibold">{inrExact(today.paid)}</dd>
              </div>
              <div>
                <dt className="eyebrow">You&apos;d get back</dt>
                <dd className="num mt-1 font-semibold">{inrExact(today.back)}</dd>
              </div>
              <div>
                <dt className="eyebrow">You&apos;d lose</dt>
                <dd className="num mt-1 font-semibold text-warn">{inrExact(today.paid - today.back)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-[12px] leading-5 text-muted-2">
              Illustrative: the higher of <Term k="gsv">guaranteed value</Term> (schedule {ep.surrenderScheduleId}) and <Term k="ssv">special value</Term> (A-SSV, placeholder). Maturity {ep.maturityBenefit ? "as entered" : "is a sample default"}. Ask your insurer for your exact figures. <Trace id={["FR-4.1", "4.2"]} />
            </p>
          </section>

          <section className="card p-5 md:p-6" aria-labelledby="four">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="four" className="font-display text-lg font-semibold">
                Your four options, side by side
              </h2>
              <span className="text-[14px] text-muted-2">Pick one to see what it means for you</span>
            </div>
            <div role="radiogroup" aria-label="Your four options" className="mt-4 space-y-3">
              {r.options.map((o) => {
                const active = o.id === chosen;
                return (
                  <button
                    key={o.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => onChoose(o.id)}
                    className={cn("grid w-full grid-cols-1 items-center gap-3 rounded-2xl border p-4 text-left sm:grid-cols-[1.3fr_1fr_1fr_1fr_auto]", active ? "border-2 border-ink" : "border-line hover:bg-bg-alt")}
                  >
                    <span className="flex items-center gap-3 font-semibold">
                      <span className={cn("grid size-5 shrink-0 place-items-center rounded-full border-2", active ? "border-ink" : "border-muted-2")}>{active ? <span className="size-2.5 rounded-full bg-ink" /> : null}</span>
                      {o.title}
                    </span>
                    <span className="text-[13px]">
                      <span className="eyebrow block">Yearly outlay</span>
                      <span className="num font-semibold">{o.yearlyOutlay === null ? "—" : `${inrExact(o.yearlyOutlay)} · ${o.shareOfIncome === null ? "—" : pct(o.shareOfIncome)}`}</span>
                    </span>
                    <span className="text-[13px]">
                      <span className="eyebrow block">Paid if you die</span>
                      <span className="num font-semibold">{o.paidIfDieParts.length > 1 && o.id === "PAID_UP_BUY_TERM" ? `${inr(o.paidIfDieParts[0].amount)} + ${inr(o.paidIfDieParts[1].amount)}` : inr(o.paidIfDie)}</span>
                    </span>
                    <span className="text-[13px]">
                      <span className="eyebrow block">Money back</span>
                      <span className="num font-semibold">{o.moneyBack.when === "today" ? `${inrExact(o.moneyBack.amount)} today` : `${o.id === "PAID_UP_BUY_TERM" ? "About " : ""}${inr(o.moneyBack.amount)} in year ${o.moneyBack.year}`}</span>
                    </span>
                    <Pill tone={o.id === r.suggested ? "green" : o.closesGap ? "blue" : "warn"} className="justify-self-start text-[12px]">
                      {o.tag}
                    </Pill>
                  </button>
                );
              })}
            </div>
            <div className="mt-4 rounded-2xl border border-line p-4">
              <p className="text-[15px] leading-6">{renderStep(opt.summary)}</p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-green-ink">Works in your favour</p>
                  <ul className="mt-1.5 space-y-1.5 text-[14px]">
                    {opt.pros.map((x, i) => (
                      <li key={i} className="flex gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-green-ink" aria-hidden />
                        {renderStep(x)}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-warn-ink">Watch out for</p>
                  <ul className="mt-1.5 space-y-1.5 text-[14px]">
                    {opt.cons.map((x, i) => (
                      <li key={i} className="flex gap-2">
                        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
                        {renderStep(x)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
            <p className="mt-3 text-[12px] leading-5 text-muted-2">
              Term premiums from sample table {tableId} ({prodName}, age {age}
              {term ? `, ${term} years` : ""}). <Term k="paidUp">Paid-up</Term> value = cover × premiums paid ÷ premiums due ({ep.policyYear} ÷ {ep.policyTerm}). Money-back figures are illustrative.
            </p>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-3xl bg-ink p-6 text-white" aria-labelledby="suggest">
            <Pill tone="green" icon={<Check className="size-3.5" aria-hidden />}>
              Our suggestion
            </Pill>
            <h2 id="suggest" className="mt-3 font-display text-[22px] font-semibold leading-tight">
              {sug.id === "KEEP_ADD_TERM" ? `Keep ${ep.name} and add ${inr(sug.termCover)} of term cover` : sug.id === "PAID_UP_BUY_TERM" ? `Make ${ep.name} paid-up and add ${inr(sug.termCover)} of term cover` : sug.id === "STOP_BUY_TERM" ? `Stop ${ep.name} and buy ${inr(sug.termCover)} of term cover` : `Keep ${ep.name}; your family is covered`}
            </h2>
            <ul className="mt-3 space-y-2 text-[14px]">
              {sug.pros.map((x, i) => (
                <li key={i} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-green-bg" aria-hidden />
                  {renderStep(x)}
                </li>
              ))}
              {sug.shareOfIncome !== null ? (
                <li className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-green-bg" aria-hidden />
                  Yearly outlay together: {pct(sug.shareOfIncome)} of income
                </li>
              ) : null}
            </ul>
            <p className="mt-4 rounded-2xl bg-white/10 p-3 text-[14px] font-medium">{renderStep(r.warning)}</p>
            <p className="mt-2 text-[12px] text-white/70">
              How we choose: keep it and add term if both premiums fit your budget; otherwise make it paid-up; otherwise stop it. <Trace id={r.suggestionRule} className="bg-white/15 text-white" />
            </p>
            <Button variant="light" className="mt-4" onClick={() => setQueryParam("panel", null)}>
              See term options
            </Button>
          </section>

          <section className="card p-6" aria-labelledby="timeline">
            <h2 id="timeline" className="font-display text-lg font-semibold">
              Policy timeline
            </h2>
            <ol className="relative mt-4 space-y-4 border-l-2 border-line pl-5">
              {r.timeline.map((t) => (
                <li key={t.label} className="relative">
                  <span className={cn("absolute -left-[27px] top-1 size-3.5 rounded-full border-2 bg-white", t.kind === "now" ? "border-warn bg-warn" : t.kind === "maturity" ? "border-[#15803d]" : "border-muted-2")} aria-hidden />
                  <p className={cn("font-semibold", t.kind === "now" && "text-warn")}>{t.label}</p>
                  <p className="text-[14px] text-muted">{renderStep(t.note)}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="card p-6" aria-labelledby="know">
            <div className="flex items-center justify-between">
              <h2 id="know" className="font-display text-lg font-semibold">
                Know before you decide
              </h2>
              <Trace id="FR-9.5" />
            </div>
            <Accordion.Root type="single" collapsible defaultValue="death" className="mt-2">
              {[
                { v: "death", t: "Death cover or maturity value?", b: `Death cover is what your family gets if you die: ${inr(ep.deathSumAssured)} here. Maturity value is what you get if you live to the end. Only death cover protects your family, so only it counts in your gap.` },
                { v: "gsv", t: "Guaranteed or special surrender value?", b: "The guaranteed value is a minimum set as a share of premiums paid. Insurers may offer a special value instead if it is higher. We show the higher of the two, using placeholder figures." },
                { v: "paidup", t: 'What does "paid-up" mean?', b: `You stop paying, but the policy carries on with smaller cover in proportion to what you've paid: ${ep.policyYear} of ${ep.policyTerm} premiums here.` },
                { v: "rules", t: "The 2024 surrender rules", b: `Our schedule (${ep.surrenderScheduleId}) uses the 2024-framework figures from the brief for years 2 to 7: ${pct(r.rows[1]?.pct ?? 0, 0)} to ${pct(r.rows[6]?.pct ?? 0, 0)} of premiums paid. Later years are an illustrative ramp. In the first few years you get back much less than you paid.` },
                { v: "why", t: "Why not a new savings plan?", b: "A savings plan spends most of each premium on savings, so the same money buys far less cover. To fix a protection gap, term cover does the job for a fraction of the cost." },
              ].map((x) => (
                <Accordion.Item key={x.v} value={x.v} className="border-b border-line last:border-b-0">
                  <Accordion.Header>
                    <Accordion.Trigger className="group flex w-full items-center justify-between py-3 text-left text-[15px] font-semibold">
                      {x.t}
                      <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" aria-hidden />
                    </Accordion.Trigger>
                  </Accordion.Header>
                  <Accordion.Content className="pb-3 text-[14px] leading-6 text-muted">{x.b}</Accordion.Content>
                </Accordion.Item>
              ))}
            </Accordion.Root>
          </section>
        </div>
      </div>
    </>
  );
}
