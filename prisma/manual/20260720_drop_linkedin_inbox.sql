-- Remove the LinkedIn unified-inbox feature (assist-only outreach doesn't send
-- from the panel, so the inbox/sync/send-command tables aren't needed).
-- Apply directly to Supabase. Idempotent.

DROP TABLE IF EXISTS "public"."linkedin_messages" CASCADE;
DROP TABLE IF EXISTS "public"."linkedin_send_commands" CASCADE;
DROP TABLE IF EXISTS "public"."linkedin_threads" CASCADE;

ALTER TABLE "public"."users" DROP COLUMN IF EXISTS "extension_token";
