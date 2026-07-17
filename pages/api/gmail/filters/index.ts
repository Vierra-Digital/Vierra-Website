import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { asStr } from "@/lib/api/parsing";

/** List / create the caller's inbound filter rules. Applied by the inbound loop. */
export default withAuth(
  async (req, res, session) => {
    const userId = session.user.id;

    if (req.method === "GET") {
      const rows = await prisma.emailFilter.findMany({
        where: { user_id: userId },
        orderBy: { created_at: "asc" },
      });
      res.status(200).json({ filters: rows });
      return;
    }

    // POST — create
    const name = asStr(req.body?.name).trim();
    if (!name) {
      res.status(400).json({ message: "A filter name is required." });
      return;
    }
    const fromContains = asStr(req.body?.fromContains).trim();
    const subjectContains = asStr(req.body?.subjectContains).trim();
    const queryContains = asStr(req.body?.queryContains).trim();
    if (!fromContains && !subjectContains && !queryContains) {
      res.status(400).json({ message: "Add at least one match condition." });
      return;
    }
    const created = await prisma.emailFilter.create({
      data: {
        user_id: userId,
        account_email: asStr(req.body?.accountEmail).trim().toLowerCase() || null,
        name,
        from_contains: fromContains || null,
        subject_contains: subjectContains || null,
        query_contains: queryContains || null,
        match_type: asStr(req.body?.matchType) === "any" ? "any" : "all",
        add_label_id: asStr(req.body?.addLabelId).trim() || null,
        add_label_name: asStr(req.body?.addLabelName).trim() || null,
        archive: Boolean(req.body?.archive),
        mark_read: Boolean(req.body?.markRead),
        star: Boolean(req.body?.star),
        trash: Boolean(req.body?.trash),
        enabled: req.body?.enabled !== false,
      },
    });
    res.status(200).json({ filter: created });
  },
  { methods: ["GET", "POST"] }
);
