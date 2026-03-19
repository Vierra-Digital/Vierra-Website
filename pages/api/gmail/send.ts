import { randomUUID } from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { requireSession } from "@/lib/auth";
import { getValidGmailAccessToken } from "@/lib/gmail/tokens";

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: string) {
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

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function getPublicBaseUrl(req: NextApiRequest) {
  const explicit =
    process.env.NEXTAUTH_URL ||
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  if (explicit) return explicit.replace(/\/$/, "");

  const proto = String(req.headers["x-forwarded-proto"] || "http");
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "localhost:3000");
  return `${proto}://${host}`.replace(/\/$/, "");
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

function replaceUrls(text: string, replacements: Map<string, string>) {
  let output = text;
  for (const [source, target] of replacements.entries()) {
    output = output.split(source).join(target);
  }
  return output;
}

function uniqueUrls(value: string) {
  const matches = value.match(/https?:\/\/[^\s<>"']+/g) || [];
  return Array.from(new Set(matches));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ message: "Method Not Allowed" });
    return;
  }

  const session = await requireSession(req, res);
  if (!session) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  const userId = Number((session.user as any).id);
  const accountEmail = normalizeEmail(asString(req.body?.accountEmail));
  const toRecipients = splitRecipients(asString(req.body?.to));
  const ccRecipients = splitRecipients(asString(req.body?.cc));
  const bccRecipients = splitRecipients(asString(req.body?.bcc));
  const subjectRaw = asString(req.body?.subject);
  const body = asString(req.body?.body);
  const bodyHtmlInput = asString(req.body?.bodyHtml);
  const threadId = asString(req.body?.threadId);
  const inReplyTo = asString(req.body?.inReplyTo);
  const references = asString(req.body?.references);
  const draftKey = asString(req.body?.draftKey);
  const providerAccountId = asString(req.body?.providerAccountId);
  const isReply = Boolean(threadId || inReplyTo || references);
  const subject = isReply ? ensureReplyPrefix(subjectRaw) : subjectRaw || "(No Subject)";

  if (!accountEmail) {
    res.status(400).json({ message: "accountEmail is required." });
    return;
  }
  if (toRecipients.length === 0) {
    res.status(400).json({ message: "Recipient email is required." });
    return;
  }
  if (!body) {
    res.status(400).json({ message: "Email body is required." });
    return;
  }

  const providerAccount = providerAccountId
    ? await prisma.emailProviderAccount.findFirst({
        where: { id: providerAccountId, userId },
      })
    : await prisma.emailProviderAccount.findFirst({
        where: { userId, accountEmail },
      });

  let tokenResult = await getValidGmailAccessToken(userId, accountEmail);
  if (!tokenResult.ok && !providerAccount) {
    const status = tokenResult.reason === "account_not_found" ? 404 : 401;
    res.status(status).json({ message: tokenResult.message });
    return;
  }

  const [accountSetting, fallbackSetting] = await Promise.all([
    prisma.emailAccountSetting.findUnique({
      where: {
        userId_accountEmail: {
          userId,
          accountEmail,
        },
      },
      select: {
        trackingEnabled: true,
        openTrackingEnabled: true,
        clickTrackingEnabled: true,
      },
    }),
    prisma.emailAccountSetting.findFirst({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: {
        trackingEnabled: true,
        openTrackingEnabled: true,
        clickTrackingEnabled: true,
      },
    }),
  ]);
  const setting = accountSetting || fallbackSetting;

  const trackingEnabled = Boolean(setting?.trackingEnabled);
  const openTrackingEnabled = trackingEnabled && Boolean(setting?.openTrackingEnabled ?? true);
  const clickTrackingEnabled = trackingEnabled && Boolean(setting?.clickTrackingEnabled ?? true);

  const openToken = openTrackingEnabled ? randomUUID().replace(/-/g, "") : null;
  const outbound = await prisma.emailOutboundMessage.create({
    data: {
      userId,
      accountEmail,
      subject,
      bodyText: body,
      bodyHtml: bodyHtmlInput || linkifyText(body),
      trackingEnabled,
      openToken,
      recipients: {
        create: [
          ...toRecipients.map((email) => ({ email, recipientType: "TO" as const })),
          ...ccRecipients.map((email) => ({ email, recipientType: "CC" as const })),
          ...bccRecipients.map((email) => ({ email, recipientType: "BCC" as const })),
        ],
      },
    },
  });

  const baseUrl = getPublicBaseUrl(req);
  const replacements = new Map<string, string>();
  if (clickTrackingEnabled) {
    const urls = uniqueUrls(body);
    for (const url of urls) {
      const token = randomUUID().replace(/-/g, "");
      await prisma.emailTrackingLink.create({
        data: {
          outboundMessageId: outbound.id,
          token,
          originalUrl: url,
        },
      });
      replacements.set(url, `${baseUrl}/api/email/track/click/${token}`);
    }
  }

  const textBody = replaceUrls(body, replacements);
  let htmlBody = bodyHtmlInput ? replaceUrls(bodyHtmlInput, replacements) : linkifyText(textBody);
  if (openTrackingEnabled && openToken) {
    const trackingPixel = `<img src="${baseUrl}/api/email/track/open/${openToken}.gif" width="1" height="1" style="display:block;max-width:1px;max-height:1px;" alt="" />`;
    htmlBody = `${trackingPixel}${htmlBody}`;
  }

  const boundary = `vierra_${randomUUID().replace(/-/g, "")}`;
  const headers = [
    `To: ${toRecipients.join(", ")}`,
    "MIME-Version: 1.0",
    `Subject: ${subject}`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  if (ccRecipients.length > 0) headers.push(`Cc: ${ccRecipients.join(", ")}`);
  if (bccRecipients.length > 0) headers.push(`Bcc: ${bccRecipients.join(", ")}`);
  if (inReplyTo) headers.push(`In-Reply-To: ${inReplyTo}`);
  if (references) headers.push(`References: ${references}`);
  else if (inReplyTo) headers.push(`References: ${inReplyTo}`);

  const rawMime = `${headers.join("\r\n")}\r\n\r\n--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${textBody}\r\n\r\n--${boundary}\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n${htmlBody}\r\n\r\n--${boundary}--`;
  const raw = toBase64Url(rawMime);

  const sendPayload: Record<string, string> = { raw };
  if (threadId) sendPayload.threadId = threadId;

  let sentMessageId: string | null = null;
  let sentThreadId: string | null = threadId || null;
  let provider: "gmail" | "smtp" = "gmail";

  if (providerAccount) {
    provider = "smtp";
    const transporter = nodemailer.createTransport({
      host: providerAccount.smtpHost,
      port: providerAccount.smtpPort,
      secure: providerAccount.smtpSecure,
      auth: {
        user: providerAccount.smtpUsername,
        pass: decrypt(providerAccount.smtpPasswordEnc),
      },
    });
    try {
      const info = await transporter.sendMail({
        from: `${accountEmail}`,
        to: toRecipients.join(", "),
        cc: ccRecipients.length > 0 ? ccRecipients.join(", ") : undefined,
        bcc: bccRecipients.length > 0 ? bccRecipients.join(", ") : undefined,
        subject,
        text: textBody,
        html: htmlBody,
        inReplyTo: inReplyTo || undefined,
        references: references || undefined,
      });
      sentMessageId = typeof info.messageId === "string" ? info.messageId : null;
    } catch (error) {
      res.status(502).json({ message: error instanceof Error ? error.message : "SMTP send failed." });
      return;
    }
  } else if (tokenResult.ok) {
    const sendWithToken = async (accessToken: string) =>
      fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sendPayload),
      });

    let response = await sendWithToken(tokenResult.accessToken);
    if (response.status === 401) {
      const refreshResult = await getValidGmailAccessToken(userId, accountEmail, { forceRefresh: true });
      if (!refreshResult.ok) {
        res.status(401).json({ message: refreshResult.message });
        return;
      }
      tokenResult = refreshResult;
      response = await sendWithToken(refreshResult.accessToken);
    }

    if (!response.ok) {
      const text = await response.text();
      res.status(502).json({ message: `Gmail send failed: ${text}` });
      return;
    }

    const payload = await response.json();
    sentMessageId = typeof payload?.id === "string" ? payload.id : null;
    sentThreadId = typeof payload?.threadId === "string" ? payload.threadId : threadId || null;
  } else {
    res.status(400).json({ message: "No valid send provider configured." });
    return;
  }
  await prisma.emailOutboundMessage.update({
    where: { id: outbound.id },
    data: {
      gmailMessageId: sentMessageId,
      threadId: sentThreadId,
      bodyText: textBody,
      bodyHtml: htmlBody,
    },
  });

  if (draftKey) {
    await prisma.emailComposeDraft.deleteMany({
      where: {
        userId,
        draftKey,
      },
    });
  }

  res.status(200).json({
    ok: true,
    messageId: sentMessageId,
    tracked: trackingEnabled,
    provider,
  });
}
