/**
 * Scheduler and atomic booking (CLAUDE.md §11).
 *
 * createBooking runs in ONE `BEGIN IMMEDIATE` transaction:
 *   idempotency check → slot + licence check → booked < capacity → increment →
 *   insert booking (encrypted customer + snapshot) → append trail events.
 * A repeated Idempotency-Key returns the original booking. A taken slot returns
 * "taken" with the next three free slots.
 */
import type Database from "better-sqlite3";
import { formatInTimeZone } from "date-fns-tz";
import { DEFAULT_ASSUMPTIONS, ENGINE_CONFIG, CONFIG_VERSION } from "@/config";
import consent from "@/config/content/consent.json";
import { CATALOG } from "@/data/catalog";
import { analyse, buildHandoffSnapshot, evaluateRules, resultLevel, withOverrides, type HandoffSnapshot, type Profile, type Provided } from "@/engine";
import type { BookingRequest } from "./booking-schema";
import { decryptJson, encryptJson } from "./crypto";
import { appendTrail } from "./trail";

export const TZ = "Asia/Kolkata";

export interface AdvisorRow {
  id: string;
  name: string;
  languages: string[];
  specialities: string[];
  licenceRef: string;
  licenceValidTo: string | null;
  isSample: boolean;
}

export interface SlotView {
  id: string;
  advisorId: string;
  startUtc: string;
  endUtc: string;
  free: boolean;
}

type RawAdvisor = { id: string; name: string; languages_json: string; specialities_json: string; licence_ref: string; licence_valid_to: string | null; is_sample: number };
const toAdvisor = (r: RawAdvisor): AdvisorRow => ({ id: r.id, name: r.name, languages: JSON.parse(r.languages_json), specialities: JSON.parse(r.specialities_json), licenceRef: r.licence_ref, licenceValidTo: r.licence_valid_to, isSample: !!r.is_sample });

/** IST calendar date of a UTC instant, as YYYY-MM-DD. */
export const istDate = (utc: string | Date) => formatInTimeZone(typeof utc === "string" ? new Date(utc) : utc, TZ, "yyyy-MM-dd");

/** Licence valid on the slot's date (expired or missing licences are hidden). */
const LICENCE_OK_SQL = "a.licence_valid_to IS NOT NULL AND a.licence_valid_to >= date(s.start_utc, '+5 hours', '+30 minutes')";

/** Days (IST) that have at least one bookable slot from a licensed advisor. */
export function availableDays(db: Database.Database, now: Date): string[] {
  const rows = db
    .prepare(`SELECT DISTINCT date(s.start_utc, '+5 hours', '+30 minutes') d FROM slots s JOIN advisors a ON a.id = s.advisor_id WHERE s.start_utc > ? AND ${LICENCE_OK_SQL} ORDER BY d`)
    .all(now.toISOString()) as { d: string }[];
  return rows.map((r) => r.d);
}

/** Slots for one IST day from licensed advisors. */
function slotIdsForDay(db: Database.Database, day: string, now: Date) {
  return db
    .prepare(`SELECT s.id sid, s.advisor_id, s.start_utc, s.end_utc, s.capacity, s.booked FROM slots s JOIN advisors a ON a.id = s.advisor_id WHERE date(s.start_utc, '+5 hours', '+30 minutes') = ? AND s.start_utc > ? AND ${LICENCE_OK_SQL} ORDER BY s.start_utc`)
    .all(day, now.toISOString()) as { sid: string; advisor_id: string; start_utc: string; end_utc: string; capacity: number; booked: number }[];
}

export function scheduleForDay(db: Database.Database, day: string, now: Date): { advisor: AdvisorRow; slots: SlotView[] }[] {
  const advisors = (db.prepare("SELECT * FROM advisors ORDER BY rowid").all() as RawAdvisor[]).map(toAdvisor);
  const slots = slotIdsForDay(db, day, now);
  return advisors
    .map((a) => ({ advisor: a, slots: slots.filter((s) => s.advisor_id === a.id).map((s) => ({ id: s.sid, advisorId: s.advisor_id, startUtc: s.start_utc, endUtc: s.end_utc, free: s.booked < s.capacity })) }))
    .filter((x) => x.slots.length > 0);
}

export function nextFreeSlots(db: Database.Database, afterUtc: string, n = 3, excludeId?: string): (SlotView & { advisorName: string })[] {
  const rows = db
    .prepare(
      `SELECT s.id sid, s.advisor_id, s.start_utc, s.end_utc, a.name FROM slots s JOIN advisors a ON a.id = s.advisor_id
       WHERE s.booked < s.capacity AND s.start_utc >= ? AND s.id != ? AND ${LICENCE_OK_SQL} ORDER BY s.start_utc, a.rowid LIMIT ?`,
    )
    .all(afterUtc, excludeId ?? "", n) as { sid: string; advisor_id: string; start_utc: string; end_utc: string; name: string }[];
  return rows.map((r) => ({ id: r.sid, advisorId: r.advisor_id, startUtc: r.start_utc, endUtc: r.end_utc, free: true, advisorName: r.name }));
}

