import type { Metadata } from "next";
import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { getDb } from "@/server/db";
import { canViewTrail, getDemoRole } from "@/server/auth-demo";
import { readTrail } from "@/server/trail";
import { RoleSwitch } from "@/components/advisor/role-switch";
import { Trace } from "@/components/ui/trace";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Decision trail" };

function detailText(d: Record<string, unknown>): string {
  if (typeof d.summary === "string") return d.summary;
  if (typeof d.note === "string") return d.note;
  return JSON.stringify(d);
}

export default async function TrailPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const db = getDb();
  const role = await getDemoRole();
  const current = role ? (role.role === "compliance" ? "compliance" : `advisor:${role.advisorId}`) : "";
  const allowed = canViewTrail(db, role, sessionId);
  const rows = allowed ? readTrail(db, sessionId) : [];
  const booking = db.prepare("SELECT id FROM bookings WHERE session_id = ? ORDER BY seq LIMIT 1").get(sessionId) as { id: string } | undefined;

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 md:px-8">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap gap-2" aria-label="Workspace">
          {booking ? (
            <Link href={`/advisor/handoff/${booking.id}`} className="rounded-full border border-line bg-white px-4 py-2 text-[14px] font-medium hover:bg-bg-alt">
              Advisor handoff pack
            </Link>
          ) : null}
          <span className="rounded-full bg-ink px-4 py-2 text-[14px] font-medium text-white">Decision trail · compliance view</span>
          <Link href="/advisor" className="rounded-full px-3 py-2 text-[14px] text-blue">
            All bookings
          </Link>
        </nav>
        <RoleSwitch current={current} compact />
      </div>
      <section className="card mt-6 p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">
              Append-only <Trace id={["FR-8.2", "§6.1 row 5"]} />
            </p>
            <h1 className="mt-1 font-display text-[28px] font-bold md:text-[34px]">Decision trail · session {sessionId}</h1>
            <p className="mt-1 text-[15px] text-muted">Every input, rule and outcome, with the rule ID and config version that produced it.</p>
          </div>
          {allowed ? (
            <div className="flex gap-2">
              <a href={`/api/trail/${sessionId}?format=json`} className="inline-flex h-11 items-center rounded-full border border-ink/80 px-5 font-medium hover:bg-bg-alt">
                Export JSON
              </a>
              <a href={`/api/trail/${sessionId}?format=csv`} className="inline-flex h-11 items-center rounded-full border border-ink/80 px-5 font-medium hover:bg-bg-alt">
                Export CSV
              </a>
            </div>
          ) : null}
        </div>
        {!allowed ? (
          <p className="mt-6 text-muted">Sign in as compliance, or as the advisor booked for this session, to see the trail.</p>
        ) : (
          <div className="scroll-x mt-6">
            <table className="w-full min-w-[880px] text-left text-[14px]">
              <thead>
                <tr className="border-b border-line text-[12px] uppercase tracking-[0.06em] text-muted-2">
                  <th className="py-2.5 pr-4 font-semibold">Time (IST)</th>
                  <th className="py-2.5 pr-4 font-semibold">Event</th>
                  <th className="py-2.5 pr-4 font-semibold">Detail</th>
                  <th className="py-2.5 pr-4 font-semibold">Rule / ID</th>
                  <th className="py-2.5 font-semibold">Config</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-line align-top">
                    <td className="py-2.5 pr-4 font-mono text-[13px]">{formatInTimeZone(new Date(r.ts), "Asia/Kolkata", "HH:mm:ss")}</td>
                    <td className="py-2.5 pr-4">{r.event}</td>
                    <td className="py-2.5 pr-4">{detailText(r.detail)}</td>
                    <td className="py-2.5 pr-4 font-mono text-[13px]">{r.ruleId}</td>
                    <td className="py-2.5 font-mono text-[13px]">{r.configVersion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-5 text-[13px] text-muted-2">
          Financial values are stored encrypted and never written to logs or analytics. Retention period set by compliance. <Trace id="§6.1 row 7" />
        </p>
      </section>
    </div>
  );
}
