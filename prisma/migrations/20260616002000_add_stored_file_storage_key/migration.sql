-- Additive: object-storage migration for documents (Issue #59, PDFs/XLSX in StoredFile).
-- Adds storageKey alongside the legacy pdfData Bytes column (dual-read/dual-write).
-- Idempotent; no data is moved by this migration.

ALTER TABLE "public"."stored_files" ADD COLUMN IF NOT EXISTS "storageKey" TEXT;