/* ------------------------------------------------------------------ */
/* Snapshot                                                             */
/* ------------------------------------------------------------------ */

export function buildSnapshotFromJourney(j: BookingRequest["journey"], now: string): { ok: true; snapshot: HandoffSnapshot } | { ok: false; errors: string[] } {
  const profile = j.profile as Profile;
  const a = withOverrides(DEFAULT_ASSUMPTIONS, j.assumptions);
  const an = analyse(profile, a, ENGINE_CONFIG);
  if (!an.ok) return { ok: false, errors: an.errors.map((e) => e.message) };
  const rules = evaluateRules(an.value, profile, a, ENGINE_CONFIG, CATALOG, j.options);
  const names = Object.fromEntries(CATALOG.products.map((p) => [p.id, { name: p.name, category: p.category }]));
  const level = resultLevel(j.provided as Provided);
  const levelText = { BASIC: "Basic", REFINED: "Refined", DETAILED: "Detailed" }[level.level] + (level.skipped.length ? ` (${level.skipped.map((s) => s.section.replace(/([A-Z])/g, " $1").toLowerCase()).join(", ")} skipped)` : "");
  const ep = j.existingPolicy ? { name: j.existingPolicy.name, category: j.existingPolicy.category, deathSumAssured: j.existingPolicy.deathSumAssured, annualPremium: j.existingPolicy.annualPremium, policyTerm: j.existingPolicy.policyTerm, policyYear: j.existingPolicy.policyYear } : null;
  return {
    ok: true,
    snapshot: buildHandoffSnapshot({ analysis: an.value, rules, profile, assumptions: a, config: ENGINE_CONFIG, productNames: names, comprehensionAnswers: j.comprehension, existingPolicy: ep, resultLevel: levelText, now }),
  };
}

/* ------------------------------------------------------------------ */
/* Atomic booking                                                       */
/* ------------------------------------------------------------------ */

export interface BookingRecord {
  id: string;
  sessionId: string;
  slotId: string;
  advisorId: string;
  advisorName: string;
  startUtc: string;
  endUtc: string;
  status: string;
  createdAt: string;
}

export type CreateResult =
  | { status: "created" | "replay"; booking: BookingRecord }
  | { status: "taken"; alternatives: (SlotView & { advisorName: string })[] }
  | { status: "unavailable"; reason: string };

function readBooking(db: Database.Database, where: "id" | "idempotency_key", v: string): BookingRecord | null {
  const r = db
    .prepare(`SELECT b.id, b.session_id, b.slot_id, b.status, b.created_at, s.advisor_id, s.start_utc, s.end_utc, a.name FROM bookings b JOIN slots s ON s.id = b.slot_id JOIN advisors a ON a.id = s.advisor_id WHERE b.${where} = ?`)
    .get(v) as { id: string; session_id: string; slot_id: string; status: string; created_at: string; advisor_id: string; start_utc: string; end_utc: string; name: string } | undefined;
  return r ? { id: r.id, sessionId: r.session_id, slotId: r.slot_id, advisorId: r.advisor_id, advisorName: r.name, startUtc: r.start_utc, endUtc: r.end_utc, status: r.status, createdAt: r.created_at } : null;
}

export const getBooking = (db: Database.Database, id: string) => readBooking(db, "id", id);

