-- Backs the meeting-invite RSVP card in the email reader (pages/api/gmail/meeting-rsvp.ts):
-- remembers the viewer's own response to an inbound calendar invite so reopening the message
-- shows "You responded: Yes" instead of the buttons again, keyed by the invite's own UID so a
-- reply survives independent of which message/thread it arrived on.
--
-- sequence mirrors the ICS SEQUENCE of the invite this response was made against — if the
-- organizer reschedules (bumping SEQUENCE), the stored response is stale and the app re-offers
-- the buttons rather than showing a response to an event that no longer exists in that form.

CREATE TABLE IF NOT EXISTS "email_meeting_responses" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES "users"(id) ON DELETE CASCADE,
  account_email text NOT NULL,
  ics_uid text NOT NULL,
  sequence integer NOT NULL DEFAULT 0,
  response text NOT NULL,
  organizer_email text,
  summary text,
  start_at timestamptz,
  end_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_email_meeting_responses_user_account_uid UNIQUE (user_id, account_email, ics_uid)
);

CREATE INDEX IF NOT EXISTS idx_email_meeting_responses_user_account
  ON "email_meeting_responses" (user_id, account_email);
