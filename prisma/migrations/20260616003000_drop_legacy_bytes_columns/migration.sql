-- FINAL, DESTRUCTIVE: drop the legacy Bytes columns now that all assets live in
-- Supabase Storage (Issue #59). APPLY ONLY AFTER the storage-only code is deployed
-- to production — dropping these while old code is live breaks image/PDF serving.
-- Irreversible; ensure a snapshot exists.

ALTER TABLE "public"."blog_images" DROP COLUMN IF EXISTS "data";
ALTER TABLE "public"."users" DROP COLUMN IF EXISTS "image";
ALTER TABLE "public"."clients" DROP COLUMN IF EXISTS "image";
ALTER TABLE "public"."stored_files" DROP COLUMN IF EXISTS "pdfData";
