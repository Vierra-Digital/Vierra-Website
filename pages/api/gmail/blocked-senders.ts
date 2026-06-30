import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { resolveAccountId } from "@/lib/api/emailAccounts";
import { asStr } from "@/lib/api/parsing";

export default withAuth(async (req, res, session) => {
  const userId = session.user.id;

  if (req.method === "GET") {
    const accountEmail = asStr(req.query.accountEmail).toLowerCase();
    const accountId = accountEmail ? await resolveAccountId(userId, accountEmail) : null;
    const rows = await prisma.emailBlockedSender.findMany({
      where: {
        user_id: userId,
        ...(accountId ? { account_id: accountId } : {}),
      },
      orderBy: { created_at: "desc" },
    });
    res.status(200).json({ blocked: rows });
    return;
  }

  if (req.method === "POST") {
    const accountEmail = asStr(req.body?.accountEmail).toLowerCase() || null;
    const email = asStr(req.body?.email).toLowerCase();
    if (!email) {
      res.status(400).json({ message: "email is required." });
      return;
    }
    const accountId = accountEmail ? await resolveAccountId(userId, accountEmail) : null;
    const existing = await prisma.emailBlockedSender.findFirst({
      where: { user_id: userId, email, account_id: accountId },
      select: { id: true },
    });
    const row = existing
      ? await prisma.emailBlockedSender.update({
          where: { id: existing.id },
          data: { name: asStr(req.body?.name) || null },
        })
      : await prisma.emailBlockedSender.create({
          data: {
            user_id: userId,
            account_id: accountId,
            email,
            name: asStr(req.body?.name) || null,
          },
        });
    res.status(200).json({ blocked: row });
    return;
  }

  if (req.method === "DELETE") {
    const id = asStr(req.body?.id || req.query.id);
    if (!id) {
      res.status(400).json({ message: "id is required." });
      return;
    }
    const row = await prisma.emailBlockedSender.findFirst({
      where: { id, user_id: userId },
      select: { id: true },
    });
    if (!row) {
      res.status(404).json({ message: "Blocked sender not found." });
      return;
    }
    await prisma.emailBlockedSender.delete({ where: { id } });
    res.status(200).json({ ok: true });
    return;
  }
}, { methods: ["GET", "POST", "DELETE"] });
