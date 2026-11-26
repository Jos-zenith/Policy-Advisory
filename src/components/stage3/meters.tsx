"use client";
import { inr, pct } from "@/engine";
import { cn } from "@/lib/cn";

/** Segmented meter: share of income 0..max with the budget limit marked. */
export function AffordMeter({ share, limit, max }: { share: number; limit: number; max: number }) {
  const segs = 30;
  const filled = Math.min(segs, Math.round((Math.min(share, max) / max) * segs));
  const limitAt = Math.round((limit / max) * segs);
  return (
    <div>
      <p className="text-[13px] text-muted">
        Premium as share of income, 0 to {pct(max, 0)} (dark line marks your budget limit)
      </p>
      <div className="relative mt-1.5 flex gap-[3px]" role="meter" aria-valuemin={0} aria-valuemax={max * 100} aria-valuenow={Number((share * 100).toFixed(2))} aria-label={`Premium is ${pct(share)} of income; budget limit ${pct(limit, 0)}`}>
        {Array.from({ length: segs }).map((_, i) => (
          <span key={i} className={cn("h-2.5 flex-1 rounded-sm", i < filled ? (share > limit ? "bg-warn" : "bg-blue") : "bg-line")} />
        ))}
        <span className="absolute -top-1 h-[18px] w-[3px] rounded bg-ink" style={{ left: `calc(${(limitAt / segs) * 100}% - 1px)` }} aria-hidden />
      </div>
    </div>
  );
}

/** "Covers X% of your gap" meter (CLAUDE.md §13.6). */
export function CoverageMeter({ cover, gap }: { cover: number; gap: number }) {
  const ratio = gap > 0 ? cover / gap : 1;
  const segs = 20;
  const filled = Math.min(segs, Math.round(Math.min(ratio, 1) * segs));
  const full = ratio >= 1;
  return (
    <div>
      <p className={cn("text-[14px] font-semibold", full ? "text-ink" : "text-warn-ink")} aria-live="polite">
        {full ? `Covers your whole gap of ${inr(gap)}` : `Covers ${pct(ratio, 0)} of your gap · leaves ${inr(gap - cover)} open`}
      </p>
      <div className="mt-1.5 flex gap-[3px]" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(ratio, 1) * 100)} aria-label="Share of your gap covered">
        {Array.from({ length: segs }).map((_, i) => (
          <span key={i} className={cn("h-2.5 flex-1 rounded-sm", i < filled ? (full ? "bg-blue" : "bg-warn") : "bg-line")} />
        ))}
      </div>
    </div>
  );
}

/** Protection / savings split bar for "where your premium goes". */
export function SplitBar({ savingsShare, savingsWord = "Savings" }: { savingsShare: number; savingsWord?: string }) {
  const prot = 1 - savingsShare;
  return (
    <div className="flex h-7 overflow-hidden rounded-md text-[12px] font-medium" role="img" aria-label={`Protection about ${pct(prot, 0)}, ${savingsWord.toLowerCase()} about ${pct(savingsShare, 0)}`}>
      {prot > 0 ? (
        <span className="flex shrink-0 items-center whitespace-nowrap bg-blue px-2 text-white" style={{ width: `${prot * 100}%`, minWidth: "3.25rem" }}>
          {savingsShare === 0 ? "Protection 100%" : prot >= 0.3 ? `Protection ~${pct(prot, 0)}` : `~${pct(prot, 0)}`}
        </span>
      ) : null}
      {savingsShare > 0 ? (
        <span className="flex items-center bg-amber-bar px-2.5 text-ink" style={{ width: `${savingsShare * 100}%` }}>
          {savingsWord} ~{pct(savingsShare, 0)}
        </span>
      ) : null}
    </div>
  );
}
