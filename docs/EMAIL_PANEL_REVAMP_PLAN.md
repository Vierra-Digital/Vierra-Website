# Email Panel Revamp — Plan

> Status: **Planning** (no code written yet)
> Target component: `components/PanelPages/EmailingPlatformSection.tsx` (~4,135 lines)
> Working branch: **`email-revamp`** (cut from `master`)
> Goal: Turn the email panel into a modern, clean, **glassmorphic** Gmail-class client — smaller in scale, healthier in code, with full Gmail-parity features and an analytics subpanel.

---

## 1. Guiding idea (what we're building)

The panel is already a real Gmail clone (inbox / sent / drafts / spam / trash / archive, tracking, templates, rich compose, threads, reply/forward, Cc/Bcc, blocked senders, contacts with tags/CSV/sync, multi-account). The problems are:

- **Looks outdated and oversized** — flat `shadow-sm` cards on plain white, dense-but-utilitarian, no cohesive modern styling.
- **Compose window clashes** — it uses a Gmail-blue palette (`#1a73e8` / `#0b57d0`) instead of the Vierra purple (`#701CC0`).
- **Only works in a popped-out tab** — the in-panel (embedded) view is a dead stub card; the real client renders only in the `/panel/email` standalone popout.
- **One 4,000-line monolith** — hard to maintain, no component/hook separation.
- **Dead modules** — "Campaigns" and a mislabeled "Cartography" (`cryptography` key) render placeholder text only.
- **Backend is ahead of the UI** — signatures, tracking toggles, and a vacation responder are fully built server-side with **no interface**.

The revamp: a restrained **glassmorphic** redesign (frosted rail/toolbars/overlays over a soft gradient background; solid high-contrast surfaces for the message list + reading pane so text stays crisp), a decomposition of the monolith, then Gmail-parity features and analytics — and, in Phase 3, an **AI compose/reply agent ("Hermes")**, **confidential mode**, and the heavier platform features. A fully working **rich text editor** (images, tables, fonts, formatting action bar), a **settings page where everything actually works**, **verified email tracking**, and **security / anti-spam / deliverability checks** run throughout.

---

## 2. Branch & safety

- Preserve the approved Stripe-animation WIP on `homepage-redesign`, then cut **`email-revamp` off `master`**.
- The panel file is byte-identical on `master` and `homepage-redesign`, so there is **zero merge risk**.
- Nothing is committed or merged until explicitly approved. `master` stays clean; merge `email-revamp` → `master` when signed off.

---

## 3. Design direction (glassmorphism, with restraint)

Standard guidance for text-dense apps: use glass for chrome, not for content.

- **Frosted glass:** side rail, top/list toolbars, compose window, dropdown menus, modals/overlays — `backdrop-blur` + translucent layers over a **soft gradient app background** (so the blur has something to refract).
- **Solid surfaces:** the message list rows and the reading pane stay solid, high-contrast — readability first.
- **Reduce scale:** tighter type ramp, smaller avatars, refined row heights, more intentional whitespace. Fixes the "large & outdated" feel.
- **Unify to brand:** replace the compose window's Gmail-blue palette with the purple system (`#701CC0` and its tints already used elsewhere).
- **Polish states:** cohesive empty / loading / error states across every module.
- **Motion:** subtle, purposeful transitions (hover, panel swaps, compose open/close) — no gratuitous animation.
- **Deliverable before implementation:** a **clickable glassmorphic mockup** (self-contained HTML Artifact) covering rail + list + reader + compose + one analytics view, for sign-off before the real component is touched.

