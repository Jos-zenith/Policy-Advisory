import { Flag } from "lucide-react";
import { inr, pct, type HandoffSnapshot } from "@/engine";
import { Trace } from "@/components/ui/trace";

function Row({ k, v, strong, tone }: { k: string; v: string; strong?: boolean; tone?: "warn" | "green" }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-2.5 text-[14px]">
      <dt className="text-muted">{k}</dt>
      <dd className={`num text-right ${strong ? "font-semibold" : "font-medium"} ${tone === "warn" ? "text-warn" : tone === "green" ? "text-green-ink" : ""}`}>{v}</dd>
    </div>
  );
}

const STATE_TEXT: Record<string, { t: string; tone: "green" | "warn" }> = {
  RIGHT_FIRST: { t: "Right first time", tone: "green" },
  CORRECTED: { t: "Clarified, then right", tone: "warn" },
  WRONG_TWICE: { t: "Explained, still unsure", tone: "warn" },
  WRONG_RETRY: { t: "Needs a second look", tone: "warn" },
  UNANSWERED: { t: "Skipped", tone: "warn" },
};

/** One-page handoff body (FR-7.4). Pure rendering of the immutable snapshot. */
export function HandoffBody({ s }: { s: HandoffSnapshot }) {
  const a = s.assumptions;
  const c = s.choice;
  return (
    <div>
      <div className="grid gap-8 md:grid-cols-3">
        <section>
          <h3 className="font-display text-[17px] font-semibold">Needs and gap</h3>
          <dl className="mt-2">
            <Row k="Total family need" v={inr(s.needs.gross)} strong />
            {s.offsets.map((o) => (
              <Row key={o.key} k={o.key === "OWN" ? "Own policies (paid on death)" : o.key === "EMPLOYER" ? "Employer group cover" : "Savings set aside"} v={`− ${inr(o.amount)}`} />
            ))}
            <div className="border-t-2 border-ink" />
            <Row k={s.state === "GAP" ? "Protection gap" : "Surplus"} v={inr(Math.abs(s.gap))} strong tone={s.state === "GAP" ? "warn" : "green"} />
            <Row k="Income-based estimate" v={s.hlv.status === "NOT_APPLICABLE" ? "Not applicable" : inr(s.hlv.value)} />
            <Row k="Estimated insurer limit" v={inr(s.cap.amount)} />
          </dl>
        </section>
        <section>
          <h3 className="font-display text-[17px] font-semibold">What the customer chose</h3>
          <dl className="mt-2">
            <Row k="Product" v={c.productName ? `${c.productName} (${(c.category ?? "").toLowerCase().replace("_", " ")})` : "None (no recommendation)"} strong />
            {c.cover !== null ? <Row k="Cover · term" v={`${inr(c.cover)} · ${c.term} years`} strong /> : null}
            {c.frequency ? <Row k="Pay · rider" v={`${c.frequency === "YEARLY" ? "Yearly" : "Monthly"} · ${c.rider ? "accidental death" : "none"}`} /> : null}
            {c.annualPremium !== null ? <Row k="Indicative premium" v={`${inr(c.annualPremium)} a year${c.shareOfIncome !== null ? ` · ${pct(c.shareOfIncome)} of income` : ""}`} strong /> : null}
            <Row k="Shown but locked" v={s.shownButLocked.length ? s.shownButLocked.join(", ") : "None"} />
            <Row k="Filtered out" v={s.filteredOut.length ? s.filteredOut.map((f) => f.name).join(", ") : "None"} />
            <Row k="Rules fired" v={c.fired.join(", ") || c.ruleState} />
          </dl>
        </section>
        <section>
          <h3 className="font-display text-[17px] font-semibold">Assumptions used</h3>
          <dl className="mt-2">
            <Row k="Prices rise · return on savings" v={`${pct(a.inflation)} · ${pct(a.discount)}`} />
            <Row k="Income growth · retirement age" v={`${pct(a.incomeGrowth)} · ${a.retirementAge}`} />
            <Row k="Own spending share" v={pct(a.expenseShare, 0)} />
            <Row k="Years of family support" v={String(a.lifeYears)} />
            <Row k="Changed from defaults" v={s.changedFromDefaults.length ? s.changedFromDefaults.map((x) => x.id).join(", ") : "None"} />
            <Row k="Result level" v={s.resultLevel} />
          </dl>
        </section>
      </div>
      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <section>
          <h3 className="font-display text-[17px] font-semibold">Reality check{s.comprehension ? ` · ${s.comprehension.score} of 3 first time` : ""}</h3>
          {s.comprehension ? (
            <dl className="mt-2">
              {s.comprehension.topics.map((t) => {
                const st = STATE_TEXT[s.comprehension![t.id as "q1"].state];
                return <Row key={t.id} k={t.topic} v={st.t} tone={st.tone} />;
              })}
            </dl>
          ) : (
            <p className="mt-2 text-[14px] text-muted">Not taken (no product chosen).</p>
          )}
        </section>
        <section>
          <h3 className="font-display text-[17px] font-semibold">Flags to cover on the call</h3>
          <ul className="mt-2 space-y-2">
            {s.flags.length ? (
              s.flags.map((f) => (
                <li key={f.id} className="flex gap-2.5 rounded-xl bg-warn-soft px-3 py-2.5 text-[14px] text-warn-ink">
                  <Flag className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>
                    {f.text} <Trace id={f.ruleId} />
                  </span>
                </li>
              ))
            ) : (
              <li className="text-[14px] text-muted">No flags.</li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
