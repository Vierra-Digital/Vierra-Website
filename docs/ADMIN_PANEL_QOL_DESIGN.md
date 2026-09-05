# Admin panel quality-of-life design scope

Status: design scope with second implementation slice in progress. Reviewed September 5, 2026.

## Implementation progress

The original document was delivered without application changes. The subsequent requests to start P1 implementation authorize the following slices; they do not mark the entire P1 scope complete.

### Slice 1

| Scope | Implemented | Remaining |
| --- | --- | --- |
| G3 / A9 | Files load/retry/stale states, filtered-empty state, result count, protected/unavailable explanations, scoped request state, deletion error/busy feedback and confirmed-response checks | — |
| G3 / A2 | Client status quick filters, visible query/sort/count, clear filters, retained data during refresh, row-level mutation feedback, uncertain-result refresh, deletion progress/error | — |
| G1 / A14 | Client list stays mounted during workspace visits; list scroll/focus restored on exit; client banner and shared-dashboard scope explanation | Full client dashboard scoping verification |
| G4 | Semantic sidebar navigation, selected-state announcements, hidden mobile rail removed from tab order, modal focus containment/return, keyboard row-action menus, wrapping shared page actions | Browser verification at target widths/zoom; remaining bespoke dialogs |

### Slice 2 (current, uncommitted)

| Scope | Implemented | Remaining |
| --- | --- | --- |
| A9 | Type/owner filters, sort, clear-filters, distinct no-records/no-matches states, refresh with focus return, `/files/preview` "Return to files" handoff | Pagination for large collections (P2) |
| A2 | Durable URL-backed filter/sort/page state (`?section=clients&q=&status=&...`), "Save filters to page link", add-client draft guard, submit-in-flight guard, per-step onboarding email delivery status distinct from client creation | — |
| G1 | Readable `?section=` URLs resolved on load and Back/Forward (`lib/panel/navigation.ts`), invalid/inaccessible section falls back to Dashboard with an explanation, settings deep link preserved, semantic nav buttons/links replacing clickable divs | Per-section deep-linkable sub-state beyond Clients (e.g. selected record) for pages other than Clients/Campaigns/email |
| G2 | In-memory (never persisted) draft registry (`lib/panel/drafts.ts`, `hooks/useDraftGuard.ts`) wired into Blog Editor, Campaign wizard, Email compose/settings, Client context, Marketing Tracker, Project Management (create/edit task), Add Client modal; browser back/refresh/tab-close guarded; background section-version refresh is deferred (not discarded) while a scoped draft is dirty, with a "New data available — your edits have been kept" banner and deliberate reload | Server-side draft recovery beyond the current browser session (P3, separately scoped); full optimistic-concurrency (revision-conflict) UI beyond the send-attempt/status-mismatch checks already added |
| E1 | Send-request idempotency: client-side request id reused across retries/undo-send (`lib/email/sendRequest.ts`), server-side receipt table dedupes and replays the confirmed result instead of resending (`lib/gmail/sendAttempt.ts`, `prisma/manual/20260909_email_send_attempts.sql`) | Remaining mailbox-destination-specific polish (Starred/Important/Scheduled/Archive/Spam/Trash/labels) |
| E5 | Server-enforced launch preflight (sequence steps, audience, company mailing address, site URL) blocks activation with the same reasons shown in Overview (`lib/campaigns/preflight.ts`); campaign detail load/retry state; send-queue-tick now scoped to the loaded campaign's company | Contacts/Analytics-tab-specific proposals; campaign list filters |
| A11 / A12 | Row-scoped delete/reset busy+error state with confirmed-response checks, session list load-failure surfaced, session expiry shown, stable pagination after filtering | Distinct Active/Expiring soon/Expired/Completed session views |

**Action required before this slice can send email in production:** `prisma/manual/20260909_email_send_attempts.sql` creates the table `runSendAttempt` depends on. The panel's compose/reply/send-queue paths always send a `requestId`, so until this SQL is applied to the live database every send will fail closed (503, "Send protection is unavailable... nothing was sent") rather than silently double-sending — but no mail will go out. Apply it before merging or deploying this slice.

Not yet started: A1, A3, A5–A8, A10, A13, A15, E2, E3, E4, E6 (settings-section-specific rows), and the remaining G2 concurrency work for Blog/Tasks server revisions.

Validation for this slice: `npx prisma generate && npx tsc --noEmit && npm run lint && npm test && npx next build` all clean (486 tests, zero lint errors, zero build warnings). Browser interaction and viewport checks remain outstanding; no browser automation package is installed in this workspace. Existing endpoint authorization and mutation semantics are preserved. The Email link keeps its existing new-tab behavior and now exposes that behavior through a semantic link and accessible label.

## Purpose and review boundaries

Make routine admin work faster, easier to resume, and easier to recover when a request fails. Preserve the current product structure and permissions while improving navigation, context, editing, and feedback.

