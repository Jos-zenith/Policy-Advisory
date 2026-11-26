import { getDb } from "@/server/db";
import { availableDays, scheduleForDay } from "@/server/bookings";

export const dynamic = "force-dynamic";

/** GET /api/slots?day=YYYY-MM-DD — bookable days, plus licensed advisors and their slots for one day. */
export function GET(req: Request) {
  const db = getDb();
  const now = new Date();
  const days = availableDays(db, now);
  const asked = new URL(req.url).searchParams.get("day");
  const day = asked && days.includes(asked) ? asked : days[0] ?? null;
  const advisors = day ? scheduleForDay(db, day, now) : [];
  return Response.json({ days, day, advisors }, { headers: { "cache-control": "no-store" } });
}
