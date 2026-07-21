import { prisma } from "@/lib/prisma";

/**
 * Shared-inbox delegation helpers. A user can access a mailbox if they OWN it (their own
 * connected account) or an admin GRANTED it (mailbox_grants). These resolve the grant side;
 * callers combine with the user's owned accounts. Degrade to "no grants" if the table is
 * missing (P2021) so nothing breaks pre-migration.
 */

/** Lowercased account emails this user has been granted access to. */
export async function grantedAccountEmails(userId: string): Promise<string[]> {
  try {
    const rows = await prisma.mailboxGrant.findMany({
      where: { grantee_user_id: userId },
      select: { account_email: true },
    });
    return rows.map((r) => r.account_email.toLowerCase());
  } catch {
    return [];
  }
}

/** True if the user was granted this mailbox with send permission. */
export async function canSendAsGranted(userId: string, accountEmail: string): Promise<boolean> {
  try {
    const g = await prisma.mailboxGrant.findFirst({
      where: { grantee_user_id: userId, account_email: accountEmail.toLowerCase(), can_send: true },
      select: { id: true },
    });
    return Boolean(g);
  } catch {
    return false;
  }
}
