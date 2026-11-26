/** Scheduler, atomic booking, trail and encryption (CLAUDE.md §11). */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Database from "better-sqlite3";
import { openDb } from "@/server/db";
import { availableDays, buildSnapshotFromJourney, createBooking, istDate, readSnapshot, scheduleForDay } from "@/server/bookings";
import { appendTrail, readTrail, trailToCsv } from "@/server/trail";
import { arjunRequest, seed } from "./fixtures";

process.env.DATA_KEY = "test-key-0123456789abcdef-not-secret";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nf-test-"));
const file = path.join(dir, "test.db");
const now = new Date();
let db: Database.Database;
let freeSlots: string[] = [];

beforeAll(() => {
  db = openDb(file);
  seed(db, now);
  const day = availableDays(db, now)[0];
  freeSlots = scheduleForDay(db, day, now).flatMap((a) => a.slots.filter((s) => s.free).map((s) => s.id));
});
afterAll(() => {
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

function runChild(slotId: string, key: string, sessionId: string, startAt: number): Promise<{ status: string; id: string | null }> {
  const tsx = path.resolve("node_modules/tsx/dist/cli.mjs");
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [tsx, "tests/server/book-once.ts", file, slotId, key, sessionId], { env: { ...process.env, START_AT: String(startAt) }, cwd: process.cwd() });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("close", (code) => (code === 0 ? resolve(JSON.parse(out.trim().split("\n").pop()!)) : reject(new Error(err))));
  });
}

describe("double-booking race", () => {
  it("two parallel processes booking one slot → exactly one booking", async () => {
    const slot = freeSlots[0];
    const startAt = Date.now() + 2500;
    const [a, b] = await Promise.all([runChild(slot, "race-key-aaaaaaaa", "s_race0001", startAt), runChild(slot, "race-key-bbbbbbbb", "s_race0002", startAt)]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual(["created", "taken"]);
    const n = (db.prepare("SELECT COUNT(*) n FROM bookings WHERE slot_id = ?").get(slot) as { n: number }).n;
    expect(n).toBe(1);
    expect((db.prepare("SELECT booked FROM slots WHERE id = ?").get(slot) as { booked: number }).booked).toBe(1);
  }, 60_000);
});

describe("idempotency", () => {
  it("a repeated key returns the original booking and books nothing new", () => {
    const req = arjunRequest(freeSlots[1], "s_idem0001");
    const snap = buildSnapshotFromJourney(req.journey, now.toISOString());
    if (!snap.ok) throw new Error("snap");
    const first = createBooking(db, req, "idem-key-12345678", snap.snapshot, new Date());
    const second = createBooking(db, req, "idem-key-12345678", snap.snapshot, new Date());
    expect(first.status).toBe("created");
    expect(second.status).toBe("replay");
    if (first.status === "created" && second.status === "replay") expect(second.booking.id).toBe(first.booking.id);
    expect((db.prepare("SELECT booked FROM slots WHERE id = ?").get(freeSlots[1]) as { booked: number }).booked).toBe(1);
  });
  it("a taken slot returns the next three free slots", () => {
    const req = arjunRequest(freeSlots[1], "s_idem0002");
    const snap = buildSnapshotFromJourney(req.journey, now.toISOString());
    if (!snap.ok) throw new Error("snap");
    const r = createBooking(db, req, "other-key-87654321", snap.snapshot, new Date());
    expect(r.status).toBe("taken");
    if (r.status === "taken") {
      expect(r.alternatives).toHaveLength(3);
      expect(r.alternatives.every((s) => s.free && s.id !== freeSlots[1])).toBe(true);
    }
  });
});

describe("advisor visibility", () => {
  it("hides the advisor whose licence has expired, and refuses to book them", () => {
    const day = availableDays(db, now)[0];
    const ids = scheduleForDay(db, day, now).map((x) => x.advisor.id);
    expect(ids).not.toContain("ADV-RV");
    expect(ids).toContain("ADV-PR");
    const rv = db.prepare("SELECT id FROM slots WHERE advisor_id = 'ADV-RV' AND start_utc > ? LIMIT 1").get(now.toISOString()) as { id: string };
    const req = arjunRequest(rv.id, "s_lic00001");
    const snap = buildSnapshotFromJourney(req.journey, now.toISOString());
    if (!snap.ok) throw new Error("snap");
    expect(createBooking(db, req, "lic-key-12345678", snap.snapshot, new Date()).status).toBe("unavailable");
  });
  it("hides an advisor on dates after their licence ends", () => {
    // Fatima's licence ends 2026-12-31: no slots for her on later days.
    for (const d of availableDays(db, now).filter((x) => x > "2026-12-31")) {
      expect(scheduleForDay(db, d, now).map((x) => x.advisor.id)).not.toContain("ADV-FS");
    }
    expect(istDate("2026-12-03T05:30:00.000Z")).toBe("2026-12-03");
  });
});

describe("trail and snapshot integrity", () => {
  it("trail is append-only and the booking writes the expected events", () => {
    const rows = readTrail(db, "s_idem0001");
    expect(rows.map((r) => r.event)).toEqual(["session.created", "consent.recorded", "booking.created", "handoff.generated"]);
    expect(rows.every((r) => r.configVersion === "v2026.11-s1")).toBe(true);
    expect(() => db.prepare("UPDATE trail SET event = 'x' WHERE session_id = 's_idem0001'").run()).toThrow(/append-only/);
    expect(() => db.prepare("DELETE FROM trail").run()).toThrow(/append-only/);
    appendTrail(db, { sessionId: "s_idem0001", ts: new Date().toISOString(), event: "advisor.feedback", detail: { summary: "x" }, ruleId: "FR-7.6", configVersion: "v2026.11-s1" });
    expect(trailToCsv(readTrail(db, "s_idem0001")).split("\n")[0]).toBe("id,session_id,ts_utc,event,detail,rule_id,config_version");
  });
  it("snapshot is immutable, encrypted, and matches the engine (Arjun gap ₹2.39 Cr)", () => {
    const id = (db.prepare("SELECT id FROM bookings WHERE session_id = 's_idem0001'").get() as { id: string }).id;
    expect(() => db.prepare("UPDATE bookings SET handoff_snapshot_enc = x'00' WHERE id = ?").run(id)).toThrow(/immutable/);
    const raw = db.prepare("SELECT customer_enc, handoff_snapshot_enc FROM bookings WHERE id = ?").get(id) as { customer_enc: Buffer; handoff_snapshot_enc: Buffer };
    expect(raw.customer_enc.toString("latin1")).not.toContain("Arjun");
    expect(raw.handoff_snapshot_enc.toString("latin1")).not.toContain("23890422");
    const s = readSnapshot(db, id)!;
    expect(Math.round(s.snapshot.gap)).toBe(23_890_423);
    expect(s.snapshot.choice.annualPremium).toBeCloseTo(25_920, 6);
    expect(s.snapshot.comprehension!.score).toBe(2);
    expect(s.snapshot.flags.map((f) => f.id)).toEqual(["NEEDS_ABOVE_HLV", "EMPLOYER_COVER", "TRADITIONAL_POLICY", "COMPREHENSION_CORRECTED"]);
    expect(s.customer.name).toBe("Arjun Test");
    const trailRaw = db.prepare("SELECT detail_enc FROM trail WHERE session_id = 's_idem0001'").all() as { detail_enc: Buffer }[];
    expect(trailRaw.every((r) => !r.detail_enc.toString("latin1").includes("Anonymous"))).toBe(true);
  });
});
