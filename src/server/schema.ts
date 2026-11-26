import fs from "node:fs";
import path from "node:path";

/** schema.sql is the source of truth; read at startup (Dockerfile copies src/server/schema.sql). */
export const SCHEMA_SQL: string = fs.readFileSync(path.join(process.cwd(), "src/server/schema.sql"), "utf8");
