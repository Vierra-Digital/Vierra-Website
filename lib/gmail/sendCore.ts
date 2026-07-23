import { randomUUID } from "crypto";
import type { EmailProviderAccount } from "@prisma/client";
import { sanitizeRichEmailHtml } from "@/lib/email/sanitize";
import { prisma } from "@/lib/prisma";
import { getValidGmailAccessToken } from "@/lib/gmail/tokens";
import { toBase64Url } from "@/lib/gmail/gmailApi";
import { createSmtpTransport } from "@/lib/email/smtp";
import { resolveAccountId } from "@/lib/api/emailAccounts";
import { asStr } from "@/lib/api/parsing";

/**
 * Reusable email send core — extracted from pages/api/gmail/send.ts so it can be
 * called both by the authenticated send endpoint AND by the session-less scheduled
 * dispatcher (Netlify Scheduled Function). No req/res/session coupling: the caller
 * passes userId + payload + baseUrl and gets a plain result back.
 */

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function extractEmailAddress(input: string) {
  const match = input.match(/<([^>]+)>/);
  if (match?.[1]) return match[1].trim();
  return input.trim();
}

function splitRecipients(value: string) {
  return value
    .split(",")
    .map((entry) => extractEmailAddress(entry))
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function ensureReplyPrefix(subject: string) {
  if (/^re:/i.test(subject.trim())) return subject.trim();
  return `Re: ${subject.trim() || "(No Subject)"}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function linkifyText(value: string) {
  const escaped = escapeHtml(value);
  return escaped
    .replace(
      /(https?:\/\/[^\s<>"']+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer" style="color:#5B21B6;text-decoration:underline;">$1</a>'
    )
    .replace(/\n/g, "<br>");
}

function rewriteTrackedLinksInHtml(value: string, replacements: Map<string, string>) {
  if (!value || replacements.size === 0) return value;
  return value.replace(/href=(['"])(https?:\/\/[^\s"'<>]+)\1/gi, (match, quote: string, href: string) => {
    const trackedHref = replacements.get(href);
    if (!trackedHref) return match;
    return `href=${quote}${escapeHtml(trackedHref)}${quote}`;
  });
}

function linkifyTextWithTrackedHrefs(value: string, replacements: Map<string, string>) {
  if (!value) return "";
  const urlRegex = /https?:\/\/[^\s<>"']+/g;
  const chunks: string[] = [];
  let lastIndex = 0;
  let match = urlRegex.exec(value);
  while (match) {
    const rawUrl = match[0];
    const start = match.index;
    if (start > lastIndex) {
      chunks.push(escapeHtml(value.slice(lastIndex, start)).replace(/\n/g, "<br>"));
    }
    const href = replacements.get(rawUrl) || rawUrl;
    chunks.push(
      `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" style="color:#5B21B6;text-decoration:underline;">${escapeHtml(rawUrl)}</a>`
    );
    lastIndex = start + rawUrl.length;
    match = urlRegex.exec(value);
  }
  if (lastIndex < value.length) {
    chunks.push(escapeHtml(value.slice(lastIndex)).replace(/\n/g, "<br>"));
  }
  return chunks.join("");
}