This is a source-based review of the current repository, not a browser usability test. “Current” statements below describe code paths inspected; proposed friction and priorities are design judgments, not measured user findings. Live data, deployed migrations, provider connections, responsive rendering, and actual user frequency were not validated. No application code, configuration, database, or external service changes are part of this deliverable.

Coverage includes all destinations in `pages/panel.tsx`, the standalone email panel and all its modules, every email settings section, account settings, the four admin client-view destinations, and the separate Manage Users route. Public booking, signing, onboarding, marketing pages, and client-only Team are outside scope. Their entry and return handoffs from admin workflows are included where relevant. `/manage/[id]` is a booking-management surface, not an admin user-detail page.

## Coverage map

Most main-panel pages are conditionally displayed sections of `/panel`, not individual routes. Section numbers below document current wiring; proposed URLs should use readable names.

| Surface | Current entry | Primary source |
| --- | --- | --- |
| Shared shell and client view | `/panel` | [panel.tsx](../pages/panel.tsx) |
| Dashboard | Section 0 | [DashboardSection](../components/PanelPages/DashboardSection.tsx) |
| Clients and add-client flow | Section 1 | [ClientsSection](../components/PanelPages/ClientsSection.tsx), [AddClientModal](../components/ui/AddClientModal.tsx) |
| Staff Orbital | Section 2 | [TeamPanelSection](../components/PanelPages/TeamPanelSection.tsx) |
| Marketing Tracker | Section 5 | [OutreachSection](../components/PanelPages/OutreachSection.tsx) |
| Project Tasks | Section 6 | [ProjectManagement](../components/PanelPages/ProjectManagement.tsx) |
| PDF Signer | Section 9 | [SignPdfSection](../components/PanelPages/SignPdfSection.tsx) |
| LTV Calculator | Section 4 | [LTVCalculatorSection](../components/PanelPages/LTVCalculatorSection.tsx) |
| Blog Editor | Section 7 | [BlogEditorSection](../components/PanelPages/BlogEditorSection.tsx) |
| Files | Section 10 | [FilesSection](../components/PanelPages/FilesSection.tsx) |
| Artemis: Generate and Review | Section 11 | [ArtemisSection](../components/PanelPages/ArtemisSection.tsx), [generation widget](../components/artemis/ArtemisGenerateWidget.tsx) |
| User Management and Client Sessions | Section 8 | [AdminEditorSection](../components/PanelPages/AdminEditorSection.tsx) |
| Account Settings | `/panel?settings=1` | [UserSettingsPage](../components/UserSettingsPage.tsx) |
| Client view: Dashboard, Outreach, Context, Files | Client selection within `/panel` | [ClientViewOutreachSection](../components/PanelPages/ClientViewOutreachSection.tsx), [LinkedInContextSection](../components/PanelPages/LinkedInContextSection.tsx), shared Dashboard/Files |
| Email workspace and Contacts | `/panel/email` | [EmailingPlatformSection](../components/PanelPages/EmailingPlatformSection.tsx), [module inventory](../components/email/constants.tsx) |
| Email Analytics | Email module | [EmailAnalyticsView](../components/email/EmailAnalyticsView.tsx) |
| Cartography: Discover and Review | Email module, internal key `cryptography` | [CartographySection](../components/PanelPages/CartographySection.tsx), [ReviewQueue](../components/PanelPages/CartographySection/ReviewQueue.tsx) |
| Campaigns: list, creation, Overview, Contacts, Analytics | Email module | [CampaignsSection](../components/PanelPages/CampaignsSection.tsx), [CampaignDetail](../components/PanelPages/CampaignsSection/CampaignDetail.tsx), [ContactsTab](../components/PanelPages/CampaignsSection/ContactsTab.tsx), [AnalyticsTab](../components/PanelPages/CampaignsSection/AnalyticsTab.tsx) |
| Email Settings, including meeting operations | `/panel/email/settings` | [settings.tsx](../pages/panel/email/settings.tsx) |
| Separate Manage Users page | `/manage-users` | [manage-users.tsx](../pages/manage-users.tsx) |
| File preview handoff | `/files/preview` | [preview.tsx](../pages/files/preview.tsx) |

## Priorities and sizing

P1 = first release candidate: protects work, clarifies action scope, or fixes recovery. P2 = next release: reduces repeated navigation and data-entry effort. P3 = optional enhancement after usage validation. These are product priorities, not incident severities.

Sizes are relative engineering scope, not delivery promises: S = localized UI using existing data; M = coordinated component/state work or a modest endpoint extension; L = persistence, provider, or cross-surface workflow work. Each page gives a base size for its principal proposal. Optional additions are called out separately. Estimates require endpoint and authorization review before scheduling.

## Shared design decisions

### G1. Resume navigation and preserve context — P1, M

Current: `/panel` initializes section 0 and most sidebar clicks update React state. Visited sections remain mounted, while server version changes remount several sections. Email opens a new tab. Email already supports account/thread deep links and preserves them through login; account settings already accepts `?settings=1`.

