import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { getValidGmailAccessToken } from "@/lib/gmail/tokens";
import { fetchPostmasterStats, type PostmasterResult } from "@/lib/email/postmaster";
import { mapInBatches } from "@/lib/batch";

/**
 * Spam-complaint rate and Gmail-observed auth pass rates, per sending domain, from Google
 * Postmaster Tools. Requires the `postmaster.readonly` scope (reconnect) and the domain to be
 * verified in Postmaster Tools — both are reported back per-domain rather than failing the request,
 * so the UI can explain exactly what's missing.
 */
export default withAuth(async (req, res, session) => {
  const accounts = await prisma.emailProviderAccount.findMany({
    where: { user_id: session.user.id },
    select: { account_email: true },
  });

  // One entry per domain; Postmaster reports per domain, not per mailbox.
  const byDomain = new Map<string, string>();
  for (const { account_email } of accounts) {
    const domain = (account_email.split("@")[1] || "").trim().toLowerCase();
    // Free consumer domains are never verifiable in Postmaster Tools — skip rather than show an error.
    if (!domain || /^(gmail|googlemail|outlook|hotmail|yahoo|icloud|aol)\./.test(`${domain}.`)) continue;
    if (!byDomain.has(domain)) byDomain.set(domain, account_email);
  }

  if (byDomain.size === 0) {
    res.status(200).json({ configured: false, domains: [] });
    return;
  }

  const results: PostmasterResult[] = await mapInBatches(
    [...byDomain.entries()],
    async ([domain, accountEmail]) => {
      const token = await getValidGmailAccessToken(session.user.id, accountEmail);
      if (!token.ok) {
        return {
          ok: false as const,
          domain,
          reason: "no_permission" as const,
          message: "This mailbox needs reconnecting before Postmaster data can be read.",
        };
      }
      return fetchPostmasterStats(domain, token.accessToken);
    },
    4
  );

  res.status(200).json({ configured: true, domains: results });
}, { methods: ["GET"] });
