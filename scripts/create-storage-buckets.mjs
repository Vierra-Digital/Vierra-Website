/**
 * Create the Supabase Storage buckets for the object-storage migration (Issue #59).
 * Idempotent — re-running is safe (existing buckets are left as-is).
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.
 *   node scripts/create-storage-buckets.mjs
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env. Aborting.");
  process.exit(1);
}

const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

const buckets = [
  { name: process.env.SUPABASE_STORAGE_BUCKET_BLOG || "blog-images", public: true },
  { name: process.env.SUPABASE_STORAGE_BUCKET_AVATARS || "avatars", public: false },
  { name: process.env.SUPABASE_STORAGE_BUCKET_DOCS || "documents", public: false },
];

for (const b of buckets) {
  const { error } = await supabase.storage.createBucket(b.name, { public: b.public });
  if (error && !/already exists/i.test(error.message)) {
    console.error(`✗ ${b.name}: ${error.message}`);
    process.exitCode = 1;
  } else {
    console.log(`✓ ${b.name} (${b.public ? "public" : "private"})${error ? " — already existed" : ""}`);
  }
}
