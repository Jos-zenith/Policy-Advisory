import { cookies } from "next/headers";
import { z } from "zod";
import advisorsJson from "@/data/canonical/advisors.json";

export const dynamic = "force-dynamic";

const Body = z.union([z.object({ role: z.literal("advisor"), advisorId: z.string() }), z.object({ role: z.literal("compliance") }), z.object({ role: z.literal("none") })]);

/** Demo sign-in, not real authentication. Sets role cookies for /advisor/*. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid" }, { status: 400 });
  const c = await cookies();
  const opts = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 8 };
  if (parsed.data.role === "none") {
    c.delete("role");
    c.delete("advisorId");
  } else if (parsed.data.role === "compliance") {
    c.set("role", "compliance", opts);
    c.delete("advisorId");
  } else {
    const id = parsed.data.advisorId;
    if (!advisorsJson.advisors.some((a) => a.id === id)) return Response.json({ error: "unknown advisor" }, { status: 400 });
    c.set("role", "advisor", opts);
    c.set("advisorId", id, opts);
  }
  return Response.json({ ok: true });
}
