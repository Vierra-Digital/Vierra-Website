# Role model redesign: admin / staff / client

## Status
Implemented in code (schema, resolveUser, and all downstream call sites below).
**Not yet applied to the database** — `prisma/manual/20260827_role_model_admin_staff_client.sql`
still needs to be run against Supabase (after the pre-flight check it documents), followed by
`npx prisma generate` to pick up the new `is_owner` column in the Prisma client types.

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