Propose readable section/tab URLs, browser Back/Forward support, and a “Copy page link” action. Example target: `/panel?section=clients&status=pending`. Treat these as proposed URLs, not working links. Preserve list query, sort, page, selected record, and scroll when returning from detail. Offer Email as a normal link with an explicit “Open in new tab” option. Give email and settings a clear return to the main panel.

Separate shareable view state from sensitive state: never put message text, draft content, credentials, or signing/session tokens into general navigation preferences. Validate entity access when resolving a link. Keep account/thread link compatibility. Invalid or inaccessible targets should explain what happened and offer an authorized destination.

Acceptance: search Clients, open a client, return, refresh, and use Back/Forward without unexpectedly landing on Dashboard or losing the filters. Opening a new tab must work from the keyboard and normal browser link controls.

### G2. Protect edits during navigation and refresh — P1, L

Keep the existing benefits of mounted sections and background refresh. Before a version-driven remount, check for active edits or in-flight mutations. Clean views can refresh automatically; dirty views should retain the draft and show “New data available” with a deliberate reload choice. Account/client switches must not transfer a draft to a different owner.

Use a consistent state vocabulary: Unsaved changes, Saving, Saved, and Could not save — Retry. Guard leaving a dirty form. Do not add persistent browser storage of email, client context, or credentials as a default solution. Server draft recovery is a separate endpoint/storage decision wherever existing draft support is absent. Handle concurrent updates without silently overwriting another person's work.

Acceptance: edit a blog or task, cause a section-version update in another tab, and return; the unsaved content survives. A failed save keeps the form and offers retry. A newer server revision cannot be overwritten without a visible conflict decision.

### G3. Consistent lists and action feedback — P1, M

Build on `PanelSearchInput`, `PaginationControls`, `RowActionMenu`, and existing confirmation/prompt components. Several pages already have search, filtering, and pagination; standardize behavior instead of rebuilding them.

Show active filter chips, Clear filters, a result count, stable pagination, and distinct “No records yet,” “No matches,” “Could not load,” and “Showing previously loaded data” states. Keep successful data visible during background refresh. Put operation errors next to the affected row or form. Prevent duplicate submission and announce success without a blocking modal for routine saves/copies. Retain confirmations for consequential actions, naming the affected entity and outcome. Offer Undo only when a real reversible operation exists.

Acceptance: filtering never leaves an empty out-of-range page; a failed request is never presented as a successful empty list; failed mutations retain input and selection. Bulk controls explicitly distinguish selected rows from all matching records.

### G4. Keyboard, responsive layout, and readable status — P1, M

Use semantic links/buttons for navigation; the main shell currently uses clickable `div` elements with repeated IDs. Provide visible focus, labeled icon actions, selected navigation state, and modal focus containment/return. Escape should close a clean overlay; dirty dialogs follow G2. Avoid shortcuts firing inside editors or form inputs.

At narrow widths, retain identity, status, and primary action; move secondary fields into expandable details or a deliberately scrollable table. Keep labels and critical errors readable at 200% zoom. Status must have text, not color alone. Test 390px, 768px, and 1440px widths with long names and realistic records.

Acceptance: complete navigation, search, row actions, and a modal form without a pointer; focus returns to the trigger; controls remain reachable without overlapping fixed footers or sidebars.

### G5. Visible scope and understandable metrics — P1, M

Show current client/company, selected mailbox, time range, and timezone where they affect data or actions. Distinguish organization-wide, per-client, per-user, per-inbox, and device-only settings. Label data freshness and metric definitions near results. Missing or unavailable data must not become a zero. Preserve existing authorization and client boundaries; UI visibility is not a replacement for endpoint authorization.

Acceptance: a user can identify the target of a save/send/delete before acting. Changing scope never leaves another client's results or another mailbox's draft under the new heading.

## Main-panel page proposals

### A1. Dashboard — P2, M

Current: summary cards, Website Visits, Recent Blog Posts, Staff Activity, and Upcoming Meetings provide separate data views.

Propose a compact scope/date/freshness header and contextual drill-throughs from each card into the corresponding filtered destination. Give each widget independent loading, unavailable-data, and retry treatment so one failed feed does not obscure useful results. Show meeting timezone and clear join/open details actions. Explain activity recency without implying that absence proves inactivity. Preserve each metric's actual supported date range rather than silently applying one range to incompatible feeds.

Acceptance: a meeting opens the correct record; a failed visits request leaves meetings usable; each card indicates whether it is showing zero, unavailable data, or a different period. Custom widget ordering is P3, M and should wait for observed demand.

### A2. Clients and add-client flow — P1, M

Current: searchable, paginated list with status and retainer/name sorting, status changes, deletion confirmation, and client-view entry.

Propose visible active filters and quick views for Active, Pending, and Inactive; preserve them when leaving client view. Make “Open client workspace” an explicit action with client name/email for disambiguation. Keep status mutation progress/error at the row. In creation, group required identity fields, show duplicate/validation errors inline, preserve entered values, and provide a success action to open the new client. Explain the effect of removal using verified backend behavior; do not imply archive or recovery if deletion is permanent.

