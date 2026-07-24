-- Allow outbound messages (and thus open/click tracking) for Gmail (OAuth) accounts, which
-- have no email_provider_accounts row. Previously account_id was a required UUID, so
-- sendEmailCore could not create an outbound row for a Gmail send and tracking never recorded
-- anything (no green dot). We make account_id nullable, add account_email so the sending
-- mailbox is still known, and index gmail_message_id for the tracked-message lookup.

ALTER TABLE email_outbound_messages ALTER COLUMN account_id DROP NOT NULL;
ALTER TABLE email_outbound_messages ADD COLUMN IF NOT EXISTS account_email text;
CREATE INDEX IF NOT EXISTS idx_email_outbound_messages_gmail_message_id
  ON email_outbound_messages (gmail_message_id);
