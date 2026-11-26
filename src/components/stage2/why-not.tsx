"use client";
import { inr, renderStep, type SensitivityResult } from "@/engine";
import { Trace } from "@/components/ui/trace";

const RUNWAY_COLORS = ["bg-blue", "bg-[#8fa9e3]", "bg-[#b9c5dd]", "bg-[#cfd8ea]", "bg-[#dde4f1]", "bg-[#e6ebf5]", "bg-[#eef1f8]"];

/** "Why ₹X and not ₹Y?" (FR-2.11): runway bar + one-at-a-time sensitivity table. */
export function WhyNot({ gap, sens }: { gap: number; sens: SensitivityResult }) {
  const rw = sens.runway;
  return (
    <section className="card p-6 md:p-8" aria-labelledby="why-not">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 id="why-not" className="font-display text-[22px] font-semibold">
          {rw && gap > 0 ? `Why ${inr(gap)} and not ${inr(rw.amount)}?` : "What could change this"}
        </h2>
        <Trace id={["FR-2.11", "promoted to P0"]} />
      </div>
      <div className="mt-6 grid gap-8 lg:grid-cols-2 [&>*]:min-w-0">
        {rw && gap > 0 ? (
          <div>
            <h3 className="font-semibold">What {inr(rw.amount)} would cover on its own</h3>
            <p className="mt-1 text-[13px] text-muted-2">Before counting the cover and savings you already have. Loans first, then living costs, then goals.</p>
            <div className="mt-3 flex h-11 overflow-hidden rounded-lg" role="img" aria-label={rw.funded.map((f) => renderStep(f.label)).join(", ")}>
              {rw.funded.map((f, i) => (
                <div key={f.key} className={`${RUNWAY_COLORS[i % RUNWAY_COLORS.length]} flex min-w-0 items-center px-2.5 text-[12px] font-medium ${i === 0 ? "text-white" : "text-ink"}`} style={{ width: `${(f.amount / rw.amount) * 100}%` }}>
                  <span className="truncate">{renderStep(f.label)}</span>
                </div>
              ))}
            </div>
            <ul className="mt-3 space-y-1 text-[14px] text-muted sm:hidden">
              {rw.funded.map((f) => (
                <li key={f.key}>• {renderStep(f.label)}</li>
              ))}
            </ul>
            <p className="mt-4 text-[15px] leading-6 text-muted">{renderStep(rw.summary)}</p>
          </div>
        ) : (
          <p className="text-[15px] text-muted">There&apos;s no gap to compare against. The table shows how the result moves if an assumption changes.</p>
        )}
        <div>
          <h3 className="font-semibold">If an assumption changes</h3>
          <div className="scroll-x mt-3">
            <table className="w-full min-w-[420px] text-left text-[14px]">
              <thead>
                <tr className="border-b border-line text-[12px] uppercase tracking-[0.06em] text-muted-2">
                  <th className="py-2 pr-3 font-semibold">Change</th>
                  <th className="py-2 pr-3 text-right font-semibold">Lower</th>
                  <th className="py-2 text-right font-semibold">Higher</th>
                </tr>
              </thead>
              <tbody>
                {sens.rows.map((r) => (
                  <tr key={r.id} className="border-b border-line">
                    <td className="py-3 pr-3">
                      {renderStep(r.label)} <Trace id={r.change} />
                    </td>
                    <td className="num py-3 pr-3 text-right">{r.lower === null ? "—" : inr(r.lower)}</td>
                    <td className="num py-3 text-right">{r.higher === null ? "—" : inr(r.higher)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[13px] text-muted-2">{renderStep(sens.note)}</p>
        </div>
      </div>
    </section>
  );
}
