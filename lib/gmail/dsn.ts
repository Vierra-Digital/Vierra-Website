/**
 * Delivery Status Notification (bounce) parsing — RFC 3464.
 *
 * When a send fails permanently, the receiving side mails back a report from mailer-daemon whose
 * `message/delivery-status` part names the failed recipient and an enhanced status code. Until now
 * nothing read those, so bounces only ever appeared for Brevo-sent campaigns (via its webhook) and
 * Gmail sends reported none at all — the biggest hole in deliverability reporting.
 *
 * This module is pure so it can be unit-tested without Gmail: detection works off headers, parsing
 * works off the raw report text.
 */

/** A single failed recipient extracted from a delivery-status report. */
export type DsnRecipient = {
  email: string;
  /** Enhanced status code, e.g. "5.1.1". Empty when the report omits it. */
  status: string;
  /** "failed" = permanent, "delayed" = transient, per the report's Action field. */
  action: string;
  /** Server's human-readable reason, when present. */
  diagnostic: string;
  /**
   * Permanent (5.x.x) failures are safe to suppress — the address does not exist or refuses mail.
   * Transient (4.x.x) failures are retried by the sending side and must NOT suppress the contact.
   */
  permanent: boolean;
};

const DAEMON_ADDRESS = /(mailer-daemon|postmaster|no-?reply)@/i;

/**
 * Cheap, header-only bounce check so the inbound loop can skip the extra body fetch for the
 * overwhelming majority of mail. Deliberately broad: a false positive costs one wasted fetch,
 * while a false negative loses a bounce entirely.
 */
export function looksLikeBounce(headers: Record<string, string>, fromEmail: string): boolean {
  const contentType = (headers["content-type"] || "").toLowerCase();
  // The authoritative signal: a multipart/report carrying a delivery-status part.
  if (contentType.includes("report-type=delivery-status")) return true;
  if (contentType.includes("multipart/report")) return true;
  if (DAEMON_ADDRESS.test(fromEmail || "")) return true;
  const subject = (headers["subject"] || "").toLowerCase();
  return /undeliver|delivery status notification|delivery has failed|returned mail|mail delivery failed/.test(
    subject
  );
}

/** Normalize an RFC 3464 address field ("rfc822; user@host", "<user@host>") to a bare address. */
function normalizeRecipient(value: string): string {
  const afterType = value.includes(";") ? value.slice(value.indexOf(";") + 1) : value;
  return afterType.trim().replace(/^<|>$/g, "").trim().toLowerCase();
}

/**
 * Parse the `message/delivery-status` body into per-recipient outcomes.
 *
 * The body is groups of `Field: value` lines separated by blank lines: one per-message group, then
 * one per-recipient group each. Only groups naming a recipient are returned, so the leading
 * per-message group is ignored naturally.
 */
export function parseDeliveryStatus(reportBody: string): DsnRecipient[] {
  if (!reportBody.trim()) return [];
  const recipients: DsnRecipient[] = [];

  for (const block of reportBody.split(/\r?\n\s*\r?\n/)) {
    const fields: Record<string, string> = {};
    // Unfold continuation lines (leading whitespace continues the previous field) before splitting.
    const unfolded = block.replace(/\r?\n[ \t]+/g, " ");
    for (const line of unfolded.split(/\r?\n/)) {
      const idx = line.indexOf(":");
      if (idx <= 0) continue;
      fields[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
    }

    const rawRecipient = fields["final-recipient"] || fields["original-recipient"] || "";
    if (!rawRecipient) continue;
    const email = normalizeRecipient(rawRecipient);
    if (!email.includes("@")) continue;

    const status = (fields["status"] || "").trim();
    const action = (fields["action"] || "").trim().toLowerCase();
    // Prefer the status code; fall back to Action when a report omits Status.
    const permanent = status ? status.startsWith("5") : action === "failed";

    recipients.push({
      email,
      status,
      action,
      diagnostic: (fields["diagnostic-code"] || "").trim(),
      permanent,
    });
  }

  return recipients;
}

/**
 * Pull the delivery-status report out of a Gmail `format=full` payload tree, plus any bounced
 * message/rfc822 headers (used to recover which of our sends bounced).
 */
export function extractDsnParts(payload: unknown): { deliveryStatus: string; originalHeaders: string } {
  let deliveryStatus = "";
  let originalHeaders = "";

  const decode = (data: string) => Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");

  const walk = (part: any) => {
    if (!part || typeof part !== "object") return;
    const mimeType = String(part.mimeType || "").toLowerCase();
    const data = typeof part?.body?.data === "string" ? part.body.data : "";
    if (data) {
      if (mimeType === "message/delivery-status" && !deliveryStatus) deliveryStatus = decode(data);
      // The report usually attaches the original message (or just its headers) — that's where our
      // Message-ID lives, letting us tie the bounce back to a specific send.
      if ((mimeType === "message/rfc822" || mimeType === "text/rfc822-headers") && !originalHeaders) {
        originalHeaders = decode(data);
      }
    }
    if (Array.isArray(part.parts)) part.parts.forEach(walk);
  };

  walk(payload);
  return { deliveryStatus, originalHeaders };
}

/** Read a header value out of a raw header block (used on the attached original message). */
export function headerFromRaw(rawHeaders: string, name: string): string {
  const match = rawHeaders
    .replace(/\r?\n[ \t]+/g, " ")
    .match(new RegExp(`^${name}\\s*:\\s*(.+)$`, "im"));
  return match ? match[1].trim() : "";
}
