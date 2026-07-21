import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { asStr } from "@/lib/api/parsing";

/**
 * Panel-facing: one LinkedIn thread + its messages (oldest first), for the logged-in user.
 * Marks the thread read on open. Per-user scoped.
 */
export default withAuth(
  async (req, res, session) => {
    const id = asStr(req.query.id).trim();
    if (!id) {
      res.status(400).json({ message: "id is required." });
      return;
    }

    const thread = await prisma.linkedInThread.findFirst({
      where: { id, user_id: session.user.id },
      select: {
        id: true,
        li_thread_id: true,
        participant_name: true,
        participant_headline: true,
        participant_url: true,
        last_message_at: true,
        unread: true,
      },
    });
    if (!thread) {
      res.status(404).json({ message: "Thread not found." });
      return;
    }

    const messages = await prisma.linkedInMessage.findMany({
      where: { thread_id: thread.id },
      orderBy: [{ sent_at: "asc" }, { created_at: "asc" }],
      take: 500,
      select: { id: true, direction: true, body: true, sent_at: true, created_at: true },
    });

    if (thread.unread) {
      await prisma.linkedInThread.update({ where: { id: thread.id }, data: { unread: false } });
    }

    res.status(200).json({
      thread: {
        id: thread.id,
        liThreadId: thread.li_thread_id,
        participantName: thread.participant_name,
        participantHeadline: thread.participant_headline,
        participantUrl: thread.participant_url,
        lastMessageAt: thread.last_message_at ? thread.last_message_at.toISOString() : null,
      },
      messages: messages.map((m) => ({
        id: m.id,
        direction: m.direction,
        body: m.body,
        at: (m.sent_at || m.created_at).toISOString(),
      })),
    });
  },
  { methods: ["GET"] }
);
