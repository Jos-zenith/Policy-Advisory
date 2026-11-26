import crypto from "node:crypto";

/**
 * AES-256-GCM for encrypted columns. Key = SHA-256(DATA_KEY).
 * Blob layout: version(1) | iv(12) | tag(16) | ciphertext.
 */
const VERSION = 1;
const DEV_KEY = "dev-only-data-key-do-not-use-in-production";
let cached: Buffer | null = null;

function key(): Buffer {
  if (cached) return cached;
  const secret = process.env.DATA_KEY;
  if (!secret || secret.length < 16) {
    if (process.env.NODE_ENV === "production" && !process.env.ALLOW_DEV_KEY) {
      throw new Error("DATA_KEY must be set (16+ characters) in production.");
    }
    console.warn("[crypto] DATA_KEY not set; using the development key.");
    cached = crypto.createHash("sha256").update(DEV_KEY).digest();
    return cached;
  }
  cached = crypto.createHash("sha256").update(secret).digest();
  return cached;
}

export function encryptJson(value: unknown): Buffer {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const plain = Buffer.from(JSON.stringify(value), "utf8");
  const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from([VERSION]), iv, tag, ct]);
}

export function decryptJson<T = unknown>(blob: Buffer | Uint8Array | null): T | null {
  if (!blob) return null;
  const buf = Buffer.from(blob);
  if (buf[0] !== VERSION) throw new Error("Unknown encryption version");
  const iv = buf.subarray(1, 13);
  const tag = buf.subarray(13, 29);
  const ct = buf.subarray(29);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ct), decipher.final()]);
  return JSON.parse(plain.toString("utf8")) as T;
}
