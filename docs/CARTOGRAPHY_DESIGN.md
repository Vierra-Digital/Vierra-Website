# Cartography: agentic lead sourcing

## Shared discovery access (09/05/2026)

Search and the city picker read the Cartography directory across all contributing companies.
Both endpoints still require an authenticated company member. A row's `company_id` records
its contributor, rather than restricting discovery access. Existing data needs no ownership
change or migration. The Review Queue also lists shared candidates. Import copies into the
current user's Contacts, deduplicates by that user and email, and leaves the shared source
available for others. Legacy promoted rows remain importable. Editing and rejection remain
restricted to the contributing company; other companies see read-only source fields.
This supersedes tenant-scoped search references in the original design below.

## Problem

Cartography is the only unbuilt stage of the outreach pipeline (Cartography ->
Contacts -> Campaigns -> Notifications -> Analytics -> Meetings — see
[`project_campaigns_full_spec`]). Its nav entry already exists
(`components/email/constants.tsx:54`, key `"cryptography"`, label
"Cartography") but `EmailingPlatformSection.tsx:5228` falls through to a
literal placeholder: `{activeModule} section placeholder.`. Everything
downstream of it — Contacts, Campaigns, Smartlead/Brevo sending, Discord
notifications, analytics, meeting links — is shipped and waiting for leads to
flow in. Today leads only enter Contacts by manual CSV import or hand entry.