Acceptance: find a pending client, open and leave the workspace, and return to the same list position. A failed status change restores the server state and leaves a readable row error. Repeated submit cannot create duplicates; server support must be checked before promising this guarantee.

### A3. Staff Orbital — P2, M

Current: staff search/sort/filter, invite and edit flows, invitation rescinding, and staff removal exist.

Propose clearly separated Members and Pending invitations views with counts; show invitation age and available expiry state. Place role/position and activity recency beside identity. Explain why actions are unavailable for staff. Preserve invitation form values after errors and make the next action visible after success. Invitation resend is optional P2, M pending confirmation that the invitation API safely supports renewal/resending.

Acceptance: an admin can distinguish an unaccepted invite from an inactive member without opening a dialog; rescinding an invite updates only that row; the staff variant exposes only authorized actions.

### A4. Marketing Tracker — P1, M

Current: monthly/yearly views, staff/client scope, funnel metrics, and debounced saves of editable current-period fields exist. Historical/future editing is restricted.

Propose a persistent period/scope bar with “This month”; label automatic sent/reply metrics versus manual meetings/closed/revenue inputs. Make saving/saved/retry visible next to editable metrics. Flush or explicitly resolve pending edits before period/client switches, retaining the previous draft when save fails. Explain period locks beside fields. Display conversion denominators and use a neutral unavailable value for a zero denominator.

Acceptance: changing month during the debounce never drops input or saves it to the new month. Returning to the page confirms the saved values. Yearly totals describe their period and source. A CSV export with scope/period metadata is P3, M.

### A5. Project Tasks — P1, M

Current: boards, task creation/detail/edit dialogs, assignees, checklists, and gated review/completion transitions exist.

Propose Mine, Needs review, and assignee filters, task search, per-column counts, and a persisted board choice. Keep the selected task addressable and return users to the same board position. Explain transition blockers directly beside the status controls, including checklist completion and admin approval. Preserve edits on failed saves and background refresh. A compact list alternative for narrow screens is P2, M.

Acceptance: a user finds their task and submits it for review without reopening the board; an admin sees review-ready tasks together; filters never bypass transition rules. Do not include new workflow states or a drag-and-drop rewrite in this scope.

### A6. PDF Signer — P2, M

Current: PDF preparation produces a signing link with copy feedback, followed by Save To Files with staff/client recipient selection.

Propose a visible progression: Prepare PDF → Review → Generate link → Save/share. Show document name and selected recipient consistently, use searchable recipient selection, and distinguish “Link generated” from “Saved to files” and “Signed.” Keep a generated link available after a failed file-save so retry does not generate a second request. Provide Open saved file after success and a deliberate Start another document action.

Acceptance: a failed save preserves the existing link and recipient; retry saves the same document. Preview and generated fields agree before link creation. Link copy failure offers manual selection. Draft persistence across browser reload is P3, L and requires a document-storage decision.

### A7. LTV Calculator — P2, S

Current: six numeric inputs calculate LTV and a retainer immediately in local component state. The retainer formula is currently LTV × clients brought in ÷ 2.

Propose explicit currency, percentage, frequency, and year labels; accept blank intermediate input; validate finite nonnegative values and cost-of-goods percentage from 0–100. Show the existing formula with a worked example and label its assumptions. Add Reset and Copy summary, including inputs and units. Keep calculations unchanged in this QoL release.

Acceptance: blank, zero, decimal, and invalid inputs produce understandable results without NaN/Infinity; copied output includes assumptions and does not present the retainer as a guaranteed outcome. Named scenario comparison is P3, M/L depending on persistence.

### A8. Blog Editor — P1, M

Current: searchable/filterable paginated post list, edit/create mode, metadata/content fields, image handling, explicit save, and deletion confirmation exist.

Propose a sticky Save/Preview/Back action area, dirty-state protection, inline validation, and image-upload progress/error next to the asset. Preview should approximate the public article's title, description, tags, author, image, and content without publishing. State whether Create/Update changes the public post immediately, based on the existing endpoint; do not relabel Save as Draft without a draft lifecycle. Return to the original list filters after save/cancel.

Acceptance: failed upload/save retains all other edits; leaving a dirty editor prompts to stay/discard; preview does not mutate public content. Server autosaved drafts/version history are P3, L and separate from this initial scope.

### A9. Files and preview handoff — P1, S/M

Current: filename search, owner/type/date metadata, download actions, protected-file indicators, and deletion confirmation exist. Fetch failure currently returns an empty array; deletion failure closes the confirmation with only limited feedback.

Propose explicit load-error/retry state and deletion progress/error that keeps the chosen file visible. Add type/owner/date filters and sorting using existing fields; preserve the full extension in accessible names. Explain protected files inline, not only in a hover title. Show unavailable download states for files without a usable download target. Preview handoffs should identify the file and provide an obvious return path.

