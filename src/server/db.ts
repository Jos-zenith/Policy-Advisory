import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { SCHEMA_SQL } from "./schema";

type DB = Database.Database;
const g = globalThis as unknown as { __nfDb?: DB; __nfDbPath?: string };

export function dbPath(): string {
  return path.resolve(/* turbopackIgnore: true */ process.env.DATABASE_PATH || "./data/app.db");
}

/** Singleton connection. WAL + busy timeout so parallel requests serialise on BEGIN IMMEDIATE. */
export function getDb(): DB {
  const file = dbPath();
  if (g.__nfDb && g.__nfDbPath === file) return g.__nfDb;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA_SQL);
  g.__nfDb = db;
  g.__nfDbPath = file;
  return db;
}

/** For tests: open an isolated database at a given path. */
export function openDb(file: string): DB {
  fs.mkdirSync(path.dirname(path.resolve(/* turbopackIgnore: true */ file)), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA_SQL);
  return db;
}
