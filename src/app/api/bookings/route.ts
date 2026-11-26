import { getDb } from "@/server/db";
import { BookingRequestSchema } from "@/server/booking-schema";
import { buildSnapshotFromJourney, createBooking } from "@/server/bookings";

export const dynamic = "force-dynamic";

/**
 * POST /api/bookings — atomic booking with an Idempotency-Key header.
 * 201 created · 200 replay (same key) · 409 slot taken (+ next three free) · 422 invalid.
 * Never logs request bodies (they contain financial values and contact details).
 */
export async function POST(req: Request) {
  const key = req.headers.get("idempotency-key");
  if (!key || key.length < 8 || key.length > 100) return Response.json({ error: "Idempotency-Key header is required" }, { status: 400 });
  const parsed = BookingRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid", issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) }, { status: 422 });
  }
  const now = new Date();
  const snap = buildSnapshotFromJourney(parsed.data.journey, now.toISOString());
  if (!snap.ok) return Response.json({ error: "invalid journey", issues: snap.errors.map((m) => ({ path: "journey", message: m })) }, { status: 422 });

  const result = createBooking(getDb(), parsed.data, key, snap.snapshot, now);
  switch (result.status) {
    case "created":
      return Response.json({ booking: result.booking }, { status: 201 });
    case "replay":
      return Response.json({ booking: result.booking, replay: true }, { status: 200 });
    case "taken":
      return Response.json({ error: "slot_taken", alternatives: result.alternatives }, { status: 409 });
    default:
      return Response.json({ error: "unavailable", reason: result.reason }, { status: 409 });
  }
}