### Design tooling & guidelines review (installed skills)
Ground every visual/motion decision in the design skills now installed in `~/.claude/skills/` (active and available):
- **UI/UX Pro Max** — design-system intelligence: color palettes, font pairings, spacing, **glassmorphism** specs, interaction states, 99 UX guidelines, chart types (also feeds the Analytics module).
- **Web Design Guidelines** (Vercel) — **the review gate**: audit every phase's UI against the Web Interface Guidelines (accessibility, focus/interaction states, contrast, semantics, UX best practices). Runs as a cross-cutting QA step (see §7).
- **Modern Web Design** — 2024–25 trends, accessibility, and performance-first patterns; sanity-checks the overall direction.
- **Motion Design** (LottieFiles) + **Motion (Framer)** + **Lottie animations** — timing/easing/choreography for transitions, compose open/close, hover states, loading/empty states, and any Lottie illustrations. Keeps motion purposeful and consistent (pairs with the project's existing `framer-motion`).

---

## 4. PHASE 1 — Visual revamp + code health

**No new features. No backend changes.** Reskin the existing capabilities and make the component maintainable.

### 4a. Visual revamp
- Glassmorphic shell (rail, toolbars, compose, overlays) per the design direction above.
- Scale reduction / spacing / type ramp cleanup.
- Compose window re-themed to purple brand.
- Cohesive empty / loading / error states.
- Remove dead **"Cartography"** module; hide the empty **"Campaigns"** module until Phase 2 builds it (or gate it behind a "coming soon" state).

### 4b. Fix the popout-only split
- Make the **full client render in-panel** (embedded), not just in the popped-out tab.
- Keep "Open in new tab" as an **optional** convenience, not the only functional path.
- Collapse the `standalone` vs embedded duplication into **one** layout source of truth.

### 4c. Code health / component handling
The monolith becomes a small tree of focused pieces:
- **Extract components:** `EmailSidebar`, `MessageListToolbar`, `MessageList` / `MessageRow`, `MessageReader` (+ `ThreadMessage`), `ComposeWindow`, `InlineComposer`, `ContactsView`, `AccountGate`, plus the future `AnalyticsView`.
- **Extract hooks:** `useGmailAccounts`, `useMessages` (list/paging/counts/badges), `useMessageDetail`, `useCompose` (+ drafts autosave), `useContacts`, `useMailboxActions`.
- **Shared modules:** move `types` (MessageRow, ContactRow, etc.) to a local `types.ts`; move constants (`MODULES`, `PAGE_SIZE`, palette tokens, scrollbar class) to `constants.ts`; centralize the HTML sanitizer + address parsers into small `lib/email/*` utilities.
- **Kill redundancy/dead code:** the identical `standalone ? "w-full h-full" : "w-full h-full"` ternary; the embedded stub; any unused state.
- **Structural bug fixes that belong with the refactor** (behavior-preserving), e.g. the `cryptography`→"Cartography" label.
- **Verification:** `npx tsc --noEmit`, `npx next lint`, and preview smoke test after extraction to prove no behavior regressions.

**Phase 1 exit criteria:** identical functionality to today, new glassmorphic look, works in-panel, component/hook decomposition complete, clean `tsc`/lint.

---

## 5. PHASE 2 — Gmail-parity features + Analytics

Built on the clean Phase 1 architecture.

### 5a. Default compose & rich text editor (make it fully work)
Complete and harden the compose experience — the "it just works like Gmail" baseline. The RTE (`ComposeRichEditor`) already exists; this makes every capability solid and brand-consistent.
- **Reply / Reply All / Forward** — verified across list + reader + inline composer, with correct quoting/threading.
- **Font controls** — font family + size selectors.
- **Formatting action bar** — bold / italic / underline / strikethrough, text + highlight color, lists (ordered/unordered), alignment, indent, links, clear-formatting.
- **Images** — inline images (paste / drag-drop / picker) *and* file attachments, correctly embedded in outgoing MIME.
- **Tables** — insert/edit tables in the body that render correctly in sent mail.
- **Robustness** — paste-from-Word/HTML cleanup, sanitization on render, undo/redo, autosave to drafts.

### 5b. Email settings page (all features working)
One consolidated, glassmorphic settings surface where **every** control actually functions and persists:
- **Accounts** — connected Gmail + SMTP/IMAP/POP provider accounts (add/test/remove, default sender).
- **Signatures** — manage multiple + default; auto-insert into compose.
- **Tracking** — per-account + global open/click toggles; **fix the bug** where saving clobbers all accounts (PUT overwrites every account's flags).
- **Vacation responder** — settings UI. ⚠️ Won't actually auto-reply until the inbound worker (Phase 3) exists — ship labeled "not yet active" or defer (decision pending).
- **Confidential-mode defaults** and **Hermes AI preferences** — placeholders wired here, activated when those Phase 3 features land.
- **Deliverability / security status** — SPF/DKIM/DMARC per sending domain (see 5e).
- **Reading pane / view (configurable)** — choose the reading experience: **split view** (list + message side-by-side) vs **full view** (click-to-open, current default), reading-pane position (right / bottom / off), and **list density** (comfortable / cozy / compact). Persisted per user.
- **Notifications** — desktop + sound alerts for new mail, per-account.
- **Composing** — default send account, default signature per account, undo-send delay window (ties to Phase 3), send-&-archive, auto-advance after archive/delete.
- **Display** — theme (light / dark / system), inbox type (default / important-first / unread-first), messages-per-page.
- **Privacy** — block remote images by default; incoming-tracker detection toggle (see 5c).
- **Keyboard shortcuts** — enable/disable + cheatsheet.

### 5c. Email tracking — verified & tested
Tracking already exists; this phase makes it **provably** correct.
- End-to-end tests: pixel open logging, click redirect logging, self-preview suppression, 2-second open de-dupe, count/first/last-open derivation, open-window estimation.
- Fix any gaps found; add a lightweight test/QA checklist so tracking stays "tested and working."
- **Outbound row indicator (done)** — a single dot: **green = opened by recipient**, **grey = tracked but not yet opened** (replaces the old green+purple pair); hover shows the full open/click report.
- **Incoming tracker detection (new)** — scan **received** mail for tracking pixels & known trackers (1×1 images, beacon domains, hidden remote images) and flag *"the sender is tracking you."* Pair with **block-remote-images-by-default** so opens aren't leaked back; show a shield indicator on flagged messages. This closes the gap left by today's outbound-only tracking. Backend: parse `message-detail` HTML + maintain a tracker-domain list; proxy/strip remote images.

### 5d. Tier 0 — Surface already-built backend (UI-only, fastest wins)
| Feature | Backend today | Work |
|---|---|---|
| **Signatures** | Full CRUD API (`gmail/signatures.ts`, multiple + default) | Manage list + auto-insert into compose (see 5b) |
| **Tracking toggles** | Settings API exists | Per-account + per-compose on/off; fix all-accounts bug (see 5b/5c) |
| **Vacation responder** | Fully modeled + settings API | Settings UI (see 5b), labeled "not yet active" |

### 5e. Security & anti-spam checks (pre-send + deliverability)
Cross-cutting hardening, surfaced where users act:
- **Pre-send deliverability lint** — warn on spam-trigger content, poor text/HTML or image/text ratio, missing plaintext part, missing/broken unsubscribe, risky links, oversized payloads.
- **SPF / DKIM / DMARC alignment checks** — verify + surface per sending domain (Brevo/`vierradev.com` already uses DMARC `p=reject`); flag misconfiguration before it hurts deliverability.
- **Send-side abuse protection** — rate limiting, recipient-count guardrails.
- **Content security** — harden the existing HTML sanitizer (XSS, remote-content), validate attachments.
- Runs through the **`security-review`** skill as a gate (see cross-cutting QA in §7).

### 5f. Analytics module (new)
Pure presentation over data already logged (`EmailTrackingEvent` + `gmail/tracking/stats.ts` + `gmail/counts.ts`), built with the **`dataviz`** skill for a consistent chart system.
- **KPI row:** sent, open rate, click rate, avg. time-to-open.
- **Opens & clicks over time** (line chart).
- **Best send-time heatmap** (day × hour) — leverages the existing open-window estimation.
- **Per-account** and **top-recipient** performance tables.
- **Top-clicked links.**
- **Mailbox volume** (inbox / archive / spam / trash).
- **Spam-filter / placement detection** — estimate inbox-vs-spam landing and deliverability health: SPF/DKIM/DMARC pass rates, bounce/complaint rates, and low-engagement anomaly signals; optional seed-inbox placement testing across providers (Gmail/Outlook/Yahoo) as a later enhancement.
- **Honesty note surfaced in-UI:** tracking is **outbound-only** — it measures mail you send, not mail you receive.

### 5g. Tier 1 — Recommended parity features (backend + UI)
Recommended cut ("feels like real Gmail" without opening the campaigns can of worms):
- **Server-side search + operators** — today search only filters the ~50 already-loaded rows; real query support is the biggest usability gain.
- **Conversation grouping in the list** — threads currently assemble only when a message is opened; group the inbox listing.
- **Stars / flags** — cheap, high-familiarity.
- **Reading pane (split view)** — implement the configurable reading pane from 5b: a resizable split (list + message side-by-side) as an alternative to the current click-to-open full view, remembered per user.

**Phase 2 exit criteria:** compose/RTE fully working (images, tables, fonts, action bar, reply/forward); settings page all-functional; tracking tested & verified; Tier 0 exposed; anti-spam/security checks in place + `security-review` passed; Analytics live (incl. spam-placement detection); chosen Tier 1 features shipped; clean `tsc`/lint + preview verification.

---

## 6. PHASE 3 — Larger Gmail features

The heavier, backend-driven work — each item is a meaningful project on its own. Built on the Phase 1/2 foundation.

### 6a. AI Compose & Reply — Hermes Agent (flagship)
An AI assistant ("**Hermes**") embedded in compose and reply — the standout differentiator. High priority; can be pulled into Phase 2 if desired (kept in Phase 3 because of build size).
- **Draft from intent** — generate a full email from a short prompt, with tone + length controls.
- **Context-aware replies** — reads the open thread and proposes reply drafts; one-click smart-reply suggestions.
- **Rewrite tools** — expand / shorten / change tone / fix grammar / translate on selected text, wired into the compose action bar (5a).
- **Thread summarize** — condense long threads at the top of the reader.
- **Optional grounding** — draw on Contacts, prior threads, and templates for personalized drafts.
- **Backend** — new AI routes (e.g. `pages/api/ai/compose`, `/ai/reply`) calling the **Claude API** with streaming; use the **`claude-api`** skill for correct model IDs (default to the latest models) and the **`security-review`** skill on the new endpoints.
- **Guardrails** — nothing sends without explicit user confirmation; PII/rate limits respected; clear "AI-generated" affordance.

### 6b. Confidential mode
Gmail-style confidential sending.
- **Message expiry** (self-destruct after a set time), **revoke access** anytime.
- **Passcode option** (email/SMS verification to open).
- **Restrict forward / copy / print / download.**
- **Implementation** — send an access-controlled link to server-hosted content instead of raw body; new models (confidential message, access token, expiry, view log), a tokened viewer page, passcode verification, and revocation. Backend-heavy → its own design pass.

### 6c. Power-user sending
- **Scheduled send** — pick a future send time; needs a persisted queue + a worker/cron to dispatch.
- **Undo send** — configurable send-delay window with a cancel affordance.

### 6d. Organization & triage
- **Custom labels / folders** — user-defined labels/folders beyond the six fixed mailboxes: label CRUD with colors, **nested folders**, multi-label assignment, drag-a-message-to-folder, filter-by-label, and per-label unread counts in the sidebar.
- **Snooze** — hide a message until a chosen time; needs snooze state + a re-surfacing worker.
- **Filters / rules** — automatic actions on incoming mail (label, archive, mark read). Depends on inbound processing (6e).

### 6e. Identity
- **Send-as / aliases / reply-to management** — send from verified aliases; per-identity signatures.

### 6f. Campaigns / sequences (strategic — own sub-project)
Clearly pre-planned in the schema: orphan `campaign_id` / `campaign_contact_id` / `step_id` columns already exist on `EmailOutboundMessage`, plus a hardcoded-zero "Campaigns" dashboard stat. A real multi-step drip system:
- New models: `Campaign`, `CampaignStep`, `CampaignContact` (+ wire the existing orphan columns).
- Sequence builder UI, per-step delays/conditions, enrollment from Contacts, per-contact progress + tracking, pause/stop.
- Feeds directly into the Analytics module (campaign performance).
- This is the biggest single item — recommend a dedicated design pass before building.

### 6g. Platform / infrastructure
- **Inbound processing loop** (IMAP/Gmail watch + history) — unlocks **filters/rules**, **true conversation sync**, and makes the **vacation responder actually fire** (the model/settings already exist from Phase 2).
- **Real read receipts (MDN)** — request/response, distinct from the outbound open-pixel tracking.
- **Delegation / shared mailboxes.**
- **Gmail push notifications** (watch/history) for near-real-time updates instead of polling.

**Phase 3 exit criteria:** per-feature — each ships with its own backend, migration (if needed), UI, and `tsc`/lint/preview verification. Not a single milestone; picked off by priority.

---

## 7. Sequencing

1. **Mockup** — glassmorphic clickable Artifact for sign-off.
2. **Phase 1** — visual revamp + popout fix + code-health decomposition.
3. **Phase 2** — compose/RTE completeness → settings page → tracking verification → Tier 0 → security/anti-spam checks → Analytics (+ spam-placement detection) → recommended parity features (search, grouping, stars).
4. **Phase 3** — larger features by priority: **Hermes AI** and **Confidential mode** as flagships, then scheduled/undo send, organization/triage, identity; Campaigns and inbound-processing get their own design passes.
5. **Cross-cutting QA gate (every phase):** run the **`web-design-guidelines`** skill to audit the UI (accessibility, interaction states, contrast, UX) and the **`security-review`** skill on new/changed endpoints; verify tests (tracking especially) and validate deliverability (SPF/DKIM/DMARC) — in addition to `tsc --noEmit` + `next lint` + preview smoke test before proceeding.

---

## 8. Open decisions

1. **Phase 2 feature cut** — confirm the set: compose/RTE completeness + settings + tracking verification + Tier 0 + security/anti-spam + Analytics + (search, grouping, stars). Anything to add/drop?
2. **Hermes AI** — keep in Phase 3, or pull the flagship into Phase 2? Which capabilities matter most first (draft-from-intent / smart replies / rewrite tools / thread summarize)?
3. **Confidential mode** — confirm the hosted-viewer approach (expiry + passcode + restrict forward/copy) as a Phase 3 build.
4. **Vacation responder** — ship settings-only UI now (labeled not-yet-active), or defer until the inbound worker is built?
5. **Popout vs in-panel** — confirm making the full client render in-panel (popout becomes optional) is desired.
6. **Spam-placement detection depth** — infer from engagement + auth pass rates only, or also build seed-inbox placement testing across providers (bigger)?

---

## 9. Reference — current state (for implementers)

- **Layout:** `grid grid-cols-[250px_minmax(740px,1fr)]` — fixed 250px rail + single pane that swaps list/reader via `viewMode`. No persistent reader column.
- **Palette:** brand purple `#701CC0` (+ tints `#ECE3FF`/`#EDE1FF`/`#F4EDFF`/`#5B21B6`); neutrals `#E5E7EB`/`#111827`/`#6B7280`; surfaces `#FBFCFF`/`#F9FAFD`. Compose window diverges into Gmail blues (to be unified).
- **Glass today:** only modal scrims (`bg-black/50 backdrop-blur-sm`). No frosted panels yet.
- **Backend (Pages Router, `pages/api/`):** `gmail/*` (status, initiate/callback/delete, counts, messages, message-detail, send [Gmail API + SMTP fallback, tracking injection], actions, drafts, settings [tracking + vacation], templates, **signatures**, blocked-senders, contacts/sync, tracking/stats), `email/*` (accounts SMTP/IMAP/POP, accounts/test, track/open/[token], track/click/[token]), `contacts/*` (index, [id], tags, import, export, visibility).
- **Prisma models:** `EmailProviderAccount`, `PlatformToken` (Gmail OAuth via `platform=gmail:<email>`), `Contact` + `ContactTag` + assignments + `ContactFieldVisibilitySetting` + `GmailContactSyncState`, `EmailOutboundMessage` (+ orphan campaign columns) + `EmailOutboundRecipient` + `EmailTrackingLink` + `EmailTrackingEvent`, `EmailTemplate`, `EmailSignature`, `EmailAccountSetting` (+ vacation) + `EmailVacationResponseLog`, `EmailBlockedSender`, `EmailComposeDraft`.
- **Tracking:** outbound-only. Open = 1×1 pixel → `EmailTrackingEvent(OPEN)`; click = link rewrite → redirect → `EmailTrackingEvent(CLICK)`. Counts computed on read (not stored). Self-previews suppressed; opens de-duped in a 2s window; open-window time estimated heuristically.
- **Known bug:** `gmail/settings.ts` PUT propagates tracking flags to **all** of a user's accounts (per-account divergence impossible despite the schema supporting it).
