-- Per-inbox default for requesting a read receipt on outbound mail. When on, a new compose from
-- this inbox starts with the "request receipt" option enabled (the user can still toggle it off).
-- Defaults false to preserve current behavior.
ALTER TABLE email_account_settings
  ADD COLUMN IF NOT EXISTS default_read_receipt BOOLEAN NOT NULL DEFAULT false;
