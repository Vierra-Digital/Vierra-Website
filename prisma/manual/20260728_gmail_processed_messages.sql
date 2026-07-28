-- Per-message idempotency guard for inbound processing.
--
-- The inbound loop runs side-effecting hooks (auto-draft, Discord notify, MDN read-events,
-- lead-status events) per newly-arrived message. Those hooks are not individually idempotent, so
-- a message processed twice — a re-listed history boundary record, or the Gmail Pub/Sub push
-- webhook running concurrently with the poll cron once push is enabled — produces duplicate
-- drafts / pings / events. This table lets the loop atomically claim a message before running its
-- hooks (INSERT wins once; a duplicate INSERT hits the unique index and is skipped).
--
-- Rows are pruned by the loop after a week (Gmail's history window), so the table stays bounded.

CREATE TABLE IF NOT EXISTS gmail_processed_messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL,
  account_email    text NOT NULL,
  gmail_message_id text NOT NULL,
  processed_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_gmail_processed_messages
  ON gmail_processed_messages (user_id, account_email, gmail_message_id);
CREATE INDEX IF NOT EXISTS idx_gmail_processed_messages_processed_at
  ON gmail_processed_messages (processed_at);
