"use client";
import { inr, inrExact, renderStep, step, q, type Analysis, type Explain } from "@/engine";
import { Trace } from "@/components/ui/trace";
import { cn } from "@/lib/cn";

export interface Bar {
  id: string;
  label: string;
  amount: number;
  kind: "need" | "total" | "offset" | "gap";
  from: number;
  to: number;
  explain: Explain;
}

/** Waterfall geometry: needs climb, total stands, offsets step down, gap stands. Segments sum to the gap. */
export function buildBars(an: Analysis): Bar[] {
  const bars: Bar[] = [];
  let cum = 0;
  for (const c of an.needs.components) {
    bars.push({ id: `need.${c.key}`, label: c.label, amount: c.amount, kind: "need", from: cum, to: cum + c.amount, explain: c.explain });
    cum += c.amount;
  }
  bars.push({ id: "total", label: "Total need", amount: an.needs.gross, kind: "total", from: 0, to: an.needs.gross, explain: an.needs.explain });
  let level = an.needs.gross;
  for (const o of an.recon.offsets) {
    bars.push({ id: `offset.${o.key}`, label: o.label, amount: -o.amount, kind: "offset", from: level - o.amount, to: level, explain: o.explain });
    level -= o.amount;
  }
  bars.push({ id: "gap", label: an.recon.gap > 0 ? "Your gap" : "Surplus", amount: an.recon.gap, kind: "gap", from: Math.min(0, an.recon.gap), to: Math.max(0, an.recon.gap), explain: an.recon.explain });
  return bars;
}

const COLORS: Record<Bar["kind"], string> = {
  need: "bg-blue-mid",
  total: "bg-ink",
  offset: "bg-[#b9c5dd]",
  gap: "bg-warn",
};

function barLabel(b: Bar): string {
  if (b.kind === "offset") return `− ${inr(-b.amount)}`;
  if (b.kind === "gap" && b.amount <= 0) return inr(-b.amount);
  return inr(b.amount);
}

export function Waterfall({ an, selected, onSelect }: { an: Analysis; selected: string; onSelect: (b: Bar) => void }) {
  const bars = buildBars(an);
  const max = Math.max(...bars.map((b) => b.to), 1);
  const min = Math.min(0, ...bars.map((b) => b.from));
  const span = max - min;
  const pct = (v: number) => ((v - min) / span) * 100;
  const needCount = an.needs.components.length;
  const offCount = an.recon.offsets.length;
  const covered = an.recon.state === "COVERED";

  const groups = [
    { label: "What your family needs", span: needCount },
    { label: "Total", span: 1 },
    ...(offCount ? [{ label: "Already in place", span: offCount }] : []),
    { label: covered ? "Surplus" : "Gap", span: 1 },
  ].filter((g) => g.span > 0);

  const check = step(["Check: {gross}", ...an.recon.offsets.map((o) => `− {${o.key}}`), "= {gap}."].join(" "), {
    gross: q(an.needs.gross, "inr"),
    ...Object.fromEntries(an.recon.offsets.map((o) => [o.key, q(o.amount, "inr")])),
    gap: q(an.recon.gap, "inr"),
  });
  const exactCheck = step(["{gross}", ...an.recon.offsets.map((o) => `− {${o.key}}`), "= {gap}"].join(" "), {
    gross: q(an.needs.gross, "inrExact"),
    ...Object.fromEntries(an.recon.offsets.map((o) => [o.key, q(o.amount, "inrExact")])),
    gap: q(an.recon.gap, "inrExact"),
  });

  return (
    <div>
      {/* Desktop / tablet: column chart */}
      <div className="hidden md:block">
        <div className="grid gap-x-1.5" style={{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` }}>
          {groups.map((g, i) => (
            <div key={i} className="border-b-2 border-ink/80 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-2" style={{ gridColumn: `span ${g.span}` }}>
              {g.label}
            </div>
          ))}
        </div>
        <div className="relative mt-8 grid h-[260px] gap-x-1.5" style={{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` }}>
          <div className="pointer-events-none absolute inset-x-0 border-t border-line" style={{ bottom: `${pct(0)}%` }} />
          {bars.map((b) => {
            const active = b.id === selected;
            const height = Math.max(pct(b.to) - pct(b.from), 0.8);
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => onSelect(b)}
                aria-pressed={active}
                aria-label={`${b.label}: ${barLabel(b)}. Show how this is calculated.`}
                className="group relative h-full min-w-0 focus-visible:outline-none"
              >
                <span
                  className={cn("absolute inset-x-[14%] rounded-md transition-[outline] group-hover:opacity-90 group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-blue-mid", COLORS[b.kind], b.kind === "gap" && covered && "bg-green-ink", active && "outline-2 outline-offset-2 outline-ink")}
                  style={{ bottom: `${pct(b.from)}%`, height: `${height}%` }}
                />
                <span className="num absolute inset-x-0 text-center text-[12px] font-semibold text-ink" style={{ bottom: `calc(${pct(b.to)}% + 6px)` }}>
                  {barLabel(b)}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-2 grid gap-x-1.5" style={{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` }}>
          {bars.map((b) => (
            <span key={b.id} lang="en" className={cn("hyphens-auto text-center text-[12px] leading-4 text-muted", b.id === selected && "font-semibold text-ink")}>
              {b.label}
            </span>
          ))}
        </div>
      </div>

      {/* Phones: vertical bar list */}
      <ul className="space-y-2 md:hidden" aria-label="How the gap adds up">
        {bars.map((b) => {
          const width = (Math.abs(b.amount) / Math.max(an.needs.gross, Math.abs(an.recon.gap), 1)) * 100;
          return (
            <li key={b.id}>
              <button type="button" onClick={() => onSelect(b)} className={cn("w-full rounded-xl border px-3 py-2.5 text-left", b.id === selected ? "border-ink" : "border-line")}>
                <span className="flex items-baseline justify-between gap-3 text-[14px]">
                  <span className={cn(b.kind === "total" || b.kind === "gap" ? "font-semibold" : "")}>{b.label}</span>
                  <span className="num font-semibold">{barLabel(b)}</span>
                </span>
                <span className="mt-1.5 block h-2 rounded-full bg-bg-alt">
                  <span className={cn("block h-2 rounded-full", COLORS[b.kind], b.kind === "gap" && covered && "bg-green-ink")} style={{ width: `${Math.min(100, width)}%` }} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 text-[13px] text-muted">
        {renderStep(check)} The bars always add up to the gap. <Trace id="P6 · property test" />
      </p>
      <p className="mt-1 font-mono text-[11px] text-muted-2">Exact: {renderStep(exactCheck)}</p>

      <details className="mt-3 text-sm">
        <summary className="font-medium text-blue">View as a table</summary>
        <div className="scroll-x mt-2">
          <table className="w-full min-w-[320px] text-left text-sm">
            <caption className="sr-only">Waterfall values</caption>
            <thead>
              <tr className="border-b border-line text-muted-2">
                <th className="py-2 pr-4 font-medium">Line</th>
                <th className="py-2 pr-4 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {bars.map((b) => (
                <tr key={b.id} className="border-b border-line">
                  <td className="py-2 pr-4">{b.label}</td>
                  <td className="num py-2 text-right">{b.kind === "offset" ? `− ${inrExact(-b.amount)}` : inrExact(b.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
