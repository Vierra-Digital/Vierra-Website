import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase Storage helper for binary assets (images, and later PDFs).
 *
 * Server-only — uses the service-role key, which bypasses RLS. Never import this
 * into client code and never expose the key via a NEXT_PUBLIC_ var.
 *
 * When the env vars are absent, `isStorageConfigured()` returns false and callers
 * fall back to the legacy Postgres `Bytes` columns, so the app keeps working
 * before any bucket is provisioned. See OBJECT_STORAGE_MIGRATION.md.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const STORAGE_BUCKETS = {
  blog: process.env.SUPABASE_STORAGE_BUCKET_BLOG || "blog-images",
  avatars: process.env.SUPABASE_STORAGE_BUCKET_AVATARS || "avatars",
  docs: process.env.SUPABASE_STORAGE_BUCKET_DOCS || "documents",
};

function isStorageConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

let client: SupabaseClient | null = null;
function getStorage(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Supabase Storage is not configured (set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)"
    );
  }
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

async function uploadObject(
  bucket: string,
  path: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  const { error } = await getStorage()
    .storage.from(bucket)
    .upload(path, body, { contentType, upsert: true });
  if (error) throw error;
}

export async function downloadObject(bucket: string, path: string): Promise<Buffer> {
  const { data, error } = await getStorage().storage.from(bucket).download(path);
  if (error || !data) throw error || new Error(`Object not found: ${bucket}/${path}`);
  return Buffer.from(await data.arrayBuffer());
}

async function deleteObject(bucket: string, path: string): Promise<void> {
  const { error } = await getStorage().storage.from(bucket).remove([path]);
  if (error) throw error;
}

/** Storage object keys may not contain arbitrary characters; normalize an id to a safe key segment. */
export function toStorageKeySegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/**
 * Upload a binary asset when storage is configured; returns the key, or `null`
 * when storage is unconfigured (caller persists to the legacy `Bytes` column).
 */
export async function putFileAsset(
  bucket: string,
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  await uploadObject(bucket, key, buffer, contentType);
  return key;
}

/**
 * Mint a one-shot URL the browser can PUT a file straight to.
 *
 * The alternative — base64 the file into a JSON request and let an API route forward it — costs a
 * ~33% size increase on the wire and, more importantly, has to fit inside the serverless request
 * body limit, which is far below the 50mb the blog upload route advertised. Uploading direct to
 * storage takes the function out of the data path entirely, so the only ceiling is the bucket's.
 *
 * The URL carries its own short-lived authorization, so it is safe to hand to the client, but it
 * is still a write capability: only mint one for a caller the route has already authorized.
 */
export async function createSignedUploadUrl(
  bucket: string,
  key: string
): Promise<{ signedUrl: string; storageKey: string }> {
  const { data, error } = await getStorage().storage.from(bucket).createSignedUploadUrl(key);
  if (error || !data) throw error || new Error(`Could not sign an upload for ${bucket}/${key}`);
  return { signedUrl: data.signedUrl, storageKey: key };
}

/**
 * Confirm an object is really present before a row is written to point at it. The browser reports
 * its own upload result, and a row promising bytes that were never stored is worse than a failed
 * upload: it renders as a permanently broken image with nothing to retry.
 */
export async function objectExists(bucket: string, key: string): Promise<boolean> {
  const slash = key.lastIndexOf("/");
  const dir = slash === -1 ? "" : key.slice(0, slash);
  const name = slash === -1 ? key : key.slice(slash + 1);
  const { data, error } = await getStorage().storage.from(bucket).list(dir, { search: name, limit: 1 });
  if (error) return false;
  return (data ?? []).some((o) => o.name === name);
}

/** True when object storage is available; callers fall back to the inline path when it is not. */
export function storageConfigured(): boolean {
  return isStorageConfigured();
}

/** Resolve a file's bytes from storage by key; null when there's no key. */
export async function getFileBuffer(
  bucket: string,
  storageKey: string | null | undefined
): Promise<Buffer | null> {
  if (storageKey) return downloadObject(bucket, storageKey);
  return null;
}

/** Best-effort delete of a stored object; no-op when there's no key or storage is unconfigured. */
export async function deleteFileAsset(
  bucket: string,
  storageKey: string | null | undefined
): Promise<void> {
  if (!storageKey || !isStorageConfigured()) return;
  try {
    await deleteObject(bucket, storageKey);
  } catch {
    // best-effort cleanup — a leftover object is preferable to a failed user action
  }
}
