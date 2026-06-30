import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { asStr } from "@/lib/api/parsing";

export default withAuth(async (req, res, session) => {
  const userId = session.user.id;

  if (req.method === "GET") {
    const tags = await prisma.contactTag.findMany({
      where: { user_id: userId },
      orderBy: { name: "asc" },
    });
    res.status(200).json({ tags });
    return;
  }

  if (req.method === "POST") {
    const name = asStr(req.body?.name);
    if (!name) {
      res.status(400).json({ message: "Tag name is required." });
      return;
    }
    const created = await prisma.contactTag.create({
      data: {
        user_id: userId,
        name,
        color: asStr(req.body?.color) || "#701CC0",
      },
    });
    res.status(201).json({ tag: created });
    return;
  }

  if (req.method === "PUT") {
    const id = asStr(req.body?.id);
    if (!id) {
      res.status(400).json({ message: "Tag id is required." });
      return;
    }
    const existing = await prisma.contactTag.findFirst({ where: { id, user_id: userId } });
    if (!existing) {
      res.status(404).json({ message: "Tag not found." });
      return;
    }
    const updated = await prisma.contactTag.update({
      where: { id },
      data: {
        name: asStr(req.body?.name) || existing.name,
        color: asStr(req.body?.color) || existing.color,
      },
    });
    res.status(200).json({ tag: updated });
    return;
  }

  if (req.method === "DELETE") {
    const id = asStr(req.body?.id);
    if (!id) {
      res.status(400).json({ message: "Tag id is required." });
      return;
    }
    await prisma.contactTag.deleteMany({ where: { id, user_id: userId } });
    res.status(200).json({ ok: true });
    return;
  }
}, { methods: ["GET", "POST", "PUT", "DELETE"] });
