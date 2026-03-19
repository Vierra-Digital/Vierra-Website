import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

function asStr(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireSession(req, res);
  if (!session) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }
  const userId = Number((session.user as any).id);

  if (req.method === "GET") {
    const draftKey = asStr(req.query.draftKey);
    if (!draftKey) {
      res.status(400).json({ message: "draftKey is required." });
      return;
    }
    const draft = await prisma.emailComposeDraft.findUnique({
      where: {
        email_compose_drafts_userId_draftKey_key: {
          userId,
          draftKey,
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

    const payload = {
      accountEmail: asStr(req.body?.accountEmail) || null,
      toText: asStr(req.body?.to),
      ccText: asStr(req.body?.cc) || null,
      bccText: asStr(req.body?.bcc) || null,
      showCc: Boolean(req.body?.showCc),
      showBcc: Boolean(req.body?.showBcc),
      subject: asStr(req.body?.subject),
      bodyText: asStr(req.body?.bodyText),
      bodyHtml: asStr(req.body?.bodyHtml) || null,
      previewHtml: asStr(req.body?.previewHtml) || null,
      threadId: asStr(req.body?.threadId) || null,
      inReplyTo: asStr(req.body?.inReplyTo) || null,
      references: asStr(req.body?.references) || null,
    };

    const draft = await prisma.emailComposeDraft.upsert({
      where: {
        email_compose_drafts_userId_draftKey_key: {
          userId,
          draftKey,
        },
      },
      update: payload,
      create: {
        userId,
        draftKey,
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
      where: { userId, draftKey },
    });
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ message: "Method Not Allowed" });
}

