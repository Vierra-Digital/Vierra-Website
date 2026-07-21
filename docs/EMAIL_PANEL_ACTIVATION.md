# Email Panel — Activation Guide

All Phase 3 features are implemented and build-green (`tsc` + `next lint` clean). Because
this repo's Supabase schema is managed **out-of-band** (Prisma Migrate is disabled — see
`netlify.toml`), the code ships ready but three things must be done in the live
environment to turn each feature on.

## 1. Apply the SQL (Supabase → SQL editor)

**Fastest:** run the single consolidated file **`prisma/manual/APPLY_ALL_email_panel.sql`** — it
creates every table below in one go (idempotent, safe to re-run). Until it's applied, endpoints
that hit a missing table return a 500 (the account-preferences one degrades to "all enabled" so the
inbox still loads). Or run the individual files:

| File | Enables |
|------|---------|
| `20260716_email_scheduled_sends.sql` | Scheduled send |
| `20260716_email_confidential.sql` | Confidential mode (2 tables) |
| `20260716_gmail_inbox_sync_state.sql` | Inbound-processing loop |
| `20260716_email_filters.sql` | Filters / rules |
| `20260716_email_ai_preferences.sql` | Artemis autonomy/tone (server-side) |
| `20260716_email_snoozes.sql` | Snooze |
| `20260716_email_account_preferences.sql` | Per-account enable/disable in the panel |
| `20260717_blocked_sender_dnc.sql` | DNC columns on blocked senders (campaigns) |
| `20260718_booking.sql` | Meeting booker (booking links + bookings) |

**Meeting booker note:** the Google OAuth now requests `calendar.events`. Accounts connected
*before* this get free/busy availability but can't auto-create events — the booker emails an `.ics`
invite instead. **Reconnect** the Google account to enable auto-created Calendar events + Meet links.

Read receipts need **no** new table (they record `event_type = "READ"` on the existing
`email_tracking_events`).

The Prisma models are already in `schema.prisma`; the Netlify build runs `prisma generate`
so the client picks them up automatically.

## 2. Environment variables (Netlify)

| Var | Used by | Notes |
|-----|---------|-------|
| `NEXT_PUBLIC_SITE_URL` | cron functions, tracking/confidential links | e.g. `https://vierradev.com` (already set for production) |
| `CRON_SECRET` | scheduled-send + inbound dispatch endpoints | any long random string; the scheduled functions send it as `x-cron-secret` |
| `ARTEMIS_API_KEY` or `ANTHROPIC_API_KEY` | Artemis AI (compose/reply/rewrite/summarize + auto-draft + reply classification) | omit `ARTEMIS_*` to default to the Claude API; set `ARTEMIS_PROVIDER=openai` + `ARTEMIS_BASE_URL` for a self-hosted LAN model |
| `DISCORD_WEBHOOK_URL` | Discord reply notifications (Phase 1 #5) | optional; when set, real inbound replies post to that Discord channel. No-op if unset |

## 3. Netlify Scheduled Functions

Two functions ship in `netlify/functions/` and register themselves via their `config.schedule`
export (no `netlify.toml` change needed):

- `dispatch-scheduled-email.ts` — every minute → `POST /api/gmail/scheduled/dispatch` (sends due scheduled mail).
- `poll-inbound.ts` — every 5 minutes → `POST /api/gmail/inbound/dispatch` (polls Gmail history; runs filters, vacation auto-reply, Artemis auto-draft, MDN read-receipts; re-surfaces due snoozes).

Both require `NEXT_PUBLIC_SITE_URL` + `CRON_SECRET`. They no-op safely if those are unset.

## Feature → surface map

| Feature | Where | Backend |
|---------|-------|---------|
| Scheduled send | Compose “Schedule” + “Scheduled” view (list/cancel) | `lib/gmail/scheduledSend.ts`, `sendCore.ts`, `/api/gmail/scheduled*` |
| Confidential mode | Compose “Confidential” toggle; viewer at `/c/[token]` | `lib/email/confidential.ts`, `/api/c/[token]/unlock`, `/api/gmail/confidential` (revoke/list) |
| Filters / rules | Settings → “Filters & rules” | `/api/gmail/filters*`, applied in `inboundActions.applyFilters` |
| Vacation auto-reply | Settings → “Vacation responder” | `inboundActions.maybeSendVacationReply` (loop/bulk-guarded, per-sender throttle) |
| Artemis auto-draft | Settings → “Artemis AI” → autonomy = Auto-draft | `inboundActions.maybeAutoDraft` (RAG-grounded, writes Gmail drafts only) |
| Snooze | Message list → Snooze menu | `lib/gmail/snooze.ts`, `/api/gmail/snooze`, re-surfaced by inbound cron |
| Read receipts | Compose “Receipt” toggle | `Disposition-Notification-To` header; inbound MDN → `READ` event |

## Deferred (out of scope for this pass — deliberate)

- **Campaigns** — the `origin/campaigns` branch is unmergeable (its code references Prisma
  models absent from the schema). Left out entirely; needs its own schema + migration pass.
- **Gmail push (Pub/Sub `watch`)** — we poll via the History API every 5 min instead. Push
  would need a Google Cloud Pub/Sub topic + domain verification + a webhook; polling covers
  the same features with no external infra. Worth revisiting only if near-real-time inbound
  is required.
- **Delegation / shared mailboxes** — a distinct access-control model (grant user A access to
  user B's mailbox) with its own permissions surface; larger project, not started.
