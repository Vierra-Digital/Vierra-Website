import { withAuth } from "@/lib/api/withAuth";
import { prisma } from "@/lib/prisma";

/**
 * Per-user email panel nav layout — the set of left-nav modules the user has hidden. Synced
 * server-side so it follows the user across devices. Degrades gracefully (Prisma P2021) until
 * prisma/manual/20260725_email_nav_preferences.sql is applied: GET returns "nothing hidden"
 * and POST no-ops, so the nav still renders.
 */
function isMissingTable(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2021";
}

export default withAuth(
  async (req, res, session) => {
    const userId = session.user.id;

    if (req.method === "GET") {
      try {
        const row = await prisma.emailNavPreference.findUnique({
          where: { user_id: userId },
          select: { hidden_modules: true },
        });
        res.status(200).json({ hiddenModules: row?.hidden_modules ?? [] });
      } catch (error) {
        if (isMissingTable(error)) {
          res.status(200).json({ hiddenModules: [] });
          return;
        }
        throw error;
      }
      return;
    }

    // POST — replace the hidden-module set.
    const raw = req.body?.hiddenModules;
    const hiddenModules = Array.isArray(raw)
      ? [...new Set(raw.filter((x: unknown): x is string => typeof x === "string").map((x) => x.trim().toLowerCase()).filter((x) => x && x.length <= 40))].slice(0, 40)
      : [];
    try {
      await prisma.emailNavPreference.upsert({
        where: { user_id: userId },
        create: { user_id: userId, hidden_modules: hiddenModules },
        update: { hidden_modules: hiddenModules, updated_at: new Date() },
      });
      res.status(200).json({ ok: true, hiddenModules });
    } catch (error) {
      if (isMissingTable(error)) {
        res.status(200).json({ ok: true, hiddenModules, degraded: true });
        return;
      }
      throw error;
    }
  },
  { methods: ["GET", "POST"] }
);
