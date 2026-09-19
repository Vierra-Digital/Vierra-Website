import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { checkSpf, checkDkim, checkDmarc, type CheckResult, type DmarcCheckResult } from "@/lib/email/domainAuthChecks";

/**
 * Authentication posture for each domain the user sends from: SPF, DKIM and DMARC.
 *
 * These three records are the single biggest controllable factor in whether cold mail lands in
 * the inbox — a domain missing DMARC (or publishing `p=none`) gets throttled or spam-foldered by
 * Gmail/Outlook regardless of content. Checked live over DNS; nothing is stored.
 */

type DomainAuth = {
  domain: string;
  accounts: string[];
  spf: CheckResult;
  dkim: CheckResult;
  dmarc: DmarcCheckResult;
};

export default withAuth(async (req, res, session) => {
  const accounts = await prisma.emailProviderAccount.findMany({
    where: { user_id: session.user.id },
    select: { account_email: true },
  });

  // Group the connected mailboxes by their domain — auth records are per-domain, not per-mailbox.
  const byDomain = new Map<string, string[]>();
  for (const { account_email } of accounts) {
    const domain = (account_email.split("@")[1] || "").trim().toLowerCase();
    if (!domain) continue;
    byDomain.set(domain, [...(byDomain.get(domain) ?? []), account_email]);
  }

  const domains: DomainAuth[] = await Promise.all(
    [...byDomain.entries()].map(async ([domain, emails]) => {
      const [spf, dkim, dmarc] = await Promise.all([checkSpf(domain), checkDkim(domain), checkDmarc(domain)]);
      return { domain, accounts: emails, spf, dkim, dmarc };
    })
  );

  res.status(200).json({ domains });
}, { methods: ["GET"] });
