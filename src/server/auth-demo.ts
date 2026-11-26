/**
 * Demo sign-in for the advisor/compliance workspace.
 * NOT real authentication: a cookie chooses the role. Clearly labelled in the UI.
 */
import { cookies } from "next/headers";
import type Database from "better-sqlite3";
import { ENGINE_CONFIG } from "@/config";

export type DemoRole = { role: "advisor"; advisorId: string } | { role: "compliance" } | null;

export async function getDemoRole(): Promise<DemoRole> {
  const c = await cookies();
  const role = c.get("role")?.value;
  if (role === "compliance") return { role: "compliance" };
  if (role === "advisor") {
    const advisorId = c.get("advisorId")?.value;
    if (advisorId) return { role: "advisor", advisorId };
  }
  return null;
}

/**
 * Who may open a handoff pack: compliance always; the booked advisor only
 * until N days after the call (config accessDaysAfterCall).
 */
export function canViewHandoff(db: Database.Database, role: DemoRole, bookingId: string, now: Date): { ok: true; viewer: string; accessEnds: string } | { ok: false; reason: string } {
  if (!role) return { ok: false, reason: "Sign in with the demo role switch first." };
  const r = db.prepare("SELECT s.advisor_id, s.end_utc FROM bookings b JOIN slots s ON s.id = b.slot_id WHERE b.id = ?").get(bookingId) as { advisor_id: string; end_utc: string } | undefined;
  if (!r) return { ok: false, reason: "No such booking." };
  const accessEnds = new Date(new Date(r.end_utc).getTime() + ENGINE_CONFIG.rules.accessDaysAfterCall * 86_400_000).toISOString();
  if (role.role === "compliance") return { ok: true, viewer: "compliance", accessEnds };
  if (role.advisorId !== r.advisor_id) return { ok: false, reason: "This pack is shared only with the booked advisor." };
  if (now.toISOString() > accessEnds) return { ok: false, reason: "Access to this pack has ended (7 days after the call)." };
  return { ok: true, viewer: `advisor:${role.advisorId}`, accessEnds };
}

/** Sessions a role may see in the trail view. */
export function canViewTrail(db: Database.Database, role: DemoRole, sessionId: string): boolean {
  if (!role) return false;
  if (role.role === "compliance") return true;
  const r = db.prepare("SELECT 1 FROM bookings b JOIN slots s ON s.id = b.slot_id WHERE b.session_id = ? AND s.advisor_id = ?").get(sessionId, role.advisorId);
  return !!r;
}
