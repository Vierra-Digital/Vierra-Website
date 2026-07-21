# E-Signature in the Email Chain — Plan

> Status: **BUILT — integrated with the in-house signer system.** Goal: request a signature on a
> document directly from an email thread; the recipient signs in-browser and the signed PDF is
> emailed back — reusing the same `SigningSession`/`SignedDocument` pipeline as the onboarding/NDA
> flow (not a separate stamp-locally path). Route B (external legally-binding provider) still specced.

## What shipped (in-house signer integration)
- Compose toolbar **"Request signature"** button (feather icon) → `components/email/SignPdfModal.tsx`.
- Pick a PDF (upload, or one already attached to the compose window) + an optional signer email.
- `POST /api/esign/request` (auth-gated) reads the PDF (page count via `pdf-lib`), creates a
  **`SigningSession`** via the existing `lib/sessionStore.saveSessionData` with a default signature
  + date field on the last page, and returns a `/sign/<token>` link.
- The absolute link is inserted into the compose body ("Sign "<file>"") via the editor's
  `insertLink`. The recipient signs at the existing `pages/sign/[tokenId]` UI →
  `/api/submitSignature`, which stamps the fields, emails the signed PDF back (admin + signer copy),
  and marks the session signed — the same secure pipeline as the onboarding documents.
- The earlier standalone "draw + flatten locally" path (`/api/esign/sign`, `lib/esign/stampPdf.ts`)
  was **removed** in favor of this integration.
- **Follow-up:** precise signature-field placement (v1 uses a sensible last-page default) — would
  reuse the admin field-placement UI.

## Two routes (decision drives the whole build)

### Route A — Informal (in-browser, free) — recommended default
Sign in the browser, flatten the signature into the PDF, reply with the signed file.
- **Deps:** `pdf-lib` (pure-JS PDF editing, no service), plus a canvas signature pad (small
  self-contained component; no dep needed).
- **Flow:** open a PDF attachment in the reader → "Sign" → draw/type a signature + place it →
  `pdf-lib` stamps it onto the page(s) → the signed PDF is attached to a reply via `sendCore`.
- **Pros:** free, private, fast, no third party. **Cons:** not legally binding, no tamper-proof
  audit trail, no identity verification. Fine for internal approvals / informal sign-off.
- **Storage:** optional `SignedDocument` row (who signed, when, sha256 of the signed file, thread id).

### Route B — Legally-binding (Dropbox Sign / DocuSign API)
Send the document to an e-sign provider; they collect a compliant signature + audit trail.
- **Deps:** a Dropbox Sign or DocuSign account + API key (customer-provided, paid per envelope).
- **Flow:** "Request signature" → create a signature request via the provider API (embedded or
  emailed) → provider handles signing + audit trail → webhook notifies us when complete → we pull
  the signed PDF and attach/store it.
- **Pros:** legally binding (ESIGN/eIDAS), audit trail, identity options. **Cons:** cost, external
  dependency, account setup, webhook plumbing.
- **Config:** `DROPBOX_SIGN_API_KEY` (or DocuSign OAuth), webhook endpoint `/api/esign/webhook`.

## Shared pieces (either route)
- **Reader affordance:** a "Sign" / "Request signature" action on PDF attachments in the message reader.
- **Model `SignedDocument`:** `id, user_id, thread_id, original_filename, signed_sha256, provider
  ("inhouse"|"dropbox_sign"|"docusign"), provider_ref, status, signed_at, created_at`.
- **Reply integration:** attach the signed PDF via the existing `sendCore` attachments path
  (`{ filename, contentType, contentBase64 }`).
- **Timeline:** emit a "document signed" event into the contact timeline (`/api/contacts/timeline`).

## Recommendation
Ship **Route A (informal)** first — it covers most agency sign-offs with zero cost/setup and reuses
`sendCore`. Add **Route B** behind a provider key later for contracts that must be legally binding;
the `SignedDocument.provider` field is designed so both coexist.

## Build order (when greenlit)
1. `SignedDocument` model + manual SQL.
2. `pdf-lib` + a signature-pad component + a "Sign PDF" modal in the reader.
3. Server route to stamp + return the signed PDF (or client-side stamp) → attach to a reply.
4. Timeline event + optional download.
5. (Later) Route B provider integration + `/api/esign/webhook`.

## Open decisions
- Confirm **Route A first** (default) vs. jumping straight to a legally-binding provider.
- If Route B: which provider (Dropbox Sign is simpler/cheaper; DocuSign is enterprise-standard)?
- Do signed documents need retention/versioning beyond the reply attachment?
