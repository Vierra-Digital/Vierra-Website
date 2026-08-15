-- CAN-SPAM unsubscribe-token column (lib/campaigns/sendQueueTick.ts's buildCanSpamFooter /
-- prisma/schema.prisma's CampaignContact.unsubscribe_token) was declared in schema.prisma but
-- the DDL to actually add it to the live database was never run — same "schema.prisma drifted
-- ahead of the live DB" failure mode as prisma/manual/20260807_meetings_fk_constraints.sql,
-- caught the same way: a live P2022 ("campaign_contacts.unsubscribe_token does not exist").
--
-- Impact while missing: every `prisma.campaignContact.update()`/`.findMany()` call without an
-- explicit `select` throws, because Prisma's default select includes every mapped column. That
-- includes lib/campaigns/sendQueueTick.ts's own `due` contacts query (line ~400) — the send-queue
-- cron's very first query — so no campaign contact can be sent to, categorized, or otherwise
-- updated until this column exists.
--
-- Idempotent (IF NOT EXISTS) so it's safe to re-run. Nullable + UNIQUE: existing rows get NULL
-- (Postgres allows multiple NULLs under a unique constraint), and sendQueueTick.ts already
-- treats a null/empty token as "generate one on first send" (line ~140-147).

BEGIN;

ALTER TABLE public.campaign_contacts
  ADD COLUMN IF NOT EXISTS unsubscribe_token TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'campaign_contacts_unsubscribe_token_key'
  ) THEN
    ALTER TABLE public.campaign_contacts
      ADD CONSTRAINT campaign_contacts_unsubscribe_token_key UNIQUE (unsubscribe_token);
  END IF;
END $$;

COMMIT;
