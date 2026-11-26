import { z } from "zod";
import { CONFIG_VERSION } from "@/config";
import { getDb } from "@/server/db";
import { canViewHandoff, getDemoRole } from "@/server/auth-demo";
import { getBooking } from "@/server/bookings";
import { appendTrail } from "@/server/trail";

export const dynamic = "force-dynamic";

const Body = z.object({ changed: z.enum(["yes", "no"]), reason: z.string().max(1000).optional() });

/** "After the call" feedback (FR-7.6, P2 designed). Stored as an append-only trail event. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = getDb();
  const access = canViewHandoff(db, await getDemoRole(), id, new Date());
  if (!access.ok) return Response.json({ error: access.reason }, { status: 403 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid" }, { status: 422 });
  const b = getBooking(db, id)!;
  appendTrail(db, {
    sessionId: b.sessionId,
    ts: new Date().toISOString(),
    event: "advisor.feedback",
    detail: { summary: `Recommendation changed: ${parsed.data.changed}${parsed.data.reason ? `; reason recorded` : ""}`, changed: parsed.data.changed, reason: parsed.data.reason ?? "" },
    ruleId: "FR-7.6",
    configVersion: CONFIG_VERSION,
  });
  return Response.json({ ok: true });
}
