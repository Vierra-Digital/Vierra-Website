-- Cartography's Agentic mode now tries /prospect (real live search + attestation) first, falling
-- back to the existing general/google_business/linkedin_sales_nav sub-agents only if starting a
-- /prospect job fails outright (config missing, Artemis unreachable, immediate 429/rejection).
-- See lib/cartography/prospectMethod.ts. This just widens the two CHECK constraints that
-- previously only allowed the three original method names, and adds a way to tie a
-- cartography_runs row back to the artemis_prospect_jobs row it was persisted from, so a job
-- polled to completion more than once (repeat GETs while "running") is persisted at most once.

ALTER TABLE cartography_companies DROP CONSTRAINT cartography_companies_source_method_check;
ALTER TABLE cartography_companies ADD CONSTRAINT cartography_companies_source_method_check
  CHECK (source_method IN ('google_business', 'linkedin_sales_nav', 'general', 'prospect'));

ALTER TABLE cartography_run_tasks DROP CONSTRAINT cartography_run_tasks_method_check;
ALTER TABLE cartography_run_tasks ADD CONSTRAINT cartography_run_tasks_method_check
  CHECK (method IN ('google_business', 'linkedin_sales_nav', 'general', 'prospect'));

ALTER TABLE cartography_runs
  ADD COLUMN IF NOT EXISTS prospect_job_id text UNIQUE REFERENCES artemis_prospect_jobs(id) ON DELETE SET NULL;
