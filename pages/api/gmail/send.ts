import { randomUUID } from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import nodemailer from "nodemailer";
import sanitizeHtml from "sanitize-html";
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
  const normalizeExplicitBaseUrl = (value: string) => {
    const raw = value.trim();
    if (!raw) return "";
    const protocol = /^https:\/\//i.test(raw) ? "https" : "http";
    const hostMatch = raw.match(/([a-z0-9.-]+\.[a-z]{2,}(?::\d+)?)/i);
    if (!hostMatch?.[1]) return "";
    return `${protocol}://${hostMatch[1]}`.replace(/\/$/, "");
  };

  const explicit =
    process.env.NEXTAUTH_URL ||
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

function sanitizeEmailHtml(html: string) {
  return sanitizeHtml(html, {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags,
      "img",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "span",
      "div",
      "font",
    ],
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: ["href", "name", "target", "rel", "style", "class"],
      img: ["src", "alt", "width", "height", "style", "class"],
      p: ["style", "class"],
      span: ["style", "class"],
      div: ["style", "class"],
      font: ["color", "face", "size"],
      td: ["colspan", "rowspan", "style", "class"],
      th: ["colspan", "rowspan", "style", "class"],
      "*": ["style", "class"],
    },
    allowedSchemes: ["http", "https", "mailto", "data"],
    allowedSchemesByTag: {
      img: ["http", "https", "data"],
    },
  });
}

const ATTACHMENTS_MAX_BYTES = 24 * 1024 * 1024;

function parseAttachments(raw: unknown): { ok: true; parts: Array<{ filename: string; contentType: string; base64: string }> } | { ok: false; message: string } {
  if (raw == null || raw === undefined) return { ok: true, parts: [] };
  if (!Array.isArray(raw)) return { ok: false, message: "attachments must be an array." };
  const parts: Array<{ filename: string; contentType: string; base64: string }> = [];
  let total = 0;
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const filename = asString(row.filename) || "attachment";
    const contentType = asString(row.contentType) || "application/octet-stream";
    const contentBase64 = asString(row.contentBase64);
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
}) {
  const nl = "\r\n";
  const mixedBoundary = `mixed_${randomUUID().replace(/-/g, "")}`;
  const altBoundary = `alt_${randomUUID().replace(/-/g, "")}`;

  const headers: string[] = [
    `To: ${opts.to}`,
    "MIME-Version: 1.0",
    `Subject: ${opts.subject}`,
  ];
  if (opts.cc) headers.push(`Cc: ${opts.cc}`);
  if (opts.bcc) headers.push(`Bcc: ${opts.bcc}`);
  if (opts.inReplyTo) headers.push(`In-Reply-To: ${opts.inReplyTo}`);
  if (opts.references) headers.push(`References: ${opts.references}`);
  else if (opts.inReplyTo) headers.push(`References: ${opts.inReplyTo}`);

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

  const attachmentParse = parseAttachments(req.body?.attachments);
  if (!attachmentParse.ok) {
    res.status(400).json({ message: attachmentParse.message });
    return;
  }
  const attachmentParts = attachmentParse.parts;

  if (!accountEmail) {
    res.status(400).json({ message: "accountEmail is required." });
    return;
  }
  if (toRecipients.length === 0) {
    res.status(400).json({ message: "Recipient email is required." });
    return;
  }
  if (!body.trim() && !bodyHtmlInput.trim()) {
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

  const sanitizedHtmlInput = bodyHtmlInput ? sanitizeEmailHtml(bodyHtmlInput) : "";
  const plainTextBody =
    body.trim() ||
    (sanitizedHtmlInput
      ? sanitizedHtmlInput.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
      : "");

  const openToken = openTrackingEnabled ? randomUUID().replace(/-/g, "") : null;
  const outbound = await prisma.emailOutboundMessage.create({
    data: {
      userId,
      accountEmail,
      subject,
      bodyText: plainTextBody,
      bodyHtml: sanitizedHtmlInput || linkifyText(plainTextBody),
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
    const urlsForTracking = mergeClickTrackUrls(plainTextBody, sanitizedHtmlInput);
    for (const url of urlsForTracking) {
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

  const textBody = plainTextBody;
  let htmlBody = sanitizedHtmlInput
    ? rewriteTrackedLinksInHtml(sanitizedHtmlInput, replacements)
    : linkifyTextWithTrackedHrefs(plainTextBody, replacements);
  if (openTrackingEnabled && openToken) {
    const trackingPixel = `<img src="${baseUrl}/api/email/track/open/${openToken}.gif" width="1" height="1" alt="" aria-hidden="true" style="width:1px;height:1px;opacity:0;position:absolute;left:-9999px;top:auto;border:0;overflow:hidden;" />`;
    htmlBody = `${trackingPixel}${htmlBody}`;
  }

  const rawMime = buildRawMime({
    to: toRecipients.join(", "),
    cc: ccRecipients.length > 0 ? ccRecipients.join(", ") : "",
    bcc: bccRecipients.length > 0 ? bccRecipients.join(", ") : "",
    subject,
    textBody,
    htmlBody,
    attachments: attachmentParts,
    inReplyTo,
    references,
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
        attachments: smtpAttachments.length > 0 ? smtpAttachments : undefined,
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
