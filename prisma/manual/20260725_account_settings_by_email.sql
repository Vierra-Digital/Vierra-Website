-- Make per-account email settings (tracking toggles + vacation responder) work for Gmail
-- (OAuth) accounts, which have no email_provider_accounts row. Re-key from account_id to
-- (user_id, account_email). The table is empty in this deployment, so no backfill is needed.

ALTER TABLE email_account_settings ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE email_account_settings ADD COLUMN IF NOT EXISTS account_email text;
ALTER TABLE email_account_settings ALTER COLUMN account_id DROP NOT NULL;

ALTER TABLE email_account_settings DROP CONSTRAINT IF EXISTS uq_email_account_settings_account_id;
DROP INDEX IF EXISTS uq_email_account_settings_account_id;
CREATE UNIQUE INDEX IF NOT EXISTS uq_email_account_settings_user_email
  ON email_account_settings (user_id, account_email);
