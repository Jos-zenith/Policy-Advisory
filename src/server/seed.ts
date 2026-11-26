/**
 * npm run seed — create the schema, upsert sample advisors and add the next
 * 10 working days of slots. Idempotent. SEED_RESET=1 deletes the DB file first.
 */
import fs from "node:fs";
import advisorsJson from "@/data/canonical/advisors.json";
import { generateSlots } from "@/data/canonical/slots.seed";
import { dbPath, getDb } from "./db";

function main() {
  const file = dbPath();
  if (process.env.SEED_RESET === "1") {
    for (const f of [file, `${file}-wal`, `${file}-shm`]) if (fs.existsSync(f)) fs.rmSync(f);
    console.log(`[seed] reset ${file}`);
  }
  const db = getDb();
  const upsertAdvisor = db.prepare(
    `INSERT INTO advisors (id, name, languages_json, specialities_json, licence_ref, licence_valid_to, is_sample)
     VALUES (@id, @name, @languages, @specialities, @licenceRef, @licenceValidTo, @isSample)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, languages_json=excluded.languages_json,
       specialities_json=excluded.specialities_json, licence_ref=excluded.licence_ref,
       licence_valid_to=excluded.licence_valid_to, is_sample=excluded.is_sample`,
  );
  const insertSlot = db.prepare(
    `INSERT OR IGNORE INTO slots (id, advisor_id, start_utc, end_utc, capacity, booked)
     VALUES (@id, @advisorId, @startUtc, @endUtc, @capacity, @booked)`,
  );
  const slots = generateSlots(new Date());
  const tx = db.transaction(() => {
    for (const a of advisorsJson.advisors) {
      upsertAdvisor.run({
        id: a.id,
        name: a.name,
        languages: JSON.stringify(a.languages),
        specialities: JSON.stringify(a.specialities),
        licenceRef: a.licenceRef,
        licenceValidTo: a.licenceValidTo || null,
        isSample: a.isSample ? 1 : 0,
      });
    }
    let added = 0;
    for (const s of slots) added += insertSlot.run(s).changes;
    return added;
  });
  const added = tx();
  const counts = db.prepare(`SELECT (SELECT COUNT(*) FROM advisors) a, (SELECT COUNT(*) FROM slots) s, (SELECT COUNT(*) FROM bookings) b`).get() as { a: number; s: number; b: number };
  console.log(`[seed] ${file}: ${counts.a} advisors, ${counts.s} slots (+${added} new), ${counts.b} bookings`);
}

main();
