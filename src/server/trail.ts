/**
 * Append-only decision trail. detail is AES-256-GCM encrypted; the table has
 * triggers that reject UPDATE and DELETE. Nothing financial is logged to stdout.
 */
import type Database from "better-sqlite3";
import { decryptJson, encryptJson } from "./crypto";

export interface TrailRow {
  id: number;
  sessionId: string;
  ts: string;
  event: string;
  detail: Record<string, unknown>;
  ruleId: string | null;
  configVersion: string;
}

export function appendTrail(db: Database.Database, row: Omit<TrailRow, "id">): number {
  const r = db
    .prepare("INSERT INTO trail (session_id, ts, event, detail_enc, rule_id, config_version) VALUES (?, ?, ?, ?, ?, ?)")
    .run(row.sessionId, row.ts, row.event, encryptJson(row.detail), row.ruleId, row.configVersion);
  return Number(r.lastInsertRowid);
}

export function readTrail(db: Database.Database, sessionId: string): TrailRow[] {
  const rows = db.prepare("SELECT id, session_id, ts, event, detail_enc, rule_id, config_version FROM trail WHERE session_id = ? ORDER BY id").all(sessionId) as {
    id: number;
    session_id: string;
    ts: string;
    event: string;
    detail_enc: Buffer;
    rule_id: string | null;
    config_version: string;
  }[];
  return rows.map((r) => ({ id: r.id, sessionId: r.session_id, ts: r.ts, event: r.event, detail: decryptJson<Record<string, unknown>>(r.detail_enc) ?? {}, ruleId: r.rule_id, configVersion: r.config_version }));
}

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : typeof v === "string" ? v : JSON.stringify(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function trailToCsv(rows: TrailRow[]): string {
  const head = ["id", "session_id", "ts_utc", "event", "detail", "rule_id", "config_version"];
  const lines = rows.map((r) => [r.id, r.sessionId, r.ts, r.event, typeof r.detail.summary === "string" ? r.detail.summary : r.detail, r.ruleId ?? "", r.configVersion].map(csvCell).join(","));
  return [head.join(","), ...lines].join("\n") + "\n";
}
