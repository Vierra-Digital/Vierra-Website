# Vierra Website

Full-stack marketing site, internal **admin/staff panel**, **client portal**, email platform (Gmail), document signing, onboarding flows, and integrations (LinkedIn, Facebook, Google Ads, Stripe). Built with **Next.js 15** (App Router + Pages Router), **PostgreSQL** via **Prisma**, **NextAuth**, deployed on **Netlify** (`vierradev.com` / production marketing domain `vierra.com`).

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
12. [Deployment (Netlify)](#deployment-netlify)
13. [Security notes](#security-notes)

---

## Tech stack

| Layer | Technology |
|--------|------------|
| Framework | Next.js 15 (hybrid App Router + Pages Router) |
| Language | TypeScript |
| UI | React 19, Tailwind CSS, Framer Motion, Radix UI |
| Auth | NextAuth.js (credentials + Google OAuth) |
| Database | PostgreSQL + Prisma ORM |
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
│   └── schema.prisma       # Database schema
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
| `lib/auth.ts` | NextAuth options, session helpers |
| `lib/prisma.ts` | Singleton Prisma client |
| `lib/crypto.ts` | AES encryption for passwords & OAuth tokens (`ENCRYPTION_SECRET`) |
| `lib/gmail/tokens.ts` | Gmail OAuth token storage & refresh |
| `lib/googleCalendar/visibility.ts` | Per-calendar show/hide for dashboard meetings |
| `lib/ga4Client.ts` | GA4 Data API auth (OAuth refresh token) |
| `lib/api/oauth.ts` | OAuth state-cookie helpers & shared Google client credentials |
| `lib/stripe.ts` | Stripe SDK instance |
| `lib/emailSender.ts` | SMTP sending for transactional mail |
| `lib/manus.ts` | Manus AI API (LinkedIn/outreach content) |

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

# Or push schema in dev (no migration history)
npm run db:push

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
| `lint` | `next lint` | ESLint |
| `db:migrate` | `prisma migrate deploy` | Apply pending migrations |
| `db:generate` | `prisma generate` | Regenerate Prisma Client |
| `db:push` | `prisma db push` | Sync schema without migration files |
| `syncdb` | `node scripts/sync-db.js` | DB sync helper (requires script in repo) |
| `envlocal` | `node scripts/generate-env.js local` | Env generator (requires `scripts/generate-env.js`) |
| `envprod` | `node scripts/generate-env.js prod` | Env generator for production |
| `create-client` | `node scripts/create-client.js` | CLI to create a client account (requires script in repo) |
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
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_URL` | Canonical app URL (e.g. `http://localhost:3000`) |
| `NEXTAUTH_SECRET` | Random secret for JWT/session signing |
| `ENCRYPTION_SECRET` | Base64 key for encrypting stored secrets |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth (login + Gmail) |

### Commonly needed

| Variable | Description |
|----------|-------------|
| `EMAIL_USER` / `EMAIL_PASS` | SMTP credentials (password reset, session links) |
| `FROM_EMAIL` / `FROM_NAME` | Default sender |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Billing & webhooks |
| `GA4_PROPERTY_ID` + `GA4_OAUTH_REFRESH_TOKEN` | Dashboard Website Visits chart (`npm run connect-ga4`) |
| `NEXT_PUBLIC_APP_URL` / `APP_URL` | Public/base URL fallbacks |

### Integration-specific (optional)

| Variable | Used for |
|----------|----------|
| `LINKEDIN_*` | LinkedIn OAuth (personal + company apps) |
| `FACEBOOK_*` | Facebook Ads connect |
| `GOOGLEADS_*` | Google Ads connect |
| `MANUS_*` | Manus AI content generation |
| `ANSWER_THE_PUBLIC_BRIDGE_*` | External research bridge |
| `GOOGLE_VERIFICATION` | Google Search Console meta verification |
| `NETLIFY` | Set on Netlify; layout skips duplicate GA scripts (edge injects tag) |

Full template with comments: [`.env.example`](./.env.example).

---

## Authentication & roles

- **NextAuth** entry: `pages/api/auth/[...nextauth].ts`
- Providers: **Google** + **credentials** (email/password for staff/clients)
- Session strategy: JWT; user `role` stored on token

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
| `/set-password/[token]` | `app/set-password/[token]/page.tsx` | Set password from email link |
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
| * | `/api/auth/[...nextauth]` | NextAuth handlers |
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

### Gmail / email platform

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/gmail/initiate` | Start Gmail OAuth (+ Calendar scope) |
| GET | `/api/gmail/callback` | OAuth callback |
| GET | `/api/gmail/status` | Connection status |
| POST | `/api/gmail/delete` | Disconnect Gmail |
| GET | `/api/gmail/messages` | List messages |
| GET | `/api/gmail/message` | Single message |
| POST | `/api/gmail/send` | Send email |
| POST | `/api/gmail/drafts` | Save draft |
| … | `/api/gmail/*` | Labels, threads, sync, contacts, signatures, templates, tracking, etc. |

See `pages/api/gmail/` for the full set (compose, blocked senders, provider accounts, open/click tracking).

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
- Provider: **PostgreSQL**
- Client: `@prisma/client` via `lib/prisma.ts`

### Core models (high level)

| Model | Purpose |
|-------|---------|
| `User` | Staff/admin/client login (`role`, encrypted password) |
| `Client` | Client business record, Stripe fields, linked `User` |
| `UserToken` | Encrypted OAuth tokens (`gmail:`, `gcalvis:`, etc.) |
| `OnboardingSession` | Client onboarding flows |
| `StoredFile` | Uploaded files |
| `Contact`, `EmailOutboundMessage`, … | Email platform & CRM |
| `SignedDocuments` | PDF signing records |
| `MarketingTracker` | Marketing performance data |

### Migrations

```bash
npx prisma migrate dev --name describe_change   # local dev
npm run db:migrate                               # deploy
npx prisma studio                                # GUI browser
```

If `migrate dev` fails on shadow DB issues, `db:push` can sync schema in development (coordinate with team before using in production).

---

## Key integrations

### Google (Sign-in, Gmail, Calendar)

- **Sign-in**: `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` via NextAuth
- **Gmail panel**: OAuth through `/api/gmail/initiate` → stores tokens in `UserToken` with platform key `gmail`
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

## Deployment (Netlify)

- Config: [`netlify.toml`](./netlify.toml)
- Build: `npx prisma generate && npm run build`
- Publish: `.next` (Next.js Netlify plugin)
- Set all production env vars in the Netlify UI (mirror `.env.example`)
- `NEXTAUTH_URL` must match the deployed origin (e.g. `https://vierradev.com`)

### Content Security Policy

`next.config.js` defines CSP allowlists for Google Analytics, fonts, images, and API origins. Update when adding new third-party scripts.

---

## Security notes

- **Secrets**: Keep `.env` out of git; rotate `NEXTAUTH_SECRET` and `ENCRYPTION_SECRET` if leaked
- **Encryption**: Passwords and OAuth tokens encrypted with `lib/crypto.ts` (`ENCRYPTION_SECRET`)
- **Webhooks**: Stripe webhook verifies signature with `STRIPE_WEBHOOK_SECRET`
- **Panel routes**: Protected with `getServerSideProps` + role checks
- **Dependencies**: Run `npm audit` periodically; lockfile pinned in `package-lock.json`

---

## Contributing

1. Branch from `main`
2. Run `npm run lint` and `npm run build` before opening a PR
3. Include Prisma migrations for schema changes when possible
4. Do not commit credentials or `.env`

---

## License

Proprietary — Vierra. All rights reserved unless otherwise noted in the repository.
