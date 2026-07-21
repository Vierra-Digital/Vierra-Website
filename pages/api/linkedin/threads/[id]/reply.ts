import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { asStr } from "@/lib/api/parsing";

/**
 * Panel-facing: queue a reply to a LinkedIn thread. Since there's no official LinkedIn API,
 * the actual send happens in the extension — we create a PENDING LinkedInSendCommand that
 * the extension polls (/api/extension/linkedin/commands) and inserts into the open thread for
 * the user to review + send, then reports back. The real sent message arrives on the next
 * sync (with its true li_message_id); the panel echoes the reply in local UI state meanwhile,
 * so we deliberately do NOT write an optimistic DB row here (that would duplicate the synced
 * message on reload). Per-user scoped.
 */
export default withAuth(
  async (req, res, session) => {
    const id = asStr(req.query.id).trim();
    const body = asStr((req.body as { body?: unknown })?.body).trim();
    if (!id) {
      res.status(400).json({ message: "id is required." });
      return;
    }
    if (!body) {
      res.status(400).json({ message: "Message body is required." });
      return;
    }

    const thread = await prisma.linkedInThread.findFirst({
      where: { id, user_id: session.user.id },
      select: { id: true, li_thread_id: true },
    });
    if (!thread) {
      res.status(404).json({ message: "Thread not found." });
      return;
    }

    const command = await prisma.linkedInSendCommand.create({
      data: { user_id: session.user.id, li_thread_id: thread.li_thread_id, body, status: "PENDING" },
      select: { id: true },
    });

    res.status(200).json({ success: true, commandId: command.id, status: "PENDING" });
  },
  { methods: ["POST"] }
);
