import type { NextApiRequest, NextApiResponse } from "next";
import { requireSession } from "@/lib/auth";
import { getValidGmailAccessToken } from "@/lib/gmail/tokens";

function asStr(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

function decodeBase64Url(data: string) {
  const padded = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64").toString("utf8");
}

function extractBodies(payload: any): { bodyText: string; bodyHtml: string } {
  let bodyText = "";
  let bodyHtml = "";

  const walk = (part: any) => {
    if (!part) return;
    const mimeType = String(part?.mimeType || "").toLowerCase();
    const data = typeof part?.body?.data === "string" ? part.body.data : "";
    if (data) {
      const decoded = decodeBase64Url(data);
      if (mimeType.includes("text/plain") && !bodyText) bodyText = decoded;
      if (mimeType.includes("text/html") && !bodyHtml) bodyHtml = decoded;
    }
    if (Array.isArray(part?.parts)) {
      part.parts.forEach((child: any) => walk(child));
    }
  };

  walk(payload);
  if (!bodyText && !bodyHtml && typeof payload?.body?.data === "string") {
    bodyText = decodeBase64Url(payload.body.data);
  }
  return { bodyText, bodyHtml };
}

function extractHeader(headers: Array<{ name?: string; value?: string }> | undefined, key: string) {
  if (!headers) return "";
  const target = headers.find((h) => (h.name || "").toLowerCase() === key.toLowerCase());
  return target?.value || "";
}

function extractEmailFromHeader(value: string) {
  const trimmed = (value || "").trim();
  const angleMatch = trimmed.match(/<([^>]+)>/);
  if (angleMatch?.[1]) return angleMatch[1].trim().toLowerCase();
  return trimmed.toLowerCase();
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
  };
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ message: "Method Not Allowed" });
    return;
  }

  const session = await requireSession(req, res);
  if (!session) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  const userId = Number((session.user as any).id);
  const accountEmail = (asStr(req.query.accountEmail) || "").trim().toLowerCase();
  const messageId = (asStr(req.query.messageId) || "").trim();
  if (!accountEmail || !messageId) {
    res.status(400).json({ message: "accountEmail and messageId are required." });
    return;
  }

  const getToken = async (forceRefresh = false) => {
    const tokenResult = await getValidGmailAccessToken(userId, accountEmail, forceRefresh ? { forceRefresh: true } : undefined);
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

  let senderPhotoUrl = "";
  const senderEmail = extractEmailFromHeader(currentMessage.fromRaw);
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
    bodyHtml: currentMessage.bodyHtml || "",
    fromRaw: currentMessage.fromRaw,
    toRaw: currentMessage.toRaw,
    subject: currentMessage.subject,
    replyTo: currentMessage.replyTo,
    date: currentMessage.date,
    timestamp: currentMessage.timestamp,
    messageIdHeader: currentMessage.messageIdHeader,
    references: currentMessage.references,
    senderPhotoUrl,
    threadMessages,
  });
}
