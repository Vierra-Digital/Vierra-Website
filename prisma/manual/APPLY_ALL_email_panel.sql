-- ============================================================================
-- Email panel — ALL new tables in one file. Run this once in the Supabase SQL
-- editor to activate every new feature (scheduled send, confidential mode, inbound
-- loop, filters, Artemis prefs, snooze, per-account enable/disable).
--
-- The live Supabase schema is managed out-of-band (Prisma Migrate is disabled — see
-- netlify.toml). Every statement is idempotent (IF NOT EXISTS), so it's safe to re-run.
-- After running, the panel endpoints stop returning 500s for missing tables.
-- ============================================================================

-- Scheduled send ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."email_scheduled_sends" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "account_email" text NOT NULL,
  "scheduled_at" timestamptz(6) NOT NULL,
  "status" text NOT NULL DEFAULT 'PENDING',
  "payload" jsonb NOT NULL,
  "attempts" integer NOT NULL DEFAULT 0,
  "last_error" text,
  "outbound_message_id" uuid,
  "sent_at" timestamptz(6),
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "email_scheduled_sends_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "email_scheduled_sends_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX IF NOT EXISTS "idx_email_scheduled_sends_due" ON "public"."email_scheduled_sends" ("status", "scheduled_at");
CREATE INDEX IF NOT EXISTS "idx_email_scheduled_sends_user_id" ON "public"."email_scheduled_sends" ("user_id");

-- Confidential mode ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."email_confidential_messages" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "token" text NOT NULL,
  "subject" text,
  "body_html" text NOT NULL,
  "body_text" text,
  "passcode_hash" text,
  "expires_at" timestamptz(6),
  "revoked" boolean NOT NULL DEFAULT false,
  "restrict_forward" boolean NOT NULL DEFAULT true,
  "restrict_copy" boolean NOT NULL DEFAULT true,
  "restrict_print" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "email_confidential_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "email_confidential_messages_token_key" UNIQUE ("token"),
  CONSTRAINT "email_confidential_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX IF NOT EXISTS "idx_email_confidential_messages_user_id" ON "public"."email_confidential_messages" ("user_id");

CREATE TABLE IF NOT EXISTS "public"."email_confidential_views" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "message_id" uuid NOT NULL,
  "viewed_at" timestamptz(6) NOT NULL DEFAULT now(),
  "ip_hash" text,
  "unlocked" boolean NOT NULL DEFAULT false,
  CONSTRAINT "email_confidential_views_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "email_confidential_views_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."email_confidential_messages"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX IF NOT EXISTS "idx_email_confidential_views_message_id" ON "public"."email_confidential_views" ("message_id");

-- Inbound-processing cursor -------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."gmail_inbox_sync_state" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "account_email" text NOT NULL,
  "history_id" text,
  "last_sync_at" timestamptz(6),
  "last_status" text,
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "gmail_inbox_sync_state_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "uq_gmail_inbox_sync_state" UNIQUE ("user_id", "account_email"),
  CONSTRAINT "gmail_inbox_sync_state_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- Filters / rules -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."email_filters" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "account_email" text,
  "name" text NOT NULL,
  "from_contains" text,
  "subject_contains" text,
  "query_contains" text,
  "match_type" text NOT NULL DEFAULT 'all',
  "add_label_id" text,
  "add_label_name" text,
  "archive" boolean NOT NULL DEFAULT false,
  "mark_read" boolean NOT NULL DEFAULT false,
  "star" boolean NOT NULL DEFAULT false,
  "trash" boolean NOT NULL DEFAULT false,
  "enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "email_filters_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "email_filters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX IF NOT EXISTS "idx_email_filters_user_id" ON "public"."email_filters" ("user_id");

-- Artemis AI preferences -----------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."email_ai_preferences" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "autonomy" text NOT NULL DEFAULT 'suggest',
  "tone" text NOT NULL DEFAULT 'professional and friendly',
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "email_ai_preferences_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "email_ai_preferences_user_id_key" UNIQUE ("user_id"),
  CONSTRAINT "email_ai_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- Snooze --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."email_snoozes" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "account_email" text NOT NULL,
  "message_id" text NOT NULL,
  "thread_id" text,
  "snooze_until" timestamptz(6) NOT NULL,
  "status" text NOT NULL DEFAULT 'SNOOZED',
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "email_snoozes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "email_snoozes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX IF NOT EXISTS "idx_email_snoozes_due" ON "public"."email_snoozes" ("status", "snooze_until");
CREATE INDEX IF NOT EXISTS "idx_email_snoozes_user_id" ON "public"."email_snoozes" ("user_id");

-- Per-account enable/disable ------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."email_account_preferences" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "account_email" text NOT NULL,
  "enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "email_account_preferences_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "uq_email_account_preferences" UNIQUE ("user_id", "account_email"),
  CONSTRAINT "email_account_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