Acceptance: a failed file fetch says “Could not load files,” not “No Files Found”; failed delete leaves the file and retry action visible; protected documents remain protected in both main and client views. Pagination for large collections is P2, M and may require API support. General uploads, folders, and bulk deletion are outside this release.

### A10. Artemis — P2, M

Current: Generate and Review tabs, status filters/counts, content display, and per-item approve/reject actions exist. Review metadata includes a raw brain identifier.

Propose readable client/brain names with technical IDs available only in secondary details, generated-at context, and explicit explanation of what approval does next. Show input requirements before generation; preserve the prompt on failure. In Review, keep queue position after actions, show row-level errors, and distinguish no pending work from a failed load. Add search or pagination when queue volume warrants it.

Acceptance: the reviewer knows the destination and effect before approving; a failed action leaves the item actionable; successful review moves focus to the next item. Edit-before-approve is P3, M/L after verifying the review API; bulk approval and automatic publishing are excluded.

### A11. User Management — P1, M

Current: user search/filter, creation, reset-link sending, status actions, and removal coexist with a Client Sessions area. Admin role assignment is intentionally unavailable through the form.

Propose explicit Users and Client Sessions navigation, identity plus role/status summaries, inline create/reset progress, and action-specific wording. Display reset delivery as a request result, not proof the recipient opened it. Explain fixed role constraints in plain language and preserve current role restrictions. Keep removal consequences adjacent to the selected user.

Acceptance: an admin can find a user, request a reset, and see the result without confusing that operation with session renewal. Creation errors retain safe form fields without exposing passwords in URLs or notifications. No role escalation controls are introduced.

### A12. Client Sessions — P1, M

Current: a separate sessions table within User Management includes search/sorting, link retrieval, renewal, expiration operations, and deletion.

Propose Active, Expiring soon, Expired, and Completed views only where server state supports them. Show absolute expiry plus relative time and timezone. Make Copy link, Renew, Expire, and Delete distinct; preview the affected count and scope for multi-session actions. After renewal, show the server-confirmed expiry and link behavior rather than assuming the old link changed or remained valid.

Acceptance: link retrieval failure is retryable without losing the row; renewal shows the resulting expiry; a multi-row operation reports partial success per record. Never expose session tokens in general-purpose analytics or saved view URLs.

### A13. Account Settings — P2, M

Current: Profile, Security, Preferences, Social Connections, Google Gmail Accounts, Detected Google Calendars, and Sign out are present, including password/image/account-removal flows.

Propose short anchored groups and independent save feedback. For Profile, show image upload/crop progress and unsaved name state. For Security, show password requirements and field-specific errors. For Preferences, make persistence scope explicit. For social/Gmail connections, show account identity, connection health, and a targeted reconnect action. For Calendars, distinguish detected calendars from the calendar actually used for booking. Explain removal effects using verified provider behavior; keep Sign out easy to locate.

Acceptance: reconnecting returns to the originating settings group; one provider failure does not hide other accounts; failed profile save leaves the entered name intact; password values clear after successful submission.

### A14. Admin client view — P1, M

Current: the shell swaps into four destinations: Dashboard, Outreach, Context, and Files. It sets an active client and restores Clients on exit. Client Files uses `readOnly` alongside explicit delete permission, so “client view” must not be described as harmless read-only preview.

Propose an always-visible “Managing [client]” banner with Exit client workspace and explicit action permissions. Do not call this impersonation or imply exact parity with the client's own UI. Confirm every destination's data resolves the chosen client; the shared Dashboard needs particular verification before displaying client-scoped claims.

| Destination | QoL scope | Acceptance |
| --- | --- | --- |
| Dashboard | Apply A1 with explicit verified client scope; label any organization-wide widget | Switching clients never relabels old/global metrics as the new client's metrics |
| Outreach | Show personal/company LinkedIn target, selected company page, connection state, generation/post preview, schedule timezone, and operation feedback together; keep editable post content on failure | Before publishing/scheduling, client, destination, content, and time are visible; retry does not silently duplicate a post |
| Context | Separate onboarding/business inputs from editable LinkedIn context; show dirty/save state and asset upload results | A client switch cannot save the previous client's edits under the new client; failed asset upload retains text |
| Files | Apply A9 and show owner; explicitly label admin delete powers | Only the selected client's authorized files display, and protection rules still apply |

The Outreach screen also exposes Sales Navigator scraper-related information and recommendations/actions. Clarify connection/setup state and the meaning of collected metrics in place; a new extension workflow is outside scope.

## Email workspace proposals

### E1. Mailbox navigation, reading, and composing — P1, M

Current: the workspace already includes account selection, search, labels, row actions, pagination, composing/replies, drafts, scheduled send, undo-send settings, templates, signatures, tracking, and meeting invite cards. Preserve these capabilities.

Propose a persistent mailbox identity, explicit search scope, readable sync/stale/error states, and a compact selection toolbar with affected count. Preserve folder, search, page, and scroll after closing a thread. Surface From account beside Send and Reply, especially for shared inboxes. Extend existing draft/save/undo feedback consistently; do not introduce a second draft or send-delay system. Explain attachment/upload blockers at Send and preserve compose contents on failure.

