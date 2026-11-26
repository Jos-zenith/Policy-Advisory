"use client";
import { renderStep, questionState, type Question, type ComprehensionResult } from "@/engine";
import { useJourney } from "@/lib/journey-store";
import { cn } from "@/lib/cn";

/** Reality check (FR-5.1/5.2): explain, allow one more try, never block or shame. */
export function RealityCheck({ questions, result }: { questions: Question[]; result: ComprehensionResult }) {
  const answers = useJourney((s) => s.comprehension.answers);
  const answer = useJourney((s) => s.answer);
  return (
    <div>
      <p className="text-[15px] leading-6 text-muted">Three questions. There&apos;s no pass mark: if something&apos;s unclear we explain it, and you can always carry on.</p>
      <ol className="mt-4 space-y-6">
        {questions.map((qn, qi) => {
          const picks = answers[qn.id] ?? [];
          const st = questionState(qn, picks);
          const last = picks[picks.length - 1];
          const locked = st.state === "RIGHT_FIRST" || st.state === "CORRECTED" || st.state === "WRONG_TWICE";
          return (
            <li key={qn.id} className="border-t border-line pt-4 first:border-t-0 first:pt-0">
              <fieldset>
                <legend className="text-[15px] font-semibold leading-6">
                  {qi + 1}. {qn.text}
                </legend>
                <div className="mt-3 space-y-2">
                  {qn.options.map((o, oi) => {
                    const chosen = picks.includes(oi);
                    const isLast = last === oi;
                    const right = oi === qn.correct;
                    return (
                      <button
                        key={oi}
                        type="button"
                        disabled={locked || (chosen && !right)}
                        aria-pressed={chosen}
                        onClick={() => answer(qn.id, oi)}
                        className={cn(
                          "block w-full rounded-xl border px-4 py-3 text-left text-[15px] transition-colors",
                          chosen && right ? "border-green-ink bg-green-bg text-green-ink" : chosen && isLast ? "border-warn bg-warn-soft text-warn-ink" : chosen ? "border-line bg-bg-alt text-muted line-through" : "border-line hover:bg-bg-alt",
                          locked && !chosen && right && st.state === "WRONG_TWICE" && "border-green-ink",
                        )}
                      >
                        {renderStep(o)}
                      </button>
                    );
                  })}
                </div>
                <div aria-live="polite">
                  {st.state === "RIGHT_FIRST" || st.state === "CORRECTED" ? <p className="mt-2 text-[14px] text-green-ink">That&apos;s right.</p> : null}
                  {st.state === "WRONG_RETRY" || st.state === "WRONG_TWICE" ? (
                    <div className="mt-3 rounded-xl bg-warn-soft p-3 text-[14px] leading-6 text-warn-ink">
                      <p>{renderStep(qn.correction)}</p>
                      <p className="mt-1 text-[13px]">{st.state === "WRONG_RETRY" ? "Have another go." : "No problem, your advisor will go over this with you."}</p>
                    </div>
                  ) : null}
                </div>
              </fieldset>
            </li>
          );
        })}
      </ol>
      <p className="mt-5 rounded-xl bg-bg-alt px-4 py-2.5 text-[14px]">
        {result.score} of 3 right first time · {3 - result.answered === 0 ? "all done" : `${3 - result.answered} to go`}
      </p>
    </div>
  );
}
