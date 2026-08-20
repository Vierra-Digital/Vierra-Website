import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { asStr } from "@/lib/api/parsing";

/**
 * Per-account state for the email panel: whether a mailbox is shown, and which one is the primary
 * inbox. Accounts default to enabled; only explicit overrides are stored.
 *
 * The primary inbox is the account's main mailbox — every other connected mailbox is a brand account
 * added onto it. At most one per user, enforced by a partial unique index in
 * prisma/manual/20260820_email_account_primary.sql.
 *
 * Degrades gracefully if the table hasn't been created yet (Prisma P2021): reads return "no
 * overrides" (everything enabled, no primary) and writes no-op, so the inbox still loads before
 * prisma/manual/20260716_email_account_preferences.sql is applied.
 *
 * is_primary is read and written with raw SQL rather than through the typed client. A server holding
 * a Prisma client generated before the column existed rejects a typed query naming it outright,
 * which would take the whole account list down with it — the same failure mode that once broke the
 * nav layout. Raw SQL lets a missing column degrade to "no primary set" instead.
 */
function isMissingTable(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2021";
}

type PreferenceRow = { account_email: string; enabled: boolean; is_primary: boolean };

/**
 * Whether this database has the is_primary column yet, remembered per process.
 *
 * Without this the endpoint attempted the query on every single request against a database where
 * the migration has not been applied. It degraded correctly, but Prisma logs each failed query, so
 * a perfectly working panel filled the server log with database errors on every load. Probed once
 * with a cheap catalogue lookup instead, so a missing column costs one query per process and
 * produces no errors at all.
 *
 * Only ever flips false -> true (after the migration is applied and the process restarts), never the
 * other way, so a transient failure cannot permanently disable the feature.
 */
let primaryColumnAvailable: boolean | null = null;

async function hasPrimaryColumn(): Promise<boolean> {
  if (primaryColumnAvailable !== null) return primaryColumnAvailable;
  try {
    const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'email_account_preferences' AND column_name = 'is_primary'
      ) AS exists
    `;
    primaryColumnAvailable = Boolean(rows[0]?.exists);
  } catch {
    // Catalogue unreadable (missing table, no permission): treat the feature as unavailable rather
    // than retrying a query that will fail anyway.
    primaryColumnAvailable = false;
  }
  return primaryColumnAvailable;
}

/** Preferences including the primary flag, or null when the column/table isn't available. */
async function readPreferencesWithPrimary(userId: string): Promise<PreferenceRow[] | null> {
  if (!(await hasPrimaryColumn())) return null;
  try {
    return await prisma.$queryRaw<PreferenceRow[]>`
      SELECT account_email, enabled, is_primary
      FROM email_account_preferences
      WHERE user_id = ${userId}::uuid
    `;
  } catch {
    return null;
  }
}

export default withAuth(
  async (req, res, session) => {
    const userId = session.user.id;

    if (req.method === "GET") {
      const withPrimary = await readPreferencesWithPrimary(userId);
      if (withPrimary) {
        res.status(200).json({
          preferences: withPrimary.map((r) => ({
            accountEmail: r.account_email,
            enabled: r.enabled,
            isPrimary: r.is_primary,
          })),
        });
        return;
      }
      // No is_primary column yet: still serve the enabled flags rather than nothing.
      try {
        const rows = await prisma.emailAccountPreference.findMany({
          where: { user_id: userId },
          select: { account_email: true, enabled: true },
        });
        res.status(200).json({
          preferences: rows.map((r) => ({ accountEmail: r.account_email, enabled: r.enabled, isPrimary: false })),
          degraded: true,
        });
      } catch (error) {
        if (isMissingTable(error)) {
          res.status(200).json({ preferences: [] });
          return;
        }
        throw error;
      }
      return;
    }

    // POST — set enabled and/or primary for one account.
    const accountEmail = asStr(req.body?.accountEmail).trim().toLowerCase();
    if (!accountEmail) {
      res.status(400).json({ message: "accountEmail is required." });
      return;
    }
    const hasEnabled = req.body?.enabled !== undefined;
    const hasPrimary = req.body?.isPrimary !== undefined;
    const enabled = req.body?.enabled !== false;
    const isPrimary = req.body?.isPrimary === true;

    if (hasPrimary && isPrimary && !(await hasPrimaryColumn())) {
      res.status(200).json({
        ok: false,
        accountEmail,
        degraded: true,
        message: "Setting a primary inbox needs prisma/manual/20260820_email_account_primary.sql applied.",
      });
      return;
    }

    if (hasPrimary && isPrimary) {
      // One statement per step, in a transaction: clearing the old primary and setting the new one
      // must not leave a window with two primaries (or none, if the second write fails).
      try {
        await prisma.$transaction([
          prisma.$executeRaw`
            UPDATE email_account_preferences
            SET is_primary = false, updated_at = now()
            WHERE user_id = ${userId}::uuid AND is_primary
          `,
          prisma.$executeRaw`
            INSERT INTO email_account_preferences (user_id, account_email, enabled, is_primary)
            VALUES (${userId}::uuid, ${accountEmail}, ${hasEnabled ? enabled : true}, true)
            ON CONFLICT (user_id, account_email)
            DO UPDATE SET is_primary = true, updated_at = now()
          `,
        ]);
        res.status(200).json({ ok: true, accountEmail, isPrimary: true });
        return;
      } catch (error) {
        // Missing table or missing column — say so rather than reporting a save that didn't happen.
        res.status(200).json({
          ok: false,
          accountEmail,
          degraded: true,
          message: isMissingTable(error)
            ? "Email panel preferences aren't migrated on this database yet."
            : "Setting a primary inbox needs prisma/manual/20260820_email_account_primary.sql applied.",
        });
        return;
      }
    }

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
