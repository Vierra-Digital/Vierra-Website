import { prisma } from "@/lib/prisma";

/**
 * Shared-inbox delegation helpers. A user can access a mailbox if they OWN it (their own
 * connected account) or an admin GRANTED it (mailbox_grants). These resolve the grant side;
 * callers combine with the user's owned accounts. Degrade to "no grants" if the table is
 * missing (P2021) so nothing breaks pre-migration.
 */

/**
 * Every Gmail mailbox a user can access = owned (their own connections) + granted (shared with
 * them by an admin), each tagged with the `ownerUserId` whose token/data to use. For owned
 * accounts ownerUserId === userId, so endpoints that swap in this list behave identically for
 * owners. Fail-safe: on any error, returns just the owned accounts.
 */
export async function getAccessibleGmailAccounts(
  userId: string
): Promise<Array<{ email: string; ownerUserId: string }>> {
  const out: Array<{ email: string; ownerUserId: string }> = [];
  const seen = new Set<string>();
  try {
    const owned = await prisma.platformToken.findMany({
      where: { user_id: userId, platform: { startsWith: "gmail:" } },
      select: { platform: true },
    });
    for (const r of owned) {
      const email = r.platform.replace(/^gmail:/, "").toLowerCase();
      if (email && !seen.has(email)) {
        seen.add(email);
        out.push({ email, ownerUserId: userId });
      }
    }
  } catch {
    return out;
  }
  try {
    const grants = await prisma.mailboxGrant.findMany({
      where: { grantee_user_id: userId },
      select: { account_email: true },
    });
    for (const g of grants) {
      const email = g.account_email.toLowerCase();
      if (seen.has(email)) continue;
      const owner = await prisma.platformToken.findFirst({
        where: { platform: `gmail:${email}` },
        select: { user_id: true },
      });
      if (owner) {
        seen.add(email);
        out.push({ email, ownerUserId: owner.user_id });
      }
    }
  } catch {
    /* grants table unavailable — owned accounts already returned */
  }
  return out;
}

/**
 * The enforcement primitive for shared inboxes. Resolves WHOSE token/data should be used for
 * `accountEmail` when `requesterId` asks for it:
 *   - owns it (Gmail token or SMTP account)  → { ownerUserId: requesterId } (identical to today)
 *   - granted it                             → { ownerUserId: <real owner>, canSend: grant.can_send }
 *   - neither                                → null (FAIL-CLOSED — no access)
 * Wire endpoints to use ownerUserId for token + data ops; owners are unaffected because for
 * them ownerUserId === requesterId.
 */
export async function resolveMailboxOwner(
  requesterId: string,
  accountEmail: string
): Promise<{ ownerUserId: string; canSend: boolean } | null> {
  const email = accountEmail.toLowerCase();
  try {
    const ownsGmail = await prisma.platformToken.findFirst({
      where: { user_id: requesterId, platform: `gmail:${email}` },
      select: { id: true },
    });
    if (ownsGmail) return { ownerUserId: requesterId, canSend: true };
    const ownsSmtp = await prisma.emailProviderAccount.findFirst({
      where: { user_id: requesterId, account_email: email },
      select: { id: true },
    });
    if (ownsSmtp) return { ownerUserId: requesterId, canSend: true };

    const grant = await prisma.mailboxGrant.findFirst({
      where: { grantee_user_id: requesterId, account_email: email },
      select: { can_send: true },
    });
    if (!grant) return null;

    const gmailOwner = await prisma.platformToken.findFirst({
      where: { platform: `gmail:${email}` },
      select: { user_id: true },
    });
    if (gmailOwner) return { ownerUserId: gmailOwner.user_id, canSend: grant.can_send };
    const smtpOwner = await prisma.emailProviderAccount.findFirst({
      where: { account_email: email },
      select: { user_id: true },
    });
    if (smtpOwner) return { ownerUserId: smtpOwner.user_id, canSend: grant.can_send };
    return null;
  } catch {
    return null;
  }
}
