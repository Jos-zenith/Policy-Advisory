import type { Metadata } from "next";
import Link from "next/link";
import { e2eEvidence, qaEvidence, testEvidence, type UnitTest } from "@/server/evidence";
import { ProofSummary, Status, goldenCases } from "@/components/judges/proof";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Proof it holds" };

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) + " IST";

function Counts({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  return (
    <div className="card p-5">
      <h3 className="font-semibold">{title}</h3>
      <dl className="mt-2 divide-y divide-line text-[14px]">
        {entries.length ? (
          entries.map(([k, v]) => (
            <div key={k} className="flex justify-between py-1.5">
              <dt className="font-mono text-[13px]">{k}</dt>
              <dd className="num font-semibold">{v}</dd>
            </div>
          ))
        ) : (
          <p className="py-2 text-muted-2">None</p>
        )}
      </dl>
    </div>
  );
}

function TestList({ title, tests }: { title: string; tests: UnitTest[] }) {
  return (
    <details className="card p-5" open={tests.some((t) => t.status !== "passed")}>
      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 font-semibold">
        <span>
          {title} ({tests.length})
        </span>
        <Status ok={tests.length ? tests.every((t) => t.status === "passed") : null} label={`${tests.filter((t) => t.status === "passed").length} / ${tests.length} passed`} />
      </summary>
      <ul className="mt-3 divide-y divide-line text-[13px]">
        {tests.map((t) => (
          <li key={t.file + t.name} className="flex items-start justify-between gap-3 py-1.5">
            <span>
              {t.name} <span className="font-mono text-[11px] text-muted-2">{t.file}</span>
            </span>
            <Status ok={t.status === "passed"} label={t.status} />
          </li>
        ))}
      </ul>
    </details>
  );
}

export default function QaPage() {
  const tests = testEvidence();
  const qa = qaEvidence();
  const e2e = e2eEvidence();
  const golden = goldenCases(tests);
  const group = (g: UnitTest["group"]) => tests?.tests.filter((t) => t.group === g) ?? [];
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-10 md:px-8">
      <Link href="/judges" className="font-semibold text-blue">
        ← Judge&apos;s guide
      </Link>
      <h1 className="mt-3 font-display text-[34px] font-bold">Proof it holds</h1>
      <p className="mt-2 max-w-[760px] text-[15px] text-muted">
        Everything on this page is read from files the test and QA scripts write: <code className="font-mono text-[13px]">npm run test:report</code>, <code className="font-mono text-[13px]">npm run qa</code> and <code className="font-mono text-[13px]">npm run test:e2e</code>. If a file is missing it says &quot;not run yet&quot;.
      </p>

      <div className="mt-6">
        <ProofSummary tests={tests} qa={qa} />
      </div>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">Unit, golden, property and server tests</h2>
        {tests ? (
          <>
            <p className="mt-1 text-[14px] text-muted">
              Run {when(tests.at)}: {tests.passed} of {tests.total} passed{tests.failed ? `, ${tests.failed} failed` : ""}.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {golden.map((g) => (
                <span key={g.id} className={`rounded-full px-3 py-1 text-[13px] font-medium ${g.ok ? "bg-green-bg text-green-ink" : "bg-warn-bg text-warn-ink"}`}>
                  {g.id}
                </span>
              ))}
            </div>
            <div className="mt-4 space-y-3">
              <TestList title="Golden cases" tests={group("golden")} />
              <TestList title="Property tests (fast-check)" tests={group("property")} />
              <TestList title="Server: booking, race, trail, encryption" tests={group("server")} />
              <TestList title="Unit: formatting and sample data" tests={group("unit")} />
            </div>
          </>
        ) : (
          <p className="mt-2 text-muted-2">Not run yet.</p>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">Profile QA run</h2>
        {qa ? (
          <>
            <p className="mt-1 text-[14px] text-muted">
              {when(qa.generatedAt)} · config {qa.configVersion} · <strong>{qa.dataLabel}</strong>
              {qa.seed ? ` (seed ${qa.seed})` : ""} · {qa.durationMs} ms
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                ["Profiles", qa.n],
                ["Valid", qa.valid],
                ["Rejected with a reason", qa.invalid],
                ["Unhandled", qa.unhandled],
              ].map(([k, v]) => (
                <div key={k as string} className="card p-4">
                  <p className="eyebrow">{k}</p>
                  <p className="num mt-1 font-display text-3xl font-bold">{v}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <Counts title="Outcome state" data={qa.byState} />
              <Counts title="Recommendation" data={qa.byRecommendation} />
              <Counts title="Rules and exclusions fired" data={qa.fallbacks} />
              <Counts title="Invalid input codes" data={qa.invalidCodes} />
            </div>
            <div className="mt-3">
              <Counts title="Integrity checks" data={qa.checks} />
            </div>
          </>
        ) : (
          <p className="mt-2 text-muted-2">Not run yet.</p>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">End-to-end (Playwright)</h2>
        {e2e ? (
          <>
            <p className="mt-1 text-[14px] text-muted">Run {when(e2e.at)}</p>
            <ul className="card mt-3 divide-y divide-line">
              {e2e.specs.map((s) => (
                <li key={s.title} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-[14px]">
                  <span>{s.title}</span>
                  <Status ok={s.ok} />
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-2 text-muted-2">Not run yet.</p>
        )}
      </section>
    </div>
  );
}
