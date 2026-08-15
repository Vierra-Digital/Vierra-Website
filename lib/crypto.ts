import crypto from "crypto";

// Lazy + memoized: validating ENCRYPTION_SECRET at module load meant merely IMPORTING this file
// (e.g. for safeCompare, which needs no secret at all) threw whenever the env var was unset —
// breaking CI (.github/workflows/ci.yml only sets DATABASE_URL) for any test that transitively
// imports this module without ever calling encrypt/decrypt. Deferred until first actual use.
let cachedKey: Buffer | null = null;
function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const keyB64 = process.env.ENCRYPTION_SECRET || "";
  const key = Buffer.from(keyB64, "base64");
  if (key.length !== 32) throw new Error("ENCRYPTION_SECRET must be 32 bytes base64");
  cachedKey = key;
  return key;
}

export function encrypt(plaintext: string) {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

/**
 * Constant-time string comparison for secrets (cron tokens, passcode hashes). Hashes both
 * sides to a fixed 32-byte digest first, so timingSafeEqual never throws on a length mismatch
 * and the length itself isn't leaked.
 */
export function safeCompare(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function decrypt(b64: string) {
  const key = getKey();
  const raw = Buffer.from(b64, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const enc = raw.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString("utf8");
}
