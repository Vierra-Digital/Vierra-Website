import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

function asStr(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function queryAccountEmail(req: NextApiRequest) {
  const raw = Array.isArray(req.query.accountEmail) ? req.query.accountEmail[0] : req.query.accountEmail;
  const value = asStr(raw).toLowerCase();
  return value || null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireSession(req, res);
  if (!session) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }
  const userId = Number((session.user as any).id);

  if (req.method === "GET") {
    const accountEmail = queryAccountEmail(req);
    const signatures = await prisma.emailSignature.findMany({
      where: {
        userId,
        OR: accountEmail ? [{ accountEmail }, { accountEmail: null }] : undefined,
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
    res.status(200).json({ signatures });
    return;
  }

  if (req.method === "POST") {
    const accountEmail = asStr(req.body?.accountEmail).toLowerCase() || null;
    const name = asStr(req.body?.name);
    if (!name) {
      res.status(400).json({ message: "name is required" });
      return;
    }
    const isDefault = Boolean(req.body?.isDefault);
    if (isDefault) {
      await prisma.emailSignature.updateMany({
        where: { userId, accountEmail, isDefault: true },
        data: { isDefault: false },
      });
    }
    const created = await prisma.emailSignature.create({
      data: {
        userId,
        accountEmail,
        name,
        signatureHtml: asStr(req.body?.signatureHtml) || null,
        signatureText: asStr(req.body?.signatureText) || null,
        isDefault,
      },
    });
    res.status(201).json({ signature: created });
    return;
  }

  if (req.method === "PUT") {
    const id = asStr(req.body?.id);
    if (!id) {
      res.status(400).json({ message: "id is required" });
      return;
    }
    const existing = await prisma.emailSignature.findFirst({ where: { id, userId } });
    if (!existing) {
      res.status(404).json({ message: "Signature not found" });
      return;
    }
    const isDefault = Boolean(req.body?.isDefault);
    if (isDefault) {
      await prisma.emailSignature.updateMany({
        where: { userId, accountEmail: existing.accountEmail, isDefault: true },
        data: { isDefault: false },
      });
    }
    const updated = await prisma.emailSignature.update({
      where: { id },
      data: {
        name: asStr(req.body?.name) || existing.name,
        signatureHtml: req.body?.signatureHtml !== undefined ? asStr(req.body?.signatureHtml) || null : existing.signatureHtml,
        signatureText: req.body?.signatureText !== undefined ? asStr(req.body?.signatureText) || null : existing.signatureText,
        isDefault,
      },
    });
    res.status(200).json({ signature: updated });
    return;
  }

  if (req.method === "DELETE") {
    const id = asStr(req.body?.id);
    if (!id) {
      res.status(400).json({ message: "id is required" });
      return;
    }
    await prisma.emailSignature.deleteMany({ where: { id, userId } });
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ message: "Method Not Allowed" });
}
