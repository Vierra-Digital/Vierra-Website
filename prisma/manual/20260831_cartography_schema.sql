-- Cartography lead-sourcing schema (see docs/CARTOGRAPHY_DESIGN.md).
--
-- Tables live in `public`, not a dedicated Postgres schema, matching every other table in
-- this repo — the design doc's "separate schema" goal is achieved by these being distinct
-- tables with their own lifecycle, not a new Postgres namespace.
--
-- INTENTIONALLY A SEPARATE MICROSERVICE-SHAPED STORE, NOT JUST SEPARATE TABLES: Cartography
-- is meant to be extractable later into its own service reached over gRPC (see the design
-- doc's Storage section) — an AI-agent-heavy workload run as internal sub-agent calls, not a
-- request/response CRUD surface like the rest of this app. Because of that, this migration
-- deliberately does NOT use real Postgres foreign keys into the main app's tables
-- (companies/users/clients/campaigns/contacts) — Postgres can't enforce a FK across two
-- separate database instances, and adding one now just to remove it later would mean
-- migrating live, constrained data. Every cross-store reference below is a plain `uuid`
-- column instead: still indexed, still required where it's required, just validated at the
-- application layer (the API route trusts company_id from the authenticated session, never
-- from client input) rather than by the database. Foreign keys WITHIN Cartography's own
-- tables (run -> run_tasks -> contacts, company -> contacts) stay real, enforced FKs, since
-- those all belong to the same store wherever it ends up living.
--
-- One consequence worth naming: "promote a candidate into a real Contact"
-- (cartography_contacts.promoted_contact_id) is the one place Cartography actually needs to
-- act on the main app's data, not just tag it with an ID. Once this is genuinely a separate
-- service, that promotion can't be a same-database write anymore — it becomes an actual
-- API/gRPC call between the two services at promotion time. Not built yet; flagging the seam
-- now so it isn't a surprise later.
--
-- Candidates are *pre*-contacts: only a reviewed/promoted row becomes a real `contacts` row.
-- Nothing here is ever hard-deleted — a bad candidate gets status = 'rejected'/'duplicate',
-- matching the DNC/spam soft-delete lifecycle already used for contacts, so a bad agent run
-- is always auditable rather than destructive.
--
-- Scoped by company_id (the agency tenant, same as campaigns.company_id) rather than
-- user_id (the way contacts.user_id scopes to one staff member's mailbox) — Cartography's
-- "brand universe" is a shared pool across a company's staff, not one person's rolodex.

CREATE TABLE IF NOT EXISTS cartography_companies (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Soft reference to companies(id) — see the file header. Set from the authenticated
  -- session server-side, never trusted from client input.
  company_id         uuid NOT NULL,
  name               text NOT NULL,
  domain             text,
  industry           text,
  description        text,
  address            text,
  -- Proximity filtering (see docs/CARTOGRAPHY_DESIGN.md "Distance Filtering"). Plain
  -- double precision + haversine in application SQL, not PostGIS — fine at this data
  -- volume per the design doc; revisit only if the pool grows large enough that an
  -- index-backed radius query (ST_DWithin) actually matters.
  lat                double precision,
  lng                double precision,
  source_method      text NOT NULL DEFAULT 'general'
                        CHECK (source_method IN ('google_business', 'linkedin_sales_nav', 'general')),
  -- Non-null only for rows belonging to the standing "General Cartography" pool; a
  -- client-spec run's candidates leave this null (see cartography_runs.mode).
  brand_universe_tag text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cartography_companies_company_id
  ON cartography_companies (company_id);
CREATE INDEX IF NOT EXISTS idx_cartography_companies_industry
  ON cartography_companies (company_id, industry);
CREATE INDEX IF NOT EXISTS idx_cartography_companies_lat_lng
  ON cartography_companies (lat, lng);

-- Free-text search over name/description/industry (see docs/CARTOGRAPHY_DESIGN.md's
-- "searchable description field" goal) — a generated column kept in sync by Postgres
-- itself, so callers never need to remember to update it.
ALTER TABLE cartography_companies
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || coalesce(industry, '')
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_cartography_companies_search_vector
  ON cartography_companies USING gin (search_vector);

-- One agentic discovery run (see docs/CARTOGRAPHY_DESIGN.md's "Two run modes"). No `method`
-- column here anymore — a run fans out into per-method sub-agents, tracked individually in
-- cartography_run_tasks below, rather than running a single method itself.
CREATE TABLE IF NOT EXISTS cartography_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Soft references (see file header) — company_id/client_id/campaign_id/created_by all
  -- point at the main app's tables but carry no DB-level FK.
  company_id      uuid NOT NULL,
  created_by      uuid,
  mode            text NOT NULL CHECK (mode IN ('general', 'client_spec')),
  -- Only set for mode = 'client_spec'; a general-pool run targets no single client.
  client_id       uuid,
  campaign_id     uuid,
  icp_description text,
  target_count    integer,
  -- "running" until every sub-task in cartography_run_tasks reaches a terminal state;
  -- rolled up by the application layer, not a DB trigger (no trigger convention exists in
  -- this repo's other manual migrations).
  status          text NOT NULL DEFAULT 'running'
                    CHECK (status IN ('running', 'review_pending', 'completed', 'failed')),
  -- Set by screenCartographyQuery() when it rejects/flags this run's query, if anything —
  -- see docs/CARTOGRAPHY_DESIGN.md's Query screening section. Null when the query passed
  -- clean.
  screening_note  text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_cartography_runs_company_id
  ON cartography_runs (company_id);
CREATE INDEX IF NOT EXISTS idx_cartography_runs_client_id
  ON cartography_runs (client_id);
CREATE INDEX IF NOT EXISTS idx_cartography_runs_status
  ON cartography_runs (company_id, status);

-- One sub-agent invocation within a run — see docs/CARTOGRAPHY_DESIGN.md's "Sub-agent
-- orchestration" section. A run fans out to one task per discovery method
-- (general/google_business/linkedin_sales_nav), run in parallel; each is independent, so one
-- method failing (or not being implemented yet) never blocks the others. A real FK to
-- cartography_runs — this relationship is entirely internal to the Cartography store, so it
-- stays enforced regardless of where that store ends up living.
CREATE TABLE IF NOT EXISTS cartography_run_tasks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          uuid NOT NULL REFERENCES cartography_runs(id) ON DELETE CASCADE,
  method          text NOT NULL
                    CHECK (method IN ('google_business', 'linkedin_sales_nav', 'general')),
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'not_implemented')),
  candidate_count integer,
  error           text,
  started_at      timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cartography_run_tasks_run_id
  ON cartography_run_tasks (run_id);

-- One sub-agent invocation should only ever produce one task row per method per run.
CREATE UNIQUE INDEX IF NOT EXISTS uq_cartography_run_tasks_run_method
  ON cartography_run_tasks (run_id, method);

CREATE TABLE IF NOT EXISTS cartography_contacts (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Soft reference (see file header) — denormalized off cartography_companies.company_id so
  -- dedupe/uniqueness and tenant-scoped queries avoid a join, the same way contacts.user_id
  -- sits directly on the row instead of requiring a join back through an account.
  company_id              uuid NOT NULL,
  -- Real FK — internal to the Cartography store either way.
  cartography_company_id  uuid NOT NULL REFERENCES cartography_companies(id) ON DELETE CASCADE,
  -- Real FKs — both internal to the Cartography store. run_id is denormalized off task_id
  -- (every task belongs to exactly one run) purely so "all candidates for this run" doesn't
  -- need a join through cartography_run_tasks. Both null for a general-pool candidate not
  -- tied to any one run.
  run_id                  uuid REFERENCES cartography_runs(id) ON DELETE SET NULL,
  task_id                 uuid REFERENCES cartography_run_tasks(id) ON DELETE SET NULL,
  name                    text,
  -- Drives the CEO/CMO-first relevance sort described in the design doc.
  title                   text,
  email                   text,
  phone                   text,
  linkedin_url            text,
  enrichment_status       text NOT NULL DEFAULT 'pending'
                            CHECK (enrichment_status IN ('pending', 'enriched', 'failed')),
  status                  text NOT NULL DEFAULT 'candidate'
                            CHECK (status IN ('candidate', 'reviewed', 'promoted', 'rejected', 'duplicate')),
  -- Soft reference to contacts(id) (see file header) — set once promoted into the real
  -- contacts table (source = 'cartography' there). Never cleared or reused — re-running a
  -- search must not re-import an already-promoted row. Promotion itself becomes a real
  -- cross-service call once Cartography is genuinely separate; see the file header.
  promoted_contact_id     uuid,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cartography_contacts_company_id
  ON cartography_contacts (company_id);
CREATE INDEX IF NOT EXISTS idx_cartography_contacts_cartography_company_id
  ON cartography_contacts (cartography_company_id);
CREATE INDEX IF NOT EXISTS idx_cartography_contacts_run_id
  ON cartography_contacts (run_id);
CREATE INDEX IF NOT EXISTS idx_cartography_contacts_task_id
  ON cartography_contacts (task_id);
CREATE INDEX IF NOT EXISTS idx_cartography_contacts_status
  ON cartography_contacts (company_id, status);

-- A promoted candidate can only ever back one real contact; re-promoting (or a second
-- candidate somehow pointing at the same contact) would silently corrupt the dedupe story
-- described in the design doc's Review -> import flow. No REFERENCES here (soft reference,
-- see file header), but the uniqueness guarantee itself still lives in this database since
-- it's only about cartography_contacts rows not colliding with each other.
CREATE UNIQUE INDEX IF NOT EXISTS uq_cartography_contacts_promoted_contact_id
  ON cartography_contacts (promoted_contact_id)
  WHERE promoted_contact_id IS NOT NULL;

-- Prevents the same tenant's pool from accumulating duplicate rows for the same person on
-- repeated discovery runs. No WHERE clause needed for the "not yet enriched, email still
-- null" case — Postgres already never treats two NULLs as colliding in a unique index.
CREATE UNIQUE INDEX IF NOT EXISTS uq_cartography_contacts_company_email
  ON cartography_contacts (company_id, email);
