import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowRight } from "lucide-react";
import j from "@/config/content/judges.json";
import { ASSUMPTION_DEFS, ENGINE_CONFIG } from "@/config";
import { pct } from "@/engine";
import { qaEvidence, testEvidence } from "@/server/evidence";
import { ProofSummary } from "@/components/judges/proof";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Judge's guide" };

function Box({ title, body, dashed = false, dark = false }: { title: string; body: string; dashed?: boolean; dark?: boolean }) {
  return (
    <div className={`rounded-2xl p-4 ${dashed ? "border-2 border-dashed border-blue bg-blue-soft" : dark ? "bg-ink text-white" : "border border-line bg-white"}`}>
      <p className="font-semibold">{title}</p>
      <p className={`mt-1 text-[13px] leading-5 ${dark ? "text-white/80" : "text-muted"}`}>{body}</p>
    </div>
  );
}

const Down = () => (
  <div className="flex justify-center py-1 text-muted-2" aria-hidden>
    <ArrowDown className="size-5" />
  </div>
);

export default function JudgesPage() {
  const tests = testEvidence();
  const qa = qaEvidence();
  const a = j.architecture;
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-10 md:px-8">
      <section aria-labelledby="thesis">
        <p className="eyebrow">{j.eyebrow}</p>
        <h1 id="thesis" className="mt-3 font-display text-[32px] font-bold leading-[1.1] tracking-tight md:text-[46px]">
          {j.thesis}
        </h1>
        <p className="mt-4 max-w-[760px] text-[17px] leading-7 text-muted">{j.sub}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/estimate?judge=1">
              Start the demo <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/judges/states">Decision states board</Link>
          </Button>
          <Button asChild size="lg" variant="soft">
            <Link href="/judges/qa">Proof it holds</Link>
          </Button>
        </div>
      </section>

      <section className="mt-10" aria-labelledby="story">
        <h2 id="story" className="font-display text-2xl font-semibold">
          The 60-second story
        </h2>
        <ol className="mt-4 grid gap-3 md:grid-cols-5">
          {j.story.map((s, i) => (
            <li key={s.title} className="card p-4">
              <span className="grid size-8 place-items-center rounded-full bg-ink font-semibold text-white">{i + 1}</span>
              <p className="mt-3 font-semibold leading-5">{s.title}</p>
              <p className="mt-1.5 text-[13px] leading-5 text-muted">{s.body}</p>
              <p className="mt-2 text-[12px] font-semibold text-blue">{s.tag}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="formulas" className="mt-12 scroll-mt-24" aria-labelledby="f">
        <h2 id="f" className="font-display text-2xl font-semibold">
          The formulas
        </h2>
        <pre className="scroll-x mt-4 rounded-2xl bg-ink p-5 font-mono text-[13px] leading-6 text-white">{j.formulas}</pre>
        <p className="mt-2 text-[14px] text-muted">{j.formulaNote}</p>
        <div className="scroll-x mt-4">
          <table className="w-full min-w-[560px] text-left text-[14px]">
            <caption className="mb-2 text-left font-semibold">Assumptions (config {ENGINE_CONFIG.configVersion}) · placeholders, to be confirmed by a finance reviewer</caption>
            <tbody>
              {ASSUMPTION_DEFS.map((d) => (
                <tr key={d.id} className="border-b border-line">
                  <td className="py-2 pr-4 font-mono text-[13px]">{d.id}</td>
                  <td className="py-2 pr-4">{d.label}</td>
                  <td className="num py-2 text-right font-semibold">{typeof d.value === "number" && d.unit === "pct" ? pct(d.value) : String(d.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-12" aria-labelledby="rules">
        <h2 id="rules" className="font-display text-2xl font-semibold">
          The rules, in order
        </h2>
        <div className="scroll-x mt-4">
          <table className="w-full min-w-[560px] text-left text-[14px]">
            <thead>
              <tr className="border-b border-line text-[12px] uppercase tracking-[0.06em] text-muted-2">
                <th className="py-2 pr-4">ID</th>
                <th className="py-2 pr-4">When</th>
                <th className="py-2">Then</th>
              </tr>
            </thead>
            <tbody>
              {j.rules.map((r) => (
                <tr key={r.id} className="border-b border-line">
                  <td className="py-2.5 pr-4 font-mono text-[13px]">{r.id}</td>
                  <td className="py-2.5 pr-4">{r.when}</td>
                  <td className="py-2.5">{r.then}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-12" aria-labelledby="arch">
        <h2 id="arch" className="font-display text-2xl font-semibold">
          Architecture: ready for the data reveal
        </h2>
        <p className="mt-2 text-[15px] text-muted">{a.note}</p>
        <div className="mt-5 grid gap-1">
          <div className="grid gap-3 md:grid-cols-2">
            <Box dashed title={a.revealDay.title} body={a.revealDay.body} />
            <Box dashed title={a.adapters.title} body={a.adapters.body} />
          </div>
          <Down />
          <div className="grid gap-3 md:grid-cols-2">
            {a.core.map((b) => (
              <Box key={b.title} title={b.title} body={b.body} />
            ))}
          </div>
          <Down />
          <div className="grid gap-3 md:grid-cols-3">
            {a.engines.map((b) => (
              <Box key={b.title} dark title={b.title} body={b.body} />
            ))}
          </div>
          <Down />
          <div className="grid gap-3 md:grid-cols-4">
            {a.outputs.map((b) => (
              <Box key={b.title} title={b.title} body={b.body} />
            ))}
          </div>
        </div>
        <details className="mt-5 rounded-2xl border border-line bg-white p-4">
          <summary className="font-semibold">Canonical schema</summary>
          <pre className="scroll-x mt-3 font-mono text-[12px] leading-5">{j.schema}</pre>
        </details>
      </section>

      <section className="mt-12" aria-labelledby="bvd">
        <h2 id="bvd" className="font-display text-2xl font-semibold">
          Built vs designed
        </h2>
        <div className="scroll-x mt-4">
          <table className="w-full min-w-[560px] text-left text-[14px]">
            <thead>
              <tr className="border-b border-line text-[12px] uppercase tracking-[0.06em] text-muted-2">
                <th className="py-2 pr-4">Item</th>
                <th className="py-2 pr-4">PRD</th>
                <th className="py-2">Selection MVP</th>
              </tr>
            </thead>
            <tbody>
              {j.builtVsDesigned.map((r) => (
                <tr key={r.item} className="border-b border-line">
                  <td className="py-2.5 pr-4">{r.item}</td>
                  <td className="py-2.5 pr-4 font-mono text-[13px]">{r.prd}</td>
                  <td className="py-2.5 font-medium">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-12" aria-labelledby="open">
        <h2 id="open" className="font-display text-2xl font-semibold">
          For a finance reviewer to confirm
        </h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px] text-muted">
          {j.openQuestions.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="proof">
        <h2 id="proof" className="font-display text-2xl font-semibold">
          Proof it holds
        </h2>
        <div className="mt-4">
          <ProofSummary tests={tests} qa={qa} />
        </div>
      </section>
    </div>
  );
}
