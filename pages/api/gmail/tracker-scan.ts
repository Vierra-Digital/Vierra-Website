import { withAuth } from "@/lib/api/withAuth";
import { getValidGmailAccessToken } from "@/lib/gmail/tokens";
import { resolveMailboxOwner } from "@/lib/email/mailboxAccess";
import { asStr } from "@/lib/api/parsing";
import { scanHtmlForTrackers } from "@/lib/email/trackerDetection";
import { senderDomain } from "@/lib/email/senderAvatar";
import { extractHeader, parseAddressFromHeader } from "@/lib/gmail/gmailApi";

/**
 * Batched tracker scan for a page of the message list.
 *
 * The list endpoint deliberately fetches messages with `format=metadata` (no body) to stay fast,
 * so it can't tell whether a message carries an open/click beacon. This endpoint takes the ids
 * already on screen, pulls their bodies once, and reports which ones are tracked — letting the
 * list render immediately and light up the tracker dots a moment later.
 *
 * Same scan (`scanHtmlForTrackers`) the reader uses, so a dot in the list and the "tracker
 * blocked" badge in the reader can never disagree.
 */

const MAX_IDS = 40;
/** Gmail tolerates parallel gets, but keep a lid on it so a page scan can't stampede the API. */
const CONCURRENCY = 4;

function decodeBase64Url(data: string) {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

/** True when the payload tree holds a real attachment (not an inline/cid image). */
function hasAttachment(payload: unknown): boolean {
  let found = false;
  const walk = (part: any) => {
    if (!part || found) return;
    const filename = String(part?.filename || "").trim();
    const disposition = (part?.headers || []).find(
      (h: any) => String(h?.name || "").toLowerCase() === "content-disposition"
    )?.value;
    if (filename && !/inline/i.test(String(disposition || ""))) {
      found = true;
      return;
    }
    if (Array.isArray(part?.parts)) part.parts.forEach(walk);
  };
  walk(payload);
  return found;
}

/** Pull the text/html part out of a Gmail payload tree. */
function extractHtml(payload: unknown): string {
  let html = "";
  const walk = (part: any) => {
    if (!part || html) return;
    const mimeType = String(part?.mimeType || "").toLowerCase();
    const data = typeof part?.body?.data === "string" ? part.body.data : "";
    if (data && mimeType.includes("text/html")) {
      html = decodeBase64Url(data);
      return;
    }
    if (Array.isArray(part?.parts)) part.parts.forEach(walk);
  };
  walk(payload);
  if (!html && typeof (payload as any)?.body?.data === "string") {
    html = decodeBase64Url((payload as any).body.data);
  }
  return html;
}

/** Run `worker` over `items` with a bounded number of in-flight requests. */
async function mapWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await worker(items[index]);
      }
    })
  );
  return results;
}

export default withAuth(
  async (req, res, session) => {
    const userId = session.user.id;
    const accountEmail = asStr(req.body?.accountEmail).trim().toLowerCase();
    const rawIds: unknown[] = Array.isArray(req.body?.messageIds) ? req.body.messageIds : [];
    const messageIds: string[] = [
      ...new Set(rawIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)),
    ].slice(0, MAX_IDS);

    if (!accountEmail || messageIds.length === 0) {
      res.status(400).json({ message: "accountEmail and messageIds are required." });
      return;
    }

    // Read access is enough to scan — this only reports what's already in the mailbox.
    const access = await resolveMailboxOwner(userId, accountEmail);
    if (!access) {
      res.status(403).json({ message: "You don't have permission to read this mailbox." });
      return;
    }
    const token = await getValidGmailAccessToken(access.ownerUserId, access.tokenEmail);
    if (!token.ok) {
      res.status(400).json({ message: token.message });
      return;
    }

    const entries = await mapWithConcurrency(messageIds, CONCURRENCY, async (id) => {
      try {
        const response = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=full`,
          { headers: { Authorization: `Bearer ${token.accessToken}` } }
        );
        if (!response.ok) return [id, null] as const;
        const payload = await response.json();
        // Same reason as message-detail: sender-hosted images must not be scored as third-party.
        const fromHeader = extractHeader(payload?.payload?.headers, "From") || "";
        const fromDomain = senderDomain(parseAddressFromHeader(fromHeader) || "");
        const verdict = scanHtmlForTrackers(extractHtml(payload?.payload), fromDomain);
        // Attachment presence rides along on the same fetch — the list request uses
        // format=metadata and can't see parts, so this is the cheapest place to learn it.
        return [
          id,
          {
            tracked: verdict.count > 0,
            count: verdict.count,
            vendors: verdict.vendors,
            hasAttachment: hasAttachment(payload?.payload),
          },
        ] as const;
      } catch {
        // A single unreadable message shouldn't fail the whole page scan.
        return [id, null] as const;
      }
    });

    const trackers: Record<string, { tracked: boolean; count: number; vendors: string[]; hasAttachment: boolean }> = {};
    for (const [id, verdict] of entries) {
      if (verdict) trackers[id] = verdict;
    }
    res.status(200).json({ trackers });
  },
  { methods: ["POST"] }
);
