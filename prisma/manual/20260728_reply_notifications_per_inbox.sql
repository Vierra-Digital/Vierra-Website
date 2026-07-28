-- Per-inbox toggle for the inbound reply notification (the Discord ping fired by
-- maybeNotifyDiscord when a real reply lands in a connected inbox). Previously the notification
-- fired for every inbox, gated only on the global Discord env var. This column lets the settings
-- page turn it on/off per inbox. Defaults to TRUE so current behavior (notify for all inboxes) is
-- preserved until a user opts specific inboxes out.

ALTER TABLE email_account_settings
  ADD COLUMN IF NOT EXISTS reply_notifications_enabled BOOLEAN NOT NULL DEFAULT true;
