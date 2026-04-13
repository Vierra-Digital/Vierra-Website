import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { getValidGmailAccessToken } from "@/lib/gmail/tokens";

function asStr(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function getAccountEmail(req: NextApiRequest) {
  const raw = Array.isArray(req.query.accountEmail) ? req.query.accountEmail[0] : req.query.accountEmail;
  return asStr(raw).toLowerCase();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireSession(req, res);
  if (!session) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }
  const userId = Number((session.user as any).id);
  const accountEmail = getAccountEmail(req);
  if (!accountEmail) {
    res.status(400).json({ message: "accountEmail is required" });
    return;
  }

  if (req.method === "GET") {
    const settings =
      (await prisma.emailAccountSetting.findUnique({
        where: {
          userId_accountEmail: {
            userId,
            accountEmail,
          },
        },
      })) ||
      (await prisma.emailAccountSetting.findFirst({
        where: { userId },
        orderBy: { updatedAt: "desc" },
      }));
    res.status(200).json({
      settings: settings || {
        accountEmail,
        trackingEnabled: false,
        openTrackingEnabled: true,
        clickTrackingEnabled: true,
        vacationResponderEnabled: false,
        vacationSubject: "",
        vacationBodyHtml: "",
        vacationBodyText: "",
        vacationStartAt: null,
        vacationEndAt: null,
        vacationReplyFrequencyHours: 24,
      },
    });
    return;
  }

  if (req.method === "PUT") {
    const vacationReplyFrequencyHoursRaw = Number(req.body?.vacationReplyFrequencyHours);
    const vacationReplyFrequencyHours =
      Number.isFinite(vacationReplyFrequencyHoursRaw) && vacationReplyFrequencyHoursRaw > 0
        ? Math.floor(vacationReplyFrequencyHoursRaw)
        : 24;
    const updated = await prisma.emailAccountSetting.upsert({
      where: {
        userId_accountEmail: {
          userId,
          accountEmail,
        },
      },
      create: {
        userId,
        accountEmail,
        trackingEnabled: Boolean(req.body?.trackingEnabled),
        openTrackingEnabled: Boolean(req.body?.openTrackingEnabled ?? true),
        clickTrackingEnabled: Boolean(req.body?.clickTrackingEnabled ?? true),
        vacationResponderEnabled: Boolean(req.body?.vacationResponderEnabled),
        vacationSubject: asStr(req.body?.vacationSubject) || null,
        vacationBodyHtml: asStr(req.body?.vacationBodyHtml) || null,
        vacationBodyText: asStr(req.body?.vacationBodyText) || null,
        vacationStartAt: req.body?.vacationStartAt ? new Date(req.body.vacationStartAt) : null,
        vacationEndAt: req.body?.vacationEndAt ? new Date(req.body.vacationEndAt) : null,
        vacationReplyFrequencyHours,
      },
      update: {
        trackingEnabled: Boolean(req.body?.trackingEnabled),
        openTrackingEnabled: Boolean(req.body?.openTrackingEnabled ?? true),
        clickTrackingEnabled: Boolean(req.body?.clickTrackingEnabled ?? true),
        vacationResponderEnabled: Boolean(req.body?.vacationResponderEnabled),
        vacationSubject: asStr(req.body?.vacationSubject) || null,
        vacationBodyHtml: asStr(req.body?.vacationBodyHtml) || null,
        vacationBodyText: asStr(req.body?.vacationBodyText) || null,
        vacationStartAt: req.body?.vacationStartAt ? new Date(req.body.vacationStartAt) : null,
        vacationEndAt: req.body?.vacationEndAt ? new Date(req.body.vacationEndAt) : null,
        vacationReplyFrequencyHours,
      },
    });
    await prisma.emailAccountSetting.updateMany({
      where: { userId },
      data: {
        trackingEnabled: Boolean(req.body?.trackingEnabled),
        openTrackingEnabled: Boolean(req.body?.openTrackingEnabled ?? true),
        clickTrackingEnabled: Boolean(req.body?.clickTrackingEnabled ?? true),
      },
    });

    const tokenResult = await getValidGmailAccessToken(userId, accountEmail);
    if (!tokenResult.ok) {
      res.status(tokenResult.reason === "account_not_found" ? 404 : 401).json({ message: tokenResult.message });
      return;
    }

    const setVacationWithToken = async (accessToken: string) => fetch("https://gmail.googleapis.com/gmail/v1/users/me/settings/vacation", {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        enableAutoReply: req.body?.vacationResponderEnabled,
        responseSubject: req.body?.vacationSubject,
        responseBodyPlainText: req.body?.vacationBodyText,
        responseBodyHtml: req.body?.vacationBodyHtml,
        startTime: req.body?.vacationStartAt,
        endTime: req.body?.vacationEndAt
      })
    });

    let vacationResult = await setVacationWithToken(tokenResult.accessToken);
    if (vacationResult.status == 401) {
      const refreshResult = await getValidGmailAccessToken(userId, accountEmail, { forceRefresh: true });
      if (!refreshResult.ok) {
        res.status(401).json({ message: refreshResult.message });
        return;
      }
      vacationResult = await setVacationWithToken(refreshResult.accessToken);
    }
    if (!vacationResult.ok) {
      res.status(502).json({ message: "Failed to update vacation settings" });
      return;
    }

    res.status(200).json({ settings: updated });
    return;
  }

  res.status(405).json({ message: "Method Not Allowed" });
}
