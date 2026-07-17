-- Inbound filter rules (auto-label / archive / mark-read / star). Backs the settings
-- "Filters & rules" UI and lib/gmail/inboundActions.applyFilters. Apply directly to
-- Supabase (schema managed out-of-band; see netlify.toml).

CREATE TABLE IF NOT EXISTS "public"."email_filters" (
  "id"               uuid          NOT NULL DEFAULT gen_random_uuid(),
  "user_id"          uuid          NOT NULL,
  "account_email"    text,
  "name"             text          NOT NULL,
  "from_contains"    text,
  "subject_contains" text,
  "query_contains"   text,
  "match_type"       text          NOT NULL DEFAULT 'all',
  "add_label_id"     text,
  "add_label_name"   text,
  "archive"          boolean       NOT NULL DEFAULT false,
  "mark_read"        boolean       NOT NULL DEFAULT false,
  "star"             boolean       NOT NULL DEFAULT false,
  "trash"            boolean       NOT NULL DEFAULT false,
  "enabled"          boolean       NOT NULL DEFAULT true,
  "created_at"       timestamptz(6) NOT NULL DEFAULT now(),
  "updated_at"       timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "email_filters_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "email_filters_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX IF NOT EXISTS "idx_email_filters_user_id" ON "public"."email_filters" ("user_id");
