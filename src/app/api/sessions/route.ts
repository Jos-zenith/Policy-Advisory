import { z } from "zod";
import { getDb } from "@/server/db";

export const dynamic = "force-dynamic";

const Body = z.object({ id: z.string().regex(/^s_[a-z0-9]{4,32}$/i) });

/** Registers an anonymous session ID. No personal or financial data is accepted here (P5). */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid session id" }, { status: 400 });
  getDb().prepare("INSERT OR IGNORE INTO sessions (id, created_at) VALUES (?, ?)").run(parsed.data.id, new Date().toISOString());
  return Response.json({ ok: true });
}
