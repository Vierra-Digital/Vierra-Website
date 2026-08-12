-- Meeting attendance tracking (schema_v2_meetings_phase0.sql / phase3.sql / phase4.sql).
--
-- schema.prisma already declared all of this (columns, tables, and — for one relation —
-- a working FK), which made it look like the DDL had already been run. It hadn't: a live
-- P2022 error ("platform_tokens.meta does not exist") proved schema.prisma had drifted
-- ahead of the actual database for at least that column. Since there's no reliable way to
-- tell which *other* phase0/3/4 columns share that fate without querying the live DB
-- directly, every statement below is idempotent (IF NOT EXISTS / safe to re-run) and the
-- full original DDL is replayed here rather than just the piece that broke — anything that
-- already exists is a no-op, anything missing gets created, so this converges to the
-- correct state regardless of what's actually live today.
--
-- All cross-table references are schema-qualified to public.* — the datasource also tracks
-- an `auth` schema (Supabase-managed, has its own `users` table), so an unqualified
-- `REFERENCES users(id)` would depend on search_path instead of always hitting the app's
-- own public.users. Wrapped in one transaction so this applies atomically regardless of how
-- it's run.

BEGIN;

-- ---- phase0: base columns on pre-existing tables ----

ALTER TABLE public.booking_links
  ADD COLUMN IF NOT EXISTS provider   TEXT NOT NULL DEFAULT 'google_meet',
  ADD COLUMN IF NOT EXISTS company_id UUID;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS provider            TEXT NOT NULL DEFAULT 'google_meet',
  ADD COLUMN IF NOT EXISTS provider_meeting_id TEXT,
  ADD COLUMN IF NOT EXISTS meeting_join_url    TEXT,
  ADD COLUMN IF NOT EXISTS attendance_status   TEXT NOT NULL DEFAULT 'booked',
  ADD COLUMN IF NOT EXISTS attendee_emails     JSONB,
  ADD COLUMN IF NOT EXISTS attendee_count      INTEGER,
  ADD COLUMN IF NOT EXISTS duration_seconds    INTEGER,
  ADD COLUMN IF NOT EXISTS held_at             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attendance_source   TEXT,
  ADD COLUMN IF NOT EXISTS campaign_contact_id UUID;

ALTER TABLE public.platform_tokens
  ADD COLUMN IF NOT EXISTS meta JSONB;

-- ---- phase0: audit-log tables (created here in case they don't already exist; the FK
-- shapes below use RESTRICT/NOT NULL to match the original doc, but are relaxed to
-- SET NULL/nullable further down for the same reason as the phase3 block) ----

