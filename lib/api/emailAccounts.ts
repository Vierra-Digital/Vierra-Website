import { prisma } from "@/lib/prisma";

/**
 * Resolves an `accountEmail` (the wire-format identifier the frontend uses)
 * to the EmailProviderAccount's real id, scoped to `userId` — this is also
 * the ownership check: a user can never resolve another user's account this
 * way, since the lookup itself is scoped to their own user_id.
 */
export async function resolveAccountId(userId: string, accountEmail: string | null | undefined): Promise<string | null> {
  const normalized = accountEmail?.trim().toLowerCase();
  if (!normalized) return null;
  const account = await prisma.emailProviderAccount.findFirst({
    where: { user_id: userId, account_email: normalized },
    select: { id: true },
  });
  return account?.id ?? null;
}
