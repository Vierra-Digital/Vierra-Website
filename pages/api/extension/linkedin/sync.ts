import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { applyExtensionCors, resolveExtensionUser } from "@/lib/linkedin/extensionAuth";

/**
 * The Sales Nav extension pushes scraped LinkedIn threads + messages here. Authenticated
 * by the caller's per-user extension token; everything is scoped to that user.
 *
 * Body: { threads: [{ liThreadId, participantName?, participantHeadline?, participantUrl?,
 *   unread?, lastMessageAt?, messages: [{ liMessageId, direction: "in"|"out", body, sentAt? }] }] }
 *
 * Upserts are idempotent on (user_id, li_thread_id) and (thread_id, li_message_id), so the
 * extension can re-send overlapping windows without creating duplicates.
 */
type InboundMessage = {
  liMessageId?: unknown;
  direction?: unknown;
  body?: unknown;
  sentAt?: unknown;
};
type InboundThread = {
  liThreadId?: unknown;
  participantName?: unknown;
  participantHeadline?: unknown;
  participantUrl?: unknown;
  unread?: unknown;
  lastMessageAt?: unknown;
  messages?: unknown;
};

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
function parseDate(v: unknown): Date | null {
  if (typeof v !== "string" && typeof v !== "number") return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  applyExtensionCors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST", "OPTIONS"]);
    res.status(405).json({ message: "Method Not Allowed" });
    return;
  }

  const auth = await resolveExtensionUser(req);
  if (!auth) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const threads = Array.isArray((req.body as { threads?: unknown })?.threads)
    ? ((req.body as { threads: InboundThread[] }).threads)
    : [];
  if (!threads.length) {
    res.status(200).json({ success: true, threadsUpserted: 0, messagesUpserted: 0 });
    return;
  }

  let threadsUpserted = 0;
  let messagesUpserted = 0;

  try {
    for (const t of threads.slice(0, 500)) {
      const liThreadId = str(t.liThreadId);
      if (!liThreadId) continue;
      const lastMessageAt = parseDate(t.lastMessageAt);
      const thread = await prisma.linkedInThread.upsert({
        where: { user_id_li_thread_id: { user_id: auth.userId, li_thread_id: liThreadId } },
        update: {
          participant_name: str(t.participantName) ?? undefined,
          participant_headline: str(t.participantHeadline) ?? undefined,
          participant_url: str(t.participantUrl) ?? undefined,
          unread: typeof t.unread === "boolean" ? t.unread : undefined,
          last_message_at: lastMessageAt ?? undefined,
          updated_at: new Date(),
        },
        create: {
          user_id: auth.userId,
          li_thread_id: liThreadId,
          participant_name: str(t.participantName),
          participant_headline: str(t.participantHeadline),
          participant_url: str(t.participantUrl),
          unread: typeof t.unread === "boolean" ? t.unread : false,
          last_message_at: lastMessageAt,
        },
        select: { id: true },
      });
      threadsUpserted++;

      const messages = Array.isArray(t.messages) ? (t.messages as InboundMessage[]) : [];
      for (const m of messages.slice(0, 500)) {
        const liMessageId = str(m.liMessageId);
        const body = typeof m.body === "string" ? m.body : null;
        const direction = str(m.direction) === "out" ? "out" : "in";
        if (!liMessageId || body === null) continue;
        await prisma.linkedInMessage.upsert({
          where: { thread_id_li_message_id: { thread_id: thread.id, li_message_id: liMessageId } },
          update: { body, direction, sent_at: parseDate(m.sentAt) ?? undefined },
          create: {
            thread_id: thread.id,
            li_message_id: liMessageId,
            direction,
            body,
            sent_at: parseDate(m.sentAt),
          },
        });
        messagesUpserted++;
      }
    }

    res.status(200).json({ success: true, threadsUpserted, messagesUpserted });
  } catch (e) {
    console.error("extension/linkedin/sync error:", e);
    res.status(500).json({ message: "Internal Server Error" });
  }
}
