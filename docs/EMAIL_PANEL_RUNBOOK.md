# Email Panel — Ops Runbook

Everything needed to run, verify, and operate the email/outreach panel. Schema is managed
out-of-band (Supabase); the build only runs `prisma generate`.

## 1. Environment variables (Netlify)
| Var | Status | Powers |
|-----|--------|--------|
| `NEXT_PUBLIC_SITE_URL` | ✅ set (`https://vierradev.com`) | tracking/click links, cron targets, deep links |
| `CRON_SECRET` | ✅ set | **all 4 crons** — without it they 401/no-op |
| `DISCORD_WEBHOOK_URL` | ✅ set | reply alerts + high-intent signal alerts (+ deep link) |
| `ENCRYPTION_SECRET` | required | AES-256-GCM for domain-SMTP passwords (module throws at import if unset) |
| `ANTHROPIC_API_KEY` / `ARTEMIS_*` | deferred | Artemis AI (compose/reply/rewrite/summarize/auto-draft) — off until set |
| `GMAIL_PUBSUB_TOPIC` | not set | Gmail push (near-real-time inbound); polling covers it until set |

## 2. Scheduled functions (`netlify/functions/`, auto-registered via `config.schedule`)
- `poll-inbound.ts` — every 5 min → `/api/gmail/inbound/dispatch` → inbound processing, filters, vacation auto-reply, Artemis auto-draft, MDN read-receipts, snooze resurfacing, **reply Discord alerts**, **signal detection + auto-enrollment**.
- `dispatch-scheduled-email.ts` — every 1 min → `/api/gmail/scheduled/dispatch` → sends due scheduled mail.
- `dispatch-campaign-queue.ts` — every 5 min → `/api/campaigns/send-queue/dispatch` → advances active campaign sequences.
- `gmail-watch-renew.ts` — daily → `/api/gmail/watch` → re-registers Gmail push (no-op unless `GMAIL_PUBSUB_TOPIC` set).

All are gated on `CRON_SECRET` + `NEXT_PUBLIC_SITE_URL`.

## 3. Gmail push activation (optional — GCP console)
1. Enable Pub/Sub API in the Google Cloud project behind the Gmail OAuth app; create a topic `gmail-push`.
2. Grant `gmail-api-push@system.gserviceaccount.com` the **Pub/Sub Publisher** role on the topic.
3. Add a **push subscription** → endpoint `https://vierradev.com/api/gmail/push?token=<CRON_SECRET>`.
4. Set `GMAIL_PUBSUB_TOPIC=projects/<PROJECT_ID>/topics/gmail-push` in Netlify → redeploy.
5. Trigger the first watch: `POST /api/gmail/watch` with header `x-cron-secret: <CRON_SECRET>` (or wait for the daily renew).

## 4. Smoke test after each deploy
- **Send:** compose + send a normal email (Gmail) and one from a domain-SMTP account — confirm delivery. *(This also validates the send-path refactor.)*
- **Tracking:** open the sent mail elsewhere → an OPEN event; click a link → CLICK + redirect.
- **Reply → Discord:** reply from an outside address → within ~5 min a `📬 Reply` post with a "Reply in Vierra" link that opens the full chain.
- **Campaign:** set a campaign `active` with a queued contact due now → the queue cron sends it; tick a campaign's "auto-enroll on signal" and click a tracked link → `🔥` + `➕ Auto-enrolled`.
- **Booking:** create a link, book a slot → Calendar event + Meet link.
- **E-sign:** compose → "Request signature" → inserts a `/sign/<token>` link; sign it → signed PDF emailed back.
- **Shared inbox:** as admin, Settings → Shared inboxes → grant a teammate a mailbox → they see it in the account switcher and can read/send it.

## 5. Cron health check (manual, safe — idempotent)
```
curl -s -X POST -H "x-cron-secret: <CRON_SECRET>" https://vierradev.com/api/gmail/inbound/dispatch
curl -s -X POST -H "x-cron-secret: <CRON_SECRET>" https://vierradev.com/api/campaigns/send-queue/dispatch
```
Expect `{"ok":true,...}` JSON.

## 6. Still pending
- **Spam-placement testing** — needs a 2nd Gmail seed inbox (or Outlook/Yahoo IMAP creds).
- **Gmail push** — needs the GCP topic above.
- **Artemis AI** — deferred (needs the AI provider key / Hermes).
