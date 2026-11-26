import { getDb } from "@/server/db";
import { getBooking, readSnapshot } from "@/server/bookings";

export const dynamic = "force-dynamic";

/** GET /api/bookings/:id?s=<sessionId> — the customer's own confirmation (session ID acts as the key). */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const s = new URL(req.url).searchParams.get("s");
  const db = getDb();
  const b = getBooking(db, id);
  if (!b || !s || b.sessionId !== s) return Response.json({ error: "not found" }, { status: 404 });
  const full = readSnapshot(db, id)!;
  return Response.json(
    {
      booking: b,
      firstName: full.customer.name.split(/\s+/)[0],
      language: full.customer.language,
      choice: full.snapshot.choice,
      gap: full.snapshot.gap,
      state: full.snapshot.state,
      comprehension: full.snapshot.comprehension ? { score: full.snapshot.comprehension.score } : null,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
