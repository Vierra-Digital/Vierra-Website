import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { sanitizeRichEmailHtml } from "./sanitize.ts";
import { getValidGmailAccessToken } from "./gmail.ts";
import { createSmtpTransport, requireSmtpCredentials } from "./smtp.ts";
import {
  asStr,
  normalizeEmail,
  splitRecipients,
  ensureReplyPrefix,
  linkifyText,
  rewriteTrackedLinksInHtml,
  linkifyTextWithTrackedHrefs,
  mergeClickTrackUrls,
  parseAttachments,
  buildRawMime,
  toBase64Url,
  escapeHtml,
} from "./mime.ts";

export { escapeHtml };

/**
 * Deno port of lib/gmail/sendCore.ts's sendEmailCore. Every `prisma.*` call is replaced with the
 * equivalent supabase-js PostgREST call (Prisma's Node `pg`-driver adapter does not run in Deno,
 * per prisma/manual/20260902_edge_fn_rpc_helpers.sql) — same tables, same column names (this repo
 * maps every Prisma model to a snake_case table via `@@map`, so the schema is identical). No RPC
 * is needed here: the original isn't transactional across the external send call either (it can't
 * be — the provider call sits between the create and the update/delete), so plain sequential CRUD
 * reproduces the same behavior.
 *
 * `sendViaSmtp` (nodemailer under Deno) was confirmed working via a spike function — see
 * supabase/functions/_shared/smtp.ts's header comment.
 */

type EmailProviderAccountRow = {
  id: string;
  user_id: string;
  account_email: string;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_secure: boolean;
  smtp_username: string | null;
  smtp_password_enc: string | null;
};

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
  requestReceipt?: boolean;
};

export type SendEmailResult =
  | { ok: true; messageId: string | null; threadId: string | null; tracked: boolean; provider: "gmail" | "smtp"; outboundId: string | null }
  | { ok: false; status: number; message: string };

type SendFailure = { ok: false; status: number; message: string };

