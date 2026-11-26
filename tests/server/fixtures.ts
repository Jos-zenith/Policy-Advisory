import type Database from "better-sqlite3";
import advisorsJson from "@/data/canonical/advisors.json";
import personasJson from "@/config/content/personas.json";
import { generateSlots } from "@/data/canonical/slots.seed";
import type { BookingRequest } from "@/server/booking-schema";

export function seed(db: Database.Database, now: Date) {
  const ins = db.prepare("INSERT OR IGNORE INTO advisors (id, name, languages_json, specialities_json, licence_ref, licence_valid_to, is_sample) VALUES (?, ?, ?, ?, ?, ?, 1)");
  for (const a of advisorsJson.advisors) ins.run(a.id, a.name, JSON.stringify(a.languages), JSON.stringify(a.specialities), a.licenceRef, a.licenceValidTo);
  const s = db.prepare("INSERT OR IGNORE INTO slots (id, advisor_id, start_utc, end_utc, capacity, booked) VALUES (@id, @advisorId, @startUtc, @endUtc, @capacity, @booked)");
  for (const slot of generateSlots(now)) s.run(slot);
}

export function arjunRequest(slotId: string, sessionId = "s_7f3c0001"): BookingRequest {
  const p = personasJson.personas.find((x) => x.id === "arjun")!;
  return {
    sessionId,
    slotId,
    customer: { name: "Arjun Test", mobile: "9876543210", email: "", language: "English" },
    consents: { prepare: true, share: true, contact: true, version: "v1.2" },
    journey: {
      profile: p.profile as BookingRequest["journey"]["profile"],
      assumptions: {},
      provided: p.provided as Record<string, boolean>,
      options: { frequency: "YEARLY", rider: false },
      comprehension: { q1: [0], q2: [0, 1], q3: [0] },
      existingPolicy: p.existingPolicy,
    },
    events: [{ ts: new Date().toISOString(), event: "session.created", detail: { note: "Anonymous session; no personal data" }, ruleId: "FR-1.3", configVersion: "v2026.11-s1" }],
  };
}
