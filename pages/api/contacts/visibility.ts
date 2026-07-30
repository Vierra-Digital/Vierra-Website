import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { resolveAccountId } from "@/lib/api/emailAccounts";
import { asQueryStr } from "@/lib/api/parsing";

export default withAuth(async (req, res, session) => {
  const userId = session.user.id;
  const accountEmail = asQueryStr(req.query.accountEmail).toLowerCase() || null;
  const accountId = await resolveAccountId(userId, accountEmail);

  if (req.method === "GET") {
    // Scope by account_email so Gmail OAuth inboxes (no account_id) get their own visibility;
    // fall back to the null-account_email global row when this inbox has none of its own.
    const setting = await prisma.contactFieldVisibilitySetting.findFirst({
      where: { user_id: userId, account_email: accountEmail },
    });
    const fallbackSetting =
      !setting && accountEmail
        ? await prisma.contactFieldVisibilitySetting.findFirst({
            where: { user_id: userId, account_email: null },
          })
        : null;
    const effectiveSetting = setting || fallbackSetting;
    res.status(200).json({
      visibility: effectiveSetting
        ? {
            accountEmail,
            showPhone: effectiveSetting.show_phone,
            showBusiness: effectiveSetting.show_business,
            showWebsite: effectiveSetting.show_website,
          }
        : {
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
      where: { user_id: userId, account_email: accountEmail },
      select: { id: true },
    });
    const setting = existing
      ? await prisma.contactFieldVisibilitySetting.update({
          where: { id: existing.id },
          data: {
            show_phone: Boolean(req.body?.showPhone ?? true),
            show_business: Boolean(req.body?.showBusiness ?? true),
            show_website: Boolean(req.body?.showWebsite ?? true),
          },
        })
      : await prisma.contactFieldVisibilitySetting.create({
          data: {
            user_id: userId,
            account_id: accountId,
            account_email: accountEmail,
            show_phone: Boolean(req.body?.showPhone ?? true),
            show_business: Boolean(req.body?.showBusiness ?? true),
            show_website: Boolean(req.body?.showWebsite ?? true),
          },
        });
    res.status(200).json({
      visibility: {
        accountEmail,
        showPhone: setting.show_phone,
        showBusiness: setting.show_business,
        showWebsite: setting.show_website,
      },
    });
    return;
  }
}, { methods: ["GET", "PUT"] });
