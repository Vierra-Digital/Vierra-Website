import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { asStr } from "@/lib/api/parsing";
import { checkSpf, checkDkim, checkDmarc, type CheckResult, type DmarcCheckResult } from "@/lib/email/domainAuthChecks";
import { getValidGmailAccessToken } from "@/lib/gmail/tokens";
import { fetchPostmasterStats, type PostmasterResult } from "@/lib/email/postmaster";
import { computeBounceStats, isConsumerDomain } from "@/lib/email/mailboxHealth";

/**
 * Consolidated sending-health snapshot for one mailbox: domain authentication (SPF/DKIM/DMARC),
 * Postmaster reputation, and a bounce-rate rollup across the campaigns this mailbox has sent.
 * Backs the single per-mailbox health row in Settings — previously three separate sections
 * (Deliverability, Gmail reputation, and nothing for bounce rate) each doing their own fetch.
 */

export default withAuth(async (req, res, session) => {
  const id = asStr(req.query.id);
  if (!id) {
    res.status(400).json({ message: "id is required." });
    return;
  }

  const account = await prisma.emailProviderAccount.findFirst({
    where: { id, user_id: session.user.id },
    select: { id: true, account_email: true },
  });
  if (!account) {
    res.status(404).json({ message: "Mailbox not found." });
    return;
  }

  const domain = (account.account_email.split("@")[1] || "").trim().toLowerCase();
  if (!domain) {
    res.status(200).json({ domain: "", spf: null, dkim: null, dmarc: null, postmaster: null, bounce: await computeBounceStats(account.id) });
    return;
  }

  const [[spf, dkim, dmarc], postmaster, bounce] = await Promise.all([
    Promise.all([checkSpf(domain), checkDkim(domain), checkDmarc(domain)]),
    (async (): Promise<PostmasterResult | null> => {
      if (isConsumerDomain(domain)) return null;
      const token = await getValidGmailAccessToken(session.user.id, account.account_email);
      if (!token.ok) {
        return { ok: false, domain, reason: "no_permission", message: "This mailbox needs reconnecting before Postmaster data can be read." };
      }
      return fetchPostmasterStats(domain, token.accessToken);
    })(),
    computeBounceStats(account.id),
  ]);

  res.status(200).json({
    domain,
    spf: spf as CheckResult,
    dkim: dkim as CheckResult,
    dmarc: dmarc as DmarcCheckResult,
    postmaster,
    bounce,
  });
}, { methods: ["GET"] });