async function sendViaSmtp(
  account: EmailProviderAccountRow,
  msg: {
    from: string;
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    text: string;
    html: string;
    attachments: Array<{ filename: string; base64: string; contentType: string }>;
    inReplyTo?: string;
    references?: string;
    notifyTo?: string;
  }
): Promise<{ ok: true; messageId: string | null } | SendFailure> {
  try {
    const transporter = await createSmtpTransport(requireSmtpCredentials(account));
    const info = await transporter.sendMail({
      from: msg.from,
      to: msg.to,
      cc: msg.cc || undefined,
      bcc: msg.bcc || undefined,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
      attachments:
        msg.attachments.length > 0
          ? msg.attachments.map((att) => ({
              filename: att.filename,
              content: att.base64,
              encoding: "base64" as const,
              contentType: att.contentType,
            }))
          : undefined,
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

async function sendViaGmail(
  supabase: SupabaseClient,
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
    const refreshResult = await getValidGmailAccessToken(supabase, userId, accountEmail, { forceRefresh: true });
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

export function settingsLookupOrder(ownerUserId: string, actingUserId?: string): string[] {
  if (!actingUserId || actingUserId === ownerUserId) return [ownerUserId];
  return [actingUserId, ownerUserId];
}

async function resolveAccountId(supabase: SupabaseClient, userId: string, accountEmail: string): Promise<string | null> {
  const { data } = await supabase
    .from("email_provider_accounts")
    .select("id")
    .eq("user_id", userId)
    .eq("account_email", accountEmail)
    .maybeSingle();
  return data?.id ?? null;
}

export async function sendEmailCore(
  supabase: SupabaseClient,
  userId: string,
  payload: SendEmailPayload,
  baseUrl: string,
  actingUserId?: string
): Promise<SendEmailResult> {
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

  const providerAccountQuery = providerAccountId
    ? supabase.from("email_provider_accounts").select("*").eq("id", providerAccountId).eq("user_id", userId).maybeSingle()
    : supabase
        .from("email_provider_accounts")
        .select("*")
        .eq("user_id", userId)
        .eq("account_email", accountEmail)
        .maybeSingle();
  const { data: providerAccount } = (await providerAccountQuery) as { data: EmailProviderAccountRow | null };

  const tokenResult = await getValidGmailAccessToken(supabase, userId, accountEmail);
  if (!tokenResult.ok && !providerAccount) {
    const status = tokenResult.reason === "account_not_found" ? 404 : 401;
    return { ok: false, status, message: tokenResult.message };
  }

  const accountId = providerAccount?.id ?? (await resolveAccountId(supabase, userId, accountEmail));

  const trackingSelect = "tracking_enabled, open_tracking_enabled, click_tracking_enabled";
  const settingsUserIds = settingsLookupOrder(userId, actingUserId);
  let setting: { tracking_enabled: boolean; open_tracking_enabled: boolean; click_tracking_enabled: boolean } | null =
    null;
  for (const settingsUserId of settingsUserIds) {
    const byAccount = await supabase
      .from("email_account_settings")
      .select(trackingSelect)
      .eq("user_id", settingsUserId)
      .eq("account_email", accountEmail)
      .maybeSingle();
    setting = byAccount.data ?? null;
    if (!setting) {
      const byUser = await supabase
        .from("email_account_settings")
        .select(trackingSelect)
        .eq("user_id", settingsUserId)
        .limit(1)
        .maybeSingle();
      setting = byUser.data ?? null;
    }
    if (setting) break;
  }

  const canEmbedTracking = /^https?:\/\//i.test(baseUrl);
  const wantTracking = setting ? Boolean(setting.tracking_enabled) : true;
  const trackingEnabled = wantTracking && canEmbedTracking;
  const openTrackingEnabled = trackingEnabled && Boolean(setting?.open_tracking_enabled ?? true);
  const clickTrackingEnabled = trackingEnabled && Boolean(setting?.click_tracking_enabled ?? true);

  const sanitizedHtmlInput = bodyHtmlInput ? sanitizeRichEmailHtml(bodyHtmlInput) : "";
  const plainTextBody =
    body.trim() ||
    (sanitizedHtmlInput ? sanitizedHtmlInput.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "");

  const openToken = openTrackingEnabled ? crypto.randomUUID().replace(/-/g, "") : null;

  let outbound: { id: string } | null = null;
  {
    let insertedId: string | null = null;
    try {
      const { data: inserted, error: insertError } = await supabase
        .from("email_outbound_messages")
        .insert({
          user_id: userId,
          account_id: accountId,
          account_email: accountEmail,
          subject,
          body_text: plainTextBody,
          body_html: sanitizedHtmlInput || linkifyText(plainTextBody),
          tracking_enabled: trackingEnabled,
          open_token: openToken,
        })
        .select("id")
        .single();
      if (insertError || !inserted) throw insertError || new Error("insert failed");
      insertedId = inserted.id;

      const recipientRows = [
        ...toRecipients.map((email) => ({ outbound_message_id: inserted.id, email, recipient_type: "TO" })),
        ...ccRecipients.map((email) => ({ outbound_message_id: inserted.id, email, recipient_type: "CC" })),
        ...bccRecipients.map((email) => ({ outbound_message_id: inserted.id, email, recipient_type: "BCC" })),
      ];
      if (recipientRows.length > 0) {
        const { error: recipientsError } = await supabase.from("email_outbound_recipients").insert(recipientRows);
        if (recipientsError) throw recipientsError;
      }
      outbound = { id: inserted.id };
    } catch {
      // A failure anywhere in this block (message insert or its recipient rows) must never block
      // the actual send — fall through with outbound=null (tracking skipped for this message). If
      // the message row itself was created before the failure, delete it so a recipients-insert
      // failure doesn't leave an orphaned outbound row with no recipients.
      if (insertedId) {
        await supabase.from("email_outbound_messages").delete().eq("id", insertedId).then(
          () => {},
          () => {}
        );
      }
      outbound = null;
    }
  }

  const replacements = new Map<string, string>();
  if (outbound && clickTrackingEnabled) {
    const urlsForTracking = mergeClickTrackUrls(plainTextBody, sanitizedHtmlInput);
    for (const url of urlsForTracking) {
      const token = crypto.randomUUID().replace(/-/g, "");
      const { error } = await supabase
        .from("email_tracking_links")
        .insert({ outbound_message_id: outbound.id, token, original_url: url });
      if (!error) replacements.set(url, `${baseUrl}/api/email/track/click/${token}`);
    }
  }

  const textBody = plainTextBody;
  let htmlBody = sanitizedHtmlInput
    ? rewriteTrackedLinksInHtml(sanitizedHtmlInput, replacements)
    : linkifyTextWithTrackedHrefs(plainTextBody, replacements);
  if (outbound && openTrackingEnabled && openToken) {
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

  const discardOutbound = () =>
    outbound
      ? supabase.from("email_outbound_messages").delete().eq("id", outbound.id).then(
          () => {},
          () => {}
        )
      : Promise.resolve();

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
      attachments: attachmentParts,
      inReplyTo,
      references,
      notifyTo: notifyTo || undefined,
    });
    if (!sent.ok) {
      await discardOutbound();
      return sent;
    }
    sentMessageId = sent.messageId;
  } else if (tokenResult.ok) {
    const sent = await sendViaGmail(supabase, userId, accountEmail, sendPayload, tokenResult.accessToken, threadId);
    if (!sent.ok) {
      await discardOutbound();
      return sent;
    }
    sentMessageId = sent.messageId;
    sentThreadId = sent.threadId;
  } else {
    await discardOutbound();
    return { ok: false, status: 400, message: "No valid send provider configured." };
  }

  if (outbound) {
    await supabase
      .from("email_outbound_messages")
      .update({ gmail_message_id: sentMessageId, thread_id: sentThreadId, body_text: textBody, body_html: htmlBody })
      .eq("id", outbound.id)
      .then(
        () => {},
        () => {}
      );
  }

  if (draftKey) {
    await supabase.from("email_compose_drafts").delete().eq("user_id", userId).eq("draft_key", draftKey);
  }

  return {
    ok: true,
    messageId: sentMessageId,
    threadId: sentThreadId,
    tracked: Boolean(outbound) && trackingEnabled,
    provider,
    outboundId: outbound?.id ?? null,
  };
}
