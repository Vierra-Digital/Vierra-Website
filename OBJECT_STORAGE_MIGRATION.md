# Object Storage Migration (Issue #59)

Move binary assets out of Supabase Postgres `Bytes` columns and into **Supabase
Storage**, keeping only a small text key in Postgres. **All code is implemented**
— images (blog + avatars) and documents (`StoredFile` PDFs/XLSX). What remains is
provisioning, backfill, and (eventually) dropping the legacy `Bytes` columns.

> **Why Supabase Storage:** the database is already Supabase, so this adds no new
> vendor, reuses the same project/keys, and supports public + private buckets.

## Status at a glance

| Asset | Model.column | Status |
|-------|--------------|--------|
| Blog editor images | `BlogImage.data` → `BlogImage.storageKey` | ✅ Implemented (code + schema) |
| Staff/admin avatars | `User.image` → `User.imageStorageKey` | ✅ Implemented |
| Client avatars | `Client.image` → `Client.imageStorageKey` | ✅ Implemented |
| Signed PDFs + contacts XLSX | `StoredFile.pdfData` → `StoredFile.storageKey` | ✅ Implemented |
| `SignedDocuments.signedPdfData` | — | ⏭️ Skipped — model is **unused** (0 references); a removal candidate, not a migration target |

**Not yet active in production** — the code uses a configured-or-fallback design
(see below), so until the bucket + key are provisioned it behaves exactly like
the old `Bytes` path. Activating requires the provisioning + backfill steps in
"Remaining work."

---

## ✅ What's implemented (images)

### Design: storage-only
The buckets are provisioned and all existing assets have been backfilled, so the
code now reads/writes **object storage exclusively** — the legacy `Bytes` fallback
has been removed and the `Bytes` columns dropped from the schema. The app
**hard-depends on Supabase Storage**: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
must be set in every environment (local + Netlify) or image/PDF routes fail.

> Earlier revisions shipped a configured-or-fallback design (storage when
> configured, else `Bytes`). That fallback was removed once provisioning +
> backfill were verified.

### Files
- [lib/storage.ts](lib/storage.ts) — Supabase Storage client + helpers:
  `isStorageConfigured()`, `uploadObject()`, `downloadObject()`, `getPublicUrl()`,
  `getSignedUrl()`, `deleteObject()`, plus convenience wrappers `putFileAsset()`,
  `getFileBuffer()`, `deleteFileAsset()`, `toStorageKeySegment()`, and
  `STORAGE_BUCKETS`. Server-only (uses the service-role key).
- [lib/api/image.ts](lib/api/image.ts) — `putImageAsset()` / `sendImageAsset()` for the image routes.
- **Image** endpoints rewritten (upload + serve, dual-read / storage-first-write):
  - Blog: [blog/admin/uploadImage.ts](pages/api/blog/admin/uploadImage.ts), [blog/image/[id].ts](pages/api/blog/image/[id].ts)
  - Profile avatar: [profile/uploadImage.ts](pages/api/profile/uploadImage.ts), [profile/getImage.ts](pages/api/profile/getImage.ts)
  - Admin user avatar: [admin/uploadUserImage.ts](pages/api/admin/uploadUserImage.ts), [admin/getUserImage.ts](pages/api/admin/getUserImage.ts)
  - Admin client avatar: [admin/uploadClientImage.ts](pages/api/admin/uploadClientImage.ts), [admin/getClientImage.ts](pages/api/admin/getClientImage.ts)
- **Document** (`StoredFile`) sites rewritten:
  - Write: [submitSignature.ts](pages/api/submitSignature.ts) (signed PDF), [lib/contacts/xlsx.ts](lib/contacts/xlsx.ts) (contacts XLSX export)
  - Serve: [admin/file/[filename].ts](pages/api/admin/file/[filename].ts) (resolves bytes from storage, else `pdfData`)
  - Delete (orphan cleanup via `deleteFileAsset`): [admin/deleteFile.ts](pages/api/admin/deleteFile.ts), [lib/contacts/xlsx.ts](lib/contacts/xlsx.ts)
- Backfill: [scripts/migrate-images-to-storage.mjs](scripts/migrate-images-to-storage.mjs) (covers blog, avatars, **and documents**)
- Dependency: `@supabase/supabase-js`

