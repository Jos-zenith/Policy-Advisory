/**
 * Child-process helper for the race test: opens its OWN connection to the DB
 * file and tries to book one slot. Prints the result status as JSON.
 * usage: tsx tests/server/book-once.ts <dbFile> <slotId> <idempotencyKey> <sessionId>
 */
import { openDb } from "@/server/db";
import { buildSnapshotFromJourney, createBooking } from "@/server/bookings";
import { arjunRequest } from "./fixtures";

const [, , file, slotId, key, sessionId] = process.argv;
const db = openDb(file);
const req = arjunRequest(slotId, sessionId);
const snap = buildSnapshotFromJourney(req.journey, new Date().toISOString());
if (!snap.ok) throw new Error("snapshot failed");
// Start both processes at (nearly) the same instant.
const startAt = Number(process.env.START_AT ?? 0);
while (Date.now() < startAt) {
  /* spin */
}
const r = createBooking(db, req, key, snap.snapshot, new Date());
process.stdout.write(JSON.stringify({ status: r.status, id: r.status === "created" || r.status === "replay" ? r.booking.id : null }) + "\n");
db.close();