Acceptance: moving between two accounts never changes a reply sender silently; failed sends retain content and attachments where technically recoverable; retries reconcile with server state before resending when the first result is uncertain. Invite RSVP displays the server-confirmed response and retains an error/retry state on failure.

Every mailbox destination is covered below. Sizes are S/M on top of E1 unless provider behavior requires more work.

| Destination | Specific improvement | Acceptance |
| --- | --- | --- |
| Inbox | Make unread state, selected account, freshness, and return-to-list position clear | Opening/closing a thread preserves list context |
| Starred | Explain that this is a filtered view; keep star changes and counts consistent | Unstarring removes only the appropriate result after success |
| Important | Label importance clearly and synchronize importance actions with the view | Importance state does not contradict the visible row after refresh |
| Sent | Surface sender, sent time, and known tracking state without equating opens with confirmed reading | Unavailable tracking has a distinct label |
| Scheduled | Show timezone, scheduled time, and queued/sending/failed states; explain unavailable cancel | Already-sending messages cannot appear successfully canceled |
| Drafts | Show save status and recency; make resume versus discard explicit | A failed discard retains the draft and a failed save stays visible |
| All Mail | Explain which messages the current query includes and preserve account/search scope | Results and displayed scope agree |
| Archive | Explain how to return a message to Inbox | Restore action updates the view only when accepted |
| Spam | Make Not spam and delete effects legible | Recovery is distinguishable from permanent deletion |
| Trash | Explain restore versus permanent delete with affected count | Permanent delete requires the existing confirmation pattern and reports failures |
| Custom labels | Preserve label CRUD and show selected label/account; explain that removing a label is different from deleting mail | Label mutation cannot be mistaken for message deletion |

Discoverable shortcut help and configurable message density are P3, M after keyboard and responsive foundations.

### E2. Contacts and contact timeline — P2, M

Current: search, filters, pagination, add/edit, tags, configurable fields, CSV import/export with validation, bulk deletion, and contact timeline affordances exist.

Propose active filter chips and explicit ownership/mailbox scope, stable selection semantics across pages, and a compact detail/timeline view that returns to the same list. Improve existing CSV validation with row numbers, reasons, accepted/rejected counts, and a downloadable error report if the API supplies enough detail. Clarify whether export includes the current filters or all contacts. For duplicates, show the match and available action rather than silently implying merge support.

Acceptance: importing a mixed-validity file explains exactly what happened and permits correction without blindly duplicating accepted rows; changing scope resets or explicitly resolves bulk selection; empty timeline and failed timeline load are distinct. Duplicate merge is P3, L and requires a separate data ownership design.

### E3. Email Analytics — P2, M

Current: tracking/deliverability/reporting views combine aggregate metrics and breakdowns; some breakdowns use recent-page data rather than full aggregates.

Propose visible account/date/timezone scope, freshness, denominator definitions, and labels differentiating aggregate totals from limited recent-message breakdowns. Distinguish sent, delivered where known, opened, clicked, replied, and failed. Link actionable failures to the relevant campaign, message, or settings group. Keep provider health separate from engagement metrics.

Acceptance: users can explain why a chart differs from a headline total; unavailable provider data is not zero; changing accounts never leaves stale metrics under the new account heading. Export is P3, M and must preserve scope and sampling labels.

### E4. Cartography Discover and Review — P2, M

Current: Discover supports search/agentic modes, city/radius constraints, task outcomes, and candidate results; Review supports contact editing, rejection, and promotion.

Propose clear mode descriptions/examples, a visible applied location/radius, and retention of the submitted query alongside results. Show partial task success without discarding usable candidates. In Review, display provenance/available confidence, missing-field reasons, selected count, and the promotion destination. Keep inline edits after failed promotion and report per-item outcomes. Use “Cartography” consistently in user-facing text despite the internal module key.

Acceptance: failed discovery is distinguishable from no matches; a candidate missing required email explains why promotion is unavailable; partial promotion retains failed rows and does not re-promote successful ones. Saved searches and resumable background discovery are P3, L pending job/storage support.

### E5. Campaigns — P1, M/L

Current: searchable campaign list, creation flow with a ready-to-launch stage, detail Overview/Contacts/Analytics tabs, sequence/send settings, failed sends, status actions, and audience sync exist.

| Surface | Proposed improvement | Acceptance |
| --- | --- | --- |
| List | Visible status/provider/sender filters and last sync/run result; preserve list state after detail | A blocked campaign is distinguishable from a paused or completed one |
| Create | Preserve wizard input; make the existing launch review summarize sender, audience count, exclusions, sequence timing, and required sending settings | Failed validation returns to the relevant field without losing earlier steps |
| Overview | Show plain-language status, next eligible action, queue/sync progress, and failed-send reasons with safe targeted retry where supported | Accepted queue/sync requests do not claim delivery; uncertain sends are reconciled before retry |
| Contacts | Retain search/filter, show status history/reason, clarify audience membership and any exclusions | A status change reports success/failure on the correct contact and preserves history |
| Analytics | Define totals/rates, data window, and last refresh; distinguish provider-reported from locally observed metrics | Metrics reconcile to their stated dataset and unavailable values stay distinct |

