import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { asStr } from "@/lib/api/parsing";

/**
 * Per-account enable/disable for the email panel. Accounts default to enabled; only
 * explicit overrides are stored. The panel loads all connected accounts that aren't
 * disabled here.
 *
 * Degrades gracefully if the table hasn't been created yet (Prisma P2021): reads
 * return "no overrides" (everything enabled) and writes no-op, so the inbox still
 * loads before `prisma/manual/20260716_email_account_preferences.sql` is applied.
 */
function isMissingTable(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2021";
}

export default withAuth(
  async (req, res, session) => {
    const userId = session.user.id;

    if (req.method === "GET") {
      try {
        const rows = await prisma.emailAccountPreference.findMany({
          where: { user_id: userId },
          select: { account_email: true, enabled: true },
        });
        res.status(200).json({ preferences: rows.map((r) => ({ accountEmail: r.account_email, enabled: r.enabled })) });
      } catch (error) {
        if (isMissingTable(error)) {
          res.status(200).json({ preferences: [] });
          return;
        }
        throw error;
      }
      return;
    }

    // POST — set enabled for one account.
    const accountEmail = asStr(req.body?.accountEmail).trim().toLowerCase();
    if (!accountEmail) {
      res.status(400).json({ message: "accountEmail is required." });
      return;
    }
    const enabled = req.body?.enabled !== false;
    try {
      await prisma.emailAccountPreference.upsert({
        where: { user_id_account_email: { user_id: userId, account_email: accountEmail } },
        create: { user_id: userId, account_email: accountEmail, enabled },
        update: { enabled, updated_at: new Date() },
      });
      res.status(200).json({ ok: true, accountEmail, enabled });
    } catch (error) {
      if (isMissingTable(error)) {
        res.status(200).json({ ok: true, accountEmail, enabled, degraded: true });
        return;
      }
      throw error;
    }
  },
  { methods: ["GET", "POST"] }
);
