-- CAN-SPAM columns on companies (mailing_address, privacy_policy_url — see
-- lib/campaigns/sendQueueTick.ts's buildCanSpamFooter / prisma/schema.prisma's Company model
-- comment) were declared in schema.prisma but never migrated onto the live database — same
-- "schema.prisma drifted ahead of the live DB" failure mode as
-- prisma/manual/20260814_campaign_contacts_unsubscribe_token.sql and
-- prisma/manual/20260807_meetings_fk_constraints.sql before it, caught the same way: a live
-- P2022 ("companies.mailing_address does not exist").
--
-- Impact while missing: runCampaignSendQueueTick's very FIRST query selects mailing_address, so
-- every company's entire send-queue tick throws immediately — no campaign, on any provider that
-- tick drives (internal/brevo), can send a single message. This was still broken even after the
-- campaign_contacts.unsubscribe_token fix; that fix only unblocked the next step in the same
-- pipeline, not this one.
--
-- Idempotent (IF NOT EXISTS) so it's safe to re-run. Both nullable, matching schema.prisma exactly
-- — sendQueueTick.ts already treats a null mailing_address as "block this company's queue" rather
-- than assuming a value, so no backfill is required for the column to be functionally safe;
-- companies wanting to actually send campaigns still need a real address filled in via the UI.

BEGIN;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS mailing_address    TEXT,
  ADD COLUMN IF NOT EXISTS privacy_policy_url TEXT;

COMMIT;
