import { createHash, randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { sanitizeRichEmailHtml } from "@/lib/email/sanitize";

/** Sanitize confidential body HTML for safe rendering in the public viewer page. */
export function sanitizeConfidentialHtml(html: string): string {
  return sanitizeRichEmailHtml(html);
}

/**
 * Confidential mode — Gmail-style. Instead of emailing the body, we store it
 * server-side under a random token and email a link to a viewer page (/c/[token]).
 * The link enforces expiry, revocation, an optional passcode, and soft restrictions
 * on forward/copy/print. Like Gmail's confidential mode, restrictions are a deterrent,
 * not hard DRM.
 */

export const CONFIDENTIAL_EXPIRY_OPTIONS = [
  { value: "1d", label: "1 day", ms: 24 * 60 * 60 * 1000 },
  { value: "1w", label: "1 week", ms: 7 * 24 * 60 * 60 * 1000 },
  { value: "1m", label: "1 month", ms: 30 * 24 * 60 * 60 * 1000 },
  { value: "never", label: "No expiry", ms: 0 },
] as const;

export type ConfidentialExpiry = (typeof CONFIDENTIAL_EXPIRY_OPTIONS)[number]["value"];

function hashPasscode(passcode: string): string {
  return createHash("sha256").update(`vierra-confidential:${passcode}`).digest("hex");
}

export function hashIp(ip: string): string {
  return createHash("sha256").update(`vierra-confidential-ip:${ip}`).digest("hex").slice(0, 32);
}

/** Resolve an expiry option (relative to `now`) to an absolute Date, or null for "never". */
export function resolveExpiry(expiry: ConfidentialExpiry | undefined, now: Date): Date | null {
  const option = CONFIDENTIAL_EXPIRY_OPTIONS.find((o) => o.value === expiry);
  if (!option || option.ms === 0) return null;
  return new Date(now.getTime() + option.ms);
}

export type CreateConfidentialInput = {
  userId: string;
  subject?: string;
  bodyHtml: string;
  bodyText?: string;
  passcode?: string;
  expiresAt: Date | null;
  restrictForward?: boolean;
  restrictCopy?: boolean;
  restrictPrint?: boolean;
};

/** Persist a confidential message and return its viewer token. */
export async function createConfidentialMessage(input: CreateConfidentialInput): Promise<{ id: string; token: string }> {
  const token = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "").slice(0, 8);
  const row = await prisma.emailConfidentialMessage.create({
    data: {
      user_id: input.userId,
      token,
      subject: input.subject || null,
      body_html: input.bodyHtml,
      body_text: input.bodyText || null,
      passcode_hash: input.passcode ? hashPasscode(input.passcode) : null,
      expires_at: input.expiresAt,
      restrict_forward: input.restrictForward ?? true,
      restrict_copy: input.restrictCopy ?? true,
      restrict_print: input.restrictPrint ?? true,
    },
    select: { id: true, token: true },
  });
  return { id: row.id, token: row.token };
}

export type ConfidentialState =
  | { status: "not_found" }
  | { status: "revoked" }
  | { status: "expired" }
  | { status: "locked"; id: string; subject: string | null }
  | {
      status: "ok";
      id: string;
      subject: string | null;
      bodyHtml: string;
      restrict: { forward: boolean; copy: boolean; print: boolean };
      expiresAt: string | null;
    };

/**
 * Resolve a token for the viewer. When a passcode is set, the body is withheld
 * (`locked`) until `passcode` is supplied and correct.
 */
export async function resolveConfidential(token: string, now: Date, passcode?: string): Promise<ConfidentialState> {
  const row = await prisma.emailConfidentialMessage.findUnique({ where: { token } });
  if (!row) return { status: "not_found" };
  if (row.revoked) return { status: "revoked" };
  if (row.expires_at && row.expires_at.getTime() <= now.getTime()) return { status: "expired" };
  if (row.passcode_hash) {
    if (!passcode || hashPasscode(passcode) !== row.passcode_hash) {
      return { status: "locked", id: row.id, subject: row.subject };
    }
  }
  return {
    status: "ok",
    id: row.id,
    subject: row.subject,
    bodyHtml: row.body_html,
    restrict: { forward: row.restrict_forward, copy: row.restrict_copy, print: row.restrict_print },
    expiresAt: row.expires_at ? row.expires_at.toISOString() : null,
  };
}

export async function logConfidentialView(messageId: string, ipHash: string | null, unlocked: boolean): Promise<void> {
  await prisma.emailConfidentialView.create({
    data: { message_id: messageId, ip_hash: ipHash, unlocked },
  });
}

/** The email body the recipient actually receives — a notice + link to the viewer. */
export function buildConfidentialInviteHtml(opts: { baseUrl: string; token: string; hasPasscode: boolean; expiresAt: Date | null }): string {
  const url = `${opts.baseUrl.replace(/\/$/, "")}/c/${opts.token}`;
  const expiryLine = opts.expiresAt
    ? `<p style="margin:0 0 4px;color:#6B7280;font-size:13px;">This message expires ${opts.expiresAt.toUTCString()}.</p>`
    : "";
  const passcodeLine = opts.hasPasscode
    ? `<p style="margin:0 0 4px;color:#6B7280;font-size:13px;">A passcode is required to open it (sent separately by the sender).</p>`
    : "";
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;">
      <div style="border:1px solid #E5E7EB;border-radius:14px;padding:24px;">
        <p style="margin:0 0 12px;font-size:16px;font-weight:600;color:#1E1B2E;">🔒 You've received a confidential message</p>
        <p style="margin:0 0 16px;color:#374151;font-size:14px;">The sender used confidential mode. Open it securely in your browser:</p>
        <p style="margin:0 0 16px;">
          <a href="${url}" style="display:inline-block;background:#701CC0;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;font-size:14px;">View the message</a>
        </p>
        ${expiryLine}
        ${passcodeLine}
        <p style="margin:12px 0 0;color:#9CA3AF;font-size:12px;">If the button doesn't work, paste this link into your browser:<br>${url}</p>
      </div>
    </div>`;
}

export function buildConfidentialInviteText(opts: { baseUrl: string; token: string }): string {
  const url = `${opts.baseUrl.replace(/\/$/, "")}/c/${opts.token}`;
  return `You've received a confidential message. Open it securely here: ${url}`;
}