Surface actual launch blockers before action, including missing company sending settings where the backend requires them. Do not add legal claims or duplicate the send engine in UI. Scope-aware preflight and retry guarantees may require API changes, which account for L sizing. Campaign cloning and sequence redesign are P3 and outside the first release.

## Email Settings: complete section scope

### E6. Settings navigation and save model — P1, M

Current: this long page already has a table of contents, section anchors, and active-section tracking. Extend those with settings search, a stable selected-account summary, scope badges, and independent save/error state. Preserve anchors on return from provider setup. Do not replace the existing navigation with another parallel system.

The table covers all 22 current settings sections. Priority/size applies to incremental work after the shared settings foundation. Scope labels must reflect actual endpoint behavior, not just existing descriptions.

| Section | Proposed QoL change | Priority / size | Acceptance |
| --- | --- | --- | --- |
| Inbox layout | Preview current order/visibility and offer restore defaults while preserving existing synced ordering | P2 / S | Changes persist and Inbox remains available |
| Send mail as | Clearly identify selected mailbox, allowed aliases, default sender, and external Gmail management handoff | P1 / S | Users know which address will be used before composing |
| Undo send | Show duration and device-only scope beside the control; explain the holding period | P2 / S | Feedback matches the existing delay and does not promise recall after dispatch |
| Inboxes | Make primary/enabled states explicit and show pending/save failure on selection changes | P1 / M | Primary account and resulting default compose account agree |
| Confidential messages | Show recipient, expiry, access state, and clear revoke impact | P2 / S | Failed revoke does not report access revoked |
| Deliverability | Use readable status explanations, last checked time, and targeted recheck | P2 / M | Unknown/loading/failed checks are distinct from a failed authentication result |
| Gmail reputation (Postmaster) | Show reporting date, lag, missing-permission/no-data explanations, and reconnect path | P2 / M | Lack of a report is not displayed as zero complaints |
| Campaign sending | Show company scope, required-field validation, and link back to blocked campaigns | P1 / M | A campaign can identify this missing setup before launch |
| Meeting booking | Separate scheduling links from bookings; search/filter bookings; copy/preview links; show timezone, provider, owner, and availability summary | P1 / M/L | Create/copy a link and find its booking without scrolling through unrelated settings |
| Shared inboxes | Summarize person → mailbox → read/send access before save/removal; show per-grant outcomes | P1 / M | UI reflects actual granted permissions; revoked access does not linger as usable |
| Email tracking | Show actual account-wide scope and explain effects on future messages | P2 / S | Toggle result and scope are visible without implying retroactive tracking |
| Reply notifications | Name the destination and scope; provide clear save/failure feedback | P2 / S | A saved toggle is not described as proof notification delivery works |
| Read receipts | Distinguish requesting a receipt from guaranteed receipt delivery | P2 / S | Default and per-message override are understandable |
| Vacation responder | Show timezone/date bounds, effective status, and reply preview | P2 / M | Invalid ranges are caught before save; scheduled and active states differ |
| Artemis AI | Explain the effect of each preference and how it affects composing/review | P2 / S | Preference changes visibly persist and do not imply automatic sending |
| Filters & rules | Readable condition/action summary, duplicate/delete feedback, safe edit preservation | P2 / M | Users can identify what a rule will do before saving; dry-run preview is optional pending API support |
| Signatures | Preview formatting and make selected-inbox/default association explicit | P2 / M | The chosen signature appears for the correct sender |
| Templates | Extend existing template rendering with sample-recipient preview and missing-variable feedback | P2 / M | Unresolved variables are visible before insertion/send |
| Contact tags | Search tags and explain rename/delete impact with row feedback | P2 / S | Renaming/deleting refreshes affected contact displays consistently |
| Contact field visibility | Live example plus restore defaults; clarify where the choice applies | P2 / S | Preview and Contacts render the same visible fields |
| Blocked senders | Search and confirm exact address/account scope; show unblock result inline | P2 / S | Failed unblock retains the sender in the list |
| Domain mail (SMTP / IMAP / POP) | Group provider fields, show supported capabilities and connection-test results, preserve nonsecret values after failure | P1 / M | A send-only connection does not imply inbox retrieval support; credentials are never echoed in errors |

Meeting operations also need explicit claim deadlines and ownership for the organization queue; row-level feedback for claim, reassign, cancel, and erase; and distinct attendance states for pending, provider-synced, manually entered, and CSV-imported results. CSV import errors should identify the file/row problem where supplied. A claimed slot must not remain claimable after server rejection because another person claimed it. Erase and cancel need different consequence wording. Moving booking operations to a dedicated page is P3, L; initial work keeps the existing route and anchors.

