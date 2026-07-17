-- Meeting booker — booking links + bookings (Google Calendar free/busy backed).
-- Apply directly to Supabase (schema managed out-of-band; see netlify.toml). Idempotent.

CREATE TABLE IF NOT EXISTS "public"."booking_links" (
  "id"               uuid          NOT NULL DEFAULT gen_random_uuid(),
  "user_id"          uuid          NOT NULL,
  "account_email"    text          NOT NULL,
  "slug"             text          NOT NULL,
  "title"            text          NOT NULL,
  "description"      text,
  "duration_minutes" integer       NOT NULL DEFAULT 30,
  "buffer_minutes"   integer       NOT NULL DEFAULT 0,
  "timezone"         text          NOT NULL DEFAULT 'UTC',
  "availability"     jsonb,
  "active"           boolean       NOT NULL DEFAULT true,
  "created_at"       timestamptz(6) NOT NULL DEFAULT now(),
  "updated_at"       timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "booking_links_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "booking_links_slug_key" UNIQUE ("slug"),
  CONSTRAINT "booking_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX IF NOT EXISTS "idx_booking_links_user_id" ON "public"."booking_links" ("user_id");

CREATE TABLE IF NOT EXISTS "public"."bookings" (
  "id"              uuid          NOT NULL DEFAULT gen_random_uuid(),
  "booking_link_id" uuid          NOT NULL,
  "invitee_name"    text          NOT NULL,
  "invitee_email"   text          NOT NULL,
  "invitee_notes"   text,
  "start_at"        timestamptz(6) NOT NULL,
  "end_at"          timestamptz(6) NOT NULL,
  "status"          text          NOT NULL DEFAULT 'confirmed',
  "google_event_id" text,
  "created_at"      timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "bookings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bookings_link_fkey" FOREIGN KEY ("booking_link_id") REFERENCES "public"."booking_links"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX IF NOT EXISTS "idx_bookings_link_id" ON "public"."bookings" ("booking_link_id");
