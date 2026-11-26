import type { Metadata } from "next";
import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import advisorsJson from "@/data/canonical/advisors.json";
import { getDb } from "@/server/db";
import { canViewHandoff, getDemoRole } from "@/server/auth-demo";
import { getBooking, handoffViews, logHandoffView, readSnapshot } from "@/server/bookings";
import { HandoffBody } from "@/components/handoff/handoff-view";
import { RoleSwitch } from "@/components/advisor/role-switch";
import { FeedbackForm } from "@/components/advisor/feedback-form";
import { PrintButton } from "@/components/advisor/print-button";
import { Button } from "@/components/ui/button";
import { Trace } from "@/components/ui/trace";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Advisor handoff pack" };

const TZ = "Asia/Kolkata";

export default async function HandoffPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  const db = getDb();
  const role = await getDemoRole();
  const current = role ? (role.role === "compliance" ? "compliance" : `advisor:${role.advisorId}`) : "";
  const now = new Date();
  const access = canViewHandoff(db, role, bookingId, now);

  if (!access.ok) {
    return (
      <div className="mx-auto max-w-[900px] px-4 py-10 md:px-8">
        <RoleSwitch current={current} />
        <div className="card mt-6 p-8">
          <h1 className="font-display text-2xl font-semibold">You can&apos;t open this pack</h1>
          <p className="mt-2 text-muted">{access.reason}</p>
          <Link href="/advisor" className="mt-4 inline-block font-semibold text-blue">
            ← Back to the workspace
          </Link>
        </div>
      </div>
    );
  }

  logHandoffView(db, bookingId, access.viewer, now); // every view is logged
  const b = getBooking(db, bookingId)!;
  const full = readSnapshot(db, bookingId)!;
  const s = full.snapshot;
  const views = handoffViews(db, bookingId);
  const advisorName = advisorsJson.advisors.find((a) => a.id === b.advisorId)?.name ?? b.advisorName;

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 md:px-8">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap gap-2" aria-label="Workspace">
          <span className="rounded-full bg-ink px-4 py-2 text-[14px] font-medium text-white">Advisor handoff pack</span>
          <Link href={`/advisor/trail/${b.sessionId}`} className="rounded-full border border-line bg-white px-4 py-2 text-[14px] font-medium hover:bg-bg-alt">
            Decision trail · compliance view
          </Link>
          <Link href="/advisor" className="rounded-full px-3 py-2 text-[14px] text-blue">
            All bookings
          </Link>
        </nav>
        <RoleSwitch current={current} compact />
      </div>

      <article className="card mt-6 p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">
              One-page handoff <Trace id={["FR-7.4", "CUJ-5"]} />
            </p>
            <h1 className="mt-1 font-display text-[28px] font-bold leading-tight md:text-[34px]">
              Call with {full.customer.name.split(/\s+/)[0]} · {formatInTimeZone(new Date(b.startUtc), TZ, "EEE d MMM, HH:mm")}
            </h1>
            <p className="mt-1 text-[14px] text-muted">
              Booking {b.id} · session {b.sessionId} · config {s.configVersion} · language {full.customer.language}
            </p>
          </div>
          <div className="no-print flex gap-2">
            <PrintButton />
            <Button disabled title="Demo: no real call is started">
              Start call
            </Button>
          </div>
        </div>
        <div className="mt-8">
          <HandoffBody s={s} />
        </div>
        <div className="mt-8 grid gap-8 border-t border-line pt-6 md:grid-cols-2">
          <section>
            <h3 className="font-display text-[17px] font-semibold">Call script</h3>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[14px] text-muted">
              <li>Confirm the gap and the assumptions with the customer.</li>
              <li>Go over any clarified reality-check point.</li>
              <li>Only then discuss product, cover and term.</li>
              <li>Record whether the recommendation changed, and why.</li>
            </ol>
            <p className="mt-4 text-[13px] text-muted-2">
              Contact on the booking record: {full.customer.mobile}
              {full.customer.email ? ` · ${full.customer.email}` : ""}
            </p>
          </section>
          <FeedbackForm bookingId={b.id} />
        </div>
        <p className="mt-6 text-[13px] text-muted-2">
          Visible only to {advisorName} until {formatInTimeZone(new Date(access.accessEnds), TZ, "d MMM")}. Every view is logged ({views.length} so far, latest {formatInTimeZone(new Date(views[views.length - 1].ts), TZ, "d MMM HH:mm")} by {views[views.length - 1].viewer}). No bulk export. Contact details appear only on the booking record. <Trace id="§6.1 row 9" />
        </p>
      </article>
    </div>
  );
}
