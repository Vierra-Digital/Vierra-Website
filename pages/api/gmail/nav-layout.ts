import { withAuth } from "@/lib/api/withAuth";
import { prisma } from "@/lib/prisma";

/**
 * Per-user email panel nav layout — which left-nav modules are hidden, and the order they
 * appear in. Synced server-side so the layout follows the user across devices. Degrades
 * gracefully until the manual migrations are applied (P2021 missing table for
 * 20260725_email_nav_preferences.sql, P2022 missing column for
 * 20260814_email_nav_module_order.sql): GET returns defaults and POST no-ops, so the nav
 * still renders either way.
 */
function isMissingTable(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2021";
}

function isMissingColumn(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2022";
}

/** Normalize a list of module keys: trimmed, lowercased, de-duped, bounded. */
function sanitizeKeys(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [
    ...new Set(
      raw
        .filter((x: unknown): x is string => typeof x === "string")
        .map((x) => x.trim().toLowerCase())
        .filter((x) => x && x.length <= 40)
    ),
  ].slice(0, 40);
}

export default withAuth(
  async (req, res, session) => {
    const userId = session.user.id;

    if (req.method === "GET") {
      try {
        const row = await prisma.emailNavPreference.findUnique({
          where: { user_id: userId },
          select: { hidden_modules: true, module_order: true },
        });
        res.status(200).json({
          hiddenModules: row?.hidden_modules ?? [],
          moduleOrder: row?.module_order ?? [],
        });
      } catch (error) {
        if (isMissingTable(error)) {
          res.status(200).json({ hiddenModules: [], moduleOrder: [] });
          return;
        }
        // Column not migrated yet — still serve the hidden set so the nav works.
        if (isMissingColumn(error)) {
          try {
            const row = await prisma.emailNavPreference.findUnique({
              where: { user_id: userId },
              select: { hidden_modules: true },
            });
            res.status(200).json({ hiddenModules: row?.hidden_modules ?? [], moduleOrder: [], degraded: true });
          } catch {
            res.status(200).json({ hiddenModules: [], moduleOrder: [], degraded: true });
          }
          return;
        }
        throw error;
      }
      return;
    }

    // POST — replace the hidden set and/or the order. Each is only written when the client
    // sends it, so toggling visibility never clobbers a saved order (and vice versa).
    const hasHidden = req.body?.hiddenModules !== undefined;
    const hasOrder = req.body?.moduleOrder !== undefined;
    const hiddenModules = sanitizeKeys(req.body?.hiddenModules);
    const moduleOrder = sanitizeKeys(req.body?.moduleOrder);
    try {
      await prisma.emailNavPreference.upsert({
        where: { user_id: userId },
        create: {
          user_id: userId,
          hidden_modules: hasHidden ? hiddenModules : [],
          module_order: hasOrder ? moduleOrder : [],
        },
        update: {
          ...(hasHidden ? { hidden_modules: hiddenModules } : {}),
          ...(hasOrder ? { module_order: moduleOrder } : {}),
          updated_at: new Date(),
        },
      });
      res.status(200).json({ ok: true, hiddenModules, moduleOrder });
    } catch (error) {
      // The order column is missing (migration not applied yet). Don't drop the write on the
      // floor — retry persisting just the hidden set, which is what most saves are, and only
      // then report the ordering half as degraded. Reporting ok:true while saving nothing is
      // what made a failed save look like a working one.
      if (isMissingColumn(error) && hasHidden) {
        try {
          await prisma.emailNavPreference.upsert({
            where: { user_id: userId },
            create: { user_id: userId, hidden_modules: hiddenModules },
            update: { hidden_modules: hiddenModules, updated_at: new Date() },
          });
          res.status(200).json({ ok: true, hiddenModules, moduleOrder: [], degraded: true });
          return;
        } catch {
          /* fall through to the honest failure below */
        }
      }
      if (isMissingTable(error) || isMissingColumn(error)) {
        res.status(200).json({ ok: false, hiddenModules, moduleOrder, degraded: true });
        return;
      }
      throw error;
    }
  },
  { methods: ["GET", "POST"] }
);
