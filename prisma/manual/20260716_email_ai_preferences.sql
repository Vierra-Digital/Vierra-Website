-- Server-persisted Artemis AI preferences (so the autonomous auto-draft cron can read
-- the user's autonomy + tone). Backs /api/ai/preferences and the settings "Artemis AI"
-- section. Apply directly to Supabase (schema managed out-of-band; see netlify.toml).

CREATE TABLE IF NOT EXISTS "public"."email_ai_preferences" (
  "id"         uuid          NOT NULL DEFAULT gen_random_uuid(),
  "user_id"    uuid          NOT NULL,
  "autonomy"   text          NOT NULL DEFAULT 'suggest',
  "tone"       text          NOT NULL DEFAULT 'professional and friendly',
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "email_ai_preferences_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "email_ai_preferences_user_id_key" UNIQUE ("user_id"),
  CONSTRAINT "email_ai_preferences_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION
);
