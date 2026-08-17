import { withAuth } from "@/lib/api/withAuth";
import { getValidGmailAccessToken } from "@/lib/gmail/tokens";
import { resolveMailboxOwner } from "@/lib/email/mailboxAccess";
import { extractHeader, parseAddressFromHeader } from "@/lib/gmail/gmailApi";
import { asQueryStr } from "@/lib/api/parsing";
import { scanHtmlForTrackers } from "@/lib/email/trackerDetection";
import { senderAvatarSources, senderDomain } from "@/lib/email/senderAvatar";

function decodeBase64Url(data: string) {
  const padded = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64").toString("utf8");
}

/**
 * An inline image referenced from the HTML body by `cid:` — signature logos and pasted images are
 * sent this way, so without resolving them the reader shows a broken image.
 */
type InlinePart = { contentId: string; mimeType: string; attachmentId: string; size: number };

/** Per-image and total budget for inlining as data URIs, so a heavy thread can't balloon the response. */
const MAX_INLINE_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_INLINE_TOTAL_BYTES = 6 * 1024 * 1024;

function extractBodies(payload: any): { bodyText: string; bodyHtml: string; inlineParts: InlinePart[] } {
  let bodyText = "";
  let bodyHtml = "";
  const inlineParts: InlinePart[] = [];

  const walk = (part: any) => {
    if (!part) return;
    const mimeType = String(part?.mimeType || "").toLowerCase();
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
    if (Array.isArray(part?.parts)) {
      part.parts.forEach((child: any) => walk(child));
    }
  };

  walk(payload);
  if (!bodyText && !bodyHtml && typeof payload?.body?.data === "string") {
    bodyText = decodeBase64Url(payload.body.data);
  }
  return { bodyText, bodyHtml, inlineParts };
}

function parseThreadMessage(message: any) {
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
  };
}

/**
 * Replace `cid:` image references with data URIs by pulling the inline attachments from Gmail.
 * Browsers can't resolve cid: on their own, so a signature logo would otherwise render broken.
 * Best-effort and budgeted: anything oversized, failed, or beyond the total cap is left as-is.
 */
