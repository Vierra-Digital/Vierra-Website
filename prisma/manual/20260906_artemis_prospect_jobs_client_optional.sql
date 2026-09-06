-- Cartography's Agentic mode (lib/cartography/prospectMethod.ts) must work for a company that has
-- no onboarded Client yet -- Vierra staff prospecting for a brand-new company shouldn't be blocked
-- on someone filling in an onboarding form first. company_id (already NOT NULL) is enough on its
-- own to run and persist a job; client_id becomes an optional "which client asked for this" tag.

ALTER TABLE artemis_prospect_jobs
  ALTER COLUMN client_id DROP NOT NULL;

ALTER TABLE artemis_prospect_jobs
  DROP CONSTRAINT IF EXISTS artemis_prospect_jobs_client_id_fkey;

ALTER TABLE artemis_prospect_jobs
  ADD CONSTRAINT artemis_prospect_jobs_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
