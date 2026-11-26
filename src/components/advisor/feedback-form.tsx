"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trace } from "@/components/ui/trace";

/** "After the call" (FR-7.6, P2 designed). Saves to the append-only trail. */
export function FeedbackForm({ bookingId }: { bookingId: string }) {
  const [changed, setChanged] = useState<"yes" | "no" | null>(null);
  const [reason, setReason] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  return (
    <section className="no-print">
      <h3 className="font-display text-[17px] font-semibold">
        After the call <Trace id={["FR-7.6", "P2 designed"]} />
      </h3>
      <fieldset className="mt-2">
        <legend className="text-[14px] font-medium">Did the recommendation change?</legend>
        <div className="mt-2 flex gap-5 text-[14px]">
          {(["no", "yes"] as const).map((v) => (
            <label key={v} className="flex items-center gap-2">
              <input type="radio" name="changed" checked={changed === v} onChange={() => setChanged(v)} />
              {v === "no" ? "No" : "Yes"}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="mt-3 block text-[14px] font-medium">
        Reason
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-line p-3 font-normal" />
      </label>
      <Button
        className="mt-3"
        size="sm"
        disabled={!changed || state === "saving"}
        onClick={async () => {
          setState("saving");
          const r = await fetch(`/api/bookings/${bookingId}/feedback`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ changed, reason }) });
          setState(r.ok ? "saved" : "error");
        }}
      >
        Save to the trail
      </Button>
      {state === "saved" ? <p className="mt-2 text-[13px] text-green-ink">Saved as an append-only trail event.</p> : null}
      {state === "error" ? <p className="mt-2 text-[13px] text-warn-ink">Couldn&apos;t save. Your access may have ended.</p> : null}
    </section>
  );
}
