import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { resolveAccountId } from "@/lib/api/emailAccounts";

function asStr(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireRole(req, res);
  if (!session) return;
  const userId = session.user.id;

  if (req.method === "GET") {
    const draftKey = asStr(req.query.draftKey);
    if (!draftKey) {
      res.status(400).json({ message: "draftKey is required." });
      return;
    }
    const draft = await prisma.emailComposeDraft.findUnique({
      where: {
        user_id_draft_key: {
          user_id: userId,
          draft_key: draftKey,
        },
      },
    });
    res.status(200).json({ draft });
    return;
  }

  if (req.method === "PUT") {
    const draftKey = asStr(req.body?.draftKey);
    if (!draftKey) {
      res.status(400).json({ message: "draftKey is required." });
      return;
    }

    const accountEmail = asStr(req.body?.accountEmail) || null;
    const accountId = accountEmail ? await resolveAccountId(userId, accountEmail) : null;

    const payload = {
      account_id: accountId,
      to_text: asStr(req.body?.to),
      cc_text: asStr(req.body?.cc) || null,
      bcc_text: asStr(req.body?.bcc) || null,
      show_cc: Boolean(req.body?.showCc),
      show_bcc: Boolean(req.body?.showBcc),
      subject: asStr(req.body?.subject),
      body_text: asStr(req.body?.bodyText),
      body_html: asStr(req.body?.bodyHtml) || null,
      preview_html: asStr(req.body?.previewHtml) || null,
      thread_id: asStr(req.body?.threadId) || null,
      in_reply_to: asStr(req.body?.inReplyTo) || null,
      references: asStr(req.body?.references) || null,
    };

    const draft = await prisma.emailComposeDraft.upsert({
      where: {
        user_id_draft_key: {
          user_id: userId,
          draft_key: draftKey,
        },
      },
      update: payload,
      create: {
        user_id: userId,
        draft_key: draftKey,
        ...payload,
      },
    });

    res.status(200).json({ draft });
    return;
  }

  if (req.method === "DELETE") {
    const draftKey = asStr(req.body?.draftKey || req.query.draftKey);
    if (!draftKey) {
      res.status(400).json({ message: "draftKey is required." });
      return;
    }
    await prisma.emailComposeDraft.deleteMany({
      where: { user_id: userId, draft_key: draftKey },
    });
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ message: "Method Not Allowed" });
}
