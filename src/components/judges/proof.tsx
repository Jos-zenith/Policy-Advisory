import Link from "next/link";
import { CheckCircle2, CircleDashed, XCircle } from "lucide-react";
import type { QaEvidence, TestEvidence } from "@/server/evidence";

export function Status({ ok, label }: { ok: boolean | null; label?: string }) {
  if (ok === null)
    return (
      <span className="inline-flex items-center gap-1 text-muted-2">
        <CircleDashed className="size-4" aria-hidden /> {label ?? "not run yet"}
      </span>
    );
  return ok ? (
    <span className="inline-flex items-center gap-1 font-semibold text-green-ink">
      <CheckCircle2 className="size-4" aria-hidden /> {label ?? "pass"}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 font-semibold text-warn-ink">
      <XCircle className="size-4" aria-hidden /> {label ?? "fail"}
    </span>
  );
}

/** Pick tests whose name matches; null when nothing matched (not run). */
export function find(t: TestEvidence | null, re: RegExp): boolean | null {
  if (!t) return null;
  const hits = t.tests.filter((x) => re.test(x.name));
  if (!hits.length) return null;
  return hits.every((x) => x.status === "passed");
}

export function goldenCases(t: TestEvidence | null): { id: string; ok: boolean }[] {
  if (!t) return [];
  const ids = new Map<string, boolean>();
  for (const x of t.tests.filter((y) => y.group === "golden")) {
    const m = x.name.match(/TC-\d{2}/g);
    const ids2 = m ?? (/Arjun/.test(x.name) ? ["Arjun fixture"] : []);
    for (const id of ids2) ids.set(id, (ids.get(id) ?? true) && x.status === "passed");
  }
  return Array.from(ids.entries())
    .map(([id, ok]) => ({ id, ok }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function ProofSummary({ tests, qa }: { tests: TestEvidence | null; qa: QaEvidence | null }) {
  const golden = goldenCases(tests);
  const rows: { label: string; value: React.ReactNode }[] = [
    { label: `Golden cases: ${golden.length ? golden.map((g) => g.id.replace("TC-", "")).join(", ") : "—"}`, value: tests ? <Status ok={golden.every((g) => g.ok)} label={`${golden.filter((g) => g.ok).length} / ${golden.length} passed`} /> : <Status ok={null} /> },
    { label: "Property: gap = need − offsets", value: <Status ok={find(tests, /P-recon/)} /> },
    { label: "Property: more cover never raises the gap", value: <Status ok={find(tests, /more existing cover never raises the gap/)} /> },
    { label: "Property: no savings plan while gap > 0", value: <Status ok={find(tests, /P4: no endowment/)} /> },
    { label: "Property: same input, same output", value: <Status ok={find(tests, /determinism/)} /> },
    { label: "Double-booking race (two processes, one slot)", value: <Status ok={find(tests, /exactly one booking/)} /> },
    {
      label: qa ? `${qa.n}-profile QA run (${qa.dataSource === "generated" ? "generated, not the provided data" : "provided data"})` : "Profile QA run",
      value: qa ? <Status ok={qa.unhandled === 0} label={`${qa.handled} / ${qa.n} handled · ${qa.unhandled} unhandled`} /> : <Status ok={null} />,
    },
  ];
  return (
    <div>
      <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
        {rows.map((r) => (
          <li key={r.label} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-[14px]">
            <span>{r.label}</span>
            {r.value}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[13px] text-muted-2">
        Filled from the generated test and QA files at build time, never typed by hand.{" "}
        <Link className="font-semibold text-blue" href="/judges/qa">
          See all evidence →
        </Link>
      </p>
    </div>
  );
}
