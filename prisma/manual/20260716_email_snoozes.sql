-- Snoozed messages — hidden from the inbox until snooze_until, then re-surfaced by the
-- inbound cron (resurfaceDueSnoozes). Backs lib/gmail/snooze.ts and /api/gmail/snooze.
-- Apply directly to Supabase (schema managed out-of-band; see netlify.toml).

CREATE TABLE IF NOT EXISTS "public"."email_snoozes" (
  "id"            uuid          NOT NULL DEFAULT gen_random_uuid(),
  "user_id"       uuid          NOT NULL,
  "account_email" text          NOT NULL,
  "message_id"    text          NOT NULL,
  "thread_id"     text,
  "snooze_until"  timestamptz(6) NOT NULL,
  "status"        text          NOT NULL DEFAULT 'SNOOZED',
  "created_at"    timestamptz(6) NOT NULL DEFAULT now(),
  "updated_at"    timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "email_snoozes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "email_snoozes_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX IF NOT EXISTS "idx_email_snoozes_due" ON "public"."email_snoozes" ("status", "snooze_until");
CREATE INDEX IF NOT EXISTS "idx_email_snoozes_user_id" ON "public"."email_snoozes" ("user_id");
