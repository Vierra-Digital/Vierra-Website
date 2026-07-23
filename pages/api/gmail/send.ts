import type { NextApiRequest } from "next";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { asStr } from "@/lib/api/parsing";
import { sendEmailCore, normalizeEmail, type SendEmailPayload } from "@/lib/gmail/sendCore";
import { resolveMailboxOwner } from "@/lib/email/mailboxAccess";
import { parseScheduledAt, enqueueScheduledSend } from "@/lib/gmail/scheduledSend";
import {
  createConfidentialMessage,
  resolveExpiry,
  buildConfidentialInviteHtml,
  buildConfidentialInviteText,
  type ConfidentialExpiry,
} from "@/lib/email/confidential";

function escapeHtmlBasic(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getPublicBaseUrl(req: NextApiRequest) {
  const normalizeExplicitBaseUrl = (value: string) => {
    const raw = value.trim();
    if (!raw) return "";
    const protocol = /^https:\/\//i.test(raw) ? "https" : "http";
    const hostMatch = raw.match(/([a-z0-9.-]+\.[a-z]{2,}(?::\d+)?)/i);
    if (!hostMatch?.[1]) return "";
    return `${protocol}://${hostMatch[1]}`.replace(/\/$/, "");
  };

  const explicit =
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  if (explicit) {
    const normalized = normalizeExplicitBaseUrl(explicit);
    if (normalized) return normalized;
  }

  const proto = String(req.headers["x-forwarded-proto"] || "http");
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "localhost:3000");
  return `${proto}://${host}`.replace(/\/$/, "");
}

export default withAuth(async (req, res, session) => {
  const userId = session.user.id;
  const baseUrl = getPublicBaseUrl(req);

  const payload: SendEmailPayload = {
    accountEmail: asStr(req.body?.accountEmail),
    from: asStr(req.body?.from),
    to: asStr(req.body?.to),
    cc: asStr(req.body?.cc),
    bcc: asStr(req.body?.bcc),
    subject: asStr(req.body?.subject),
    body: asStr(req.body?.body),
    bodyHtml: asStr(req.body?.bodyHtml),
    threadId: asStr(req.body?.threadId),
    inReplyTo: asStr(req.body?.inReplyTo),
    references: asStr(req.body?.references),
    providerAccountId: asStr(req.body?.providerAccountId),
    draftKey: asStr(req.body?.draftKey),
    attachments: req.body?.attachments,
    requestReceipt: Boolean(req.body?.requestReceipt),
  };

  // Shared-inbox delegation: send as the mailbox owner when the sender was granted access
  // (owner === requester for their own accounts, so this is a no-op for them). Fail-closed:
  // no ownership + no send grant → 403.
  const sendAccount = normalizeEmail(payload.accountEmail);
  let effectiveUserId = userId;
  if (sendAccount) {
    const access = await resolveMailboxOwner(userId, sendAccount);
    if (!access || !access.canSend) {
      res.status(403).json({ message: "You don't have permission to send from this mailbox." });
      return;
    }
    effectiveUserId = access.ownerUserId;
  }

  // Confidential mode: stash the real body server-side under a token and replace the
  // outgoing body with a notice + link to the viewer page (/c/[token]). Runs before the
  // scheduled branch so a scheduled confidential message carries the invite too.
  const confidential = req.body?.confidential;
  if (confidential && typeof confidential === "object" && !Array.isArray(confidential)) {
    const conf = confidential as Record<string, unknown>;
    const passcode = asStr(conf.passcode).trim();
    const expiresAt = resolveExpiry(asStr(conf.expiry) as ConfidentialExpiry, new Date());
    const realHtml = payload.bodyHtml && payload.bodyHtml.trim()
      ? payload.bodyHtml
      : `<div style="white-space:pre-wrap;font-family:Arial,Helvetica,sans-serif;">${escapeHtmlBasic(asStr(payload.body))}</div>`;
    if (!realHtml.trim()) {
      res.status(400).json({ message: "Email body is required." });
      return;
    }
    const created = await createConfidentialMessage({
      userId,
      subject: payload.subject,
      bodyHtml: realHtml,
      bodyText: payload.body,
      passcode: passcode || undefined,
      expiresAt,
      restrictForward: conf.restrictForward !== false,
      restrictCopy: conf.restrictCopy !== false,
      restrictPrint: conf.restrictPrint !== false,
    });
    payload.bodyHtml = buildConfidentialInviteHtml({ baseUrl, token: created.token, hasPasscode: Boolean(passcode), expiresAt });
    payload.body = buildConfidentialInviteText({ baseUrl, token: created.token });
  }

  // Scheduled send: persist the payload for the cron dispatcher instead of sending
  // now (see lib/gmail/scheduledSend.ts). The message goes out server-side at the
  // chosen time even if the user closes the tab.
  const scheduledRaw = req.body?.scheduledAt;
  if (scheduledRaw != null && scheduledRaw !== "") {
    const accountEmail = normalizeEmail(payload.accountEmail);
    if (!accountEmail) {
      res.status(400).json({ message: "accountEmail is required." });
      return;
    }
    if (!payload.to.trim()) {
      res.status(400).json({ message: "Recipient email is required." });
      return;
    }
    if (!asStr(payload.body).trim() && !asStr(payload.bodyHtml).trim()) {
      res.status(400).json({ message: "Email body is required." });
      return;
    }
    const parsed = parseScheduledAt(scheduledRaw, new Date());
    if (!parsed.ok) {
      res.status(400).json({ message: parsed.message });
      return;
    }
    const queued = await enqueueScheduledSend(effectiveUserId, accountEmail, payload, parsed.date);
    if (payload.draftKey) {
      await prisma.emailComposeDraft.deleteMany({ where: { user_id: userId, draft_key: payload.draftKey } });
    }
    res.status(200).json({ ok: true, scheduled: true, id: queued.id, scheduledAt: queued.scheduledAt });
    return;
  }

  const result = await sendEmailCore(effectiveUserId, payload, baseUrl);
  if (!result.ok) {
    res.status(result.status).json({ message: result.message });
    return;
  }
  res.status(200).json({ ok: true, messageId: result.messageId, tracked: result.tracked, provider: result.provider });
}, { methods: ["POST"] });