## Adjacent admin route

### A15. Separate Manage Users — P2, M

Current: `/manage-users` uses a separate shell and a completed-user list with password reset feedback, overlapping the panel's User Management capability.

Propose matching navigation, search, loading/error/empty states, and per-user reset feedback. Define the completed-user subset in the page description. Prefer a future canonical User Management destination with a completed-user filter if endpoint semantics and permissions can be preserved; keep the old route compatible before any consolidation. Do not remove it solely because it appears redundant.

Acceptance: a bookmarked route remains useful, clearly explains its subset, and permits return to the main panel; failed initial fetch offers retry; selecting another user cannot display the previous user's reset success as its own.

## Delivery sequence and dependencies

| Release slice | Deliverable | Dependencies / boundary |
| --- | --- | --- |
| 1. Feedback and context | G3–G5 patterns; A9 file recovery; client/mailbox scope; local mutation feedback | Reuse existing shared UI; verify role and endpoint semantics; no new provider features |
| 2. Preserve work | G1–G2; Marketing Tracker, Blog, Tasks, email compose, and settings state protection | Shared dirty-state contract, URL state design, concurrency handling; use existing draft support first |
| 3. Daily workflow shortcuts | Dashboard drill-through, client/staff/task quick views, PDF handoffs, calculator clarity, settings refinements | Stable navigation and filtering; entity access validated on deep links |
| 4. Operational workflows | Contacts import recovery, Cartography review, campaign preflight, booking operations, user/session management polish | Confirm partial-result, idempotency, and status APIs before promising reliable retry |
| Later, separately scoped | Saved scenarios/searches, server draft history, campaign cloning, widget customization, booking-page extraction | Validate demand and estimate storage/API/provider work independently |

Implementation should reuse the current authorization model documented in [ROLE_MODEL_REDESIGN](ROLE_MODEL_REDESIGN.md). Existing email cache and Cartography design documents are context for later implementation, not evidence that all documented features are deployed. Do not change cache architecture, role assignment, signing semantics, campaign dispatch, or calculation formulas as an incidental QoL task.

Before implementation, inspect endpoint contracts for each selected slice. UI-only candidates include text/labels, filter chips over already-loaded data, local retry presentation, and progress states. Features such as conflict-safe saves, server drafts, aggregate filtering/export, invitation resend, resumable discovery, and exactly-once retries require backend verification and possibly additional work. Keep those separate in estimates.

## Validation and success criteria

For each slice, validate populated, empty, filtered-empty, loading, stale, unavailable, mutation-failure, and successful states. Exercise admin and staff permissions, shared-mailbox read-only versus send grants, and two distinct clients. Use realistic long names, expired links, partial imports, and provider failures. Verify keyboard navigation, focus return, the three target viewport widths, and 200% zoom.

Cross-page release scenarios:

1. Filter Clients, enter client view, edit Context, trigger an external data refresh, and exit without losing input or list position.
2. Edit Marketing Tracker and switch month before debounce completes; verify the correct period receives the update.
3. Edit a task/blog, fail a save, retry, and use Back; input and record identity remain correct.
4. Fail Files loading/deletion; no failure masquerades as empty data or success.
5. Compose from a shared mailbox, fail sending, reconnect, and retry without silently changing sender or duplicating delivery.
6. Import mixed-validity contacts, promote a partly valid Cartography selection, and inspect campaign failures; each outcome is explicit per affected record.
7. Claim an already-claimed booking and renew an expired session; display authoritative server outcomes and preserve context.
8. Open a saved destination as an unauthorized role; retain a clear recovery path without exposing another client's/mailbox's data.

Measure baseline task completion time, clicks/backtracking, save-loss reports, repeated submissions, and recovery success with a small set of representative admin workflows before implementation. Proposed targets: reduce median steps for find/open/return tasks by 25%; complete the failure-recovery scenarios without re-entering unaffected fields; zero draft loss or wrong-scope actions in the scripted validation suite. These are targets, not measured improvements. Any future telemetry should record event/state outcomes, not message bodies, passwords, signing links, or client context text.

## Decisions to resolve during implementation planning

- Which workflows are most frequent for admins versus staff? This can reorder P2 work without blocking shared P1 fixes.
- Which settings really apply per inbox, user, company, or device? Reconcile current copy with endpoint behavior before adding scope labels.
- Which widgets support client/date filtering and which are organization-wide? Do not promise unified filtering until confirmed.
- Which mutations expose revisions, partial results, or idempotency guarantees? Those determine safe refresh and retry designs.
- Should `/manage-users` remain a distinct completed-user workflow or become a compatible entry into User Management?
- Is recovery beyond the current browser session required for blog/context/PDF work? If so, estimate server draft persistence separately.

The recommended first implementation slice is shared action feedback and scope labeling plus Files error recovery, followed by draft-safe refresh/navigation. Those changes support every page while directly addressing source-visible failure and state-loss risks.
