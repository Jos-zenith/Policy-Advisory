import { getDb } from "@/server/db";
import { canViewTrail, getDemoRole } from "@/server/auth-demo";
import { readTrail, trailToCsv } from "@/server/trail";

export const dynamic = "force-dynamic";

/** GET /api/trail/:sessionId?format=json|csv — export for the compliance view (demo role required). */
export async function GET(req: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await ctx.params;
  const db = getDb();
  if (!canViewTrail(db, await getDemoRole(), sessionId)) return Response.json({ error: "forbidden" }, { status: 403 });
  const rows = readTrail(db, sessionId);
  const format = new URL(req.url).searchParams.get("format");
  if (format === "csv") {
    return new Response(trailToCsv(rows), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="trail-${sessionId}.csv"`, "cache-control": "no-store" } });
  }
  return new Response(JSON.stringify({ sessionId, exportedAt: new Date().toISOString(), rows }, null, 2), {
    headers: { "content-type": "application/json", "content-disposition": `attachment; filename="trail-${sessionId}.json"`, "cache-control": "no-store" },
  });
}
