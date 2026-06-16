-- Additive: object-storage migration for image assets (Issue #59).
-- Adds storage-key columns alongside the legacy Bytes columns (dual-read/dual-write).
-- Nullable + IF NOT EXISTS = safe and idempotent; no data is moved by this migration.

ALTER TABLE "public"."blog_images" ALTER COLUMN "data" DROP NOT NULL;
ALTER TABLE "public"."blog_images" ADD COLUMN IF NOT EXISTS "storageKey" TEXT;
ALTER TABLE "public"."users" ADD COLUMN IF NOT EXISTS "imageStorageKey" TEXT;
ALTER TABLE "public"."clients" ADD COLUMN IF NOT EXISTS "imageStorageKey" TEXT;
