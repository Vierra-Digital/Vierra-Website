-- Per-inbox scoping for signatures, templates, and contact field visibility.
--
-- These three tables scoped by account_id (a foreign key into email_provider_accounts). Gmail
-- OAuth accounts have NO provider-account row, so account_id is always NULL for them and every
-- Gmail inbox collapses into one shared bucket — the settings page's per-inbox switcher can't
-- separate them. Add account_email (the wire identifier the frontend already passes for every
-- mailbox, Gmail or SMTP) as the scoping key.
--
-- Backfill preserves current behavior:
--   * Rows with an account_id (SMTP mailboxes) get that provider's account_email, so their
--     existing per-account scoping is retained.
--   * Rows with account_id NULL (Gmail globals) keep account_email NULL and stay shared until
--     re-saved — no data disappears; nothing changes for existing users until they edit.

ALTER TABLE email_signatures ADD COLUMN IF NOT EXISTS account_email TEXT;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS account_email TEXT;
ALTER TABLE contact_field_visibility_settings ADD COLUMN IF NOT EXISTS account_email TEXT;

UPDATE email_signatures s
  SET account_email = lower(a.account_email)
  FROM email_provider_accounts a
  WHERE s.account_id = a.id AND s.account_email IS NULL;

UPDATE email_templates t
  SET account_email = lower(a.account_email)
  FROM email_provider_accounts a
  WHERE t.account_id = a.id AND t.account_email IS NULL;

UPDATE contact_field_visibility_settings v
  SET account_email = lower(a.account_email)
  FROM email_provider_accounts a
  WHERE v.account_id = a.id AND v.account_email IS NULL;

CREATE INDEX IF NOT EXISTS idx_email_signatures_user_account_email
  ON email_signatures (user_id, account_email);
CREATE INDEX IF NOT EXISTS idx_email_templates_user_account_email
  ON email_templates (user_id, account_email);
CREATE INDEX IF NOT EXISTS idx_contact_field_visibility_user_account_email
  ON contact_field_visibility_settings (user_id, account_email);
