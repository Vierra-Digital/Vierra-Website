/**
 * Shared Gmail message-fetch/parse helpers, extracted from pages/api/gmail/message-detail.ts so
 * pages/api/gmail/meeting-rsvp.ts can re-derive a message's calendar invite without importing
 * one API route handler's internals from another.
 */
import { getValidGmailAccessToken } from "@/lib/gmail/tokens";
import { resolveMailboxOwner } from "@/lib/email/mailboxAccess";
import { extractHeader } from "@/lib/gmail/gmailApi";
import { parseIcsCalendar } from "@/lib/email/ics";

export function decodeBase64Url(data: string) {
  const padded = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64").toString("utf8");
}

/**
 * An inline image referenced from the HTML body by `cid:` — signature logos and pasted images are
 * sent this way, so without resolving them the reader shows a broken image.
 */
export type InlinePart = { contentId: string; mimeType: string; attachmentId: string; size: number };

/** A `text/calendar` (or `.ics`-named) MIME part — the invite this message carries, if any. */
export type IcsPart = { data: string; attachmentId: string };

export function extractBodies(
  payload: any
): { bodyText: string; bodyHtml: string; inlineParts: InlinePart[]; icsPart: IcsPart | null } {
  let bodyText = "";
  let bodyHtml = "";
  const inlineParts: InlinePart[] = [];
  let icsPart: IcsPart | null = null;

  const walk = (part: any) => {
    if (!part) return;
    const mimeType = String(part?.mimeType || "").toLowerCase();
    const filename = String(part?.filename || "").toLowerCase();
    const data = typeof part?.body?.data === "string" ? part.body.data : "";
    if (data) {
      const decoded = decodeBase64Url(data);
      if (mimeType.includes("text/plain") && !bodyText) bodyText = decoded;
      if (mimeType.includes("text/html") && !bodyHtml) bodyHtml = decoded;
    }
    // Collect image parts that carry a Content-ID so the body's cid: refs can be resolved below.
    const partHeaders = Array.isArray(part?.headers) ? part.headers : [];
    const rawContentId = extractHeader(partHeaders, "Content-ID") || "";
    const attachmentId = typeof part?.body?.attachmentId === "string" ? part.body.attachmentId : "";
    if (mimeType.startsWith("image/") && rawContentId && attachmentId) {
      inlineParts.push({
        // Content-ID is wrapped in angle brackets on the wire; cid: refs use the bare value.
        contentId: rawContentId.trim().replace(/^<|>$/g, ""),
        mimeType,
        attachmentId,
        size: Number(part?.body?.size || 0),
      });
    }
    // The calendar invite: a text/calendar part (small ones arrive inline as body.data; larger
    // ones as an attachmentId, same as any other attachment), or an application/ics-named file
    // some senders mislabel as octet-stream.
    if (!icsPart && (mimeType.includes("text/calendar") || mimeType.includes("application/ics") || filename.endsWith(".ics"))) {
      icsPart = { data, attachmentId };
    }
    if (Array.isArray(part?.parts)) {
      part.parts.forEach((child: any) => walk(child));
    }
  };

  walk(payload);
  if (!bodyText && !bodyHtml && typeof payload?.body?.data === "string") {
    bodyText = decodeBase64Url(payload.body.data);
  }
  return { bodyText, bodyHtml, inlineParts, icsPart };
}

export function parseThreadMessage(message: any) {
  const headers = Array.isArray(message?.payload?.headers) ? message.payload.headers : [];
  const bodies = extractBodies(message?.payload || {});
  const date = extractHeader(headers, "Date") || "";
  const timestamp = Number(message?.internalDate || 0) || Date.parse(date) || 0;
  return {
    id: String(message?.id || ""),
    threadId: String(message?.threadId || ""),
    subject: extractHeader(headers, "Subject") || "(No Subject)",
    fromRaw: extractHeader(headers, "From") || "",
    toRaw: extractHeader(headers, "To") || "",
    replyTo: extractHeader(headers, "Reply-To") || extractHeader(headers, "From") || "",
    date,
    timestamp,
    snippet: String(message?.snippet || ""),
    bodyText: bodies.bodyText || String(message?.snippet || ""),
    bodyHtml: bodies.bodyHtml || "",
    messageIdHeader: extractHeader(headers, "Message-ID") || "",
    references: extractHeader(headers, "References") || "",
    inReplyTo: extractHeader(headers, "In-Reply-To") || "",
    inlineParts: bodies.inlineParts,
    icsPart: bodies.icsPart,
  };
}

export async function fetchWithAuthRetry(
  url: string,
  getToken: (forceRefresh?: boolean) => Promise<string | null>
): Promise<Response | null> {
  const firstToken = await getToken(false);
  if (!firstToken) return null;
  let response = await fetch(url, {
    headers: { Authorization: `Bearer ${firstToken}` },
  });
  if (response.status !== 401) return response;
  const refreshedToken = await getToken(true);
  if (!refreshedToken) return response;
  response = await fetch(url, {
    headers: { Authorization: `Bearer ${refreshedToken}` },
  });
  return response;
}

/** Resolves a calendar part's raw ICS text, fetching it as an attachment if it wasn't inlined. */
export async function resolveIcsText(
  messageId: string,
  icsPart: IcsPart | null,
  getToken: (forceRefresh?: boolean) => Promise<string | null>
): Promise<string> {
  if (!icsPart) return "";
  if (icsPart.data) return decodeBase64Url(icsPart.data);
  if (!icsPart.attachmentId) return "";
  try {
    const response = await fetchWithAuthRetry(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(icsPart.attachmentId)}`,
      getToken
    );
    if (!response?.ok) return "";
    const payload = await response.json();
    const data = typeof payload?.data === "string" ? payload.data : "";
    return data ? decodeBase64Url(data) : "";
  } catch {
    return "";
  }
}

/**
 * Re-fetches a message from Gmail and returns its parsed calendar invite, if it carries one.
 * Shared by the reader (pages/api/gmail/message-detail.ts) and the RSVP endpoint
 * (pages/api/gmail/meeting-rsvp.ts), which must re-derive the invite's UID/SEQUENCE/organizer
 * from Gmail itself rather than trust a client-submitted copy of them.
 */
export async function fetchInviteForMessage(
  requestingUserId: string,
  accountEmail: string,
  messageId: string
): Promise<
  | { ok: true; invite: NonNullable<ReturnType<typeof parseIcsCalendar>>; effectiveUserId: string }
  | { ok: false; status: number; message: string }
> {
  const access = await resolveMailboxOwner(requestingUserId, accountEmail);
  if (!access) return { ok: false, status: 403, message: "You don't have access to this mailbox." };
  const effectiveUserId = access.ownerUserId;

  const getToken = async (forceRefresh = false) => {
    const tokenResult = await getValidGmailAccessToken(effectiveUserId, access.tokenEmail, forceRefresh ? { forceRefresh: true } : undefined);
    if (!tokenResult.ok) return null;
    return tokenResult.accessToken;
  };

  const response = await fetchWithAuthRetry(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}?format=full`,
    getToken
  );
  if (!response) return { ok: false, status: 404, message: "Gmail account token not found." };
  if (!response.ok) return { ok: false, status: 502, message: `Gmail message detail failed: ${await response.text()}` };

  const message = parseThreadMessage(await response.json());
  const icsText = await resolveIcsText(message.id, message.icsPart, getToken);
  const invite = icsText ? parseIcsCalendar(icsText) : null;
  if (!invite) return { ok: false, status: 404, message: "This message doesn't carry a calendar invite." };
  return { ok: true, invite, effectiveUserId };
}
