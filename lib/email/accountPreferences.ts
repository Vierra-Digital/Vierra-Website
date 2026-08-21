import { prisma } from "@/lib/prisma";

/**
 * Per-account state for the email panel: whether a mailbox is shown, and which one is the primary
 * inbox. Accounts default to enabled; only explicit overrides are stored.
 *
 * Shared by the /api/gmail/account-preferences endpoint and the email panel page's
 * getServerSideProps (which needs the same enabled/primary resolution to pick the initial account
 * selection server-side, without a client round trip).
 *
 * Degrades gracefully if the table hasn't been created yet (Prisma P2021): reads return "no
 * overrides" (everything enabled, no primary) rather than throwing.
 *
 * is_primary is read with raw SQL rather than through the typed client. A server holding a Prisma
 * client generated before the column existed rejects a typed query naming it outright, which would
 * take the whole account list down with it. Raw SQL lets a missing column degrade to "no primary
 * set" instead.
 */

export type AccountPreferenceRow = { account_email: string; enabled: boolean; is_primary: boolean };

export function isMissingPreferencesTable(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2021";
}

/**
 * Whether this database has the is_primary column yet, remembered per process.
 *
 * Without this every caller would attempt the query on every single request against a database
 * where the migration has not been applied, logging a Prisma error each time even though it
 * degrades correctly. Probed once with a cheap catalogue lookup instead.
 *
 * Only ever flips false -> true (after the migration is applied and the process restarts), never the
 * other way, so a transient failure cannot permanently disable the feature.
 */
let primaryColumnAvailable: boolean | null = null;

export async function hasPrimaryColumn(): Promise<boolean> {
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
    primaryColumnAvailable = false;
  }
  return primaryColumnAvailable;
}

/** Preferences including the primary flag, or null when the column/table isn't available. */
export async function readPreferencesWithPrimary(userId: string): Promise<AccountPreferenceRow[] | null> {
  if (!(await hasPrimaryColumn())) return null;
  try {
    return await prisma.$queryRaw<AccountPreferenceRow[]>`
      SELECT account_email, enabled, is_primary
      FROM email_account_preferences
      WHERE user_id = ${userId}::uuid
    `;
  } catch {
    return null;
  }
}

/**
 * Enabled account emails, primary first, given the full set of accessible accounts. Used to pick
 * the initial account selection without needing the enabled/primary UI-facing response shape.
 * Falls back to "everything enabled, no primary" on any error — same default the endpoint uses.
 */
export async function resolveEnabledAccounts(userId: string, accessibleEmails: string[]): Promise<string[]> {
  const disabled = new Set<string>();
  let primary = "";
  try {
    const withPrimary = await readPreferencesWithPrimary(userId);
    const normalized: Array<{ email: string; enabled: boolean; isPrimary: boolean }> = withPrimary
      ? withPrimary.map((r) => ({ email: r.account_email.toLowerCase(), enabled: r.enabled, isPrimary: r.is_primary }))
      : await prisma.emailAccountPreference
          .findMany({ where: { user_id: userId }, select: { account_email: true, enabled: true } })
          .then((rows) => rows.map((r) => ({ email: r.account_email.toLowerCase(), enabled: r.enabled, isPrimary: false })))
          .catch((error) => {
            if (isMissingPreferencesTable(error)) return [];
            throw error;
          });
    for (const row of normalized) {
      if (row.enabled === false) disabled.add(row.email);
      if (row.isPrimary) primary = row.email;
    }
  } catch {
    /* default to all enabled, no primary */
  }
  return accessibleEmails
    .filter((email) => !disabled.has(email.toLowerCase()))
    .sort((a, b) => Number(b.toLowerCase() === primary) - Number(a.toLowerCase() === primary));
}