### Schema (applied to prod)
Two additive migrations, already applied via `prisma db execute` + `migrate resolve`
(the empty `add_calendar_visibility_settings` migration blocks `migrate deploy`):
- [20260616001000_add_image_storage_keys](prisma/migrations/20260616001000_add_image_storage_keys/migration.sql):
  `BlogImage.data` → nullable; `BlogImage.storageKey`, `User.imageStorageKey`, `Client.imageStorageKey`.
- [20260616002000_add_stored_file_storage_key](prisma/migrations/20260616002000_add_stored_file_storage_key/migration.sql):
  `StoredFile.storageKey` (`pdfData` was already nullable).

The legacy `Bytes` columns are intentionally **kept** (not dropped) for fallback
and rollback safety.

### Conventions as built
- **Buckets:** `blog-images` (public), `avatars` (private), `documents` (private).
  Names overridable via `SUPABASE_STORAGE_BUCKET_BLOG` / `_AVATARS` / `_DOCS`.
- **Keys:** `blog/<uuid>`, `user/<userId>`, `client/<clientId>` (images, no ext —
  mime stored in the row); `documents/<token-or-id>.pdf|.xlsx` (documents, sanitized
  via `toStorageKeySegment`).
- **Serving:** all routes **proxy/stream** the object through the existing API
  routes (`/api/blog/image/[id]`, `/api/profile/getImage`, `/api/admin/file/[filename]`, …).
  URLs are unchanged → **zero frontend changes, no CSP / next-image domain changes**,
  and existing auth checks are preserved.
- **Orphan cleanup:** `StoredFile` deletions call `deleteFileAsset()`. Blog images
  are never deleted in-app, so they need no cleanup hook.

---

## Status of the rollout

| Step | State |
|------|-------|
| Buckets created (`blog-images`/`avatars`/`documents`) | ✅ Done (via `scripts/create-storage-buckets.mjs`) |
| `SUPABASE_URL` + service-role key in local `.env` | ✅ Done |
| Backfill (7 blog, 2 avatars, 4 docs) + integrity verified | ✅ Done |
| Storage-only refactor (fallback removed) | ✅ Done — `tsc`/lint/build green |
| `Bytes` fields removed from schema | ✅ Done |
| Drop-`Bytes`-columns migration | ⏳ **Staged but NOT applied** ([20260616003000_drop_legacy_bytes_columns](prisma/migrations/20260616003000_drop_legacy_bytes_columns/migration.sql)) |

## Remaining (ordering matters — deploy before dropping columns)

1. **Set Netlify env** — `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (server-only).
   Without them, the deployed app's image/PDF routes throw (no fallback).
2. **Commit + deploy** the storage-only code. Production must run this code before
   the columns are dropped.
3. **Apply the drop migration** — only after step 2 is live. The currently-deployed
   (pre-storage) code still reads the `Bytes` columns; dropping them before the new
   code is live breaks production image/PDF serving. Apply via:
   ```
   npx prisma db execute --file prisma/migrations/20260616003000_drop_legacy_bytes_columns/migration.sql --schema prisma/schema.prisma
   npx prisma migrate resolve --applied 20260616003000_drop_legacy_bytes_columns
   ```
   ⚠️ Destructive + irreversible — ensure the snapshot exists.

### Optional cleanup
- `SignedDocuments` is unused (0 references) — consider removing the model/table separately.
- Rotate the service-role key (it appeared in chat during setup).

---

## Rollback
- Images today: reverting the endpoint code restores the old `Bytes` behavior
  instantly; `Bytes` data is untouched until you run the backfill with `--purge`.
- After `--purge` or after step 5, rollback requires restoring from a snapshot.

## Risks & gotchas
- **Service-role key** is server-only — never expose via `NEXT_PUBLIC_`.
- **Netlify env** must mirror `.env` or production falls back to `Bytes` (or fails
  if `Bytes` was already purged).
- **Content-Type** is set on upload so browsers render inline (preserved).
- **Orphaned objects** — see Remaining work §3.
- The empty `prisma/migrations/20260528035000_add_calendar_visibility_settings/`
  directory makes `prisma migrate deploy` fail (P3015); that's why DB changes here
  were applied via `prisma db execute`. Clean it up separately.
