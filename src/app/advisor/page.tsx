import type { Metadata } from "next";
import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import advisorsJson from "@/data/canonical/advisors.json";
import { inr } from "@/engine";
import { getDb } from "@/server/db";
import { getDemoRole } from "@/server/auth-demo";
import { listBookings } from "@/server/bookings";
import { RoleSwitch } from "@/components/advisor/role-switch";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Advisor workspace" };

export default async function AdvisorHome() {
  const role = await getDemoRole();
  const current = role ? (role.role === "compliance" ? "compliance" : `advisor:${role.advisorId}`) : "";
  const advisorName = role?.role === "advisor" ? advisorsJson.advisors.find((a) => a.id === role.advisorId)?.name : null;
  const bookings = role ? listBookings(getDb(), role.role === "advisor" ? role.advisorId : undefined) : [];

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Advisor workspace</p>
          <h1 className="mt-1 font-display text-3xl font-bold">{role ? (role.role === "compliance" ? "All bookings · compliance view" : `Your calls, ${advisorName}`) : "Sign in to the demo workspace"}</h1>
        </div>
        <RoleSwitch current={current} />
      </div>
      {!role ? (
        <div className="card mt-8 p-6 text-[15px] text-muted">
          <p>Choose an advisor or the compliance role above. An advisor sees only their own bookings, until 7 days after each call; compliance sees every booking and trail. Every view of a handoff pack is logged.</p>
          <p className="mt-2">Tip: after booking as Arjun with Priya Raman, sign in as Priya Raman.</p>
        </div>
      ) : bookings.length === 0 ? (
        <div className="card mt-8 p-6 text-muted">No bookings yet. Book a call from Stage 4 of the journey, then come back here.</div>
      ) : (
        <div className="card scroll-x mt-8">
          <table className="w-full min-w-[720px] text-left text-[14px]">
            <thead>
              <tr className="border-b border-line text-[12px] uppercase tracking-[0.06em] text-muted-2">
                <th className="px-5 py-3 font-semibold">When (IST)</th>
                <th className="px-5 py-3 font-semibold">Customer</th>
                <th className="px-5 py-3 font-semibold">Advisor</th>
                <th className="px-5 py-3 font-semibold">Booking</th>
                <th className="px-5 py-3 font-semibold">Summary</th>
                <th className="px-5 py-3 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} className="border-b border-line last:border-b-0">
                  <td className="num px-5 py-3">{formatInTimeZone(new Date(b.startUtc), "Asia/Kolkata", "EEE d MMM, HH:mm")}</td>
                  <td className="px-5 py-3">{b.customerFirstName}</td>
                  <td className="px-5 py-3">{b.advisorName}</td>
                  <td className="px-5 py-3 font-mono text-[13px]">{b.id}</td>
                  <td className="num px-5 py-3">{b.state === "GAP" ? `Gap ${inr(b.gap)}` : "Adequately covered"}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-right">
                    <Link className="font-semibold text-blue hover:underline" href={`/advisor/handoff/${b.id}`}>
                      Handoff
                    </Link>
                    <span className="mx-2 text-line">|</span>
                    <Link className="font-semibold text-blue hover:underline" href={`/advisor/trail/${b.sessionId}`}>
                      Trail
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
