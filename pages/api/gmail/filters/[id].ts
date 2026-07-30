import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { asStr } from "@/lib/api/parsing";

/** Update / delete a single filter rule. */
export default withAuth(
  async (req, res, session) => {
    const userId = session.user.id;
    const id = asStr(req.query.id).trim();
    if (!id) {
      res.status(400).json({ message: "id is required." });
      return;
    }

    const owned = await prisma.emailFilter.findFirst({ where: { id, user_id: userId }, select: { id: true } });
    if (!owned) {
      res.status(404).json({ message: "Filter not found." });
      return;
    }

    if (req.method === "DELETE") {
      await prisma.emailFilter.delete({ where: { id } });
      res.status(200).json({ ok: true });
      return;
    }

    // PUT — update (partial)
    const body = req.body || {};
    const data: Record<string, unknown> = { updated_at: new Date() };
    if (body.name !== undefined) data.name = asStr(body.name).trim() || "Filter";
    if (body.accountEmail !== undefined) data.account_email = asStr(body.accountEmail).trim().toLowerCase() || null;
    if (body.fromContains !== undefined) data.from_contains = asStr(body.fromContains).trim() || null;
    if (body.subjectContains !== undefined) data.subject_contains = asStr(body.subjectContains).trim() || null;
    if (body.queryContains !== undefined) data.query_contains = asStr(body.queryContains).trim() || null;
    if (body.matchType !== undefined) data.match_type = asStr(body.matchType) === "any" ? "any" : "all";
    if (body.addLabelId !== undefined) data.add_label_id = asStr(body.addLabelId).trim() || null;
    if (body.addLabelName !== undefined) data.add_label_name = asStr(body.addLabelName).trim() || null;
    if (body.archive !== undefined) data.archive = Boolean(body.archive);
    if (body.markRead !== undefined) data.mark_read = Boolean(body.markRead);
    if (body.star !== undefined) data.star = Boolean(body.star);
    if (body.trash !== undefined) data.trash = Boolean(body.trash);
    if (body.enabled !== undefined) data.enabled = Boolean(body.enabled);

    const updated = await prisma.emailFilter.update({ where: { id }, data });
    res.status(200).json({ filter: updated });
  },
  { methods: ["PUT", "DELETE"] }
);
