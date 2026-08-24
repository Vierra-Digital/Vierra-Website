-- Perf: email panel actions (label/archive/snooze/delete) hit two lookups that had no
-- covering index. See lib/email/mailboxAccess.ts (resolveMailboxOwner/getAccessibleGmailAccounts)
-- and pages/api/gmail/actions.ts (permanent-delete outbound cleanup).

-- Shared-inbox grant resolution looks up a mailbox's owner by `platform` alone (no user_id),
-- which previously fell back to a sequential scan of platform_tokens.
CREATE INDEX "idx_platform_tokens_platform" ON "platform_tokens"("platform");

-- Permanent delete cleans up email_outbound_messages by (account_id, gmail_message_id) per item.
CREATE INDEX "idx_email_outbound_messages_account_gmail_msg" ON "email_outbound_messages"("account_id", "gmail_message_id");
