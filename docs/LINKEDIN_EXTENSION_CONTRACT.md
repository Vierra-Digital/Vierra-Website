# LinkedIn Unified Inbox — Extension ↔ App Contract

> For the **Vierra-Extension** repo (separate MV3 Sales Nav extension). Both sides are now
> **built**: the app endpoints below, and the extension implementation (`src/content/inbox.js`
> + `SELECTORS.INBOX` + `sw.js` handlers + popup token/toggle; see that repo's
> `docs/INBOX_SYNC.md`). There is no official LinkedIn API — the extension is the bridge that
> scrapes visible threads on linkedin.com and inserts queued replies for the user to send.
> **Remaining:** verify `SELECTORS.INBOX` against the live LinkedIn messaging DOM.

## Auth — per-user token

Each user generates a personal token in the panel: **Settings → LinkedIn extension →
Generate token** (`vx_<48 hex>`). It's shown once. The extension stores it and sends it
as a Bearer token on every request:

```
Authorization: Bearer vx_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

The app resolves the token → `user_id` (`lib/linkedin/extensionAuth.ts`). All data is
scoped to that user: staff sync their own LinkedIn, clients theirs. Invalid/absent token →
`401`. Regenerating in the panel invalidates the previous token.

Base URL: the app origin (e.g. `https://app.vierra.io`). All endpoints accept CORS from any
origin (guarded by the token) and handle `OPTIONS` preflight.

## Endpoints (app side — already implemented)

### 1. Push threads + messages — `POST /api/extension/linkedin/sync`
The extension scrapes visible conversations and pushes them. Idempotent (safe to re-send
overlapping windows). Cap: 500 threads/call, 500 messages/thread.

```jsonc
// Request body
{
  "threads": [
    {
      "liThreadId": "2-abc...",          // stable LinkedIn thread id (required)
      "participantName": "Jane Doe",
      "participantHeadline": "VP Sales @ Acme",
      "participantUrl": "https://www.linkedin.com/in/janedoe/",
      "unread": true,
      "lastMessageAt": "2026-07-19T14:03:00Z",
      "messages": [
        {
          "liMessageId": "msg-1",        // stable per-message id (required)
          "direction": "in",             // "in" (received) | "out" (sent)
          "body": "Hi, thanks for reaching out…",
          "sentAt": "2026-07-19T14:03:00Z"
        }
      ]
    }
  ]
}
// Response: { "success": true, "threadsUpserted": 1, "messagesUpserted": 1 }
```

Upsert keys: threads on `(user_id, liThreadId)`, messages on `(thread_id, liMessageId)`.
Use the DOM's stable ids for `liThreadId`/`liMessageId` so re-syncs dedupe.

### 2. Poll for queued replies — `GET /api/extension/linkedin/commands`
Replies composed in the panel are queued as `PENDING` send commands. The extension polls
this (e.g. every 20–60s while a LinkedIn tab is open) and executes each on linkedin.com.

```jsonc
// Response
{
  "commands": [
    { "id": "uuid", "liThreadId": "2-abc...", "body": "Sounds great — how's Tuesday?", "createdAt": "…" }
  ]
}
```

### 3. Report a send result — `POST /api/extension/linkedin/commands/{id}`
After attempting a send, report the outcome. On success include the new message's
`liMessageId` so it's recorded in the thread (and the panel's optimistic placeholder is
reconciled on the next sync).

```jsonc
// Request body
{
  "status": "SENT",                      // "SENT" | "FAILED"
  "liThreadId": "2-abc...",              // optional (defaults to the command's thread)
  "liMessageId": "msg-42",               // include on SENT
  "error": "…"                           // include on FAILED
}
// Response: { "success": true }
```

## Extension responsibilities (to build in `vierra-linkedin-extension`)

1. **Settings UI** — a field to paste the per-user token + the app base URL; store in
   `chrome.storage.local`.
2. **Scrape loop** — on linkedin.com/messaging, read the visible conversation list +
   open-thread messages from the DOM; map to the sync payload; `POST` to `/sync`.
   Respect LinkedIn — throttle, only read what the user already sees, no aggressive
   background crawling (F5-style safety already established for the outreach MVP).
3. **Command loop** — poll `/commands`; for each, open the target thread, type `body`,
   send, then `POST` the result to `/commands/{id}` with the resulting `liMessageId`.
4. **Backoff + auth handling** — on `401`, surface "reconnect token"; on `429`/errors,
   exponential backoff.
5. **Manifest** — host permission for the app origin + `https://www.linkedin.com/*`;
   `storage`. Reuse the existing MV3 scaffold.

## Data model (app side, applied)

`linkedin_threads` (per user), `linkedin_messages` (per thread), `linkedin_send_commands`
(per user, `PENDING`→`SENT`/`FAILED`), plus `users.extension_token` (unique). SQL in
`prisma/manual/20260719_linkedin.sql`. Panel view: **LinkedIn** module in the email panel.

## Panel-facing endpoints (for reference — session-authed, not for the extension)
- `GET /api/linkedin/threads` — list the user's threads.
- `GET /api/linkedin/threads/{id}` — thread + messages (marks read).
- `POST /api/linkedin/threads/{id}/reply` — queue a reply (creates a `PENDING` command).
- `GET|POST|DELETE /api/linkedin/extension-token` — token status / generate / revoke.
