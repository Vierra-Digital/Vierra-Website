import { prisma } from "@/lib/prisma";
import { getValidGmailAccessToken } from "@/lib/gmail/tokens";
import { toBase64Url } from "@/lib/gmail/gmailApi";
import { buildRawMime, sendViaGmail } from "@/lib/gmail/sendCore";

export interface SystemEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
}

type SystemSender = { userId: string; accountEmail: string };

/**
 * Sends system/transactional email (password resets, onboarding links, signed documents, ...)
 * through the same authenticated Google Workspace mailbox the Email Panel already sends from —
 * a real Gmail API send is SPF/DKIM/DMARC-aligned for the account's own domain, unlike relaying
 * mail through an unrelated SMTP account with an @vierradev.com From header (which fails DMARC
 * and lands in spam). Deliberately has no SMTP/Brevo fallback: a silent fallback here would
 * reintroduce exactly the deliverability failure this module exists to avoid, so a misconfigured
 * or disconnected system sender fails loudly instead.
 */
let systemSenderCache: Promise<SystemSender> | null = null;

function resolveSystemSenderEmail(): string {
  return (process.env.SYSTEM_EMAIL_ACCOUNT || process.env.FROM_EMAIL || "alex@vierradev.com").trim().toLowerCase();
}

async function getSystemSender(): Promise<SystemSender> {
  if (!systemSenderCache) {
    const accountEmail = resolveSystemSenderEmail();
    systemSenderCache = prisma.user
      .findFirst({ where: { email: accountEmail }, select: { id: true } })
      .then((user) => {
        if (!user) {
          throw new Error(
            `No Vierra user found for system sender ${accountEmail}. Set SYSTEM_EMAIL_ACCOUNT/FROM_EMAIL to a connected mailbox's address.`
          );
        }
        return { userId: user.id, accountEmail };
      })
      .catch((error) => {
        // Don't cache a failure — fixing env/DB state shouldn't require a process restart.
        systemSenderCache = null;
        throw error;
      });
  }
  return systemSenderCache;
}

export async function sendSystemEmail(input: SystemEmailInput): Promise<void> {
  const { userId, accountEmail } = await getSystemSender();

  const tokenResult = await getValidGmailAccessToken(userId, accountEmail);
  if (!tokenResult.ok) {
    throw new Error(`System sender mailbox ${accountEmail} is not connected: ${tokenResult.message}`);
  }

  const fromName = process.env.FROM_NAME || "Vierra";
  const rawMime = buildRawMime({
    from: `"${fromName}" <${accountEmail}>`,
    to: input.to,
    cc: "",
    bcc: "",
    subject: input.subject,
    textBody: input.text || "",
    htmlBody: input.html,
    attachments: (input.attachments || []).map((a) => ({
      filename: a.filename,
      contentType: a.contentType || "application/octet-stream",
      base64: a.content.toString("base64"),
    })),
    inReplyTo: "",
    references: "",
  });

  const result = await sendViaGmail(userId, accountEmail, { raw: toBase64Url(rawMime) }, tokenResult.accessToken, "");
  if (!result.ok) {
    throw new Error(result.message);
  }
}