export function createBooking(db: Database.Database, req: BookingRequest, idempotencyKey: string, snapshot: HandoffSnapshot, now: Date): CreateResult {
  const nowIso = now.toISOString();
  const tx = db.transaction((): CreateResult => {
    const replay = readBooking(db, "idempotency_key", idempotencyKey);
    if (replay) return { status: "replay", booking: replay };

    const slot = db.prepare("SELECT s.*, a.name advisor_name, a.licence_valid_to FROM slots s JOIN advisors a ON a.id = s.advisor_id WHERE s.id = ?").get(req.slotId) as
      | { id: string; advisor_id: string; start_utc: string; end_utc: string; capacity: number; booked: number; advisor_name: string; licence_valid_to: string | null }
      | undefined;
    if (!slot) return { status: "unavailable", reason: "That time no longer exists." };
    if (slot.start_utc <= nowIso) return { status: "unavailable", reason: "That time has already passed." };
    if (!slot.licence_valid_to || slot.licence_valid_to < istDate(slot.start_utc)) return { status: "unavailable", reason: "That advisor isn't available for this date." };
    if (slot.booked >= slot.capacity) return { status: "taken", alternatives: nextFreeSlots(db, slot.start_utc, 3, slot.id) };

    const upd = db.prepare("UPDATE slots SET booked = booked + 1 WHERE id = ? AND booked < capacity").run(slot.id);
    if (upd.changes !== 1) return { status: "taken", alternatives: nextFreeSlots(db, slot.start_utc, 3, slot.id) };

    db.prepare("INSERT OR IGNORE INTO sessions (id, created_at) VALUES (?, ?)").run(req.sessionId, nowIso);
    const seq = ((db.prepare("SELECT COALESCE(MAX(seq), 0) + 1 n FROM bookings").get() as { n: number }).n);
    const id = `BK-${req.sessionId.slice(2, 6).toUpperCase()}-${String(seq).padStart(4, "0")}`;
    const customer = { ...req.customer, email: req.customer.email || undefined };
    db.prepare(
      "INSERT INTO bookings (id, session_id, slot_id, idempotency_key, customer_enc, consents_json, handoff_snapshot_enc, status, created_at, seq) VALUES (?, ?, ?, ?, ?, ?, ?, 'CONFIRMED', ?, ?)",
    ).run(id, req.sessionId, slot.id, idempotencyKey, encryptJson(customer), JSON.stringify({ ...req.consents, recordedAt: nowIso }), encryptJson(snapshot), nowIso, seq);

    // Buffered journey events (anonymous, already in order), then the booking events.
    for (const e of req.events) {
      if (e.event === "booking.created" || e.event === "handoff.generated" || e.event === "consent.recorded") continue;
      appendTrail(db, { sessionId: req.sessionId, ts: e.ts, event: e.event, detail: e.detail, ruleId: e.ruleId, configVersion: e.configVersion });
    }
    const when = formatInTimeZone(new Date(slot.start_utc), TZ, "EEE d MMM HH:mm");
    const accessEnds = formatInTimeZone(new Date(new Date(slot.end_utc).getTime() + ENGINE_CONFIG.rules.accessDaysAfterCall * 86_400_000), TZ, "d MMM");
    appendTrail(db, { sessionId: req.sessionId, ts: nowIso, event: "consent.recorded", detail: { summary: `3 purposes granted, consent text ${req.consents.version}`, purposes: ["prepare", "share", "contact"] }, ruleId: "§6.1 row 6", configVersion: CONFIG_VERSION });
    appendTrail(db, { sessionId: req.sessionId, ts: nowIso, event: "booking.created", detail: { summary: `${slot.advisor_name}, ${when}; slot locked in one transaction; idempotency key ${idempotencyKey.slice(0, 8)}`, bookingId: id, slotId: slot.id }, ruleId: "FR-7.2", configVersion: CONFIG_VERSION });
    appendTrail(db, { sessionId: req.sessionId, ts: nowIso, event: "handoff.generated", detail: { summary: `Pack shared with advisor; access ends ${accessEnds}`, bookingId: id }, ruleId: "FR-7.4", configVersion: CONFIG_VERSION });

    return { status: "created", booking: readBooking(db, "id", id)! };
  });
  return tx.immediate();
}

export function readSnapshot(db: Database.Database, bookingId: string): { snapshot: HandoffSnapshot; customer: { name: string; mobile: string; email?: string; language: string }; consents: Record<string, unknown> } | null {
  const r = db.prepare("SELECT customer_enc, handoff_snapshot_enc, consents_json FROM bookings WHERE id = ?").get(bookingId) as { customer_enc: Buffer; handoff_snapshot_enc: Buffer; consents_json: string } | undefined;
  if (!r) return null;
  return { snapshot: decryptJson<HandoffSnapshot>(r.handoff_snapshot_enc)!, customer: decryptJson(r.customer_enc)!, consents: JSON.parse(r.consents_json) };
}

export function listBookings(db: Database.Database, advisorId?: string): (BookingRecord & { customerFirstName: string; gap: number; state: string })[] {
  const rows = db
    .prepare(`SELECT b.id FROM bookings b JOIN slots s ON s.id = b.slot_id ${advisorId ? "WHERE s.advisor_id = ?" : ""} ORDER BY s.start_utc`)
    .all(...(advisorId ? [advisorId] : [])) as { id: string }[];
  return rows.map((r) => {
    const b = readBooking(db, "id", r.id)!;
    const s = readSnapshot(db, r.id)!;
    return { ...b, customerFirstName: s.customer.name.split(/\s+/)[0], gap: s.snapshot.gap, state: s.snapshot.state };
  });
}

export function logHandoffView(db: Database.Database, bookingId: string, viewer: string, now: Date) {
  db.prepare("INSERT INTO handoff_views (booking_id, viewer, ts) VALUES (?, ?, ?)").run(bookingId, viewer, now.toISOString());
}

export function handoffViews(db: Database.Database, bookingId: string): { viewer: string; ts: string }[] {
  return db.prepare("SELECT viewer, ts FROM handoff_views WHERE booking_id = ? ORDER BY id").all(bookingId) as { viewer: string; ts: string }[];
}

export const CONSENT_VERSION = consent.version;
