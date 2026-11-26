"use client";
import { Check, Lock } from "lucide-react";
import ui from "@/config/content/ui.json";
import { ENGINE_CONFIG, DEFAULT_ASSUMPTIONS } from "@/config";
import { CATEGORY_LABELS, eligibilityLine, inrExact, pct, renderStep, surrenderProfile, type ProductCard, type RulesOutcome } from "@/engine";
import { Pill } from "@/components/ui/pill";
import { Trace } from "@/components/ui/trace";
import { Term } from "@/components/ui/tooltip";
import { SplitBar } from "./meters";
import { cn } from "@/lib/cn";

export function TermCard({ card }: { card: ProductCard }) {
  const p = card.product;
  const sp = surrenderProfile(p, ENGINE_CONFIG, DEFAULT_ASSUMPTIONS.ssvScheduleId, 0);
  return (
    <article className="card flex h-full flex-col border-2 border-ink p-6" aria-labelledby={`p-${p.id}`}>
      <div className="flex items-center justify-between gap-2">
        <Pill tone="green" icon={<Check className="size-3.5" aria-hidden />}>
          {card.status === "RECOMMENDED" ? "Recommended first" : card.status === "OPTIONAL" ? "Available if you need it" : "Also eligible"}
        </Pill>
        <Trace id={["Rule R1", "FR-3.1"]} />
      </div>
      <p className="eyebrow mt-5">{CATEGORY_LABELS[p.category]} · Sample product</p>
      <h2 id={`p-${p.id}`} className="mt-1 font-display text-2xl font-semibold">
        {p.name}
      </h2>
      <div className="mt-4 rounded-2xl bg-bg-alt p-4">
        <p className="eyebrow">What problem it solves</p>
        <p className="mt-1.5 text-[16px] leading-6">{p.problemSolved}</p>
      </div>
      <p className="mt-5 text-[14px] font-semibold">Where your premium goes</p>
      <div className="mt-1.5">
        <SplitBar savingsShare={p.savingsShare} />
      </div>
      <p className="mt-4 text-[14px] leading-6 text-muted">
        <strong className="text-ink">If you stop paying:</strong> {renderStep(sp.line).replace(/^If you stop paying: /, "")} <Trace id="FR-4.4" />
      </p>
      <p className="mt-2 text-[14px] leading-6 text-muted">
        <strong className="text-ink">You&apos;re eligible:</strong> {eligibilityLine(p)}. <Trace id="FR-3.3" />
      </p>
      <p className="mt-2 text-[14px] leading-6 text-muted">
        <strong className="text-ink">How the seller is paid:</strong> {ui.remunerationPlaceholder}
      </p>
    </article>
  );
}

const SAVINGS_WORD: Record<string, string> = { WHOLE_LIFE: "Savings", ENDOWMENT: "Savings", ULIP: "Investment" };

export function SavingsCard({ card }: { card: ProductCard }) {
  const p = card.product;
  const locked = card.status === "LOCKED";
  const sp = surrenderProfile(p, ENGINE_CONFIG, DEFAULT_ASSUMPTIONS.ssvScheduleId, ENGINE_CONFIG.surrender.cardIllustrationPremium);
  const showYears = ENGINE_CONFIG.surrender.cardDisplayYears;
  return (
    <article className={cn("card flex flex-col p-5", locked && "bg-white")} aria-labelledby={`p-${p.id}`} data-status={card.status}>
      <div className="flex items-center justify-between gap-2">
        {locked ? (
          <Pill tone="locked" icon={<Lock className="size-3.5" aria-hidden />}>
            Locked
          </Pill>
        ) : (
          <Pill tone="blue">{card.ruleId === "R2" ? "Add-on, not instead of term" : "Optional add-on"}</Pill>
        )}
        <Trace id={`Rule ${card.ruleId}`} />
      </div>
      <p className="eyebrow mt-4">
        {p.category === "ULIP" ? "ULIP" : CATEGORY_LABELS[p.category]} · Sample
      </p>
      <h3 id={`p-${p.id}`} className="mt-1 font-display text-xl font-semibold">
        {p.name}
      </h3>
      <p className="eyebrow mt-4">What problem it solves</p>
      <p className="mt-1 text-[15px] leading-6">{p.problemSolved}</p>
      <div className="mt-4">
        <SplitBar savingsShare={p.savingsShare} savingsWord={SAVINGS_WORD[p.category]} />
      </div>
      {sp.kind === "SCHEDULE" && p.category === "ENDOWMENT" ? (
        <div className="mt-4">
          <p className="text-[14px] font-semibold">
            {renderStep(sp.line)} · <Term k="surrenderValue">surrender value</Term>
          </p>
          <div className="scroll-x">
            <table className="mt-2 w-full min-w-[260px] text-[14px]">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-[0.06em] text-muted-2">
                  <th className="py-2 font-semibold">Year</th>
                  <th className="py-2 font-semibold">Paid</th>
                  <th className="py-2 font-semibold">Back</th>
                  <th className="py-2 text-right font-semibold">%</th>
                </tr>
              </thead>
              <tbody>
                {sp.rows
                  .filter((r) => showYears.includes(r.year))
                  .map((r) => (
                    <tr key={r.year} className="border-b border-line">
                      <td className="py-2">{r.year}</td>
                      <td className="num py-2">{inrExact(r.paid)}</td>
                      <td className="num py-2">{inrExact(r.back)}</td>
                      <td className="num py-2 text-right">{pct(r.pct, 0)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[12px] leading-5 text-muted-2">
            {renderStep(sp.note)} <Trace id={["FR-4.1", "4.2"]} />
          </p>
        </div>
      ) : null}
      {sp.kind === "ULIP" ? (
        <p className="mt-4 text-[14px] leading-6 text-muted">
          <strong className="text-ink">If you stop early:</strong> {renderStep(sp.line).replace(/^If you stop early: /, "")} <Term k="discontinuance">What&apos;s a discontinuance fund?</Term> <Trace id="FR-4.3" />
        </p>
      ) : null}
      {card.reason && !locked ? <p className="mt-4 text-[14px] text-muted">{renderStep(card.reason)}</p> : null}
      {card.unlock ? (
        <p className="mt-4 rounded-2xl bg-bg-alt p-4 text-[14px] leading-6 text-muted">
          <strong className="text-ink">{locked ? "Unlocks when:" : "Price:"}</strong> {renderStep(card.unlock)}
        </p>
      ) : null}
    </article>
  );
}

export function NotShown({ items }: { items: RulesOutcome["notShown"] }) {
  if (!items.length) return null;
  return (
    <section className="card p-6" aria-labelledby="not-shown">
      <div className="flex items-center justify-between">
        <h2 id="not-shown" className="font-display text-lg font-semibold">
          Not shown for you ({items.length})
        </h2>
        <Trace id={["FR-3.3", "TC-09"]} />
      </div>
      <ul className="mt-3 divide-y divide-line">
        {items.map((n) => (
          <li key={n.product.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-[14px]">
            <span>
              <strong>{n.product.name}</strong> · {n.reasons.map((r) => r.message).join("; ")} <Trace id={n.reasons.map((r) => r.code)} />
            </span>
            <span className="text-muted">{n.nearest ? `Nearest eligible: ${n.nearest.name}` : "No eligible alternative; an advisor can help"}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