This doc designs Cartography as an agentic lead-discovery module: given an
industry/ICP description (general research) or a specific client's targeting
spec (e.g. "dental clinic, patients within 5mi with bad reviews on
competitors"), an AI workflow searches the web, compiles a candidate list,
enriches each with contact info, and hands the result to Contacts the same
way CSV import does today.

## Goals

- Two entry modes: **General Cartography** (always-on wide research building
  a reusable "brand universe" of companies/contacts by industry) and
  **Client-Spec Cartography** (a one-off run scoped to a specific client's
  ICP, e.g. "ecom brands that just signed with Stripe").
- Agentic search loop: seed query -> candidate discovery -> per-candidate
  enrichment (email/phone/LinkedIn/address) -> dedupe against existing
  contacts -> review queue -> import into Contacts (same seam CSV import uses
  today).
- A worked example the notes call out explicitly: given a client + industry
  + service area, pull businesses in the area via Google Business, identify
  competitors within a radius, and for every competitor location with a
  rating under some threshold (notes say "<3"), pull every reviewer/patient
  name visible and attempt to find contact info for them. This is squarely a
  scraping/ToS-grey-area flow — flag explicitly under Open questions below,
  don't build it first.
- Searchable, filterable, sortable result set: free-text search over a
  description field, filter by industry, sort by relevance (title match —
  CEO/CMO/founder-type titles rank above generic staff), filter by distance
  from a reference point.
- Company <-> contact <-> industry affiliation modeled explicitly, since
  "sort by CEO/CMO" and "filter by industry" both need it.
- Data access split by audience: Vierra staff get read/write on the
  cartography store; a client-facing read surface (if/when clients get
  panel access to their own lead lists) is read-only. No hard delete from
  either side — see Data model.
- Every submitted query passes a screening gate *before* it reaches either
  branch (pool search or AI agent) — see Query screening below. Not optional
  and not just an Agentic-mode concern.

## Non-goals (this doc)

- Not replacing or changing Contacts, Campaigns, or anything downstream —
  Cartography is purely a new *feeder* into the existing `Contact` model via
  the existing import path.
- Not building the review-scraping flow (the "<3 stars, pull reviewer names"
  example) as a first cut — it's the most legally/ToS-sensitive piece
  described in the notes and needs its own scoping pass (see Open
  questions).
- Not standing up gRPC infra yet — see Storage below: the store is built now
  to be *extractable* into a separate service later (soft references instead
  of cross-database foreign keys), but it's reached via plain REST/Next.js
  API routes for now. gRPC specifically is deferred until there's a real
  non-browser caller that needs it — see Storage's "REST now, gRPC later"
  subsection for why.
- Not designing the "brand universe" generation/rendering UI in detail —
  scoped here only as "the general-mode result set," not as a visual
  brand-asset generator.

## Prior art already in the repo

- **Artemis** (`lib/ai/artemis.ts`) is the pluggable LLM client Cartography's
  agent loop should sit behind — it already abstracts Claude vs a
  self-hosted OpenAI-compatible endpoint via `ARTEMIS_PROVIDER` /
  `ARTEMIS_BASE_URL`, which is exactly the "MOE self-hosted model" path
  described in the notes ("Installed MOE with Gwen, 3 instances"). Point
  `ARTEMIS_BASE_URL` at that cluster rather than building a second AI client.
  `ARTEMIS_DISABLE_THINKING` already exists for exactly the failure mode a
  cheap classify-style call (e.g. "is this person a CEO/CMO?") would hit
  against a reasoning MOE model — reuse it, don't rediscover the bug fixed
  in `a5aff04`.
- **`lib/enrichment/companyContext.ts`** is a keyless company-enrichment
  module (name, description, logo, socials, generic contact emails, tech
  stack, firmographics from schema.org/Wikidata, domain age via RDAP,
  popularity via Tranco) that already does a slice of what "enrich each
  candidate" needs at the *company* level. Cartography's enrichment step
  should call this rather than re-implement keyless firmographics lookup;
  it only needs to add the *contact-level* enrichment (named person -> email/
  phone/LinkedIn) on top.
- **Contacts import path** (`Contact` model, `prisma/schema.prisma:850`) is
  the existing landing zone — `source` is already a free-text column
  (`@default("manual")`), so Cartography rows can land with
  `source: "cartography"` without a schema change to `Contact` itself.
- **"Alex" / "EA route"** from the raw notes has no corresponding code
  anywhere in the repo (checked `lib/`, `pages/api/`, `components/`) — treat
  it as an unscoped future idea, not an existing integration point. Don't
  build against it until the user defines what it is.

## Architecture

```text
                    +-----------------------+
                    |  Cartography tab (UI) |
                    |  General | Client-Spec|
                    +-----------+-----------+
                                |
                    +-----------v-----------+
                    | Cartography API layer |
                    | (pages/api/cartography,|
                    |  plain REST — see      |
                    |  "REST now, gRPC later")|
                    +-----------+-----------+
                                |
                    +-----------v-----------+
                    | Query screening gate   |
                    | screenCartographyQuery|
                    | (runs before EITHER    |
                    |  branch below) [DONE]  |
                    +-----------+-----------+
                                |
              +-----------------+------------------+
              |                                     |
   +----------v----------+              +-----------v-----------+
   | Agent orchestrator     |              | Cartography store      |
   | fans out to ONE        |              | (own tables, soft      |
   | sub-agent per           |<---------->| references out, real   |
   | discovery method,       |  write via | FKs within the store,  |
   | in parallel [DONE —    |  persistRun| staff RW / client RO,  |
   | see Sub-agent           |  .ts [DONE]| no hard delete)        |
   | orchestration below]   |            +-----------+-----------+
   +----------+-----------+                          ^
              |                                       | read via
   +----------v-----------------------+               | search.ts [DONE,
   | sub-agent: general (Artemis +    |               | verified live with
   |   keyless domain enrichment)     |               | real seeded data —
   |   [DONE]                         |               | Rollout M3]
   | sub-agent: google_business [NOT  |               |
   |   IMPLEMENTED — reports as such] |               |
   | sub-agent: linkedin_sales_nav    |               |
   |   [NOT IMPLEMENTED — reports as  |               |
   |    such]                         |               |
   +------------------------------------+              |
                                                        |
                                          +-------------v-------------+
                                          | Review queue -> Import to |
                                          | Contact (source=cartography)|
                                          | [Review queue verified live|
                                          |  with real seeded rows;   |
                                          |  promote not yet exercised|
                                          |  live — Rollout M4]       |
                                          +----------------------------+
```

`[DONE]` marks pieces that are real, working code as of this doc's latest
revision — `lib/cartography/screenQuery.ts`,
`lib/cartography/agentOrchestrator.ts`, `lib/cartography/persistRun.ts`,
`pages/api/cartography/agent.ts`, `pages/api/cartography/search.ts`. The
migration and seed data are now both applied to the live database (were not
when earlier revisions of this doc were written) — Search mode and the
review queue's listing have both been verified against real rows, not just
against a down Supabase. Screening now runs in front of both Search and
Agentic mode (see Query screening below), confirmed live: a
prompt-injection-shaped keyword is rejected with a 400 before touching the
database on either path.

### Two run modes

**General Cartography** — a standing job (cron, not request-triggered) that
does wide research by industry to build up a reusable candidate pool ("brand
universe"): companies + known contacts + industry tags, independent of any
one client engagement. This is the pool client-spec runs can also draw from
before going out to live search.

**Client-Spec Cartography** — triggered from a specific client's targeting
brief (ICP description, desired count, optionally a service-area radius).
Runs the same discover -> enrich -> dedupe loop but scoped and one-shot,
producing a review queue tied to that client/campaign rather than the shared
pool.

### Discovery methods

Matches the "pick a cartography method" entry point already described in
[`project_campaigns_full_spec`]: LinkedIn Sales Nav query, Google
Reviews/Google Business proximity search, or a general ICP-description-driven
web search. Each method is a pluggable strategy behind the same orchestrator
interface (`discover(query) -> Candidate[]`), so adding a new source later
doesn't touch the enrichment/dedupe/review stages.

The Google-Business-proximity method (client dental-clinic example) works out
to:

1. Input: client business + industry + service radius.
2. Pull businesses in that radius via Google Business (Places API).
3. Identify competitors (same industry/category, excluding the client).
4. For each competitor location, pull its review data.
5. Filter to reviewers/patients associated with sub-3-star reviews.
6. Attempt contact-info enrichment on those names.
7. Land in the review queue same as any other candidate.

Steps 4-6 are the ToS-sensitive part — see Open questions.

### Sub-agent orchestration [DONE — `lib/cartography/agentOrchestrator.ts`]

Agentic mode doesn't run one Artemis call — it fans a screened query out to
**one sub-agent per discovery method**, in parallel, and aggregates the
results:

```text
runCartographyAgent(description)
  ├─ sub-agent "general"             -> real Artemis call, returns candidates
  ├─ sub-agent "google_business"     -> reports { status: "not_implemented" }
  └─ sub-agent "linkedin_sales_nav"  -> reports { status: "not_implemented" }
       (Promise.all — one method failing/missing never blocks the others)
  -> { tasks: [...], candidates: [...] }   (deduped by lowercased company name)
```

Each sub-agent is independent, matching the "pluggable discovery method"
interface from the Discovery methods section above — adding a real
`google_business`/`linkedin_sales_nav` backend later means implementing that
one method's runner function and flipping its `not_implemented` result to a
real one; the fan-out/aggregation/dedupe logic doesn't change. A sub-agent
that isn't built yet says so explicitly (`not_implemented`) rather than
silently doing nothing or being omitted — the UI shows all three methods'
status every run, not just the ones that did something.

**Persistence [DONE — `lib/cartography/persistRun.ts`].** After
`runCartographyAgent` resolves, `pages/api/cartography/agent.ts` writes one
`cartography_runs` row, one `cartography_run_tasks` row per sub-agent
(method, status, candidate count, error — mirrors `SubAgentTaskResult`), and
`cartography_contacts` rows tagged with both `run_id` and `task_id` so a
candidate's provenance (which sub-agent found it) survives into the review
queue. The run's own `status` rolls up from its tasks' statuses at the
application layer (`computeRunStatus()`, pure and unit-tested — no DB
trigger, matching this repo's other manual migrations). A persistence
failure is caught and logged, never thrown — verified live against a
genuinely down Supabase: the agent's candidates still reached the caller
even though the write underneath them failed.

**Enrichment [DONE — `agentOrchestrator.ts`'s `enrichCandidate()`].** Each
deduped candidate's company name is run through
`lib/enrichment/companyContext.ts`'s keyless name -> domain resolution,
attaching a real `domain` when one resolves and leaving it `null`
otherwise — never a fabricated one. Runs once per deduped candidate, not
once per contributing sub-agent, so two methods agreeing on a company only
costs one lookup.

### Storage: extractable now, even though it isn't extracted yet

**Decided:** Cartography's tables live in `public` alongside everything
else (not a dedicated Postgres schema — seeded language in an earlier draft
of this doc said "separate schema," but a real Postgres namespace would need
multi-schema Prisma config and Supabase API-exposure setup this repo has
never used, for no benefit while everything's still one database). What
actually makes Cartography *separable* is how its foreign keys are drawn,
not which schema its tables sit in:

- **Soft references out of the store**: `cartography_companies.company_id`,
  `cartography_runs.company_id`/`client_id`/`campaign_id`/`created_by`, and
  `cartography_contacts.company_id`/`promoted_contact_id` are plain `uuid`
  columns with **no** Postgres `REFERENCES` into `companies`/`clients`/
  `campaigns`/`users`/`contacts`. Postgres can't enforce a foreign key across
  two separate database instances, so a real FK here is exactly the kind of
  coupling that would block extracting Cartography into its own database
  later — these columns are validated at the application layer instead (the
  API route trusts `company_id` from the authenticated session, never from
  client input).
- **Real, enforced FKs within the store**: `cartography_run_tasks.run_id`,
  `cartography_contacts.cartography_company_id`/`run_id`/`task_id` all stay
  genuine `REFERENCES ... ON DELETE ...` constraints, since that relationship
  is entirely internal to Cartography's own data and travels with it
  wherever it ends up living.
- **The one real seam this creates**: promoting a candidate into a real
  `Contact` (`promoted_contact_id`) is the one place Cartography actually
  *acts on* the main app's data, not just tags it with an ID. Once
  Cartography is a genuinely separate service, that promotion stops being a
  same-database write and becomes a real API call between the two services.
  Not built yet — flagged here so it isn't a surprise when the store is
  actually extracted.

See `prisma/manual/20260831_cartography_schema.sql`'s header comment for the
same reasoning inline with the SQL.

### REST now, gRPC later — not a schema decision, a transport one

The notes ask for Cartography to work "sort of acting like a microservice,"
with AI calls as internal queries that "spit out a response... later." That
description is a **job/async-run pattern** (submit a query, get a run id,
poll or get notified when it's done — `cartography_runs.status`), not
inherently a gRPC requirement. Recommendation: build the API surface as
plain REST/JSON (`pages/api/cartography/*`, matching every other route in
this app), not gRPC, for now:

- The only caller today is the browser (`CartographySection.tsx`'s `fetch`
  calls), and browsers can't speak gRPC directly — a gRPC backend would need
  a REST-to-gRPC gateway hop in front of it just to reach parity with a
  plain REST endpoint, at the cost of new infra (proto compiler, codegen,
  HTTP/2 plumbing) this repo has never needed.
- gRPC's real advantages (strict binary contracts, streaming, service-to-
  service throughput) matter once there's a second *non-browser* internal
  caller — e.g. the sub-agent orchestrator becoming its own long-running
  worker process instead of running inline in a Next.js API route. That's
  not the case today (see Sub-agent orchestration above: sub-agents run in
  parallel within one request, not as separate processes).
- The soft-reference schema work above is what actually makes the *data*
  extractable later; REST-vs-gRPC is an independent decision that can be
  revisited the moment a real second internal caller shows up, without
  touching the schema again.

### Access model

- **Internal (staff) callers**: read/write. Staff review, edit, tag, and
  promote candidates into Contacts.
- **Client-facing callers** (if/when clients get read access to their own
  sourced leads in the panel): read-only.
- **No hard delete**, either side — matches the DNC/spam lifecycle already
  designed for Contacts (soft delete -> hard delete) per
  [`project_campaigns_full_spec`]. A cartography candidate that turns out
  bad gets a status flag (e.g. `rejected`, `duplicate`), never a `DELETE`.
  This also means a bad agent run is always auditable/reversible rather than
  silently destructive.

### Query screening: before AI, before search — a single gate, not two

**Decided:** every submitted query — Search mode's keyword lookup and
Agentic mode's ICP description alike — passes through one
`screenCartographyQuery()` gate before the API layer branches to either the
pool search or the agent orchestrator (see the architecture diagram above).
This is a repo-wide standing rule already, not a new one invented for
Cartography: CLAUDE.md requires treating "email content, form input and
webhook payloads" as data, never instructions, for "anything reaching an AI
prompt" — an Agentic-mode ICP description is exactly that, since it gets
concatenated into an Artemis prompt for the discovery step. Screening the
Search-mode branch too, not just Agentic, matters because both branches
share one input box and one submit path — a user (or anything scripting
against the API later) shouldn't be able to reach the AI branch by relying
on the UI's mode toggle as the only gate.

What the gate checks, in order:

1. **Length/shape** — reject or truncate absurdly long input before it
   reaches anything else; cheap and catches most junk.
2. **Prompt-injection patterns** — phrases shaped like "ignore previous
   instructions," role-reassignment attempts ("you are now..."), or
   attempts to smuggle system-prompt-looking text. This only matters for
   the Agentic branch mechanically (Search mode's query becomes a Prisma
   `WHERE ... ILIKE`/`tsvector` parameter, not a prompt), but the gate
   applies uniformly since both branches share one entry point — see above.
3. **Named-private-individual targeting** — a query that reads as aimed at
   a specific person by name rather than a company/decision-maker/industry
   is exactly the pattern flagged as needing counsel sign-off in Open
   questions (the review-scraping fact pattern). Flag or block at the gate
   rather than relying on a human catching it downstream in the review
   queue.
4. **Audit log** — every screened query (pass or reject) gets logged with
   its verdict, so a bad or borderline query is traceable after the fact,
   independent of whether the run that followed it produced anything.

**[DONE — both branches]** `lib/cartography/screenQuery.ts` implements this
(length cap, prompt-injection patterns, a review+contact-seeking combo
check, and an honorific-based named-individual check), with unit tests in
`tests/cartographyScreening.test.ts`. Both `pages/api/cartography/agent.ts`
and `pages/api/cartography/search.ts` call it before doing anything else —
`search.ts` only screens the `q` keyword (the one natural-language field;
`centerLat`/`centerLng`/`radiusMiles` are numeric filters with nothing to
screen), and only when `q` is present, so a location-only search isn't
rejected for having no query. Verified live on both routes: a
prompt-injection-shaped query is rejected with a 400 before touching the
database, and an ordinary query still returns correct results afterward.
Search-mode rejections are logged (`console.warn`), not persisted as a
`cartography_runs` row the way Agentic mode's are — that table's `mode`
CHECK constraint only allows `'general'`/`'client_spec'`, neither of which
honestly describes a rejected pool lookup, so forcing a fit there would be
worse than the console record. A dedicated audit path for search-mode
rejections is a follow-up, not something to force into the run-oriented
schema now.

## Data model (sketch)

New tables, not additions to `public.contacts` — Cartography candidates are
*pre*-contacts; only reviewed/promoted ones become a `Contact` row. See
`prisma/manual/20260831_cartography_schema.sql` (the real migration, not yet
applied to any live database) and the matching models in
`prisma/schema.prisma`. Fields marked *(soft)* are plain `uuid` columns with
no Postgres `REFERENCES` — see Storage above for why.

```text
cartography_companies
  id, company_id (soft) -> companies,
  name, domain, industry, description (searchable text),
  address, lat, lng,                    -- for proximity filtering
  source_method,                        -- "google_business" | "linkedin_sales_nav" | "general"
  brand_universe_tag,                   -- ties into the "general" standing pool
  created_at, updated_at

cartography_runs
  id, company_id (soft) -> companies, created_by (soft) -> users,
  mode,                                 -- "general" | "client_spec"
  client_id (soft) / campaign_id (soft) (nullable),
  icp_description, target_count,
  status,                               -- running | review_pending | completed | failed
                                         -- (rolled up from cartography_run_tasks)
  screening_note,                       -- set by screenCartographyQuery() if rejected/flagged
  created_at, completed_at
  -- NOTE: no `method` column — a run fans out into per-method sub-agents,
  -- tracked individually below, rather than running one method itself.

cartography_run_tasks
  id, run_id -> cartography_runs (real FK),
  method,                               -- "google_business" | "linkedin_sales_nav" | "general"
  status,                               -- pending | running | completed | failed | not_implemented
  candidate_count, error,
  started_at, completed_at, created_at

cartography_contacts
  id, company_id (soft) -> companies,
  cartography_company_id -> cartography_companies (real FK),
  run_id -> cartography_runs (real FK, nullable),
  task_id -> cartography_run_tasks (real FK, nullable),
  name, title,                          -- title drives CEO/CMO relevance sort
  email, phone, linkedin_url,
  enrichment_status,                    -- pending | enriched | failed
  status,                               -- candidate | reviewed | promoted | rejected | duplicate
  promoted_contact_id (soft) -> contacts.id (nullable, set once imported),
  created_at, updated_at
```

`cartography_companies.description` is the free-text field the notes ask to
make searchable — backed by a Postgres full-text index (`tsvector`), no need
for a separate search service at this scale. `industry` is a plain filter
column. Relevance sort combines a title-rank lookup table (CEO/Founder/CMO
etc. rank above "Associate") with plain recency/enrichment-completeness as
tiebreakers. Distance filtering uses `lat`/`lng` with a radius query (Postgis
`ST_DWithin` if the cartography DB has PostGIS, otherwise a haversine
calculation in SQL — either is fine at this data volume).

## Review -> import flow

1. Agent run populates `cartography_contacts` with `status: candidate`.
2. Staff reviews in the Cartography tab: search/filter/sort as above, fill
   in any missing enrichment fields inline (matches the "user reviews/fills
   in missing fields" step from the original notes).
3. Bulk-select -> "Import to Contacts." This reuses whatever internal
   function today's CSV import calls for `Contact` creation (same
   validation, same `source` column, same dedupe-by-email path) rather than
   a parallel insert path — the notes' original design already went through
   a `contacts.csv` intermediate for this reason; the DB-to-DB version
   should preserve the same semantics, not the same file hop.
4. Each imported row gets `promoted_contact_id` set, `status: promoted`, so
   re-running a search never re-imports it (dedupe by this join, not just by
   email, so a re-enriched later record can't collide silently).

## Open questions

- **Review-scraping legality/ToS — non-lawyer risk read (get real counsel
  before building this step).** Layered risk, worst first:
  1. **Google's own terms, separately from any law.** The Maps Platform ToS
     bars exporting/extracting/scraping Maps content "for use outside the
     Services" and bars caching beyond narrow exceptions (place IDs
     indefinitely, coordinates up to 30 days — everything else, including
     names/ratings/review text, is meant to be requested live, not
     warehoused). The official Places API also caps reviews at 5 per place,
     so even a compliant path can't return every sub-3-star reviewer, only a
     handful. Violating the ToS itself isn't a criminal or civil claim on
     its own, but it's a contract Vierra would be breaking with Google, and
     the practical consequence is IP blocks / API key revocation, not
     prosecution.
  2. **CFAA / anti-hacking law is probably not the exposure.** *hiQ Labs v.
     LinkedIn* (9th Cir., final on remand) held that scraping data a page
     serves to anyone without login is not "unauthorized access" under the
     CFAA — there's no gate to breach on public data. Google reviews are
     public in the same sense, so criminal-hacking-statute risk here is
     low. (hiQ's case did lose on a *different* theory — creating fake
     accounts to scrape data behind a login wall — which isn't this design;
     don't let that muddy the read on the public-data piece.)
  3. **Breach-of-contract / ToS-enforcement risk is real but civil, not
     criminal**, and Google enforcing it against a small marketing agency
     rather than just cutting off API access is a low-probability tail risk,
     not the main concern.
  4. **The actual sharp edge is downstream of scraping: contacting a
     private individual, unsolicited, because they left a bad review of a
     business that isn't even Vierra's client.** That's not a scraping
     question at all — it's cold-outreach law: CAN-SPAM if by email
     (requires honest headers/subject, a working opt-out, and arguably
     doesn't clearly exempt this since it's commercial email to a consumer,
     not the business itself), TCPA if by phone/SMS (consent requirements
     are much stricter, statutory damages per violation), and state
     consumer-protection/UDAP theories on top — "we found you because you
     complained about a competitor" is the kind of fact pattern that reads
     badly to a regulator or a judge even before you get to a specific
     statute. If the target vertical is anything remotely sensitive (the
     notes' own example is a dental clinic, i.e. patients), add
     reputational risk to legal risk — a client whose funnel opener is "I
     saw your bad experience at [competitor]" is a hard sell even if every
     step were legal.
  5. **No clear finding either way from public sources on "scrape reviews,
     then cold-contact the reviewer for marketing"** as a combined fact
     pattern — it sits in a gap between scraping law (mostly settled toward
     "public data scraping itself is low CFAA risk") and outreach law
     (well-settled, but written around review *content* is public data,
     not permission to *contact the reviewer*). That gap is exactly why
     this needs a real attorney's read on the combined flow, not just a
     scraping-legality check.

  **Recommendation unchanged from before:** build the general
  company/decision-maker enrichment paths first (phases 1-3 in Rollout,
  minus the review-scraping sub-step), and treat sub-3-star-reviewer
  contact-mining as a separate, explicitly counsel-approved follow-up —
  don't let it block or get bundled into the rest of Cartography.

  Sources (informal research, not legal advice): [Google Places API terms —
  scraping, storage & cache](https://bizcollect.dev/blog/google-places-api-terms),
  [hiQ v. LinkedIn wrapped up](https://www.zwillgen.com/alternative-data/hiq-v-linkedin-wrapped-up-web-scraping-lessons-learned/),
  [Ninth Circuit holds data scraping legal in hiQ v. LinkedIn](https://calawyers.org/privacy-law/ninth-circuit-holds-data-scraping-is-legal-in-hiq-v-linkedin/).
- **"Alex EA route"** — undefined; no code reference found. Needs the user
  to specify what this is before it can be scoped.
- **Rate limits / cost** — an "always running, wide research" general mode
  against Google Business + LinkedIn + arbitrary company websites, backed by
  LLM calls per candidate, needs a budget/throttle from day one (both API
  quota and Artemis/MOE inference cost) or a runaway cron job becomes the
  first incident.
- **LinkedIn Sales Nav access** — needs confirmation of what access Vierra
  actually has (paid seat vs. unofficial scraping) before that discovery
  method can be built; unofficial scraping carries the same ToS exposure
  flagged above for Google reviews.

## Rollout (proposed phases)

1. **Schema + review UI**, no live discovery yet — **done, verified live**:
   the UI (`CartographySection.tsx`) calls a real
   `GET /api/cartography/search` endpoint (M3) instead of an in-memory mock,
   and the review queue (M4) — `components/PanelPages/CartographySection/ReviewQueue.tsx`,
   a "Review Queue" tab alongside Discover — lists real rows. The migration
   (`prisma/manual/20260831_cartography_schema.sql`) and seed data
   (`.../20260901_seed_cartography_test_data.sql`, scoped to a real
   `company_id` the user confirmed via `GET /api/auth/me`) are both applied
   to the live database now. Confirmed live: searching `"dental"` returns
   Nova Dental Group and Brightline Orthodontics correctly sorted, and the
   review queue lists all 8 seeded candidates with editable fields. Not yet
   exercised live: actually promoting a candidate into a real `Contact` —
   deliberately not tested without explicit confirmation, since it's a real
   write to production data, not a read-only check.
2. **Client-Spec mode, general-web discovery method only** — **mostly
   done**: `screenCartographyQuery()`, the sub-agent orchestrator
   (`lib/cartography/agentOrchestrator.ts`), persistence
   (`lib/cartography/persistRun.ts`), and real enrichment via
   `lib/enrichment/companyContext.ts` are all real, tested code — a screened
   ICP description fans out to a `general` sub-agent (real Artemis call,
   each candidate's company name run through keyless domain resolution)
   plus `google_business`/`linkedin_sales_nav` sub-agents (report
   `not_implemented`, don't silently no-op). Persistence degrades
   gracefully — verified live against a genuinely down Supabase: the run's
   candidates still reach the caller even when the DB write fails, logged
   but never thrown.
3. **Google Business proximity method** (competitor discovery + radius
   filtering), stopping short of the review-scraping step pending the legal
   question above. Not started — the `google_business` sub-agent is
   currently a stub that reports `not_implemented`.
4. **General Cartography standing job** — cron-driven wide research building
   the shared brand-universe pool, with the budget/throttle from Open
   questions in place before it's allowed to run unattended. Not started.
5. Everything past that (review-scraping enrichment, LinkedIn Sales Nav,
   gRPC transport, Alex EA route) stays gated behind its respective open
   question.

### Detailed scope: what's left, in dependency order

Confirmed while scoping this: `withAuth`'s session (`kind: "member"`,
`lib/auth/resolveUser.ts`) already carries `session.companyId` and
`session.user.id` — no new auth plumbing was needed for any of the
`company_id`/`created_by` scoping below.

**M1 — Tenant-scoping convention. [DONE]** Every write below uses
`session.companyId` for `company_id` columns and `session.user.id` for
`created_by` (`pages/api/cartography/agent.ts`,
`lib/cartography/persistRun.ts`, `pages/api/cartography/search.ts`). One
nuance for later — the real `Contact` row created at promotion time (M4) is
scoped by `user_id`, not `company_id` (matching
`pages/api/contacts/import.ts`'s existing pattern, since `Contact` itself
has no `company_id` column), so promotion assigns the *promoting staff
member*, not the cartography tenant.

**M2 — Persist agent runs. [DONE]** `lib/cartography/persistRun.ts` — after
`runCartographyAgent()` resolves in `agent.ts`, writes one `cartography_runs`
row, one `cartography_run_tasks` row per sub-agent, and one
`cartography_companies` + `cartography_contacts` row pair per candidate
(tagged with both `run_id` and `task_id`). A screening rejection is also
persisted (`status: 'failed'`, `screening_note` set to the rejection
reason) — the audit-log requirement from Query screening's check 4. Both
paths degrade gracefully on a DB failure (caught, logged, never thrown) —
this was verified for real against a genuinely down Supabase instance, not
just reasoned about: the candidates the agent found still reached the
caller when persistence failed underneath them. `computeRunStatus()` (the
run-status rollup) is pure and unit-tested
(`tests/cartographyPersistRun.test.ts`); the actual Prisma writes around it
can't be unit-tested in this repo's harness (`vitest.config.mts` scopes
tests to Prisma/Next-free modules only), same constraint every other
DB-touching route in this app already lives with.

**M3 — Search mode, for real. [DONE, verified live]**
`GET /api/cartography/search` — keyword match via `search_vector`
(`$queryRaw`, conditional filters expressed as `$1 IS NULL OR <condition>`
in one fixed statement rather than dynamically composed SQL), radius via
`lat`/`lng` haversine computed in Postgres, relevance sort by title rank.
`CartographySection.tsx`'s Search mode now calls this endpoint instead of
the old mock array (`MOCK_BRAND_UNIVERSE` is gone). The migration and seed
data (`prisma/manual/20260831_cartography_schema.sql`,
`.../20260901_seed_cartography_test_data.sql`) are now both applied —
verified live with real results: `"dental"` correctly returned Nova Dental
Group and Brightline Orthodontics, sorted CEO-above-Practice-Owner as
designed. `screenCartographyQuery()` is now wired in front of this route
too (only the `q` keyword is screened — `centerLat`/`centerLng`/
`radiusMiles` are numeric filters, nothing to screen — and only when `q` is
present, so a location-only search isn't rejected for having "no query").
Verified live: a prompt-injection-shaped keyword is rejected with a 400
before touching the database, and an ordinary keyword still returns correct
real results afterward. Screening rejections here are logged
(`console.warn`) rather than persisted as a `cartography_runs` row like
Agentic mode's are — that table's `mode` CHECK constraint only allows
`'general'`/`'client_spec'`, neither of which honestly describes a rejected
pool lookup; a dedicated audit path for search-mode rejections is a
follow-up, not forced into the run-oriented schema now.

**M4 — Review queue + "Import to Contacts." [DONE, listing verified live —
promote not yet exercised live]**
- `GET /api/cartography/contacts` — lists candidates for review, defaulting
  to `status in ('candidate', 'reviewed')`.
- `PATCH /api/cartography/contacts/[id]` — inline-edit `name`/`email`/
  `title`/`phone`/`linkedinUrl`, or move a row to `reviewed`/`rejected`/
  `duplicate` (never a hard delete — matches the rest of this schema).
- `POST /api/cartography/contacts/promote` — bulk-promotes: creates a real
  `Contact` (`source: "cartography"`, `user_id` per M1's nuance), or reuses
  an existing one with a matching `(user_id, email)` rather than creating a
  duplicate (the "dedupe against existing contacts" goal — the DB's own
  unique index on `Contact` never fires here since `account_id` stays null,
  so this dedupe check is deliberate application-layer logic, not
  incidental). Sets `promoted_contact_id` + `status: 'promoted'`. Rejects a
  row with no valid email rather than silently skipping it — Artemis never
  fabricates a contact's real email, so this is the expected, common case
  for Agentic-mode candidates until a real name/email is filled in.
  Processes one id at a time (not in parallel) so each row's outcome is
  individually attributable, returned to the caller as
  `{id, ok, contactId?, reason?}[]`.
- `components/PanelPages/CartographySection/ReviewQueue.tsx` — a new
  top-level "Review Queue" tab (`CartographySection.tsx`, separate from the
  Search/Agentic mode toggle — sourcing and reviewing act on different
  data, not two flavors of one search). Inline-editable rows, per-row
  reject/promote, and bulk select + promote.
- **Verified live twice**: first against a genuinely down Supabase (the
  queue correctly fetches on mount, degrades to a clean error with a Retry
  button, and Retry/tab-switching both work cleanly without getting stuck),
  then again after the migration and seed data landed — all 8 seeded
  candidates list correctly with editable fields, correct industry badges,
  and correct `via general` source tags. Promotion itself
  (`POST .../promote`) hasn't been exercised live yet — deliberately not
  tested without explicit confirmation, since it's a real write to
  production data (creates an actual `Contact` row), not a read-only check.

**M5 — Real enrichment. [DONE]** `lib/cartography/agentOrchestrator.ts`'s
`enrichCandidate()` calls `lib/enrichment/companyContext.ts` with each
deduped candidate's company *name* (not a domain Artemis guesses — Artemis
was never asked to invent one, since a wrong guess would be worse than
none) and attaches whatever real `domain` that keyless lookup resolves,
leaving it `null` on no match or any failure — never fabricated, matching
the same "an unverified guess must look unverified" posture as
`suggestedTitle`. Runs once per deduped candidate (not once per
contributing sub-agent) so a company two methods agree on doesn't cost two
lookups. Unit-tested by mocking `getCompanyContextFor`
(`tests/cartographyAgentOrchestrator.test.ts`).

**M6 — Explicitly blocked; don't start without resolving the gate first:**
- Real `google_business` sub-agent — needs Places API access, and the
  review-scraping sub-flow specifically needs separate legal sign-off (see
  Open questions) before any of it is built, not just the proximity part.
- Real `linkedin_sales_nav` sub-agent — needs LinkedIn access confirmed
  (paid Sales Nav seat vs. unofficial scraping — see Open questions).
- Standing "General Cartography" cron job — needs a rate-limit/cost budget
  designed before it's allowed to run unattended (see Open questions).
- "Alex EA route" — still completely undefined; needs the user to specify
  what it is before it can be scoped at all.
