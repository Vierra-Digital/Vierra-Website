import { prisma } from "@/lib/prisma";
import { modifyMessageLabels, getOrCreateLabelId, createGmailDraft, gmailGet } from "@/lib/gmail/gmailApi";
import { resolveAccountId } from "@/lib/api/emailAccounts";
import { sendEmailCore } from "@/lib/gmail/sendCore";
import { artemisGenerate, artemisConfigured } from "@/lib/ai/artemis";
import { notifyDiscordEmbed, notifyCampaignReply, discordConfigured } from "@/lib/notify/discord";
import { addToDnc } from "@/lib/campaigns/dnc";
import { bumpCampaignStat } from "@/lib/campaigns/campaignStats";
import { looksLikeBounce, parseDeliveryStatus, extractDsnParts } from "@/lib/gmail/dsn";
import type { InboundMessage, InboundContext } from "@/lib/gmail/inboundTypes";

/** True for automated/bulk mail we must never auto-reply to (prevents mail loops). */
function isAutomatedSender(msg: InboundMessage): boolean {
  const autoSubmitted = (msg.headers["auto-submitted"] || "").toLowerCase();
  if (autoSubmitted && autoSubmitted !== "no") return true;
  const precedence = (msg.headers["precedence"] || "").toLowerCase();
  if (/bulk|list|junk/.test(precedence)) return true;
  if (msg.headers["list-unsubscribe"] || msg.headers["list-id"]) return true;
  if (/(no-?reply|do-?not-?reply|mailer-daemon|postmaster|bounce)@/i.test(msg.fromEmail)) return true;
  return false;
}

/**
 * Inbound-processing hooks. The inbound loop (lib/gmail/inbound.ts) calls each of these
 * for every newly-arrived message. Bodies are filled in by their respective features:
 *   - applyFilters        -> filters/rules (user-defined actions)
 *   - maybeSendVacationReply -> vacation auto-responder
 *   - maybeAutoDraft      -> Artemis autonomous auto-draft
 *   - maybeHandleMdn      -> read-receipt (MDN) handling
 * Each is best-effort: it must never throw (the loop keeps going for other messages).
 */

export async function applyFilters(msg: InboundMessage, ctx: InboundContext): Promise<void> {
  const filters = await prisma.emailFilter.findMany({
    where: {
      user_id: msg.userId,
      enabled: true,
      OR: [{ account_email: null }, { account_email: msg.accountEmail }],
    },
  });
  if (filters.length === 0) return;

  const fromHay = `${msg.fromEmail} ${msg.from}`.toLowerCase();
  const subjectHay = msg.subject.toLowerCase();
  const anyHay = `${msg.subject} ${msg.snippet} ${msg.from}`.toLowerCase();

  const add = new Set<string>();
  const remove = new Set<string>();

  for (const f of filters) {
    const conds: boolean[] = [];
    if (f.from_contains) conds.push(fromHay.includes(f.from_contains.toLowerCase()));
    if (f.subject_contains) conds.push(subjectHay.includes(f.subject_contains.toLowerCase()));
    if (f.query_contains) conds.push(anyHay.includes(f.query_contains.toLowerCase()));
    if (conds.length === 0) continue;
    const matched = f.match_type === "any" ? conds.some(Boolean) : conds.every(Boolean);
    if (!matched) continue;

    if (f.archive) remove.add("INBOX");
    if (f.mark_read) remove.add("UNREAD");
    if (f.star) add.add("STARRED");
    if (f.trash) add.add("TRASH");
    if (f.add_label_id) {
      add.add(f.add_label_id);
    } else if (f.add_label_name) {
      const labelId = await getOrCreateLabelId(ctx.accessToken, f.add_label_name);
      if (labelId) add.add(labelId);
    }
  }

  if (add.size > 0 || remove.size > 0) {
    await modifyMessageLabels(ctx.accessToken, msg.id, {
      addLabelIds: [...add],
      removeLabelIds: [...remove],
    });
  }
}

