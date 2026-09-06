# Role model redesign: admin / staff / client

## v2 (2026-09-05): Vierra-only staff, client businesses flattened

**Status: scoping only, nothing implemented.** This supersedes the v1 design below — the
`is_owner` bit and `prisma/manual/20260827_role_model_admin_staff_client.sql` should **not** be
applied as-is; there's no more per-tenant ownership left to express once tenants stop having their
own staff (see below). Also worth flagging: despite v1's Status note below claiming the code side
was done, this checkout's actual `lib/auth/resolveUser.ts` and `prisma/schema.prisma` still show
the pre-v1 shape (no `is_owner` anywhere in either) — that work either never landed on this branch
or was reverted. Don't trust v1's "implemented in code" claim without re-verifying.

**Motivation.** v1 kept the current architecture's premise that any business can self-onboard and
run its own team (`company_memberships` per tenant, `role: "admin"` for whoever onboarded it). In
practice Vierra is the only real tenant — client businesses don't need their own login-driven staff
hierarchy; their people only need flat portal access to their own account.

**Target model:**

| Tier | Backing | Scope |
|---|---|---|
| `admin` | `company_memberships.role = "admin"` | Full perms: financials, management, everything. Today, in practice, exactly two people (Alex, Michael) — set only via direct database access, never through the app |
| `staff` | `company_memberships.role = "staff"` | The rest of Vierra's own team (e.g. Hao, Stefan) — standard staff perms, no financials/management |
| `client` | today's `Company` model, repurposed | A business created via onboarding (see below), no own staff hierarchy |
| representative | today's `Client` model | Flat portal user under a client business, linked by `company_id`. Truly flat — no owner/primary-contact bit, identical permissions for every representative of the same client |

**`users.is_platform_admin` is discontinued (2026-09-06).** The original plan (below) used this
boolean as the sole admin/staff signal, with `company_memberships.role` reduced to a vestigial
label. That's reversed: `is_platform_admin` is no longer read or written anywhere in the app —
`company_memberships.role` is authoritative for "admin" vs. "staff" again, exactly like the
pre-v1 model, except now every row lives under Vierra's one fixed company (see below) and "admin"
is still never settable through any UI or API — only ever set directly against the database for
Michael's and Alex's rows. The column stays in the schema (not dropped — that's a real schema
change, out of scope for a data migration) but every app-code reference to it is gone
(`lib/auth/resolveUser.ts`, `pages/api/admin/users.ts`, `components/PanelPages/AdminEditorSection.tsx`).
The "Superadmin" naming cleanup below still applies to "admin" generally, just not tied to that
specific column anymore. The admin/staff split's *enforcement* (financials, management screens
gated to admin-only, not just any staff) isn't built yet — there's no finance-facing API route
today (`FinanceEntry` only exists as a model + migration), so this is a forward-looking gate to
add when that surface is built, not a regression to fix now.

**"Superadmin" naming goes away.** A few places (`pages/api/admin/users.ts`'s comments/error
messages, an `AdminEditorSection.tsx` tooltip) colloquially called the top tier "Superadmin" as if
it were a level above "admin." It isn't a separate tier — it's what "admin" *is*. Renamed to
"Admin" throughout.

**Multiple representatives per client company — confirmed, concrete requirement.** Example given:
Exactus needs two different people to log in and see the same campaigns/events/etc. This is exactly
the flat-representative model above — two `Client` rows sharing one `company_id`. What still needs
building: the actual invite/link mechanism for adding a *second* representative to an
*already-onboarded* client company (see resolved open question below).

**One onboarding module per company.** Running onboarding again for someone who should join an
*existing* client company is the wrong flow — onboarding creates exactly one client-business record
per company, the first time. A second (or third) person joining that same business must go through
an invite/link path that attaches a new representative row to the existing `company_id`, never a
second onboarding pass that would create a duplicate company.

**Onboarding stays, but creates a client + a representative, not a membership.**
Self-onboarding (`pages/api/onboarding/create-company.ts`) is **not removed** — a business still
signs itself up. What changes is what that flow writes: instead of a `Company` row plus a
`company_memberships` row (`role: "admin"`) for the onboarding user, it creates a client-business
row (today's `Company` table, repurposed) plus one representative row (today's `Client` table) for
the onboarding user, `user_id`-linked the same way `Client` already supports. Additional people
join the same client company as more representative rows (e.g. via an invite flow that targets the
`Client`/representative shape, not `company_memberships`) — multiple people can access one client
company, all flat, none more privileged than another.

