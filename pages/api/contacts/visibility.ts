import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { handleApiError } from "@/lib/api/guards";
import { resolveAccountId } from "@/lib/api/emailAccounts";
import { asQueryStr } from "@/lib/api/parsing";

export default withAuth(async (req, res, session) => {
  const userId = session.user.id;
  const accountEmail = asQueryStr(req.query.accountEmail).toLowerCase() || null;
  try {
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
      const data = {
        show_phone: Boolean(req.body?.showPhone ?? true),
        show_business: Boolean(req.body?.showBusiness ?? true),
        show_website: Boolean(req.body?.showWebsite ?? true),
      };
      // account_id has a real (user_id, account_id) unique constraint (schema.prisma), so upsert
      // is atomic and race-free for it — two concurrent PUTs for the same inbox can no longer both
      // miss a find-then-create and double-insert. A null account_id (a Gmail OAuth inbox with no
      // provider row) isn't covered by that constraint — Postgres allows more than one NULL — so it
      // keeps the find-then-write this route already used for that case.
      const setting = accountId
        ? await prisma.contactFieldVisibilitySetting.upsert({
            where: { user_id_account_id: { user_id: userId, account_id: accountId } },
            create: { user_id: userId, account_id: accountId, account_email: accountEmail, ...data },
            update: data,
          })
        : await (async () => {
            const existing = await prisma.contactFieldVisibilitySetting.findFirst({
              where: { user_id: userId, account_email: accountEmail },
              select: { id: true },
            });
            return existing
              ? prisma.contactFieldVisibilitySetting.update({ where: { id: existing.id }, data })
              : prisma.contactFieldVisibilitySetting.create({
                  data: { user_id: userId, account_id: null, account_email: accountEmail, ...data },
                });
          })();
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
  } catch (e) {
    handleApiError(res, `contacts/visibility ${req.method}`, e, "Failed to process visibility request.");
  }
}, { methods: ["GET", "PUT"] });
