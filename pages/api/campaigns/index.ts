import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { asStr, asQueryStr } from "@/lib/api/parsing";
import { serializeCampaign, CAMPAIGN_STATUSES, SEND_PROVIDERS } from "@/lib/api/campaigns";

export default withAuth(async (req, res, session) => {
  if (req.method === "GET") {
    const status = asQueryStr(req.query.status);
    const where: any = { company_id: session.companyId };
    if (status && (CAMPAIGN_STATUSES as readonly string[]).includes(status)) where.status = status;

    const campaigns = await prisma.campaign.findMany({
      where,
      include: {
        email_provider_accounts: { select: { account_email: true } },
        _count: { select: { campaign_steps: true, campaign_contacts: true } },
      },
      orderBy: { created_at: "desc" },
    });
    res.setHeader("Cache-Control", "private, max-age=15");
    res.status(200).json({ campaigns: campaigns.map(serializeCampaign) });
    return;
  }

  if (req.method === "POST") {
    const name = asStr(req.body?.name);
    const accountId = asStr(req.body?.accountId);
    const accountEmail = asStr(req.body?.accountEmail).toLowerCase();
    if (!name || (!accountId && !accountEmail)) {
      res.status(400).json({ message: "name and (accountId or accountEmail) are required." });
      return;
    }

    const sendProviderRaw = asStr(req.body?.sendProvider);
    if (sendProviderRaw && !(SEND_PROVIDERS as readonly string[]).includes(sendProviderRaw)) {
      res.status(400).json({ message: `sendProvider must be one of: ${SEND_PROVIDERS.join(", ")}.` });
      return;
    }
    const sendProvider = sendProviderRaw || "internal";

    let resolvedAccountId: string;
    if (accountId) {
      const account = await prisma.emailProviderAccount.findFirst({
        where: { id: accountId, user_id: session.user.id, company_id: session.companyId },
        select: { id: true, smtp_password_enc: true },
      });
      if (!account) {
        res.status(400).json({ message: "accountId must reference one of your connected mailboxes." });
        return;
      }
      // "internal" campaigns actually SMTP-send through this account — vendor-provider campaigns
      // (smartlead/brevo) only need it for the account_email identity, so no credential check there.
      if (sendProvider === "internal" && !account.smtp_password_enc) {
        res.status(400).json({ message: "That mailbox has no SMTP credentials configured — required for an internal-provider campaign." });
        return;
      }
      resolvedAccountId = account.id;
    } else {
      if (sendProvider === "internal") {
        res.status(400).json({ message: "accountId (a connected mailbox with real SMTP credentials) is required for internal-provider campaigns." });
        return;
      }
      // Identity-only account for a vendor-provider campaign: find-or-create by (user, email) —
      // no SMTP/IMAP fields needed, the vendor sends the mail. See lib/email/smtp.ts's
      // requireSmtpCredentials() and prisma/schema.prisma's EmailProviderAccount comment.
      const existing = await prisma.emailProviderAccount.findFirst({
        where: { user_id: session.user.id, company_id: session.companyId, account_email: accountEmail },
        select: { id: true },
      });
      resolvedAccountId =
        existing?.id ??
        (
          await prisma.emailProviderAccount.create({
            data: { company_id: session.companyId, user_id: session.user.id, account_email: accountEmail },
            select: { id: true },
          })
        ).id;
    }

    const sendDelaySeconds = Number(req.body?.sendDelaySeconds);
    const sendJitterSeconds = Number(req.body?.sendJitterSeconds);
    const dailySendLimit = Number(req.body?.dailySendLimit);
    const scheduledStartAtRaw = asStr(req.body?.scheduledStartAt);

    const created = await prisma.campaign.create({
      data: {
        company_id: session.companyId,
        account_id: resolvedAccountId,
        created_by: session.user.id,
        name,
        status: "draft",
        send_provider: sendProvider,
        send_delay_seconds: Number.isFinite(sendDelaySeconds) && sendDelaySeconds >= 30 ? Math.floor(sendDelaySeconds) : 60,
        send_jitter_seconds: Number.isFinite(sendJitterSeconds) && sendJitterSeconds >= 0 ? Math.floor(sendJitterSeconds) : 30,
        daily_send_limit: Number.isFinite(dailySendLimit) && dailySendLimit > 0 ? Math.floor(dailySendLimit) : 50,
        scheduled_start_at: scheduledStartAtRaw ? new Date(scheduledStartAtRaw) : null,
      },
      include: {
        email_provider_accounts: { select: { account_email: true } },
        _count: { select: { campaign_steps: true, campaign_contacts: true } },
      },
    });
    res.status(201).json({ campaign: serializeCampaign(created) });
    return;
  }
}, { methods: ["GET", "POST"] });