export async function maybeSendVacationReply(msg: InboundMessage, ctx: InboundContext): Promise<void> {
  const sender = msg.fromEmail;
  if (!sender || sender === msg.accountEmail.toLowerCase()) return;
  if (isAutomatedSender(msg)) return;

  const setting = await prisma.emailAccountSetting.findUnique({
    where: { user_id_account_email: { user_id: msg.userId, account_email: msg.accountEmail } },
  });
  if (!setting || !setting.vacation_responder_enabled) return;

  const now = ctx.now;
  if (setting.vacation_start_at && now < setting.vacation_start_at) return;
  if (setting.vacation_end_at && now > setting.vacation_end_at) return;

  // Throttle: at most one auto-reply per sender per frequency window.
  const freqMs = (setting.vacation_reply_frequency_hours || 24) * 60 * 60 * 1000;
  const existing = await prisma.emailVacationResponseLog.findUnique({
    where: { email_account_setting_id_sender_email: { email_account_setting_id: setting.id, sender_email: sender } },
  });
  if (existing && now.getTime() - existing.last_sent_at.getTime() < freqMs) return;

  const result = await sendEmailCore(
    msg.userId,
    {
      accountEmail: msg.accountEmail,
      to: sender,
      subject: setting.vacation_subject?.trim() || "Automatic reply",
      body: setting.vacation_body_text || "",
      bodyHtml: setting.vacation_body_html || "",
      threadId: msg.threadId,
      inReplyTo: msg.messageIdHeader,
      references: msg.messageIdHeader,
    },
    ctx.baseUrl
  );
  if (!result.ok) return;

  await prisma.emailVacationResponseLog.upsert({
    where: { email_account_setting_id_sender_email: { email_account_setting_id: setting.id, sender_email: sender } },
    create: { email_account_setting_id: setting.id, sender_email: sender, last_sent_at: now },
    update: { last_sent_at: now, updated_at: now },
  });
}

/**
 * Record hard bounces from delivery-status notifications (RFC 3464).
 *
 * Until this existed, bounces were only ever reported for Brevo-sent campaigns (via its webhook) —
 * Gmail sends reported zero, so "Bounces" in the analytics deliverability panel was always 0 and
 * dead addresses kept receiving the rest of a sequence.
 *
 * Permanent (5.x.x) failures suppress the contact and add it to the DNC list; transient (4.x.x)
 * ones are left alone because the sending side retries them. Best-effort throughout: a bounce we
 * can't attribute is simply not recorded.
 */
export async function maybeRecordBounce(msg: InboundMessage, ctx: InboundContext): Promise<void> {
  if (!looksLikeBounce(msg.headers, msg.fromEmail)) return;

  // The inbound loop fetches headers only; pull the body just for suspected bounces (rare).
  const { ok, data } = await gmailGet(ctx.accessToken, `/messages/${encodeURIComponent(msg.id)}?format=full`);
  if (!ok || !data || typeof data !== "object") return;
  const { deliveryStatus } = extractDsnParts((data as { payload?: unknown }).payload);
  const recipients = parseDeliveryStatus(deliveryStatus).filter((r) => r.permanent);
  if (recipients.length === 0) return;

  // Same fail-closed scoping as reply matching: bounces return to the sending mailbox, so only
  // campaigns sent FROM this account may match. No resolvable account means no reliable scope.
  const accountId = await resolveAccountId(msg.userId, msg.accountEmail);
  if (!accountId) return;

  for (const recipient of recipients) {
    const contact = await prisma.campaignContact.findFirst({
      where: {
        contact_email: recipient.email,
        // A contact already skipped/failed needs no further action.
        queue_status: { notIn: ["skipped", "failed"] },
        campaigns: { account_id: accountId },
      },
      orderBy: { enrolled_at: "desc" },
      select: { id: true, campaign_id: true },
    });
    if (!contact) continue;

    // Stop the sequence for this address, and record why.
    await prisma.campaignContact.update({
      where: { id: contact.id },
      data: { queue_status: "skipped", skip_reason: "bounce", next_send_at: null },
    });
    await bumpCampaignStat(contact.campaign_id, "bounces");
    // Suppress future sends to a permanently-failing address across the whole mailbox.
    await addToDnc(contact.campaign_id, recipient.email, "bounce").catch(() => {});
  }
}

