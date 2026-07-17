-- Confidential mode — server-hosted message bodies delivered via a tokened viewer
-- (/c/[token]) instead of raw email. Backs lib/email/confidential.ts and the compose
-- "Confidential" toggle. Apply directly to Supabase (schema is managed out-of-band; see
-- netlify.toml). The Prisma models EmailConfidentialMessage / EmailConfidentialView map
-- to these tables.

CREATE TABLE IF NOT EXISTS "public"."email_confidential_messages" (
  "id"               uuid          NOT NULL DEFAULT gen_random_uuid(),
  "user_id"          uuid          NOT NULL,
  "token"            text          NOT NULL,
  "subject"          text,
  "body_html"        text          NOT NULL,
  "body_text"        text,
  "passcode_hash"    text,
  "expires_at"       timestamptz(6),
  "revoked"          boolean       NOT NULL DEFAULT false,
  "restrict_forward" boolean       NOT NULL DEFAULT true,
  "restrict_copy"    boolean       NOT NULL DEFAULT true,
  "restrict_print"   boolean       NOT NULL DEFAULT true,
  "created_at"       timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "email_confidential_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "email_confidential_messages_token_key" UNIQUE ("token"),
  CONSTRAINT "email_confidential_messages_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX IF NOT EXISTS "idx_email_confidential_messages_user_id"
  ON "public"."email_confidential_messages" ("user_id");

CREATE TABLE IF NOT EXISTS "public"."email_confidential_views" (
  "id"         uuid          NOT NULL DEFAULT gen_random_uuid(),
  "message_id" uuid          NOT NULL,
  "viewed_at"  timestamptz(6) NOT NULL DEFAULT now(),
  "ip_hash"    text,
  "unlocked"   boolean       NOT NULL DEFAULT false,
  CONSTRAINT "email_confidential_views_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "email_confidential_views_message_id_fkey"
    FOREIGN KEY ("message_id") REFERENCES "public"."email_confidential_messages"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX IF NOT EXISTS "idx_email_confidential_views_message_id"
  ON "public"."email_confidential_views" ("message_id");
