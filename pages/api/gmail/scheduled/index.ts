import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { asStr } from "@/lib/api/parsing";
import type { SendEmailPayload } from "@/lib/gmail/sendCore";

/** List / cancel a user's own scheduled sends (the compose "Scheduled" view). */
export default withAuth(
  async (req, res, session) => {
    const userId = session.user.id;

    if (req.method === "GET") {
      const rows = await prisma.emailScheduledSend.findMany({
        where: { user_id: userId, status: { in: ["PENDING", "SENDING", "FAILED"] } },
        orderBy: { scheduled_at: "asc" },
        take: 200,
      });
      const items = rows.map((row) => {
        const payload = row.payload as unknown as SendEmailPayload;
        return {
          id: row.id,
          accountEmail: row.account_email,
          scheduledAt: row.scheduled_at.toISOString(),
          status: row.status,
          lastError: row.last_error,
          to: asStr(payload?.to),
          subject: asStr(payload?.subject) || "(No Subject)",
        };
      });
      res.status(200).json({ items });
      return;
    }

    // DELETE ?id= — cancel a still-pending scheduled send (can't un-send one already dispatched).
    const id = asStr(req.query.id).trim();
    if (!id) {
      res.status(400).json({ message: "id is required." });
      return;
    }
    const result = await prisma.emailScheduledSend.updateMany({
      where: { id, user_id: userId, status: { in: ["PENDING", "FAILED"] } },
      data: { status: "CANCELED", updated_at: new Date() },
    });
    if (result.count === 0) {
      res.status(409).json({ message: "That scheduled send can no longer be canceled." });
      return;
    }
    res.status(200).json({ ok: true });
  },
  { methods: ["GET", "DELETE"] }
);