/** Retrieve lightweight context (prior threads with this sender, contact info) to ground the draft. */
async function buildRagContext(userId: string, accountEmail: string, senderEmail: string): Promise<string> {
  // Contacts are client-scoped now (see docs/ROLE_MODEL_REDESIGN.md's "v2" section) — the mailbox
  // this reply is drafted from already pins down which client, same pattern as elsewhere in this
  // file (see resolveAccountId's other call sites above).
  const accountId = await resolveAccountId(userId, accountEmail);
  const account = accountId
    ? await prisma.emailProviderAccount.findUnique({ where: { id: accountId }, select: { company_id: true } })
    : null;

  const [priorOutbound, contact] = await Promise.all([
    prisma.emailOutboundMessage.findMany({
      where: { user_id: userId, email_outbound_recipients: { some: { email: senderEmail } } },
      orderBy: { created_at: "desc" },
      take: 3,
      select: { subject: true, body_text: true },
    }),
    account?.company_id
      ? prisma.contact.findFirst({
          where: { company_id: account.company_id, email: senderEmail },
          select: { first_name: true, last_name: true, business: true },
        })
      : null,
  ]);

  const parts: string[] = [];
  if (contact) {
    const name = [contact.first_name, contact.last_name].filter(Boolean).join(" ");
    parts.push(`Known contact: ${name || senderEmail}${contact.business ? ` (${contact.business})` : ""}.`);
  }
  if (priorOutbound.length) {
    parts.push(
      "Recent messages you sent this person:\n" +
        priorOutbound
          .map((m) => `- ${m.subject || "(no subject)"}: ${(m.body_text || "").slice(0, 200)}`)
          .join("\n")
    );
  }
  return parts.join("\n\n");
}

export async function maybeAutoDraft(msg: InboundMessage, ctx: InboundContext): Promise<void> {
  if (!artemisConfigured()) return;
  const sender = msg.fromEmail;
  if (!sender || sender === msg.accountEmail.toLowerCase()) return;
  if (isAutomatedSender(msg)) return;

  const pref = await prisma.emailAiPreference.findUnique({ where: { user_id: msg.userId } });
  if (pref?.autonomy !== "autodraft") return;

  const tone = pref.tone || "professional and friendly";
  const context = await buildRagContext(msg.userId, msg.accountEmail, sender);

  const system =
    `You are Artemis, an assistant that drafts email replies on behalf of the account owner. ` +
    `Write in a ${tone} tone. Be concise and specific. Write only the reply body — no subject line, ` +
    `no "Draft:" preface, no placeholders like [Name] unless truly unknown. This is a DRAFT the user will review before sending.` +
    (context ? `\n\nRelevant context:\n${context}` : "");

  const userPrompt =
    `Draft a reply to this email.\n\nFrom: ${msg.from}\nSubject: ${msg.subject}\n\n${msg.snippet}`;

  const result = await artemisGenerate({ system, messages: [{ role: "user", content: userPrompt }], maxTokens: 800 });
  if (!result.ok || !result.text.trim()) return;

  const subject = /^re:/i.test(msg.subject.trim()) ? msg.subject.trim() : `Re: ${msg.subject.trim() || "(No Subject)"}`;
  await createGmailDraft(ctx.accessToken, {
    to: msg.from || sender,
    subject,
    bodyText: result.text.trim(),
    threadId: msg.threadId,
    inReplyTo: msg.messageIdHeader,
    references: msg.messageIdHeader,
  });
}

export async function maybeHandleMdn(msg: InboundMessage, ctx: InboundContext): Promise<void> {
  // An MDN (read receipt) arrives as multipart/report; report-type=disposition-notification.
  const contentType = (msg.headers["content-type"] || "").toLowerCase();
  const looksLikeMdn =
    contentType.includes("report-type=disposition-notification") ||
    (contentType.includes("multipart/report") && /^read:/i.test(msg.subject.trim()));
  if (!looksLikeMdn) return;

  // Best-effort match: the most recent tracked outbound message this user sent TO the
  // reporter (no reliable Original-Message-ID in metadata). Record a distinct READ event.
  const outbound = await prisma.emailOutboundMessage.findFirst({
    where: {
      user_id: msg.userId,
      email_outbound_recipients: { some: { email: msg.fromEmail } },
    },
    orderBy: { created_at: "desc" },
    select: { id: true },
  });
  if (!outbound) return;

  await prisma.emailTrackingEvent.create({
    data: {
      outbound_message_id: outbound.id,
      event_type: "READ",
      recipient_email: msg.fromEmail,
      occurred_at: ctx.now,
    },
  });
}