function uniqueUrls(value: string) {
  const matches = value.match(/https?:\/\/[^\s<>"']+/g) || [];
  return Array.from(new Set(matches));
}

function uniqueUrlsFromHtmlHref(html: string) {
  const set = new Set<string>();
  const re = /href\s*=\s*(["'])(https?:\/\/[^"']+)\1/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    set.add(m[2]);
  }
  return Array.from(set);
}

function mergeClickTrackUrls(plain: string, html: string) {
  return Array.from(new Set([...uniqueUrls(plain), ...uniqueUrlsFromHtmlHref(html)]));
}


const ATTACHMENTS_MAX_BYTES = 24 * 1024 * 1024;

export function parseAttachments(
  raw: unknown
):
  | { ok: true; parts: Array<{ filename: string; contentType: string; base64: string }> }
  | { ok: false; message: string } {
  if (raw == null || raw === undefined) return { ok: true, parts: [] };
  if (!Array.isArray(raw)) return { ok: false, message: "attachments must be an array." };
  const parts: Array<{ filename: string; contentType: string; base64: string }> = [];
  let total = 0;
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const filename = asStr(row.filename) || "attachment";
    const contentType = asStr(row.contentType) || "application/octet-stream";
    const contentBase64 = asStr(row.contentBase64);
    if (!contentBase64) continue;
    const buf = Buffer.from(contentBase64, "base64");
    if (!buf.length) continue;
    total += buf.length;
    if (total > ATTACHMENTS_MAX_BYTES) {
      return { ok: false, message: "Attachments exceed size limit." };
    }
    parts.push({ filename, contentType, base64: contentBase64.replace(/\r?\n/g, "") });
  }
  return { ok: true, parts };
}

function chunkBase64ForMime(b64: string) {
  const clean = b64.replace(/\r?\n/g, "");
  return clean.match(/.{1,76}/g)?.join("\r\n") || clean;
}

function buildRawMime(opts: {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  textBody: string;
  htmlBody: string;
  attachments: Array<{ filename: string; contentType: string; base64: string }>;
  inReplyTo: string;
  references: string;
  from?: string;
  dispositionNotificationTo?: string;
}) {
  const nl = "\r\n";
  const mixedBoundary = `mixed_${randomUUID().replace(/-/g, "")}`;
  const altBoundary = `alt_${randomUUID().replace(/-/g, "")}`;

  const headers: string[] = [
    ...(opts.from ? [`From: ${opts.from}`] : []),
    `To: ${opts.to}`,
    "MIME-Version: 1.0",
    `Subject: ${opts.subject}`,
  ];
  if (opts.cc) headers.push(`Cc: ${opts.cc}`);
  if (opts.bcc) headers.push(`Bcc: ${opts.bcc}`);
  if (opts.inReplyTo) headers.push(`In-Reply-To: ${opts.inReplyTo}`);
  if (opts.references) headers.push(`References: ${opts.references}`);
  else if (opts.inReplyTo) headers.push(`References: ${opts.inReplyTo}`);
  if (opts.dispositionNotificationTo) {
    headers.push(`Disposition-Notification-To: ${opts.dispositionNotificationTo}`);
    headers.push(`Return-Receipt-To: ${opts.dispositionNotificationTo}`);
  }

  const altInner =
    `--${altBoundary}${nl}Content-Type: text/plain; charset=UTF-8${nl}${nl}${opts.textBody}${nl}${nl}` +
    `--${altBoundary}${nl}Content-Type: text/html; charset=UTF-8${nl}${nl}${opts.htmlBody}${nl}${nl}` +
    `--${altBoundary}--`;

  if (opts.attachments.length === 0) {
    headers.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
    return `${headers.join(nl)}${nl}${nl}${altInner}`;
  }

  headers.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`);

  const firstPart =
    `--${mixedBoundary}${nl}Content-Type: multipart/alternative; boundary="${altBoundary}"${nl}${nl}${altInner}${nl}`;

  const rest = opts.attachments
    .map((att) => {
      const body = chunkBase64ForMime(att.base64);
      const safeName = att.filename.replace(/[\r\n"]/g, "_");
      return (
        `--${mixedBoundary}${nl}Content-Type: ${att.contentType}; name="${safeName}"${nl}` +
        `Content-Disposition: attachment; filename="${safeName}"${nl}` +
        `Content-Transfer-Encoding: base64${nl}${nl}${body}${nl}`
      );
    })
    .join("");

  return `${headers.join(nl)}${nl}${nl}${firstPart}${rest}--${mixedBoundary}--`;
}

/** Everything the compose form collects — the shape persisted for a scheduled send. */
export type SendEmailPayload = {
  accountEmail: string;
  from?: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  body?: string;
  bodyHtml?: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string;
  providerAccountId?: string;
  draftKey?: string;
  attachments?: unknown;
  /** Ask the recipient's client for a read receipt (Disposition-Notification-To). */
  requestReceipt?: boolean;
};

export type SendEmailResult =
  | { ok: true; messageId: string | null; threadId: string | null; tracked: boolean; provider: "gmail" | "smtp"; outboundId: string }
  | { ok: false; status: number; message: string };

type SendFailure = { ok: false; status: number; message: string };

/** Send one message over a domain SMTP account (nodemailer). Behavior extracted verbatim from sendEmailCore. */
async function sendViaSmtp(
  account: EmailProviderAccount,
  msg: {
    from: string;
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    text: string;
    html: string;
    attachments: Array<{ filename: string; content: Buffer; contentType: string }>;
    inReplyTo?: string;
    references?: string;
    notifyTo?: string;
  }
): Promise<{ ok: true; messageId: string | null } | SendFailure> {
  const transporter = createSmtpTransport(account);
  try {
    const info = await transporter.sendMail({
      from: msg.from,
      to: msg.to,
      cc: msg.cc || undefined,
      bcc: msg.bcc || undefined,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
      attachments: msg.attachments.length > 0 ? msg.attachments : undefined,
      inReplyTo: msg.inReplyTo || undefined,
      references: msg.references || undefined,
      headers: msg.notifyTo
        ? { "Disposition-Notification-To": msg.notifyTo, "Return-Receipt-To": msg.notifyTo }
        : undefined,
    });
    return { ok: true, messageId: typeof info.messageId === "string" ? info.messageId : null };
  } catch (error) {
    return { ok: false, status: 502, message: error instanceof Error ? error.message : "SMTP send failed." };
  }
}

/** Send via the Gmail REST API, retrying once on a 401 with a force-refreshed token. Extracted verbatim. */
async function sendViaGmail(
  userId: string,
  accountEmail: string,
  sendPayload: Record<string, string>,
  accessToken: string,
  fallbackThreadId: string
): Promise<{ ok: true; messageId: string | null; threadId: string | null } | SendFailure> {
  const sendWithToken = (token: string) =>
    fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(sendPayload),
    });

  let response = await sendWithToken(accessToken);
  if (response.status === 401) {
    const refreshResult = await getValidGmailAccessToken(userId, accountEmail, { forceRefresh: true });
    if (!refreshResult.ok) return { ok: false, status: 401, message: refreshResult.message };
    response = await sendWithToken(refreshResult.accessToken);
  }
  if (!response.ok) {
    const text = await response.text();
    return { ok: false, status: 502, message: `Gmail send failed: ${text}` };
  }
  const responsePayload = await response.json();
  return {
    ok: true,
    messageId: typeof responsePayload?.id === "string" ? responsePayload.id : null,
    threadId: typeof responsePayload?.threadId === "string" ? responsePayload.threadId : fallbackThreadId || null,
  };
}

/**
 * Send one email for a user. `baseUrl` is the public origin used to build tracking
 * pixel/click URLs (the caller resolves it from the request or from env for the cron).
 */
export async function sendEmailCore(userId: string, payload: SendEmailPayload, baseUrl: string): Promise<SendEmailResult> {
  const accountEmail = normalizeEmail(asStr(payload.accountEmail));
  const fromAlias = normalizeEmail(asStr(payload.from));
  const toRecipients = splitRecipients(asStr(payload.to));
  const ccRecipients = splitRecipients(asStr(payload.cc));
  const bccRecipients = splitRecipients(asStr(payload.bcc));
  const subjectRaw = asStr(payload.subject);
  const body = asStr(payload.body);
  const bodyHtmlInput = asStr(payload.bodyHtml);
  const threadId = asStr(payload.threadId);
  const inReplyTo = asStr(payload.inReplyTo);
  const references = asStr(payload.references);
  const draftKey = asStr(payload.draftKey);
  const providerAccountId = asStr(payload.providerAccountId);
  const isReply = Boolean(threadId || inReplyTo || references);
  const subject = isReply ? ensureReplyPrefix(subjectRaw) : subjectRaw || "(No Subject)";

  const attachmentParse = parseAttachments(payload.attachments);
  if (!attachmentParse.ok) {
    return { ok: false, status: 400, message: attachmentParse.message };
  }
  const attachmentParts = attachmentParse.parts;

  if (!accountEmail) {
    return { ok: false, status: 400, message: "accountEmail is required." };
  }
  if (toRecipients.length === 0) {
    return { ok: false, status: 400, message: "Recipient email is required." };
  }
  if (!body.trim() && !bodyHtmlInput.trim()) {
    return { ok: false, status: 400, message: "Email body is required." };
  }

  const providerAccount = providerAccountId
    ? await prisma.emailProviderAccount.findFirst({
        where: { id: providerAccountId, user_id: userId },
      })
    : await prisma.emailProviderAccount.findFirst({
        where: { user_id: userId, account_email: accountEmail },
      });

  const tokenResult = await getValidGmailAccessToken(userId, accountEmail);
  if (!tokenResult.ok && !providerAccount) {
    const status = tokenResult.reason === "account_not_found" ? 404 : 401;
    return { ok: false, status, message: tokenResult.message };
  }

  const accountId = providerAccount?.id ?? (await resolveAccountId(userId, accountEmail));

  const [accountSetting, fallbackSetting] = await Promise.all([
    accountId
      ? prisma.emailAccountSetting.findUnique({
          where: { account_id: accountId },
          select: { tracking_enabled: true, open_tracking_enabled: true, click_tracking_enabled: true },
        })
      : null,
    prisma.emailAccountSetting.findFirst({
      where: { email_provider_accounts: { user_id: userId } },
      orderBy: { updated_at: "desc" },
      select: { tracking_enabled: true, open_tracking_enabled: true, click_tracking_enabled: true },
    }),
  ]);
  const setting = accountSetting || fallbackSetting;

  const trackingEnabled = Boolean(setting?.tracking_enabled);
  const openTrackingEnabled = trackingEnabled && Boolean(setting?.open_tracking_enabled ?? true);
  const clickTrackingEnabled = trackingEnabled && Boolean(setting?.click_tracking_enabled ?? true);

  const sanitizedHtmlInput = bodyHtmlInput ? sanitizeRichEmailHtml(bodyHtmlInput) : "";
  const plainTextBody =
    body.trim() ||
    (sanitizedHtmlInput
      ? sanitizedHtmlInput.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
      : "");

  const openToken = openTrackingEnabled ? randomUUID().replace(/-/g, "") : null;
  const outbound = await prisma.emailOutboundMessage.create({
    data: {
      user_id: userId,
      account_id: accountId ?? "",
      subject,
      body_text: plainTextBody,
      body_html: sanitizedHtmlInput || linkifyText(plainTextBody),
      tracking_enabled: trackingEnabled,
      open_token: openToken,
      email_outbound_recipients: {
        create: [
          ...toRecipients.map((email) => ({ email, recipient_type: "TO" })),
          ...ccRecipients.map((email) => ({ email, recipient_type: "CC" })),
          ...bccRecipients.map((email) => ({ email, recipient_type: "BCC" })),
        ],
      },
    },
  });

  const replacements = new Map<string, string>();
  if (clickTrackingEnabled) {
    const urlsForTracking = mergeClickTrackUrls(plainTextBody, sanitizedHtmlInput);
    for (const url of urlsForTracking) {
      const token = randomUUID().replace(/-/g, "");
      await prisma.emailTrackingLink.create({
        data: {
          outbound_message_id: outbound.id,
          token,
          original_url: url,
        },
      });
      replacements.set(url, `${baseUrl}/api/email/track/click/${token}`);
    }
  }

  const textBody = plainTextBody;
  let htmlBody = sanitizedHtmlInput
    ? rewriteTrackedLinksInHtml(sanitizedHtmlInput, replacements)
    : linkifyTextWithTrackedHrefs(plainTextBody, replacements);
  if (openTrackingEnabled && openToken) {
    const trackingPixel = `<img src="${baseUrl}/api/email/track/open/${openToken}.gif" width="1" height="1" alt="" aria-hidden="true" style="width:1px;height:1px;opacity:0;position:absolute;left:-9999px;top:auto;border:0;overflow:hidden;" />`;
    htmlBody = `${trackingPixel}${htmlBody}`;
  }

  const notifyTo = payload.requestReceipt ? fromAlias || accountEmail : "";
  const rawMime = buildRawMime({
    from: fromAlias || "",
    to: toRecipients.join(", "),
    cc: ccRecipients.length > 0 ? ccRecipients.join(", ") : "",
    bcc: bccRecipients.length > 0 ? bccRecipients.join(", ") : "",
    subject,
    textBody,
    htmlBody,
    attachments: attachmentParts,
    inReplyTo,
    references,
    dispositionNotificationTo: notifyTo || undefined,
  });
  const raw = toBase64Url(rawMime);

  const sendPayload: Record<string, string> = { raw };
  if (threadId) sendPayload.threadId = threadId;

  let sentMessageId: string | null = null;
  let sentThreadId: string | null = threadId || null;
  let provider: "gmail" | "smtp" = "gmail";

  const smtpAttachments = attachmentParts.map((att) => ({
    filename: att.filename,
    content: Buffer.from(att.base64, "base64"),
    contentType: att.contentType,
  }));

  if (providerAccount) {
    provider = "smtp";
    const sent = await sendViaSmtp(providerAccount, {
      from: fromAlias || accountEmail,
      to: toRecipients.join(", "),
      cc: ccRecipients.length > 0 ? ccRecipients.join(", ") : undefined,
      bcc: bccRecipients.length > 0 ? bccRecipients.join(", ") : undefined,
      subject,
      text: textBody,
      html: htmlBody,
      attachments: smtpAttachments,
      inReplyTo,
      references,
      notifyTo: notifyTo || undefined,
    });
    if (!sent.ok) return sent;
    sentMessageId = sent.messageId;
  } else if (tokenResult.ok) {
    const sent = await sendViaGmail(userId, accountEmail, sendPayload, tokenResult.accessToken, threadId);
    if (!sent.ok) return sent;
    sentMessageId = sent.messageId;
    sentThreadId = sent.threadId;
  } else {
    return { ok: false, status: 400, message: "No valid send provider configured." };
  }

  await prisma.emailOutboundMessage.update({
    where: { id: outbound.id },
    data: {
      gmail_message_id: sentMessageId,
      thread_id: sentThreadId,
      body_text: textBody,
      body_html: htmlBody,
    },
  });

  if (draftKey) {
    await prisma.emailComposeDraft.deleteMany({
      where: { user_id: userId, draft_key: draftKey },
    });
  }

  return { ok: true, messageId: sentMessageId, threadId: sentThreadId, tracked: trackingEnabled, provider, outboundId: outbound.id };
}
