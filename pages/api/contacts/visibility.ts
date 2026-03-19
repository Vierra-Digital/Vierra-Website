import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

function asStr(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0]?.trim() || "" : v?.trim() || "";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireSession(req, res);
  if (!session) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }
  const userId = Number((session.user as any).id);
  const accountEmail = asStr(req.query.accountEmail).toLowerCase() || null;

  if (req.method === "GET") {
    const setting = await prisma.contactFieldVisibilitySetting.findFirst({
      where: {
        userId,
        accountEmail,
      },
    });
    const fallbackSetting =
      !setting && accountEmail
        ? await prisma.contactFieldVisibilitySetting.findFirst({
            where: {
              userId,
              accountEmail: null,
            },
          })
        : null;
    const effectiveSetting = setting || fallbackSetting;
    res.status(200).json({
      visibility: effectiveSetting || {
        accountEmail,
        showPhone: true,
        showBusiness: true,
        showWebsite: true,
      },
    });
    return;
  }

  if (req.method === "PUT") {
    const existing = await prisma.contactFieldVisibilitySetting.findFirst({
      where: { userId, accountEmail },
      select: { id: true },
    });
    const setting = existing
      ? await prisma.contactFieldVisibilitySetting.update({
          where: { id: existing.id },
          data: {
            showPhone: Boolean(req.body?.showPhone ?? true),
            showBusiness: Boolean(req.body?.showBusiness ?? true),
            showWebsite: Boolean(req.body?.showWebsite ?? true),
          },
        })
      : await prisma.contactFieldVisibilitySetting.create({
          data: {
            userId,
            accountEmail,
            showPhone: Boolean(req.body?.showPhone ?? true),
            showBusiness: Boolean(req.body?.showBusiness ?? true),
            showWebsite: Boolean(req.body?.showWebsite ?? true),
          },
        });
    res.status(200).json({ visibility: setting });
    return;
  }

  res.status(405).json({ message: "Method Not Allowed" });
}