/** Result of a campaign-contact match + classification, threaded into maybeNotifyDiscord so the
 *  Discord ping can carry campaign name + lead status instead of firing blind. */
export type ReplyIntelligenceResult = {
  campaignId: string;
  campaignContactId: string;
  fromStatus: string | null;
  leadStatus: string;
} | null;

/**
 * Reply-intelligence (Artemis): when an inbound reply matches an active campaign contact,
 * auto-pause their sequence and record the lead-status change. If Artemis is configured,
 * classify the reply to set a more specific lead status. Returns the match + classification
 * (or null when no campaign contact matched) so callers — namely maybeNotifyDiscord — can
 * enrich their own output without re-running this lookup.
 */
export async function maybeReplyIntelligence(msg: InboundMessage): Promise<ReplyIntelligenceResult> {
  if (isAutomatedSender(msg)) return null;

  // Scope to campaigns sent FROM the mailbox that received this reply — replies come back to
  // the sending address, so this is the same account. Without it, a prospect email shared
  // across two tenants' campaigns would flip whichever contact sorts first (wrong tenant). A
  // missing accountId (no EmailProviderAccount row for this mailbox — e.g. an alternate connect
  // path) previously dropped the scope filter entirely rather than failing closed, which let a
  // reply match the most-recently-enrolled contact with that email ACROSS EVERY TENANT. Fail
  // closed instead: no resolvable account means no reliable scope, so match nothing.
  const accountId = await resolveAccountId(msg.userId, msg.accountEmail);
  if (!accountId) return null;
  const contact = await prisma.campaignContact.findFirst({
    where: {
      contact_email: msg.fromEmail,
      // Canonical QUEUE_STATUSES (lib/api/campaigns.ts) is queued|sending|sent|failed|skipped|
      // completed|paused. "completed" is deliberately NOT excluded here — sendQueueTick.ts sets it
      // as soon as a contact's last sequence step goes out, which is exactly when most real replies
      // arrive (after reading the full sequence, or the one email in a single-step campaign).
      // Excluding it meant most replies never matched a campaign contact at all.
      queue_status: { notIn: ["paused", "skipped", "failed"] },
      campaigns: { account_id: accountId },
    },
    orderBy: { enrolled_at: "desc" },
  });
  if (!contact) return null;

  // Default: a reply pauses the sequence. ("reply" — not "replied", which isn't in LEAD_STATUSES.)
  let leadStatus = "reply";

  if (artemisConfigured()) {
    const result = await artemisGenerate({
      system:
        "Classify this email reply into exactly one label from: interested, not_interested, " +
        "out_of_office, unsubscribe, neutral. Respond with ONLY the label, nothing else.",
      messages: [{ role: "user", content: `Subject: ${msg.subject}\n\n${msg.snippet}` }],
      maxTokens: 8,
    });
    if (result.ok) {
      const label = result.text.trim().toLowerCase().replace(/[^a-z_]/g, "");
      // Values must be canonical LEAD_STATUSES (lib/api/campaigns.ts) — "interested" and
      // "unsubscribed" were never valid entries there (positive_response / remove_contact are);
      // writing the old values meant these replies wouldn't match the UI's status filter chips.
      const map: Record<string, string> = {
        interested: "positive_response",
        not_interested: "not_interested",
        out_of_office: "no_response",
        unsubscribe: "remove_contact",
        neutral: "reply",
      };
      if (map[label]) leadStatus = map[label];
    }
  }

  const fromStatus = contact.lead_status;
  // An out-of-office-flavored reply ("no_response") must not erase a status that already carries
  // real signal — isAutomatedSender() only checks headers, so a genuine human reply whose body
  // just reads like an OOO note (e.g. "swamped this week, will follow up Monday" sent from a
  // normal inbox) can reach here after the contact was already classified positive_response,
  // meeting_booked, etc. Downgrading that back to no_response would silently discard the prior
  // signal. Keep the existing status in that case instead of overwriting it.
  const STICKY_STATUSES = new Set([
    "positive_response",
    "positive_response_closed",
    "meeting_booked",
    "not_interested",
    "remove_contact",
    "bad_timing",
  ]);
  if (leadStatus === "no_response" && STICKY_STATUSES.has(fromStatus)) {
    leadStatus = fromStatus;
  }
  const now = new Date();
  await prisma.campaignContact.update({
    where: { id: contact.id },
    data: {
      queue_status: leadStatus === "no_response" ? contact.queue_status : "paused",
      lead_status: leadStatus,
      updated_at: now,
    },
  });
  await prisma.leadStatusEvent.create({
    data: {
      campaign_contact_id: contact.id,
      from_status: fromStatus,
      to_status: leadStatus,
      changed_by_rule: "inbound_reply",
      note: "Auto-updated from an inbound reply.",
    },
  });

  // An auto-classified unsubscribe should actually stop future contact, same as the manual
  // remove_contact categorization path (pages/api/campaigns/[id]/contacts/[contactId].ts) —
  // previously this branch changed lead_status but never added the sender to the DNC list.
  if (leadStatus === "remove_contact") {
    await addToDnc(contact.campaign_id, msg.fromEmail, "categorization");
  }

  return { campaignId: contact.campaign_id, campaignContactId: contact.id, fromStatus, leadStatus };
}

