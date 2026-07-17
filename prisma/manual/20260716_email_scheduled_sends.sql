-- Scheduled email sends queue — backs the compose "Schedule send" feature and the
-- Netlify Scheduled Function dispatcher (netlify/functions/dispatch-scheduled-email.ts
-- -> /api/gmail/scheduled/dispatch -> lib/gmail/scheduledSend.ts).
--
-- IMPORTANT: This project's live Supabase schema is managed OUT-OF-BAND (see the note
-- in netlify.toml) — Prisma `migrate deploy` is NOT used because the migrations history
-- is not in sync with the DB. Apply this SQL directly to the Supabase database (SQL
-- editor or psql). The Prisma model `EmailScheduledSend` in schema.prisma already maps
-- to this table, so `npx prisma generate` (run at build) picks it up automatically.

CREATE TABLE IF NOT EXISTS "public"."email_scheduled_sends" (
  "id"                  uuid          NOT NULL DEFAULT gen_random_uuid(),
  "user_id"             uuid          NOT NULL,
  "account_email"       text          NOT NULL,
  "scheduled_at"        timestamptz(6) NOT NULL,
  "status"              text          NOT NULL DEFAULT 'PENDING',
  "payload"             jsonb         NOT NULL,
  "attempts"            integer       NOT NULL DEFAULT 0,
  "last_error"          text,
  "outbound_message_id" uuid,
  "sent_at"             timestamptz(6),
  "created_at"          timestamptz(6) NOT NULL DEFAULT now(),
  "updated_at"          timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "email_scheduled_sends_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "email_scheduled_sends_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "idx_email_scheduled_sends_due"
  ON "public"."email_scheduled_sends" ("status", "scheduled_at");
CREATE INDEX IF NOT EXISTS "idx_email_scheduled_sends_user_id"
  ON "public"."email_scheduled_sends" ("user_id");
