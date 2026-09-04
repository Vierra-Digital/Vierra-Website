/**
 * Deno port of lib/crypto.ts's safeCompare — constant-time secret comparison for CRON_SECRET
 * auth. Hashes both sides to a fixed-length digest first so a byte-by-byte compare never
 * short-circuits on length, matching the Node implementation's guarantee.
 */
/**
 * Deno port of lib/crypto.ts's encrypt/decrypt (AES-256-GCM). Byte layout must match the Node
 * side exactly (iv[12] + authTag[16] + ciphertext, base64), since tokens this decrypts were
 * written by lib/crypto.ts and tokens this encrypts get read back by it. Web Crypto returns
 * ciphertext+tag concatenated (tag last) from encrypt and expects the same concatenation as
 * input to decrypt, which is why the tag gets sliced off/back on here instead of passed
 * separately the way Node's cipher.getAuthTag() API does it.
 */
async function importKey(): Promise<CryptoKey> {
  const keyB64 = Deno.env.get("ENCRYPTION_SECRET") || "";
  const keyBytes = base64ToBytes(keyB64);
  if (keyBytes.length !== 32) throw new Error("ENCRYPTION_SECRET must be 32 bytes base64");
  return crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

/**
 * atob() is strict about the base64 alphabet and throws on base64url characters (-, _) or stray
 * whitespace. Node's Buffer.from(str, "base64") tolerates both — normalize to match, since some
 * existing secrets/tokens in this codebase were produced with a base64url-flavored generator.
 */
/** Exported for _shared/mime.ts's base64url helpers — same base64url-tolerant decode. */
export function base64ToBytes(b64: string): Uint8Array {
  const normalized = b64.replace(/-/g, "+").replace(/_/g, "/").replace(/[^A-Za-z0-9+/=]/g, "");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Exported for _shared/mime.ts's base64url helpers. */
export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export async function encrypt(plaintext: string): Promise<string> {
  const key = await importKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext))
  );
  const ciphertext = data.slice(0, data.length - 16);
  const tag = data.slice(data.length - 16);
  const combined = new Uint8Array(iv.length + tag.length + ciphertext.length);
  combined.set(iv, 0);
  combined.set(tag, iv.length);
  combined.set(ciphertext, iv.length + tag.length);
  return bytesToBase64(combined);
}

export async function decrypt(b64: string): Promise<string> {
  const key = await importKey();
  const raw = base64ToBytes(b64);
  const iv = raw.slice(0, 12);
  const tag = raw.slice(12, 28);
  const ciphertext = raw.slice(28);
  const combined = new Uint8Array(ciphertext.length + tag.length);
  combined.set(ciphertext, 0);
  combined.set(tag, ciphertext.length);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, combined);
  return new TextDecoder().decode(plaintext);
}

export async function safeCompare(a: string, b: string): Promise<boolean> {
  const ha = await sha256(a);
  const hb = await sha256(b);
  if (ha.length !== hb.length) return false;
  let diff = 0;
  for (let i = 0; i < ha.length; i++) diff |= ha[i] ^ hb[i];
  return diff === 0;
}

async function sha256(input: string): Promise<Uint8Array> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return new Uint8Array(digest);
}
