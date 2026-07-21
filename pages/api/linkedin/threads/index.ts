import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";

/**
 * Panel-facing: list the logged-in user's LinkedIn threads (newest activity first).
 * Per-user scoped — a user only ever sees threads synced under their own extension token.
 * Degrades gracefully (empty list) if the table doesn't exist yet (P2021).
 */
export default withAuth(
  async (_req, res, session) => {
    try {
      const threads = await prisma.linkedInThread.findMany({
        where: { user_id: session.user.id },
        orderBy: [{ last_message_at: "desc" }, { updated_at: "desc" }],
        take: 200,
        select: {
          id: true,
          participant_name: true,
          participant_headline: true,
          participant_url: true,
          last_message_at: true,
          unread: true,
          _count: { select: { linkedin_messages: true } },
        },
      });
      res.status(200).json({
        threads: threads.map((t) => ({
          id: t.id,
          participantName: t.participant_name,
          participantHeadline: t.participant_headline,
          participantUrl: t.participant_url,
          lastMessageAt: t.last_message_at ? t.last_message_at.toISOString() : null,
          unread: t.unread,
          messageCount: t._count.linkedin_messages,
        })),
      });
    } catch (e) {
      if ((e as { code?: string })?.code === "P2021") {
        res.status(200).json({ threads: [], degraded: true });
        return;
      }
      throw e;
    }
  },
  { methods: ["GET"] }
);
