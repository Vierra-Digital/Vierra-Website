import { prisma } from "@/lib/prisma";
import { modifyMessageLabels, getOrCreateLabelId, createGmailDraft } from "@/lib/gmail/gmailApi";
import { resolveAccountId } from "@/lib/api/emailAccounts";
import { sendEmailCore } from "@/lib/gmail/sendCore";
import { artemisGenerate, artemisConfigured } from "@/lib/ai/artemis";
import { notifyDiscord, discordConfigured } from "@/lib/notify/discord";
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

  const accountId = await resolveAccountId(msg.userId, msg.accountEmail);
  if (!accountId) return;
  const setting = await prisma.emailAccountSetting.findUnique({ where: { account_id: accountId } });
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

/** Retrieve lightweight context (prior threads with this sender, contact info) to ground the draft. */
async function buildRagContext(userId: string, senderEmail: string): Promise<string> {
  const [priorOutbound, contact] = await Promise.all([
    prisma.emailOutboundMessage.findMany({
      where: { user_id: userId, email_outbound_recipients: { some: { email: senderEmail } } },
      orderBy: { created_at: "desc" },
      take: 3,
      select: { subject: true, body_text: true },
    }),
    prisma.contact.findFirst({
      where: { user_id: userId, email: senderEmail },
      select: { first_name: true, last_name: true, business: true },
    }),
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
  const context = await buildRagContext(msg.userId, sender);

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

/**
 * Reply-intelligence (Artemis): when an inbound reply matches an active campaign contact,
 * auto-pause their sequence and record the lead-status change. If Artemis is configured,
 * classify the reply to set a more specific lead status.
 */
export async function maybeReplyIntelligence(msg: InboundMessage): Promise<void> {
  if (isAutomatedSender(msg)) return;

  const contact = await prisma.campaignContact.findFirst({
    where: {
      contact_email: msg.fromEmail,
      queue_status: { notIn: ["paused", "completed", "unsubscribed", "bounced"] },
    },
    orderBy: { enrolled_at: "desc" },
  });
  if (!contact) return;

  // Default: a reply pauses the sequence.
  let leadStatus = "replied";

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
      const map: Record<string, string> = {
        interested: "interested",
        not_interested: "not_interested",
        out_of_office: "no_response",
        unsubscribe: "unsubscribed",
        neutral: "replied",
      };
      if (map[label]) leadStatus = map[label];
    }
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
      from_status: contact.lead_status,
      to_status: leadStatus,
      changed_by_rule: "inbound_reply",
      note: "Auto-updated from an inbound reply.",
    },
  });
}

/** Notify the team Discord when a real reply (to one of your threads) arrives. */
export async function maybeNotifyDiscord(msg: InboundMessage): Promise<void> {
  if (!discordConfigured()) return;
  // Only reply threads (In-Reply-To present) from humans — not cold inbound / automated mail.
  if (!msg.inReplyTo || isAutomatedSender(msg)) return;
  await notifyDiscord(
    `📬 **Reply** from ${msg.from || msg.fromEmail} → ${msg.accountEmail}\n` +
      `**${msg.subject || "(no subject)"}**\n${msg.snippet.slice(0, 240)}`
  );
}
