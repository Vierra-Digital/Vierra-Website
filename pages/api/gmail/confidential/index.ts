import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { asStr } from "@/lib/api/parsing";

/** List / revoke the caller's confidential messages. */
export default withAuth(
  async (req, res, session) => {
    const userId = session.user.id;

    if (req.method === "GET") {
      const rows = await prisma.emailConfidentialMessage.findMany({
        where: { user_id: userId },
        orderBy: { created_at: "desc" },
        take: 200,
        select: {
          id: true,
          subject: true,
          created_at: true,
          expires_at: true,
          revoked: true,
          _count: { select: { email_confidential_views: true } },
        },
      });
      res.status(200).json({
        items: rows.map((row) => ({
          id: row.id,
          subject: row.subject,
          createdAt: row.created_at.toISOString(),
          expiresAt: row.expires_at ? row.expires_at.toISOString() : null,
          revoked: row.revoked,
          views: row._count.email_confidential_views,
        })),
      });
      return;
    }

    // DELETE ?id= — revoke access to a confidential message.
    const id = asStr(req.query.id).trim();
    if (!id) {
      res.status(400).json({ message: "id is required." });
      return;
    }
    const result = await prisma.emailConfidentialMessage.updateMany({
      where: { id, user_id: userId },
      data: { revoked: true },
    });
    if (result.count === 0) {
      res.status(404).json({ message: "Message not found." });
      return;
    }
    res.status(200).json({ ok: true });
  },
  { methods: ["GET", "DELETE"] }
);
