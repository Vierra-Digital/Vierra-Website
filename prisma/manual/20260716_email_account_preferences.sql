-- Per-account enable/disable for the email panel. Backs /api/gmail/account-preferences
-- and the settings "Accounts" toggles; the panel loads all connected accounts that are
-- not disabled here. Apply directly to Supabase (schema managed out-of-band; see netlify.toml).

CREATE TABLE IF NOT EXISTS "public"."email_account_preferences" (
  "id"            uuid          NOT NULL DEFAULT gen_random_uuid(),
  "user_id"       uuid          NOT NULL,
  "account_email" text          NOT NULL,
  "enabled"       boolean       NOT NULL DEFAULT true,
  "created_at"    timestamptz(6) NOT NULL DEFAULT now(),
  "updated_at"    timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "email_account_preferences_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "uq_email_account_preferences" UNIQUE ("user_id", "account_email"),
  CONSTRAINT "email_account_preferences_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION
);
