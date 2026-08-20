-- Primary inbox designation.
--
-- One mailbox is the account's main inbox; the rest are brand accounts added onto it. Stored per
-- account row rather than as a user-level column because "is this the primary" is a property of the
-- mailbox, and the panel already loads this table when it opens — so the flag arrives with the
-- accounts, costing no extra request.
--
-- Safe to re-run.
ALTER TABLE public.email_account_preferences
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false;

-- At most one primary per user, enforced by the database rather than by application code alone:
-- two primaries would make "which inbox is the main one" ambiguous for every reader of this table.
CREATE UNIQUE INDEX IF NOT EXISTS uq_email_account_preferences_primary
  ON public.email_account_preferences (user_id)
  WHERE is_primary;
