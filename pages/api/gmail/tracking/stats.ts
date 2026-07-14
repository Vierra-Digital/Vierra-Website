import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";

import { asQueryStr } from "@/lib/api/parsing";

export default withAuth(async (req, res, session) => {
  const userId = session.user.id;
  const accountEmail = asQueryStr(req.query.accountEmail).trim().toLowerCase();
  const from = asQueryStr(req.query.from).trim();
  const to = asQueryStr(req.query.to).trim();

  let accountId: string | null = null;
  if (accountEmail) {
    const account = await prisma.emailProviderAccount.findFirst({
      where: { user_id: userId, account_email: accountEmail },
      select: { id: true },
    });
    accountId = account?.id ?? null;
  }

  const where: Prisma.EmailOutboundMessageWhereInput = {
    user_id: userId,
    ...(accountId ? { account_id: accountId } : {}),
    ...(from || to
      ? {
          created_at: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
  };

  const messages = await prisma.emailOutboundMessage.findMany({
    where,
    select: {
      id: true,
      gmail_message_id: true,
      account_id: true,
      subject: true,
      tracking_enabled: true,
      created_at: true,
      email_tracking_events: {
        select: {
          event_type: true,
          occurred_at: true,
        },
      },
    },
    orderBy: { created_at: "desc" },
    take: 200,
  });

  const uniqueAccountIds = [...new Set(messages.map((m) => m.account_id).filter((id): id is string => !!id))];
  const accountMap = new Map<string, string>();
  if (uniqueAccountIds.length > 0) {
    const accounts = await prisma.emailProviderAccount.findMany({
      where: { id: { in: uniqueAccountIds } },
      select: { id: true, account_email: true },
    });
    for (const a of accounts) accountMap.set(a.id, a.account_email);
  }

  const rows = messages.map((message) => {
    const openCount = message.email_tracking_events.filter((e) => e.event_type === "OPEN").length;
    const clickCount = message.email_tracking_events.filter((e) => e.event_type === "CLICK").length;
    return {
      messageId: message.gmail_message_id,
      accountEmail: message.account_id ? (accountMap.get(message.account_id) ?? null) : null,
      subject: message.subject,
      trackingEnabled: message.tracking_enabled,
      createdAt: message.created_at,
      openCount,
      clickCount,
    };
  });

  res.status(200).json({
    totals: {
      trackedMessages: rows.filter((row) => row.trackingEnabled).length,
      opens: rows.reduce((sum, row) => sum + row.openCount, 0),
      clicks: rows.reduce((sum, row) => sum + row.clickCount, 0),
    },
    messages: rows,
  });
}, { methods: ["GET"] });