async function inlineCidImages(
  messageId: string,
  bodyHtml: string,
  inlineParts: InlinePart[],
  getToken: (forceRefresh?: boolean) => Promise<string | null>
): Promise<string> {
  if (!bodyHtml || inlineParts.length === 0 || !/\bcid:/i.test(bodyHtml)) return bodyHtml;

  // Only fetch parts the body actually references, cheapest first, and stop at the total budget.
  const referenced = inlineParts
    .filter((part) => bodyHtml.toLowerCase().includes(`cid:${part.contentId.toLowerCase()}`))
    .sort((a, b) => a.size - b.size);

  let budget = MAX_INLINE_TOTAL_BYTES;
  let html = bodyHtml;
  for (const part of referenced) {
    if (part.size > MAX_INLINE_IMAGE_BYTES || part.size > budget) continue;
    try {
      const response = await fetchWithAuthRetry(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(part.attachmentId)}`,
        getToken
      );
      if (!response?.ok) continue;
      const payload = await response.json();
      const data = typeof payload?.data === "string" ? payload.data : "";
      if (!data) continue;
      // Gmail returns base64url; data: URIs need standard base64.
      const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
      budget -= part.size;
      // Replace every occurrence of this cid, with or without surrounding quotes.
      const escapedId = part.contentId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      html = html.replace(new RegExp(`cid:${escapedId}`, "gi"), `data:${part.mimeType};base64,${base64}`);
    } catch {
      /* leave this image unresolved rather than failing the whole message */
    }
  }
  return html;
}

type ThreadMessageRow = ReturnType<typeof parseThreadMessage>;

async function fetchWithAuthRetry(
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

export default withAuth(async (req, res, session) => {
  const userId = (session.user as any).id;
  const accountEmail = (asQueryStr(req.query.accountEmail) || "").trim().toLowerCase();
  const messageId = (asQueryStr(req.query.messageId) || "").trim();
  if (!accountEmail || !messageId) {
    res.status(400).json({ message: "accountEmail and messageId are required." });
    return;
  }

  // Shared-inbox access: read via the mailbox owner's token (owner === requester for own accounts).
  const access = await resolveMailboxOwner(userId, accountEmail);
  if (!access) {
    res.status(403).json({ message: "You don't have access to this mailbox." });
    return;
  }
  const effectiveUserId = access.ownerUserId;

  const getToken = async (forceRefresh = false) => {
    const tokenResult = await getValidGmailAccessToken(effectiveUserId, accountEmail, forceRefresh ? { forceRefresh: true } : undefined);
    if (!tokenResult.ok) return null;
    return tokenResult.accessToken;
  };

  const response = await fetchWithAuthRetry(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}?format=full`,
    getToken
  );
  if (!response) {
    res.status(404).json({ message: "Gmail account token not found." });
    return;
  }
  if (!response.ok) {
    const text = await response.text();
    res.status(502).json({ message: `Gmail message detail failed: ${text}` });
    return;
  }

  const payload = await response.json();
  const currentMessage = parseThreadMessage(payload);

  let threadMessages = [currentMessage];
  if (currentMessage.threadId) {
    const threadResponse = await fetchWithAuthRetry(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(currentMessage.threadId)}?format=full`,
      getToken
    );
    if (threadResponse?.ok) {
      const threadPayload = await threadResponse.json();
      const rawMessages = Array.isArray(threadPayload?.messages) ? threadPayload.messages : [];
      const parsedMessages = rawMessages
        .map(parseThreadMessage)
        .filter((message: ThreadMessageRow) => Boolean(message.id));
      if (parsedMessages.length > 0) {
        threadMessages = parsedMessages.sort((a: ThreadMessageRow, b: ThreadMessageRow) => a.timestamp - b.timestamp);
      }
    }
  }

  // Resolve inline (cid:) images so signature logos and pasted images actually render. Done per
  // message and in parallel across the thread; each message degrades independently.
  threadMessages = await Promise.all(
    threadMessages.map(async (message: ThreadMessageRow) => ({
      ...message,
      bodyHtml: await inlineCidImages(message.id, message.bodyHtml, message.inlineParts, getToken),
    }))
  );
  const resolvedCurrent =
    threadMessages.find((message: ThreadMessageRow) => message.id === currentMessage.id) ?? currentMessage;

  let senderPhotoUrl = "";
  const senderEmail = parseAddressFromHeader(currentMessage.fromRaw);
  if (senderEmail && senderEmail.includes("@")) {
    const trySearchContacts = async () => {
      const peopleQuery = encodeURIComponent(senderEmail);
      const peopleResponse = await fetchWithAuthRetry(
        `https://people.googleapis.com/v1/people:searchContacts?query=${peopleQuery}&readMask=names,emailAddresses,photos&pageSize=10`,
        getToken
      );
      if (!peopleResponse?.ok) return "";
      const peoplePayload = await peopleResponse.json();
      const results = Array.isArray(peoplePayload?.results) ? peoplePayload.results : [];
      for (const result of results) {
        const person = result?.person;
        const emails = Array.isArray(person?.emailAddresses)
          ? person.emailAddresses.map((entry: any) => String(entry?.value || "").toLowerCase()).filter(Boolean)
          : [];
        if (!emails.includes(senderEmail)) continue;
        const photo = Array.isArray(person?.photos) ? person.photos.find((entry: any) => entry?.url && !entry?.default) || person.photos.find((entry: any) => entry?.url) : null;
        if (typeof photo?.url === "string" && photo.url.trim()) {
          return photo.url.trim();
        }
      }
      return "";
    };

    const tryPeopleConnections = async () => {
      const peopleResponse = await fetchWithAuthRetry(
        "https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,photos&pageSize=200",
        getToken
      );
      if (!peopleResponse?.ok) return "";
      const peoplePayload = await peopleResponse.json();
      const connections = Array.isArray(peoplePayload?.connections) ? peoplePayload.connections : [];
      for (const person of connections) {
        const emails = Array.isArray(person?.emailAddresses)
          ? person.emailAddresses.map((entry: any) => String(entry?.value || "").toLowerCase()).filter(Boolean)
          : [];
        if (!emails.includes(senderEmail)) continue;
        const photo = Array.isArray(person?.photos) ? person.photos.find((entry: any) => entry?.url && !entry?.default) || person.photos.find((entry: any) => entry?.url) : null;
        if (typeof photo?.url === "string" && photo.url.trim()) {
          return photo.url.trim();
        }
      }
      return "";
    };

    senderPhotoUrl = (await trySearchContacts()) || (await tryPeopleConnections()) || "";
  }

  res.status(200).json({
    bodyText: currentMessage.bodyText || payload?.snippet || "",
    bodyHtml: resolvedCurrent.bodyHtml || "",
    fromRaw: currentMessage.fromRaw,
    toRaw: currentMessage.toRaw,
    subject: currentMessage.subject,
    replyTo: currentMessage.replyTo,
    date: currentMessage.date,
    timestamp: currentMessage.timestamp,
    messageIdHeader: currentMessage.messageIdHeader,
    references: currentMessage.references,
    senderPhotoUrl,
    // Ordered avatar sources (contact photo → Gravatar → company favicon). Built here so the md5
    // stays on the server: importing node:crypto into the panel would ship a polyfill to the
    // browser for one hash. The client walks these on image error, then falls back to initials.
    senderAvatarSources: senderEmail ? senderAvatarSources(senderEmail, senderPhotoUrl) : [],
    threadMessages,
    // Authoritative tracker scan (DOM-free) so the "tracker blocked" badge is consistent with the
    // client's own detection and available without client-side rendering.
    // Pass the sender's domain: without it every remote image scored a "third-party" penalty, so
    // images a sender hosts on its OWN domain were being flagged as beacons and stripped.
    trackers: scanHtmlForTrackers(currentMessage.bodyHtml || "", senderDomain(senderEmail)),
  });
}, { methods: ["GET"] });