**Nice side effect:** `lib/auth/resolveUser.ts` already tries the `company_memberships` branch
(`kind: "member"`) before the `clients` branch (`kind: "client"`). Once onboarding and invites stop
writing `company_memberships` rows for anything but Vierra's own team, that function needs
little-to-no change — every client-business representative already falls through to the existing
`kind: "client"` path today. The real work is in the write paths (onboarding, invites) and the ~31
files gating on `role`/`company_memberships` under the old assumption that "a company member" meant
"that business's own staff."

**What goes away:**
- `company_memberships` rows for anything other than Vierra's own team — a client business's
  people never get a `company_memberships` row; they only ever exist as `Client`/representative
  rows, from onboarding onward.
- The v1 `is_owner` bit — with no per-client ownership left to express (representatives are
  flat), it has nothing to attach to.

**Entity mapping (old -> new):**

| Old | New |
|---|---|
| `Company` (self-onboarded tenant) | Client-business record (same table; rename is cosmetic, not urgent) |
| `CompanyMembership` (per-tenant staff) | Only ever Vierra's own team now — effectively single-tenant |
| `Client` (a tenant's own leads/customers) | Representative (flat portal user under a client business, same `company_id` link) |
| `company_memberships.role = "admin"` (tenant owner, set by onboarding) | Gone — onboarding now creates a representative row instead |

**Open questions — need answers before any schema/code work starts:**
1. Does `company_memberships` keep a `company_id` column pointed at one fixed "Vierra" row, or
   drop `company_id` entirely and become a flat `role` + `user_id` table?
2. Migration of already-onboarded businesses: today's self-onboarded "admin" `company_memberships`
   rows need converting into representative (`Client`) rows for the same `company_id` — auto-script
   or manual, and does the existing `clients` table need a not-null-`user_id` backfill path for
   these (today's schema already tolerates a null `user_id`, per `resolveUser`'s "unlinked client"
   fallback, so this may already have a working seam)?
3. **Resolved:** invitations for a second/third representative reuse the existing `invitations`
   table (it already has `company_id`/`email`/`role`/`expires_at`) rather than a new table — but the
   acceptance branch in `resolveUser.ts` (and wherever invites are created,
   e.g. `pages/api/admin/invitations/index.ts`) needs a discriminator so accepting one creates a
   `Client`/representative row for a client-company invite, vs. a `company_memberships` row for a
   Vierra-hiring invite. Simplest option: an invite targeting a client `company_id` always means
   "representative," an invite targeting Vierra's own fixed company id always means "staff" — no new
   column needed if that fixed id is known at the call site. Still needs deciding at implementation
   time: does the invite-sender need to pick a role at all (no — client invites are always flat
   representative, Vierra invites are always staff-or-admin-by-flag), and what UI surfaces "invite a
   teammate to this client account" for an existing representative to use.
4. **Resolved: yes.** Everything currently hung off `Company` (campaigns, booking links, email
   provider accounts, project boards, Artemis runs, invitations, login attempts, marketing tracker,
   stored files, signed documents, finance entries) stays owned by the client-business record —
   it's per-account data, tied to the client, not to Vierra.
5. **Blast radius, checked directly against this repo (2026-09-05):** 31 files reference literal
   `role` values (`"admin"`/`"staff"`/`"member"`/`"user"`), 82 reference `companyId`, 32 touch
   `company_memberships` directly, 23 touch the `clients` table. This reaches nearly every panel
   auth gate, the onboarding flow, and the RLS policies backing `resolveUser`'s RPCs — it is not a
   small follow-up, it's its own project, larger than v1's already-undersold 25-file sweep.

**#1 resolved — staff get a fixed Vierra `company_id`; every Vierra member can reach every client's
data.** This is the bigger of the two options laid out above (not "assigned to one client at a
time"). Concrete consequences, since this is where the real work is:

- A real `companies` row for Vierra itself needs to exist. Every `company_memberships` row — every
  Vierra staff/admin account — points at that one row, permanently. `session.companyId` for a
  `kind: "member"` session is therefore *always* Vierra's own id, never a client's.
- Every one of the ~82 `companyId`-scoped reads/writes (campaigns, booking links, project boards,
  etc.) currently assumes "the caller's own `session.companyId` is whose data this is." That
  assumption breaks entirely for staff: their `companyId` no longer identifies a client, so it can't
  be the thing routes filter by anymore. Each of those routes needs to accept an **explicit target
  client `company_id`** (a route param or query param naming which client's campaigns/booking-links/
  etc. are being requested) instead of implicitly trusting `session.companyId` — with an
  authorization check that a `kind: "member"` session may target *any* client's `company_id` (per
  "all Vierra members can access client companies" — no per-staff assignment/restriction), while a
  `kind: "client"` (representative) session may only ever target its own `company_id`.
- This also means the panel UI needs a "which client am I currently working on" concept for staff —
  a client picker/switcher — since there's no longer an implicit single answer. Not designed yet;
  needed before the API changes above can be exercised end-to-end.
- This is the single largest piece of new work in this redesign — larger than the write-path
  changes (onboarding/invites) or the migration script below, since it touches the shape of nearly
  every data-scoped panel route, not just who's allowed to call them.

**#2 resolved — auto-migrate, keyed by email domain.** A `company_memberships` row belongs to
Vierra's own team if and only if the user's email ends in `@vierradev.com`; every other row is a
client business's own person and gets converted. Concretely, the one-time migration script does,
per existing `company_memberships` row:
- **`@vierradev.com` email:** re-point this row at the new fixed Vierra `company_id` (create it if
  it doesn't already point there), setting `role = "admin"` directly — confirmed at migration time
  that every existing `@vierradev.com` account today is an admin, so there's no separate staff
  tier to preserve yet. A future hire invited through the app still lands as `"staff"` by default
  (`pages/api/admin/invitations/index.ts`) — `"admin"` remains something only ever set directly
  against the database, never through the app.
- **Any other email:** create a `Client`/representative row for the same `(user_id, company_id)`
  pulling `name`/`email` from `users`, then remove the `company_memberships` row. No email-domain
  check needed here beyond "not vierradev.com" — every non-Vierra membership today is, by
  construction, someone at a self-onboarded client business.
- No manual company-by-company judgment call needed — the email domain is a clean, mechanical
  discriminator for the whole existing dataset.

## v1: admin / staff / client (is_owner bit)

## Status
Implemented in code (schema, resolveUser, and all downstream call sites below).
**Not yet applied to the database** — `prisma/manual/20260827_role_model_admin_staff_client.sql`
still needs to be run against Supabase (after the pre-flight check it documents), followed by
`npx prisma generate` to pick up the new `is_owner` column in the Prisma client types.

**Superseded by v2 above as of 2026-09-05** — kept here for history, not as the current plan.

The downstream-impact list below undersold the actual blast radius: a repo-wide sweep for
`role === "admin"` turned up 25 files, not the ~7 originally listed. All 25 were checked; the
ones that were genuinely "company owner" gates were switched to `isPlatformAdmin || isOwner`
(schema, `pages/api/admin/*`, `pages/api/project/*`, `pages/api/booking/[id]/*`,
`pages/api/email/mailbox-grants.ts`, `pages/api/campaigns/send-queue/tick.ts`,
`components/PanelPages/{AdminEditorSection,TeamPanelSection,ProjectManagement}.tsx`,
`pages/panel.tsx`'s nav gating, `pages/manage-users.tsx`). The rest were "is any team member"
checks (`role !== "admin" && role !== "staff"` or `["admin","staff"]` role lists) that need no
change, since `"staff"` alone already covers every company member post-migration.

Two things were added beyond the original schema section below: `invitations.is_owner` (mirrors
`company_memberships.is_owner`, so accepting a pending invite can't reintroduce `role = "admin"`
into `company_memberships`), and a new `user_is_owner()` SQL function (parallel to the existing
`user_company_role()` RPC) for `resolveUser` to read the bit through.

## Motivation
The identity model currently has three overlapping, inconsistently-named
concepts instead of one clean hierarchy:

1. `users.is_platform_admin` (bool) — a Vierra superadmin flag, orthogonal to
   any company membership, granting cross-company visibility.
2. `company_memberships.role` (string: `"admin" | "staff" | "user"`) — scoped
   to one company. `"admin"` is granted to whoever self-onboards a company
   (`pages/api/onboarding/create-company.ts`) and lets them manage that
   company's team. `"user"` is a dead value: no code path ever writes it, but
   it's still shown in UI dropdowns labeled "Client", which is misleading
   since it has nothing to do with the actual `clients` table.
3. `clients` (table) — the real external client-portal identity
   (`resolveUser`'s `kind: "client"`), entirely separate from
   `company_memberships`.

This makes "admin" mean two different things (Vierra staff vs. a client
company's own owner) depending on context, and gives "client" two different,
unrelated meanings (a dead membership-role value vs. the real `clients`
table). The fix is to make the three tiers line up 1:1 with the three real
populations:

- **admin** = Vierra, global, cross-company.
- **staff** = people who work at an onboarded (client) company.
- **client** = the people that staff reach out to — the client's own
  customers/leads, with portal logins.

## Target model

| Tier | Backing | Scope |
|---|---|---|
| `admin` | `users.is_platform_admin = true` | Global, cross-company (mechanism unchanged) |
| `staff` | a row in `company_memberships` | Per-company. `is_owner: Boolean` marks the company's own team-manager (today's de facto "client admin") |
| `client` | a row in `clients` | Already the external portal identity (`resolveUser`'s `kind: "client"`) — no schema change needed |

`is_platform_admin` stays as the sole mechanism for the `admin` tier — it
already fits the "global, not tied to one company" shape that
`company_memberships` can't express (that table requires a `company_id`).

Within a company, the old `role: "admin"` (company owner) collapses into
`staff` plus a new `is_owner` bit, so "admin" no longer means anything
company-scoped — only Vierra is `admin`.

The `clients` table already is the third tier; nothing about its shape
changes. What changes is that `company_memberships.role = "user"` (the dead,
confusingly-labeled "Client" value) goes away, so there's exactly one place
in the schema that means "client."

## Schema change

```prisma
model CompanyMembership {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  company_id String   @db.Uuid
  user_id    String   @unique(map: "one_company_per_user") @db.Uuid
  role       String   @default("staff")   // no longer ever "admin" or "user"
  is_owner   Boolean  @default(false)     // NEW — per-company team-manager bit
  position   String?
  ...
}
```

No changes to `users.is_platform_admin` or the `clients` table.

## Data migration

1. `ALTER TABLE company_memberships ADD COLUMN is_owner boolean NOT NULL DEFAULT false;`
2. `UPDATE company_memberships SET is_owner = true WHERE role = 'admin';`
3. `UPDATE company_memberships SET role = 'staff';`
4. Pre-flight check: confirm no live rows have `role = 'user'` before running
   step 3 — none should exist (no code path creates them), but if any do,
   they need a manual decision (most likely: they were meant to be rows in
   `clients`, not `company_memberships`) rather than silently collapsing into
   `staff`.

## Downstream code impact (not yet done)

- `pages/api/onboarding/create-company.ts:48` — insert
  `{ role: "staff", is_owner: true }` instead of `role: "admin"`.
- `lib/auth/resolveUser.ts` — `kind: "member"` needs to also return
  `isOwner: boolean` alongside `role`/`isPlatformAdmin`.
- Every route currently gated `roles: ["admin"]` to mean *"this company's
  owner"* needs to switch to `isPlatformAdmin || isOwner`:
  - `pages/api/admin/invitations/index.ts`, `pages/api/admin/invitations/[id].ts`
  - `pages/api/admin/clients.ts`
  - `pages/manage-users.tsx`
  - `components/PanelPages/TeamPanelSection.tsx` (add/edit/remove staff gating)
  - relevant parts of `pages/api/admin/users.ts`
  - Routes already gated `roles: ["admin", "staff"]` need **no change** —
    staff is already included in that set.
- UI: role dropdowns (`components/PanelPages/AdminEditorSection.tsx`, the
  team invite modal in `TeamPanelSection.tsx`) drop `admin`/`user` as
  assignable values for company members — replaced by an "Owner" toggle on
  the `staff` row.
- `SessionRole` types (`lib/auth.ts`, `lib/api/withAuth.ts`,
  `lib/linkedin*.ts`, several `pages/api/linkedin/*.ts`,
  `pages/api/context/client.ts`) stay `"admin" | "staff"` — no type change,
  just a semantic narrowing of what `"admin"` means at the company level
  (nothing, now — only global).

## Open questions for implementation time
- Should `company_memberships.role` be dropped entirely once it's always
  `"staff"`, or kept for forward-compatibility? Leaning toward keeping it —
  removing it is a bigger blast radius (every `SessionRole`/`getSessionRole`
  read site) for no functional gain right now.
