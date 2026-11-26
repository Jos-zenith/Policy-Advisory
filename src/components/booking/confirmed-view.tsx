"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import { inr, pct } from "@/engine";
import { Button } from "@/components/ui/button";
import { Trace } from "@/components/ui/trace";
import { useSearch } from "@/lib/hooks";
import { whenLabel } from "./advisor-picker";

interface Confirmation {
  booking: { id: string; advisorName: string; startUtc: string; endUtc: string; sessionId: string };
  firstName: string;
  language: string;
  choice: { productName: string | null; cover: number | null; term: number | null; annualPremium: number | null; shareOfIncome: number | null };
  gap: number;
  state: string;
}

export function ConfirmedView({ id }: { id: string }) {
  const s = new URLSearchParams(useSearch()).get("s");
  const [data, setData] = useState<Confirmation | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!s) return;
    fetch(`/api/bookings/${id}?s=${encodeURIComponent(s)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setFailed(true));
  }, [id, s]);

  if (failed || (!s && typeof window !== "undefined")) {
    return (
      <div className="mx-auto max-w-[720px] px-4 py-16">
        <div className="card p-8">
          <h1 className="font-display text-2xl font-semibold">We couldn&apos;t find that booking</h1>
          <p className="mt-2 text-muted">Open the link from the same browser session you booked in.</p>
        </div>
      </div>
    );
  }
  if (!data) return <div className="mx-auto max-w-[720px] px-4 py-16 text-muted">Loading your booking…</div>;

  return (
    <div className="mx-auto max-w-[760px] px-4 py-12 md:px-8">
      <div className="card p-6 md:p-10">
        <span className="grid size-12 place-items-center rounded-full bg-green-bg text-green-ink">
          <CalendarCheck className="size-6" aria-hidden />
        </span>
        <p className="eyebrow mt-5">Booking {data.booking.id}</p>
        <h1 className="mt-1 font-display text-3xl font-bold">You&apos;re booked, {data.firstName}</h1>
        <p className="mt-3 text-[17px] text-muted">
          {whenLabel(data.booking.startUtc)} IST with {data.booking.advisorName} · 30 minutes · phone or video · in {data.language}.
        </p>
        <dl className="mt-6 divide-y divide-line rounded-2xl border border-line px-4">
          <div className="flex justify-between py-3 text-[15px]">
            <dt className="text-muted">{data.state === "GAP" ? "Your gap" : "Your position"}</dt>
            <dd className="num font-semibold">{data.state === "GAP" ? inr(data.gap) : "Adequately covered"}</dd>
          </div>
          {data.choice.productName ? (
            <div className="flex justify-between gap-3 py-3 text-[15px]">
              <dt className="text-muted">Option you looked at</dt>
              <dd className="num text-right font-semibold">
                {data.choice.productName} · {inr(data.choice.cover ?? 0)} · {data.choice.term} years · {inr(data.choice.annualPremium ?? 0)} a year
                {data.choice.shareOfIncome !== null ? ` (${pct(data.choice.shareOfIncome)})` : ""}
              </dd>
            </div>
          ) : null}
        </dl>
        <h2 className="mt-8 font-display text-lg font-semibold">What happens next</h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[15px] text-muted">
          <li>{data.booking.advisorName} reads your one-page summary before the call.</li>
          <li>They confirm your gap and assumptions with you first, then talk about cover.</li>
          <li>Nothing is bought on the call unless you choose to. You can withdraw consent at any time.</li>
        </ol>
        <p className="mt-4 text-[13px] text-muted-2">
          Advisors and slots are sample data; no real call is scheduled in this demo. <Trace id={["FR-7.2", "FR-7.4"]} />
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href="/summary">Print summary</Link>
          </Button>
          <Button asChild variant="soft">
            <Link href="/advisor">See the advisor&apos;s view (demo)</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
