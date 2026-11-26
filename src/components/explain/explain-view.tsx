"use client";
import { renderQuantity, renderStep, stepParts, type Explain, type ExplainInput } from "@/engine";
import { useJudgeOn } from "@/components/ui/trace";
import { useJourney } from "@/lib/journey-store";
import { cn } from "@/lib/cn";

const SOURCE_LABEL: Record<ExplainInput["source"], string> = {
  you: "You",
  assumption: "Assumption",
  config: "Config",
  derived: "Worked out",
  product: "Product",
  "rate-table": "Rate table",
};

/** Renders an engine Explain object: result, plain summary, formula block, inputs, source (P2). */
export function ExplainView({ explain, eyebrow = "Show how this is calculated", compact = false }: { explain: Explain; eyebrow?: string; compact?: boolean }) {
  const judge = useJudgeOn();
  const sessionId = useJourney((s) => s.sessionId);
  return (
    <div className="text-ink" data-testid={`explain-${explain.id}`}>
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h3 className="mt-1 font-display text-lg font-semibold">{explain.title}</h3>
      <p className="num mt-2 font-display text-[28px] font-bold leading-tight">{renderQuantity(explain.result)}</p>
      {explain.summary ? <p className="mt-2 text-[15px] leading-6 text-muted">{renderStep(explain.summary)}</p> : null}
      {explain.steps.length ? (
        <div className="mt-4 rounded-2xl bg-ink px-4 py-3 font-mono text-[13px] leading-6 text-white">
          {explain.steps.map((s, i) => (
            <p key={i} className="break-words">
              {stepParts(s).map((part, j) => (
                <span key={j} className={part.isValue ? "text-white" : "text-white/80"}>
                  {part.text}
                </span>
              ))}
            </p>
          ))}
        </div>
      ) : null}
      {explain.inputs.length ? (
        <dl className={cn("mt-4 divide-y divide-line", compact && "text-sm")}>
          {explain.inputs.map((inp, i) => (
            <div key={i} className="flex items-start justify-between gap-4 py-3">
              <dt className="text-[14px] leading-5 text-muted">{inp.label}</dt>
              <dd className="flex shrink-0 flex-col items-end gap-1 text-right">
                <span className="num font-semibold">{renderQuantity(inp.q)}</span>
                <span className="chip-id">{judge && inp.ref ? inp.ref : inp.source === "you" && inp.ref ? `You · ${inp.ref}` : SOURCE_LABEL[inp.source]}</span>
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      <p className="mt-3 text-xs leading-5 text-muted-2">
        Source: config {explain.source.configVersion}
        {sessionId ? ` · session ${sessionId} (anonymous)` : ""}
        {explain.source.note ? ` · ${explain.source.note}` : ""}
        {judge && explain.traceIds.length ? <span className="ml-1 font-mono">· {explain.traceIds.join(", ")}</span> : null}
      </p>
    </div>
  );
}
