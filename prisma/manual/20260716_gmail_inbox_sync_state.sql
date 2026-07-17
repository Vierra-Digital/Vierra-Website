-- Inbound-processing cursor: per (user, account) Gmail historyId + last sync status.
-- Backs lib/gmail/inbound.ts (polled by netlify/functions/poll-inbound). Apply directly
-- to Supabase (schema managed out-of-band; see netlify.toml).

CREATE TABLE IF NOT EXISTS "public"."gmail_inbox_sync_state" (
  "id"            uuid          NOT NULL DEFAULT gen_random_uuid(),
  "user_id"       uuid          NOT NULL,
  "account_email" text          NOT NULL,
  "history_id"    text,
  "last_sync_at"  timestamptz(6),
  "last_status"   text,
  "created_at"    timestamptz(6) NOT NULL DEFAULT now(),
  "updated_at"    timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "gmail_inbox_sync_state_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "uq_gmail_inbox_sync_state" UNIQUE ("user_id", "account_email"),
  CONSTRAINT "gmail_inbox_sync_state_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION
);
