# Vierra Website

Full-stack marketing site, internal **admin/staff panel**, **client portal**, a full **email & outreach platform** (Gmail + SMTP — open/click tracking, inbound tracker detection, sequenced campaigns, scheduled send, shared inboxes, meeting booker, confidential mode), **document signing**, onboarding flows, and integrations (LinkedIn, Facebook, Google Ads, Stripe). Built with **Next.js 16** (App Router + Pages Router), **PostgreSQL** via **Prisma 7**, **Supabase Auth**, deployed on **Netlify** (`vierradev.com` / production marketing domain `vierra.com`).

---

## Table of contents

1. [Tech stack](#tech-stack)
2. [Repository layout](#repository-layout)
3. [Getting started](#getting-started)
4. [npm scripts](#npm-scripts)
5. [Environment variables](#environment-variables)
6. [Authentication & roles](#authentication--roles)
7. [Pages directory](#pages-directory)
8. [API routes](#api-routes)
9. [Panel sections](#panel-sections)
10. [Database (Prisma)](#database-prisma)
11. [Key integrations](#key-integrations)
12. [Testing](#testing)
13. [Deployment (Netlify)](#deployment-netlify)
14. [Security notes](#security-notes)

---

## Tech stack

| Layer | Technology |
|--------|------------|
| Framework | Next.js 16 (hybrid App Router + Pages Router) |
| Language | TypeScript |
| UI | React 19, Tailwind CSS, Framer Motion, Radix UI |
| Auth | Supabase Auth (email/password + Google OAuth) |
| Database | PostgreSQL + Prisma 7 ORM (node-postgres driver adapter) |
| Email | Nodemailer (SMTP), Gmail API (panel email platform) |
| Payments | Stripe |
| Analytics | Google Analytics 4 (site tag + server-side GA4 Data API for dashboard) |
| Hosting | Netlify (build + edge functions) |

---

## Repository layout

```
Vierra-Website/
├── app/                    # App Router (marketing home, set-password, stripe success, sitemap)
├── pages/                  # Pages Router (panel, client, blog, login, API routes)
├── components/             # Shared & panel UI (DashboardSection, EmailingPlatformSection, …)
├── lib/                    # Server utilities (auth, prisma, gmail, googleCalendar, stripe, crypto)
├── prisma/
│   ├── schema.prisma       # Database schema
│   ├── migrations/         # Baselined pre-v2 history; not applied to the live DB
│   └── manual/             # Hand-applied SQL, the actual change record
├── prisma.config.ts        # Prisma 7 CLI config (schema path, migrations, datasource URL)
├── public/                 # Static assets
├── netlify/
│   └── edge-functions/     # e.g. GA tag injection at edge
├── netlify.toml            # Build command, edge function registration
├── next.config.js          # CSP, images, redirects
├── .env.example            # Documented env template (copy to .env)
└── package.json
```

### Important `lib/` modules

| Path | Purpose |
|------|---------|
| `lib/auth.ts` | `requireSession` / `requireRole` — verifies the Supabase cookie, resolves the caller's company role |
| `lib/prisma.ts` | Prisma client singleton — lazily constructed, node-postgres driver adapter, connection cap |
| `lib/crypto.ts` | AES encryption for passwords & OAuth tokens (`ENCRYPTION_SECRET`) |
| `lib/gmail/tokens.ts` | Gmail OAuth token storage & refresh |
| `lib/googleCalendar/visibility.ts` | Per-calendar show/hide for dashboard meetings |
| `lib/ga4Client.ts` | GA4 Data API auth (OAuth refresh token) |
| `lib/api/oauth.ts` | OAuth state-cookie helpers & shared Google client credentials |
| `lib/stripe.ts` | Stripe SDK instance |
| `lib/emailSender.ts` | SMTP sending for transactional mail (shared card shell + CTA helpers) |
| `lib/manus.ts` | Manus AI API (LinkedIn/outreach content) |
| `lib/gmail/dsn.ts` | RFC 3464 bounce (delivery-status) parsing — hard vs. transient failures |
| `lib/email/postmaster.ts` | Google Postmaster Tools: spam-complaint rate, domain reputation |
| `lib/email/panelApi.ts` | Shared client request handlers for the email panel (JSON, errors, query strings) |
| `lib/email/sanitize.ts` | Canonical sanitizer for rich email HTML |
| `lib/email/trackerDetection.ts` | Open-tracker/beacon detection in inbound HTML |
| `lib/batch.ts` | `mapInBatches` — bounded-concurrency helper for independent writes |
| `components/email/emailTheme.ts` | **Styling guide** for the email panel (surfaces, buttons, fields, chips) |
| `components/ui/BrandLoadingScreen.tsx` | Shared branded loading screen (login + email panel) |

---

## Getting started

### Prerequisites

- **Node.js** 18+ (20+ recommended)
- **PostgreSQL** database (local or hosted)
- Google Cloud project (OAuth for sign-in, Gmail, Calendar APIs as needed)
- Optional: Stripe account, GA4 property (`npm run connect-ga4`), SMTP credentials

### Install & run

```bash
git clone <repo-url>
cd Vierra-Website
npm install
cp .env.example .env
# Edit .env with your values (see Environment variables)

npx prisma generate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Database setup

```bash
# Apply migrations (production / shared DB)
npm run db:migrate

# Regenerate Prisma Client after schema changes
npm run db:generate
```

### Create a client user (script)

```bash
npm run create-client
```

---

## npm scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `next dev --turbopack` | Local development server (Turbopack) |
| `build` | `next build` | Production build |
| `start` | `next start` | Run production build locally |
| `lint` | `eslint .` | ESLint (flat config in `eslint.config.mjs`; `next lint` was removed in Next 16) |
| `test` | `vitest run` | Unit tests |
| `test:coverage` | `vitest run --coverage` | Unit tests with the coverage gate |
| `db:migrate` | `prisma migrate deploy` | Apply pending migrations |
| `db:generate` | `prisma generate` | Regenerate Prisma Client |
| `create-client` | `node scripts/create-client.js` | CLI to create a client account |
| `syncdb`, `envlocal`, `envprod` | `node scripts/…` | Local-only helpers. **The scripts they call are gitignored and not in the repo**, so these fail on a fresh clone — copy `.env.example` to `.env` instead |
| `connect-ga4` | `node scripts/connect-ga4.js` | OAuth setup for dashboard Website Visits chart |

Netlify production build (see `netlify.toml`):

```bash
npx prisma generate && npm run build
```

---

## Environment variables

Copy **`.env.example`** → **`.env`**. Never commit `.env`.

### Required for basic local dev

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Pooled PostgreSQL connection the app runs on (Supabase pooler, port 6543) |
| `DIRECT_URL` | Optional. Direct connection (port 5432) for schema work; `prisma.config.ts` falls back to `DATABASE_URL` when unset, so the CLI still runs either way. Set it if you have it — DDL belongs on a direct connection, not the pooler |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project, used by both the browser and server clients |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key for the writes a not-yet-affiliated user has no RLS path for (client backfill, invitation auto-accept). Server only |
| `NEXT_PUBLIC_APP_URL` | Canonical app origin (e.g. `http://localhost:3000`) |
| `ENCRYPTION_SECRET` | Base64 key for encrypting stored secrets |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth (login + Gmail) |

### Commonly needed

| Variable | Description |
|----------|-------------|
| `EMAIL_USER` / `EMAIL_PASS` | SMTP credentials (password reset, session links) |
| `FROM_EMAIL` / `FROM_NAME` | Default sender |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Billing & webhooks |
| `GA4_PROPERTY_ID` + `GA4_OAUTH_REFRESH_TOKEN` | Dashboard Website Visits chart (`npm run connect-ga4`) |
| `APP_URL` / `NEXT_PUBLIC_SITE_URL` | Base-URL fallbacks for cron and tracking-link builders |

### Integration-specific (optional)

| Variable | Used for |
|----------|----------|
| `LINKEDIN_*` | LinkedIn OAuth (personal + company apps) |
| `FACEBOOK_*` | Facebook Ads connect |
| `GOOGLEADS_*` | Google Ads connect |
| `MANUS_*` | Manus AI content generation |
| `ANSWER_THE_PUBLIC_BRIDGE_*` | External research bridge |
| `GOOGLE_VERIFICATION` | Google Search Console meta verification |
| `ANALYTICS_VALIDATE_URL` / `_KEY` / `_PROJECT_ID` | Self-hosted analytics licence check. Unset means `/api/analytics/validate` reports `not_configured` and makes no upstream call |
| `NETLIFY` | Set on Netlify; layout skips duplicate GA scripts (edge injects tag) |

### Email platform (cron, alerts, AI)

| Variable | Used for |
|----------|----------|
| `CRON_SECRET` | Shared secret guarding the scheduled-function endpoints (inbound poll, scheduled send, campaign queue, watch renew) via the `x-cron-secret` header |
| `NEXT_PUBLIC_SITE_URL` | Public origin for tracking pixel/click links, cron base URL, and Discord deep-links |
| `DISCORD_WEBHOOK_URL` | Optional — reply + high-intent signal alerts |
| `GMAIL_PUBSUB_TOPIC` | Optional — enables Gmail push (near-real-time inbound); the 5-min poller covers it when unset |
| `ANTHROPIC_API_KEY` / `ARTEMIS_*` | Optional — Artemis AI (compose/reply/summarize/auto-draft); stays dormant until set |

Full template with comments: [`.env.example`](./.env.example).

---

## Authentication & roles

- **Supabase Auth**; there is no NextAuth in this repo (`next-auth` is not a dependency)
- Providers: **Google** OAuth + email/password, both through Supabase
- The session cookie is verified per request by `requireSession` (`lib/auth.ts`), which hands the
  verified user to `resolveUser` (`lib/auth/resolveUser.ts`)
- `resolveUser` classifies the caller as a company `member`, a `client`, or `unaffiliated` using the
  `user_company_id()` / `user_company_role()` / `user_client_id()` SQL functions, so the panel role
  lives on the database rather than on a token
- API routes authorize with `requireRole(req, res, ["admin", "staff"])`, or the equivalent
  `requireSessionOrRespond401` + `requireRolesOrRespond403` guards in `lib/api/guards.ts`

| Role | Access |
|------|--------|
| `admin` | Full panel: clients, user management, email, signing, all sections |
| `staff` | Panel without Clients, User Management, PDF Signer; has Email Panel |
| `user` | Client portal at `/client` (files, outreach, context) |

**Route guards**

- `/panel` → `admin` or `staff` only (`pages/panel.tsx` `getServerSideProps`)
- `/client` → authenticated clients
- `/login` → public; redirects if already signed in

---

## Pages directory

Routes use **Pages Router** unless listed under **App Router**.

### App Router (`app/`)

| Route | File | Description |
|-------|------|-------------|
| `/` | `app/page.tsx` | Marketing homepage (3D hero, services, contact) |
| `/set-password` | `app/set-password/page.tsx` | Set password from an invite or recovery link (token arrives in the URL hash) |
| `/stripe/success` | `app/stripe/success/page.tsx` | Post-checkout success |
| `/sitemap.xml` | `app/sitemap.ts` | Dynamic sitemap |
| (404) | `app/not-found.tsx` | Not found UI |

Root layout: `app/layout.tsx` (fonts, metadata, GA on non-Netlify dev).

### Public & marketing (`pages/`)

| Route | File | Description |
|-------|------|-------------|
| `/login` | `pages/login.tsx` | Sign in (Google + credentials) |
| `/blog` | `pages/blog.tsx` | Blog index |
| `/blog/[slug]` | `pages/blog/[slug].tsx` | Blog post |
| `/blog/author/[name]` | `pages/blog/author/[name].tsx` | Posts by author |
| `/blog/tag/[tag]` | `pages/blog/tag/[tag].tsx` | Posts by tag |
| `/blog/rss.xml` | `pages/blog/rss.xml.ts` | RSS feed |
| `/terms-of-service` | `pages/terms-of-service.tsx` | Legal |
| `/privacy-policy` | `pages/privacy-policy.tsx` | Legal |
| `/work-policy` | `pages/work-policy.tsx` | Legal |
| `/404` | `pages/404.tsx` | Custom 404 |

### Authenticated portals

| Route | File | Who | Description |
|-------|------|-----|-------------|
| `/panel` | `pages/panel.tsx` | admin, staff | Main internal dashboard & tools |
| `/panel/email` | `pages/panel/email.tsx` | admin, staff | Full-screen email platform |
| `/panel/email/settings` | `pages/panel/email/settings.tsx` | admin, staff | Email account settings |
| `/client` | `pages/client.tsx` | client (`user`) | Client portal |
| `/connect` | `pages/connect.tsx` | clients | OAuth hub (Facebook, LinkedIn, Google Ads) |
| `/manage-users` | `pages/manage-users.tsx` | admin | User management UI |

### Onboarding, sessions & signing

| Route | File | Description |
|-------|------|-------------|
| `/onboarding/[token]` | `pages/onboarding/[token].tsx` | Client onboarding questionnaire |
| `/session` | `pages/session/index.tsx` | Session entry |
| `/session/[token]` | `pages/session/[token].tsx` | Platform connection session |
| `/session/onboarding/[token]` | `pages/session/onboarding/[token].tsx` | Multi-step onboarding session |
| `/sign/[tokenId]` | `pages/sign/[tokenId].tsx` | PDF signing for recipients |

### Utilities

| Route | File | Description |
|-------|------|-------------|
| `/files/preview` | `pages/files/preview.tsx` | File preview (authenticated) |

---

## API routes

All live under `pages/api/`. Unless noted, routes expect an authenticated session (admin/staff/client as appropriate).

### Auth & profile

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/auth/me` | Current session identity (member / client / unaffiliated) |
| POST | `/api/auth/setPassword` | Set password from an invite or recovery link |
| GET | `/api/profile/getUser` | Current user profile |
| GET | `/api/profile/getImage` | Profile image bytes |
| GET | `/api/profile/getSettings` | User settings |
| POST | `/api/profile/updateSettings` | Update settings (notifications, theme, language, 2FA, …) |
| POST | `/api/profile/updateName` | Update display name |
| POST | `/api/profile/uploadImage` | Upload avatar |
| POST | `/api/profile/changePassword` | Change password |
| POST | `/api/profile/updateActivity` | Presence / last active |

### Dashboard (panel home)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/dashboard/stats` | Aggregated dashboard metrics |
| GET | `/api/dashboard/upcoming-meetings` | Next meetings from Google Calendar (Gmail OAuth) |
| GET | `/api/dashboard/website-visits` | GA4 visit chart data |

### Deliverability

| Route | Purpose |
|-------|---------|
| `GET /api/email/domain-auth` | Live DNS check of SPF / DKIM / DMARC per sending domain |
| `GET /api/email/postmaster` | Google Postmaster Tools: spam rate, reputation, Gmail-observed auth pass rates |

Requires the `postmaster.readonly` OAuth scope (reconnect each mailbox after adding it) **and** each
domain verified at [postmaster.google.com](https://postmaster.google.com). Google publishes with a
1–2 day lag and only above a daily volume threshold, so an empty panel is often correct — the API
distinguishes "not authorized" from "no data" so the UI can say which.

### Gmail / email platform

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/gmail/initiate` | Start Gmail OAuth (+ Calendar scope) |
| GET | `/api/gmail/callback` | OAuth callback |
| GET | `/api/gmail/status` | Connection status |
| POST | `/api/gmail/delete` | Disconnect Gmail |
| GET | `/api/gmail/messages` | List messages |
| GET | `/api/gmail/message-detail` | Single message, with inline images resolved |
| POST | `/api/gmail/send` | Send email |
| POST | `/api/gmail/drafts` | Save draft |
| … | `/api/gmail/*` | Labels, threads, sync, contacts, signatures, templates, tracking, etc. |

See `pages/api/gmail/` and `pages/api/email/` for the full set. Beyond basic compose/send, the platform includes:

- **Open/click tracking** (per-account toggle) plus inbound **tracker-pixel detection** that flags trackers in received mail (Mailtrack, Yesware, HubSpot, Mixmax, Streak, Outreach, and ~50 others) — see `lib/email/trackerDetection.ts`
- **Campaigns / sequences** (`/api/campaigns/*`) — multi-step sends with per-campaign daily limits, DNC/blocked-sender skipping, retry caps, and a cron-driven send queue
- **Scheduled send** (`/api/gmail/scheduled/*`) — persisted and dispatched server-side by cron
- **Shared inboxes / delegation** (`/api/email/mailbox-grants`) — admins grant a teammate read/send access to a mailbox (fail-closed resolver in `lib/email/mailboxAccess.ts`)
- **Meeting booker** (`/api/booking/*`) — scheduling links backed by Google Calendar free/busy
- **Confidential mode** (`/c/[token]`) — the body is stored server-side behind a link with optional passcode + expiry
- **Filters, signatures, templates, vacation responder, snooze, blocked senders**, and a per-user **inbox layout** (`/api/gmail/nav-layout`) toggling which mailboxes appear in the nav

### Google Calendar

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/api/google-calendar/calendars` | List calendars & toggle visibility (uses Gmail OAuth) |

Calendar visibility is stored in `user_tokens` as `gcalvis:{email}::{calendarId}` (`lib/googleCalendar/visibility.ts`). Reconnect Gmail in settings to refresh Calendar access.

### Clients, files, blog, admin

| Area | Base path | Notes |
|------|-----------|--------|
| Clients | `/api/clients/*` | CRUD, outreach, context |
| Files | `/api/files/*` | Upload, download, delete |
| Blog | `/api/blog/*` | Posts for panel blog editor |
| Users | `/api/users/*` | Staff/admin user management |
| Contacts | `/api/contacts/*` | CRM-style contacts |
| Projects | `/api/projects/*` | Project boards & tasks |
| Marketing | `/api/marketing/*` | Tracker data |
| Signing | `/api/signing/*`, `/api/generateSignLink` | PDF signing workflows |
| Sessions | `/api/session/*` | Onboarding session tokens |

### OAuth integrations

| Platform | Paths |
|----------|--------|
| LinkedIn | `/api/linkedin/initiate`, `callback`, `status`, `delete`, `generate`, `context`, … |
| Facebook | `/api/facebook/initiate`, `callback`, `status`, `delete` |
| Google Ads | `/api/googleads/initiate`, `callback`, `status`, `delete` |

### Stripe & billing

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/stripe/webhook` | Stripe webhooks (raw body) |
| * | `/api/stripe/*` | Checkout, portal, payment methods |

### Other

| Path | Description |
|------|-------------|
| `/api/sendEmail`, `/api/sendSessionLinkEmail` | Transactional email |
| `/api/onboarding/saveAnswers`, `/api/onboarding/generateNdaLink` | Onboarding & NDA |
| `/api/email/track/open/[token]`, `/api/email/track/click/[token]` | Email open/click tracking |
| `/api/health` | Health check |
| `/api/analytics/validate` | Validate analytics setup |
| `/api/presets`, `/api/generateSignLink*` | Signing presets & links |

---

## Panel sections

Defined in `pages/panel.tsx` (`currentSection` index).

### Staff / admin mode

| # | Section | Component | Access |
|---|---------|-----------|--------|
| 0 | Dashboard | `DashboardSection` | all |
| 1 | Clients | `ClientsSection` | not `staff` |
| 2 | Staff Orbital | `TeamPanelSection` | all |
| 4 | LTV Calculator | `LtvCalculatorSection` | all |
| 5 | Marketing Tracker | `OutreachSection` | all |
| 6 | Project Tasks | `ProjectManagement` | all |
| 7 | Blog | `BlogEditorSection` | all |
| 8 | User Management | `AdminEditorSection` | not `staff` |
| 9 | PDF Signer | `SignPdfSection` | not `staff` |
| 10 | Files | `FilesSection` | all |
| 11 | Email Panel | `EmailingPlatformSection` | admin & staff |

Settings overlay: `UserSettingsPage` (profile, Gmail reconnect, **Detected Google Calendars** toggles).

### Client view mode (admin viewing a client)

| # | Section |
|---|---------|
| 0 | Dashboard |
| 1 | Files |
| 2 | Outreach |
| 3 | Context (LinkedIn) |

---

## Database (Prisma)

- Schema: `prisma/schema.prisma`
- CLI config: `prisma.config.ts` (Prisma 7 reads the schema path, migrations directory and datasource URL from here, not from the datasource block)
- Provider: **PostgreSQL**, through the `@prisma/adapter-pg` driver adapter — required as of Prisma 7
- Client: generated to `lib/generated/prisma` (gitignored; `predev` and the Netlify build regenerate it), imported as `@/lib/generated/prisma/client`, wrapped by the singleton in `lib/prisma.ts`

### Core models (high level)

| Model | Purpose |
|-------|---------|
| `User` | Staff/admin/client login (`role`, encrypted password) |
| `Client` | Client business record, Stripe fields, linked `User` |
| `PlatformToken` | Encrypted OAuth tokens (`gmail:`, `gcalvis:`, etc.) |
| `OnboardingSession` | Client onboarding flows |
| `StoredFile` | Uploaded files |
| `Contact`, `EmailOutboundMessage`, … | Email platform & CRM |
| `SignedDocuments` | PDF signing records |
| `MarketingTracker` | Marketing performance data |

### Migrations

```bash
npm run db:migrate     # prisma migrate deploy — safe, applies pending migrations only
npx prisma studio      # GUI browser
```

**Do not run `prisma db push` or `prisma migrate dev` against this database.** `schema.prisma` cannot express one constraint the database has — the `public.users.id -> auth.users.id` foreign key, because the `auth` schema model is `@@ignore`d — so both commands generate a migration that drops it. Schema changes are applied directly and recorded as SQL in `prisma/manual/`. The `db:push` script was removed for this reason.

Schema changes are applied **out-of-band** as hand-written SQL in `prisma/manual/*.sql`:

```bash
npx prisma db execute --file prisma/manual/<name>.sql
```

(no `--schema` flag — Prisma 7 removed it; the schema path comes from `prisma.config.ts`.)

Then mirror the change into `schema.prisma` and run `prisma generate`. `prisma/manual/` is the real change record: the email-platform tables (tracking, campaigns, bookings, mailbox grants, nav preferences, account settings) all arrived this way, as did the unique indexes and the enum-type cleanup.

`prisma/migrations/` is **baselined pre-v2 history**. Every folder is recorded as applied, so `migrate deploy` reports nothing pending, but the contents do not describe the live schema — they reference tables the v2 redesign dropped. Do not expect to replay them.

---

## Key integrations

### Google (Sign-in, Gmail, Calendar)

- **Sign-in**: `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, exchanged by Supabase Auth
- **Gmail panel**: OAuth through `/api/gmail/initiate` → stores tokens in `PlatformToken` with platform key `gmail`
- **Upcoming meetings**: Uses same Gmail-connected tokens + Calendar API; only events with meeting links; respects per-calendar visibility toggles in settings

### Google Analytics

- **Site tag**: configured via `NEXT_PUBLIC_GA_MEASUREMENT_ID` — loaded via `next/script` (`afterInteractive`) in `app/layout.tsx` (app router) and `pages/_app.tsx` (pages router), so the tag is part of React's tree and hydration-safe on every environment
- **Dashboard Website Visits**: `GA4_PROPERTY_ID` (numeric property ID) + `GA4_OAUTH_REFRESH_TOKEN` from `npm run connect-ga4`

### Stripe

- Client subscriptions and payment methods on `Client` model
- Webhook: `/api/stripe/webhook` with `STRIPE_WEBHOOK_SECRET`

### Email

- **SMTP**: password resets, session links (`lib/emailSender.ts`)
- **Gmail API**: panel compose, sync, tracking (`pages/api/gmail/*`)

---

## Testing

Unit tests run on pure, import-safe modules only (no Next server, Prisma, or network — DB and
`fetch` are mocked where needed).

```bash
npm run test              # run the suite
npm run test:coverage     # run with the coverage gate
```

- Specs live in `tests/*.test.ts`.
- `vitest.config.mts` scopes the coverage `include` list to modules that actually have tests, so the
  threshold is a real gate rather than being diluted toward zero by the whole app. **Add new modules
  to that list as their specs land** — otherwise they are not protected by the gate.
- CI (`.github/workflows/ci.yml`) runs `npm ci` → `prisma generate` → `tsc --noEmit` →
  `eslint .` → `test:coverage`. The required checks on `master` are `quality` and `ensure-CC`.
- **Run `npx prisma generate` after pulling a schema change.** The client is generated to
  `lib/generated/prisma`, which is gitignored, so a fresh clone has no client until you do.

### Two gotchas

- **Don't hand-edit `jsx` in `tsconfig.json`.** Next rewrites that key on every build and lint
  because it compiles JSX itself, and which value it writes depends on the version — 15 forced
  `preserve`, 16 forces `react-jsx`. Anything else you commit is reverted under you. tsconfig
  therefore stores whatever the installed Next enforces, and Vitest owns its own JSX transform via
  `oxc` in `vitest.config.mts` — don't make the test runner depend on the tsconfig value again.
- **Run `npx prisma generate` after pulling a schema change**, or `tsc` fails locally against a
  stale client while CI (which always regenerates) passes.

---

## Deployment (Netlify)

- Config: [`netlify.toml`](./netlify.toml)
- Build: `npx prisma generate && npm run build`
- Publish: `.next` (Next.js Netlify plugin)
- Set all production env vars in the Netlify UI (mirror `.env.example`)
- `NEXT_PUBLIC_APP_URL` must match the deployed origin (e.g. `https://vierradev.com`)
- `DIRECT_URL` is optional everywhere: the Netlify build only runs `prisma generate`, and `prisma.config.ts` falls back to `DATABASE_URL` for migrations

### Build minutes

Netlify bills per build minute in **every** context, and runs a deploy preview on each push to each
open PR, so two controls exist:

- **[`netlify-ignore.sh`](./netlify-ignore.sh)** (wired via `ignore` in `netlify.toml`) skips the
  build when every changed path is non-deployable (tests, CI config, docs). It **fails open** —
  anything it doesn't recognise still builds.
- **`plugins/warm-blog-cache`** warms the blog ISR cache post-deploy. It runs inside the billed
  build, so it is capped (newest 8 posts, 4 concurrently); anything unwarmed regenerates on first
  visit.

Avoid reintroducing dynamic `fs`/`path` access in API routes without a static prefix or a
`/*turbopackIgnore: true*/` annotation — Turbopack otherwise traces the **whole project** into the
server bundle, inflating every deploy.

### Scheduled functions (cron)

Was 9 Netlify Scheduled Functions in `netlify/functions/`, one per cadence — moved to Supabase
`pg_cron` + `pg_net` (see `prisma/manual/20260901_migrate_cron_to_pg_cron.sql`) after they hit
Netlify's scheduled-function invocation limit. Each cron job POSTs its paired API route, guarded
by `CRON_SECRET` (pulled from Supabase Vault at call time, never committed):

| Job (`cron.job.jobname`) | Cadence | Triggers |
|----------|---------|----------|
| `poll-inbound` | every 5 min | inbound processing — filters, vacation reply, auto-draft, read receipts, snooze resurfacing, reply/signal Discord alerts |
| `dispatch-scheduled-email` | every 1 min | sends due scheduled mail |
| `dispatch-campaign-queue` | every 5 min | advances active campaign sequences |
| `gmail-watch-renew` | daily | re-registers Gmail push (no-op unless `GMAIL_PUBSUB_TOPIC` is set) |
| `sync-upcoming-meetings` | every 5 min | caches the dashboard's upcoming-meetings list |
| `sync-meeting-attendance` | hourly | reconciles meeting attendance |
| `send-meeting-reminders` | hourly | sends ~24h-out meeting reminder emails |
| `purge-meeting-pii` | daily 03:00 UTC | 1-year meeting-PII retention sweep |
| `auto-assign-meetings` | every 5 min | round-robin fallback for unclaimed team booking slots |

Inspect/rotate: `select * from cron.job order by jobname;` and
`select * from cron.job_run_details order by start_time desc limit 20;` in the Supabase SQL
editor. Rotating `CRON_SECRET` requires updating both the app env var and the Vault secret
(`select vault.update_secret(id, '<new value>') from vault.secrets where name = 'cron_secret';`).

A quick health check (idempotent): `curl -s -X POST -H "x-cron-secret: <CRON_SECRET>" https://vierradev.com/api/gmail/inbound/dispatch` → expects `{"ok":true,...}`.

### Content Security Policy

`next.config.js` defines CSP allowlists for Google Analytics, fonts, images, and API origins. Update when adding new third-party scripts.

---

## Security notes

**Secrets**
- Keep `.env` out of git. Rotate `SUPABASE_SERVICE_ROLE_KEY` and `ENCRYPTION_SECRET` if leaked.
- Passwords and OAuth tokens are encrypted with `lib/crypto.ts` (`ENCRYPTION_SECRET`).
- The IndexNow key in `lib/indexnow.ts` is **public by design** — it must match the file served at
  `/<key>.txt`, which is how IndexNow proves domain ownership. It is not a leak.

**Authorization**
- `proxy.ts` deliberately does **not** match `/api/`, so every API route is responsible for its own
  authorization. There is no blanket guard to fall back on.
- Session routes use `requireRole(req, res, ["admin", "staff"])` from `lib/auth.ts`, or the
  `requireSessionOrRespond401` / `requireRolesOrRespond403` pair in `lib/api/guards.ts`. Those guards
  throw a `__handled__` sentinel that `handleApiError` swallows, which is why callers legitimately
  do not `return` after them.
- Cron dispatch routes are gated on `CRON_SECRET` compared with `safeCompare` (timing-safe); the
  scheduler side (Supabase `pg_cron`) fetches that secret from Vault rather than embedding it.
- The browser extension authenticates with `EXTENSION_TRACK_TOKEN`; it cannot use the session cookie
  cross-origin.
- Admin endpoints scope every lookup by `company_id` to prevent cross-tenant reads. See
  `tests/adminAuthz.test.ts`, which pins that on the representative case.

**Untrusted input**
- Email HTML is rendered through `sanitizeRichEmailHtml`. The public confidential viewer
  (`/c/[token]`) additionally passes `restrictStyles`, because an inline `background:url(...)` would
  otherwise beacon the viewer's IP on render.
- Structured data goes through `jsonLd()` (`lib/jsonLd.ts`), which escapes `<` so panel-authored
  content cannot close a `<script type="application/ld+json">` block early.
- Public form submissions are normalized and length-limited server-side
  (`lib/publicFormValidation.ts`, `lib/careerApplicationValidation.ts`), with a honeypot and per-IP
  rate limiting. The client and server share the same rules so the UI cannot be bypassed.
- Values interpolated into generated email HTML are escaped with `escapeHtml` (`lib/utils.ts`).
- `/api/careers/apply-chunk` restricts its upload target to the exact Google Drive resumable
  endpoint, so it cannot be used as a request proxy.
- The markdown mirror resolves paths through a `STATIC_PAGES` allowlist rather than joining URL
  segments onto a directory.

**Rate limiting** — `lib/rateLimit.ts` is in-memory and per-instance, so it is a soft limit under
scaled-out concurrency, not a hard guarantee. Applied to the audit form, career applications,
confidential-link unlock, and blog view counting. For a hard guarantee, back it with Redis or a
Netlify rate-limiting rule.

**Transport & headers** — CSP, HSTS, `Referrer-Policy`, `Permissions-Policy`, `X-Content-Type-Options`
and `X-Frame-Options` are set in `next.config.js`; HSTS is repeated in `netlify.toml` for static files
that bypass the app. Keep the CSP allowlist minimal — every host in `script-src` is a place a
compromised CDN could serve executable code from.

**Cookies** — the onboarding cookie is `httpOnly`, `sameSite=lax`, `secure` in production, path-scoped
and expiring.

**Webhooks** — Stripe verifies its signature with `STRIPE_WEBHOOK_SECRET`.

**Dependencies** — run `npm audit` periodically; the lockfile is committed. Note that `prisma` (a
devDependency) currently pulls a high-severity `deepmerge-ts` advisory through `@prisma/config`. It is
build-time only and npm's suggested "fix" is a major downgrade, so it is knowingly accepted.

---

## Contributing

1. Branch from `main`
2. Run `npm run lint` and `npm run build` before opening a PR
3. Include Prisma migrations for schema changes when possible
4. Do not commit credentials or `.env`

---

## License

Proprietary — Vierra. All rights reserved unless otherwise noted in the repository.