/**
 * Notify the team Discord when a real reply (to one of your threads) arrives. When `replyIntel`
 * identifies this as a campaign contact's reply (passed in by the inbound loop, which runs
 * maybeReplyIntelligence first), the message is enriched with the campaign name and lead status
 * — color/emoji-coded so a positive reply is visually distinguishable from a negative one —
 * instead of the plain "someone replied" ping.
 */
export async function maybeNotifyDiscord(msg: InboundMessage, replyIntel?: ReplyIntelligenceResult): Promise<void> {
  if (!discordConfigured()) return;
  // Only reply threads (In-Reply-To present) from humans — not cold inbound / automated mail.
  if (!msg.inReplyTo || isAutomatedSender(msg)) return;
  // Per-inbox opt-out: skip if this mailbox has reply notifications turned off in settings.
  // No settings row → default on (preserves the pre-toggle behavior of notifying for every inbox).
  const setting = await prisma.emailAccountSetting.findUnique({
    where: { user_id_account_email: { user_id: msg.userId, account_email: msg.accountEmail } },
    select: { reply_notifications_enabled: true },
  });
  if (setting && !setting.reply_notifications_enabled) return;
  const base = (process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || "").replace(/\/$/, "");
  // Deep link into the panel: the embed title links straight to this mailbox + conversation so you
  // can respond right there. If logged out, login bounces back here via ?returnTo.
  const threadUrl =
    base && msg.threadId
      ? `${base}/panel/email?accounts=${encodeURIComponent(msg.accountEmail)}&thread=${encodeURIComponent(msg.threadId)}`
      : undefined;

  if (replyIntel) {
    const campaign = await prisma.campaign.findUnique({ where: { id: replyIntel.campaignId }, select: { name: true } });
    await notifyCampaignReply({
      contactEmail: msg.fromEmail,
      campaignName: campaign?.name ?? "(unknown)",
      leadStatus: replyIntel.leadStatus,
      fromStatus: replyIntel.fromStatus,
      subject: msg.subject,
      snippet: msg.snippet,
      threadUrl,
    });
    return;
  }

  await notifyDiscordEmbed({
    author: { name: `Reply From ${(msg.from || msg.fromEmail).slice(0, 240)}` },
    title: (msg.subject || "(no subject)").slice(0, 250),
    ...(threadUrl ? { url: threadUrl } : {}),
    description: msg.snippet.slice(0, 500) || undefined,
    color: 0x701cc0, // Vierra purple
    fields: [{ name: "Inbox", value: msg.accountEmail, inline: true }],
  });
}