CREATE TABLE IF NOT EXISTS public.booking_status_events (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id         UUID NOT NULL,
  from_status        TEXT,
  to_status          TEXT NOT NULL,
  changed_by_user_id UUID,
  note               TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.booking_reschedule_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id        UUID NOT NULL,
  previous_start_at TIMESTAMPTZ NOT NULL,
  new_start_at      TIMESTAMPTZ NOT NULL,
  rescheduled_by    TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.booking_reassignment_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id          UUID NOT NULL,
  from_user_id        UUID,
  to_user_id          UUID,
  approved_by_user_id UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- phase3: team-link claim queue ----

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS claimed_by_user_id UUID,
  ADD COLUMN IF NOT EXISTS claim_deadline_at  TIMESTAMPTZ;

-- ---- phase4: reminders + retention ----

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pii_erased_at    TIMESTAMPTZ;

-- ---- "who took this meeting" email snapshots (survive the users row being deleted) ----

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS claimed_by_user_email TEXT;

ALTER TABLE public.booking_reassignment_events
  ADD COLUMN IF NOT EXISTS from_user_email        TEXT,
  ADD COLUMN IF NOT EXISTS to_user_email          TEXT,
  ADD COLUMN IF NOT EXISTS approved_by_user_email TEXT;

ALTER TABLE public.booking_status_events
  ADD COLUMN IF NOT EXISTS changed_by_user_email TEXT;

-- Must happen before the to_user_id FK below: a SET NULL referential action can't be
-- attached to a NOT NULL column.
ALTER TABLE public.booking_reassignment_events
  ALTER COLUMN to_user_id DROP NOT NULL;

-- ---- foreign keys (dropped + unconditionally re-added, so re-running this file after an
-- edit always converges to exactly what's written here instead of keeping a stale prior
-- definition) ----

ALTER TABLE public.booking_links DROP CONSTRAINT IF EXISTS booking_links_company_id_fkey;
ALTER TABLE public.booking_links
  ADD CONSTRAINT booking_links_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_campaign_contact_id_fkey;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_campaign_contact_id_fkey
  FOREIGN KEY (campaign_contact_id) REFERENCES public.campaign_contacts(id) ON DELETE SET NULL;

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_claimed_by_user_id_fkey;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_claimed_by_user_id_fkey
  FOREIGN KEY (claimed_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.booking_status_events DROP CONSTRAINT IF EXISTS booking_status_events_booking_id_fkey;
ALTER TABLE public.booking_status_events
  ADD CONSTRAINT booking_status_events_booking_id_fkey
  FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;

ALTER TABLE public.booking_status_events DROP CONSTRAINT IF EXISTS booking_status_events_changed_by_user_id_fkey;
ALTER TABLE public.booking_status_events
  ADD CONSTRAINT booking_status_events_changed_by_user_id_fkey
  FOREIGN KEY (changed_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.booking_reschedule_events DROP CONSTRAINT IF EXISTS booking_reschedule_events_booking_id_fkey;
ALTER TABLE public.booking_reschedule_events
  ADD CONSTRAINT booking_reschedule_events_booking_id_fkey
  FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;

ALTER TABLE public.booking_reassignment_events DROP CONSTRAINT IF EXISTS booking_reassignment_events_booking_id_fkey;
ALTER TABLE public.booking_reassignment_events
  ADD CONSTRAINT booking_reassignment_events_booking_id_fkey
  FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;

ALTER TABLE public.booking_reassignment_events DROP CONSTRAINT IF EXISTS booking_reassignment_events_from_user_id_fkey;
ALTER TABLE public.booking_reassignment_events
  ADD CONSTRAINT booking_reassignment_events_from_user_id_fkey
  FOREIGN KEY (from_user_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- SET NULL (not RESTRICT — see header note): deleting a user must not be blocked by, or
-- silently orphan, a meeting they were ever reassigned. to_user_email preserves the "who".
ALTER TABLE public.booking_reassignment_events DROP CONSTRAINT IF EXISTS booking_reassignment_events_to_user_id_fkey;
ALTER TABLE public.booking_reassignment_events
  ADD CONSTRAINT booking_reassignment_events_to_user_id_fkey
  FOREIGN KEY (to_user_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.booking_reassignment_events DROP CONSTRAINT IF EXISTS booking_reassignment_events_approved_by_user_id_fkey;
ALTER TABLE public.booking_reassignment_events
  ADD CONSTRAINT booking_reassignment_events_approved_by_user_id_fkey
  FOREIGN KEY (approved_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- ---- indexes (safe no-ops if already present) ----

CREATE INDEX IF NOT EXISTS idx_booking_links_company_id ON public.booking_links(company_id);
CREATE INDEX IF NOT EXISTS idx_bookings_campaign_contact_id ON public.bookings(campaign_contact_id);
CREATE INDEX IF NOT EXISTS idx_bookings_claim_deadline ON public.bookings(status, claim_deadline_at);
CREATE INDEX IF NOT EXISTS idx_booking_status_events_booking_id ON public.booking_status_events(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_reschedule_events_booking_id ON public.booking_reschedule_events(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_reassignment_events_booking_id ON public.booking_reassignment_events(booking_id);

COMMIT;
