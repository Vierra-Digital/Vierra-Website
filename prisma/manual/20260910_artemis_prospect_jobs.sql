-- Artemis partner-discovery: panel-side record of prospect jobs run against artemis.vierradev.com.
--
-- The /prospect job itself lives entirely on the box (job store per vierra_jobs.py); this table
-- exists only so the panel can answer "who is allowed to see job X" without asking Artemis. A
-- client session must only ever see jobs run for their own company; a guessed/leaked job_id must
-- not be enough on its own to read another company's prospect results.
--
-- Written by pages/api/prospect/start.ts (insert on job creation), pages/api/prospect/callback.ts
-- (poll-back: re-fetches the real result from Artemis by job_id rather than trusting the callback
-- POST body, then writes it here), and read by pages/api/prospect/[jobId].ts for the ownership
-- check plus a cached result so most polls don't need to hit Artemis again.
--
-- No RLS: matches the sibling artemis_runs/artemis_review_items/artemis_knowledge_docs tables from
-- 20260902_artemis_control_plane.sql -- access is gated at the Next.js route layer via session +
-- the client_id/company_id check, not via PostgREST, so this table has no anon/authenticated grant
-- at all.

CREATE TABLE IF NOT EXISTS artemis_prospect_jobs (
  id            text PRIMARY KEY, -- job_id as minted by Artemis, not a local uuid
  client_id     uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  requested_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  goal          text NOT NULL,
  -- 'queued' -> 'running' -> 'done' | 'failed'; 'interrupted' if the box restarted mid-run
  -- (Artemis auto-resumes these, so treat as non-terminal, same as 'running').
  status        text NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued', 'running', 'done', 'failed', 'interrupted')),
  result        jsonb,
  error         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_artemis_prospect_jobs_client_created
  ON artemis_prospect_jobs (client_id, created_at DESC);
