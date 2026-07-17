import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { asStr } from "@/lib/api/parsing";
import { snoozeMessages, unsnooze, type SnoozeItem } from "@/lib/gmail/snooze";

/** Snooze / list / un-snooze messages for the caller. */
export default withAuth(
  async (req, res, session) => {
    const userId = session.user.id;

    if (req.method === "GET") {
      const rows = await prisma.emailSnooze.findMany({
        where: { user_id: userId, status: "SNOOZED" },
        orderBy: { snooze_until: "asc" },
        take: 200,
      });
      res.status(200).json({
        items: rows.map((row) => ({
          id: row.id,
          accountEmail: row.account_email,
          messageId: row.message_id,
          threadId: row.thread_id,
          snoozeUntil: row.snooze_until.toISOString(),
        })),
      });
      return;
    }

    if (req.method === "DELETE") {
      const id = asStr(req.query.id).trim();
      if (!id) {
        res.status(400).json({ message: "id is required." });
        return;
      }
      const ok = await unsnooze(userId, id);
      if (!ok) {
        res.status(404).json({ message: "Snooze not found." });
        return;
      }
      res.status(200).json({ ok: true });
      return;
    }

    // POST — snooze a batch of messages until a time.
    const accountEmail = asStr(req.body?.accountEmail).trim().toLowerCase();
    const snoozeUntilRaw = asStr(req.body?.snoozeUntil);
    const items: SnoozeItem[] = Array.isArray(req.body?.items)
      ? (req.body.items as unknown[])
          .map((entry) => {
            const row = (entry || {}) as Record<string, unknown>;
            return { messageId: asStr(row.messageId), threadId: asStr(row.threadId) || undefined };
          })
          .filter((item) => item.messageId)
      : [];
    if (!accountEmail || items.length === 0) {
      res.status(400).json({ message: "accountEmail and items are required." });
      return;
    }
    const until = new Date(snoozeUntilRaw);
    if (Number.isNaN(until.getTime()) || until.getTime() <= Date.now()) {
      res.status(400).json({ message: "snoozeUntil must be a future time." });
      return;
    }
    const result = await snoozeMessages(userId, accountEmail, items, until);
    if (!result.ok) {
      res.status(400).json({ message: result.message || "Failed to snooze." });
      return;
    }
    res.status(200).json({ ok: true, snoozed: result.snoozed });
  },
  { methods: ["GET", "POST", "DELETE"] }
);
