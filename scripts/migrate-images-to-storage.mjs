/**
 * One-off backfill: copy existing image bytes from Postgres into Supabase Storage
 * and set the new *StorageKey columns. Idempotent and re-runnable.
 *
 * Usage:
 *   node scripts/migrate-images-to-storage.mjs            # upload + set keys (keeps Bytes)
 *   node scripts/migrate-images-to-storage.mjs --purge    # ALSO null the Bytes columns afterward
 *
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (+ optional bucket overrides) in .env,
 * and the buckets (blog-images, avatars) already created. Run against a snapshot first.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BLOG = process.env.SUPABASE_STORAGE_BUCKET_BLOG || "blog-images";
const AVATARS = process.env.SUPABASE_STORAGE_BUCKET_AVATARS || "avatars";
const DOCS = process.env.SUPABASE_STORAGE_BUCKET_DOCS || "documents";
const PURGE = process.argv.includes("--purge");

if (!URL || !KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Aborting.");
  process.exit(1);
}

const prisma = new PrismaClient();
const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

async function upload(bucket, key, bytes, mimeType) {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(key, Buffer.from(bytes), { contentType: mimeType || "application/octet-stream", upsert: true });
  if (error) throw error;
}

async function backfillBlog() {
  const rows = await prisma.blogImage.findMany({
    where: { storageKey: null, NOT: { data: null } },
    select: { id: true, data: true, mimeType: true },
  });
  console.log(`blog_images: ${rows.length} to migrate`);
  for (const r of rows) {
    const key = `blog/${r.id}`;
    await upload(BLOG, key, r.data, r.mimeType);
    await prisma.blogImage.update({
      where: { id: r.id },
      data: { storageKey: key, ...(PURGE ? { data: null } : {}) },
    });
    console.log(`  ✓ ${key}`);
  }
}

async function backfillAvatars(model, bucketPrefix) {
  const delegate = prisma[model];
  const rows = await delegate.findMany({
    where: { imageStorageKey: null, NOT: { image: null } },
    select: { id: true, image: true, imageMimeType: true },
  });
  console.log(`${model}: ${rows.length} to migrate`);
  for (const r of rows) {
    const key = `${bucketPrefix}/${r.id}`;
    await upload(AVATARS, key, r.image, r.imageMimeType);
    await delegate.update({
      where: { id: r.id },
      data: { imageStorageKey: key, ...(PURGE ? { image: null } : {}) },
    });
    console.log(`  ✓ ${key}`);
  }
}

async function backfillStoredFiles() {
  const rows = await prisma.storedFile.findMany({
    where: { storageKey: null, NOT: { pdfData: null } },
    select: { id: true, pdfData: true, fileType: true },
  });
  console.log(`stored_files: ${rows.length} to migrate`);
  for (const r of rows) {
    const isXlsx = (r.fileType || "pdf").toLowerCase() === "xlsx";
    const key = `documents/${r.id}.${isXlsx ? "xlsx" : "pdf"}`;
    const ct = isXlsx
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : "application/pdf";
    await upload(DOCS, key, r.pdfData, ct);
    await prisma.storedFile.update({
      where: { id: r.id },
      data: { storageKey: key, ...(PURGE ? { pdfData: null } : {}) },
    });
    console.log(`  ✓ ${key}`);
  }
}

try {
  await backfillBlog();
  await backfillAvatars("user", "user");
  await backfillAvatars("client", "client");
  await backfillStoredFiles();
  console.log(`\nDone.${PURGE ? " Bytes columns purged." : " Bytes columns kept (run with --purge to free DB space once verified)."}`);
} catch (e) {
  console.error("Backfill failed:", e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
