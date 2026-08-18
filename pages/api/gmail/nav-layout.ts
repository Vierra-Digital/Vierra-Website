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

/** Clamp a requested page size to the range the mailbox list can actually serve. */
export const PAGE_SIZE_MIN = 10;
export const PAGE_SIZE_MAX = 100;
export function sanitizePageSize(raw: unknown): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(PAGE_SIZE_MAX, Math.max(PAGE_SIZE_MIN, Math.floor(n)));
}

/** Normalize a list of module keys: trimmed, lowercased, de-duped, bounded. */
export function sanitizeKeys(raw: unknown): string[] {
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
      // Read the newest shape first, then fall back column-by-column. The fallbacks trigger on
      // ANY error, not just Prisma's P2021/P2022: a running server holding a client generated
      // before a column existed rejects it with a validation error instead, which used to
      // escape as a 500 and take the whole nav layout down with it — the saved hidden set
      // couldn't be read, so every module came back visible and a save that had genuinely
      // landed in the database looked like it had been lost.
      try {
        const row = await prisma.emailNavPreference.findUnique({
          where: { user_id: userId },
          select: { hidden_modules: true, module_order: true, page_size: true },
        });
        res.status(200).json({
          hiddenModules: row?.hidden_modules ?? [],
          moduleOrder: row?.module_order ?? [],
          pageSize: row?.page_size ?? null,
        });
        return;
      } catch {
        /* fall through */
      }
      try {
        const row = await prisma.emailNavPreference.findUnique({
          where: { user_id: userId },
          select: { hidden_modules: true, module_order: true },
        });
        res.status(200).json({
          hiddenModules: row?.hidden_modules ?? [],
          moduleOrder: row?.module_order ?? [],
          pageSize: null,
          degraded: true,
        });
        return;
      } catch {
        /* fall through */
      }
      try {
        const row = await prisma.emailNavPreference.findUnique({
          where: { user_id: userId },
          select: { hidden_modules: true },
        });
        res.status(200).json({
          hiddenModules: row?.hidden_modules ?? [],
          moduleOrder: [],
          pageSize: null,
          degraded: true,
        });
      } catch {
        res.status(200).json({ hiddenModules: [], moduleOrder: [], pageSize: null, degraded: true });
      }
      return;
    }

    // POST — replace the hidden set and/or the order. Each is only written when the client
    // sends it, so toggling visibility never clobbers a saved order (and vice versa).
    const hasHidden = req.body?.hiddenModules !== undefined;
    const hasOrder = req.body?.moduleOrder !== undefined;
    const hasPageSize = req.body?.pageSize !== undefined;
    const hiddenModules = sanitizeKeys(req.body?.hiddenModules);
    const moduleOrder = sanitizeKeys(req.body?.moduleOrder);
    const pageSize = sanitizePageSize(req.body?.pageSize);
    try {
      await prisma.emailNavPreference.upsert({
        where: { user_id: userId },
        create: {
          user_id: userId,
          hidden_modules: hasHidden ? hiddenModules : [],
          module_order: hasOrder ? moduleOrder : [],
          ...(hasPageSize ? { page_size: pageSize } : {}),
        },
        update: {
          ...(hasHidden ? { hidden_modules: hiddenModules } : {}),
          ...(hasOrder ? { module_order: moduleOrder } : {}),
          ...(hasPageSize ? { page_size: pageSize } : {}),
          updated_at: new Date(),
        },
      });
      res.status(200).json({ ok: true, hiddenModules, moduleOrder, pageSize });
    } catch (error) {
      // A save carrying page_size can fail on a server whose Prisma client predates that
      // column. Retry without it rather than losing the visibility/order half of the write,
      // and say plainly that the page size didn't stick — reporting a blanket failure for a
      // save that mostly succeeded is as misleading as reporting success for one that didn't.
      if (hasPageSize && (hasHidden || hasOrder)) {
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
          res.status(200).json({
            ok: false,
            hiddenModules,
            moduleOrder,
            pageSize: null,
            degraded: true,
            message: "Emails per page needs a server restart to pick up a new database column.",
          });
          return;
        } catch {
          /* fall through */
        }
      }
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
        res.status(200).json({
          ok: false,
          hiddenModules,
          moduleOrder,
          degraded: true,
          message: "Email panel preferences aren't migrated on this database yet.",
        });
        return;
      }
      // Anything else (most often a Prisma client that predates a column this write uses)
      // used to surface as a bare 500, leaving the UI to guess at a generic failure string.
      // Report the reason so the message on screen names the actual problem.
      res.status(500).json({
        ok: false,
        message: error instanceof Error ? error.message : "Failed to save email panel preferences.",
      });
      return;
    }
  },
  { methods: ["GET", "POST"] }
);
