-- Artemis control plane: the panel-side tables behind the self-hosted AI box (Sparkey).
--
-- The box already answers at artemis.vierradev.com (/generate, /chat, /research,
-- /v1/chat/completions) but keeps no durable state beyond flat files on its own disk. These three
-- tables are that state, in the panel's database, where the review UI and dashboards can read it.
--
-- "Brain" mirrors the box's per-project isolation (vierra, ndimensions, personal, client:<name>).
-- It is text rather than an enum because client brains are created per client, and every new one
-- would otherwise need a migration. No cross-brain reads: queries always filter on brain_id.

-- Documents that get embedded into a brain's Qdrant collection. Rows here are the panel's record
-- of what was uploaded and whether the box has ingested it; the vectors themselves live on the box.
CREATE TABLE IF NOT EXISTS artemis_knowledge_docs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  brain_id      text NOT NULL,
  title         text NOT NULL,
  -- Where the text came from ('upload', 'url', 'paste'), plus the URL or filename when there is one.
  source        text NOT NULL DEFAULT 'upload',
  source_ref    text,
  content       text NOT NULL,
  -- pending -> ingested, or failed with the reason in ingest_error.
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ingested', 'failed')),
  ingest_error  text,
  ingested_at   timestamptz,
  created_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_artemis_kb_company_brain
  ON artemis_knowledge_docs (company_id, brain_id, created_at DESC);

-- The human-in-the-loop gate. Everything the box generates lands here first; nothing is published,
-- sent or posted from a row that is not 'approved'. `edited_content` holds the reviewer's version
-- when they changed it, so the original draft stays intact for the feedback loop.
CREATE TABLE IF NOT EXISTS artemis_review_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  brain_id       text NOT NULL,
  -- What the draft is for: social post, blog post, email reply, research report.
  kind           text NOT NULL CHECK (kind IN ('social', 'blog', 'email', 'research')),
  title          text,
  content        text NOT NULL,
  edited_content text,
  -- Free-form context the generator wants to keep with the draft (topic, platform, sources, prompt).
  meta           jsonb NOT NULL DEFAULT '{}'::jsonb,
  status         text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'approved', 'rejected', 'edited')),
  review_note    text,
  reviewed_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- The review queue is read as "everything still pending, newest first", per company.
CREATE INDEX IF NOT EXISTS idx_artemis_review_company_status
  ON artemis_review_items (company_id, status, created_at DESC);

-- One row per call to the box: what it cost in tokens and latency, and whether it worked.
-- Feeds the dashboard tiles and the cost/error spike auto-trip on the kill switch.
CREATE TABLE IF NOT EXISTS artemis_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid REFERENCES companies(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES users(id) ON DELETE SET NULL,
  brain_id        text NOT NULL DEFAULT 'vierra',
  -- Which panel feature made the call ('compose', 'reply', 'rewrite', 'summarize', 'generate',
  -- 'research', 'blog'), and which model answered it.
  endpoint        text NOT NULL,
  model           text,
  status          text NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'error')),
  error           text,
  prompt_tokens   integer,
  output_tokens   integer,
  latency_ms      integer,
  -- Integer tenths of a cent, not a float: local runs are near-zero, a frontier fallback is not,
  -- and money in floating point accumulates rounding error.
  cost_millicents integer,
  review_item_id  uuid REFERENCES artemis_review_items(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_artemis_runs_company_created
  ON artemis_runs (company_id, created_at DESC);

-- Spend and error-rate windows are read per endpoint over the last N minutes.
CREATE INDEX IF NOT EXISTS idx_artemis_runs_endpoint_created
  ON artemis_runs (endpoint, created_at DESC);
