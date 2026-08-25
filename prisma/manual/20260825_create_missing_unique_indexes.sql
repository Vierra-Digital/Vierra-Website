-- Six unique constraints that schema.prisma declares but the database never had.
--
-- This is the opposite of the usual drift: the code already relies on them. Prisma only generates a
-- compound `where: { session_id_platform: { ... } }` input for findUnique/upsert because the schema
-- declares the unique, and lib/api/oauth.ts uses exactly that. Without the index the database was
-- not enforcing it, so concurrent writes could produce duplicate rows that the code then treats as
-- impossible.
--
-- Verified before applying: every one of these tables was checked for existing duplicate groups and
-- all six were clean, so each index can be created without a cleanup step. Row counts are 0-3, so
-- creation is instant and CONCURRENTLY is unnecessary.
--
-- IF NOT EXISTS so this is safe to re-run.

CREATE UNIQUE INDEX IF NOT EXISTS "uq_contact_field_visibility_user_account"
  ON "contact_field_visibility_settings" ("user_id", "account_id");

CREATE UNIQUE INDEX IF NOT EXISTS "uq_contact_tags_user_name"
  ON "contact_tags" ("user_id", "name");

CREATE UNIQUE INDEX IF NOT EXISTS "uq_email_blocked_senders_user_account_email"
  ON "email_blocked_senders" ("user_id", "account_id", "email");

CREATE UNIQUE INDEX IF NOT EXISTS "uq_email_vacation_logs_setting_sender"
  ON "email_vacation_response_logs" ("email_account_setting_id", "sender_email");

CREATE UNIQUE INDEX IF NOT EXISTS "uq_gmail_contact_sync_user_account"
  ON "gmail_contact_sync_states" ("user_id", "account_id");

CREATE UNIQUE INDEX IF NOT EXISTS "uq_onboarding_platform_tokens_session_platform"
  ON "onboarding_platform_tokens" ("session_id", "platform");
