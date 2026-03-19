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
    const templates = await prisma.emailTemplate.findMany({
      where: {
        userId,
        OR: accountEmail ? [{ accountEmail }, { accountEmail: null }] : undefined,
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
    res.status(200).json({ templates });
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
      await prisma.emailTemplate.updateMany({
        where: { userId, accountEmail, isDefault: true },
        data: { isDefault: false },
      });
    }
    const created = await prisma.emailTemplate.create({
      data: {
        userId,
        accountEmail,
        name,
        subject: asStr(req.body?.subject) || null,
        bodyHtml: asStr(req.body?.bodyHtml) || null,
        bodyText: asStr(req.body?.bodyText) || null,
        isDefault,
      },
    });
    res.status(201).json({ template: created });
    return;
  }

  if (req.method === "PUT") {
    const id = asStr(req.body?.id);
    if (!id) {
      res.status(400).json({ message: "id is required" });
      return;
    }
    const existing = await prisma.emailTemplate.findFirst({ where: { id, userId } });
    if (!existing) {
      res.status(404).json({ message: "Template not found" });
      return;
    }
    const isDefault = Boolean(req.body?.isDefault);
    if (isDefault) {
      await prisma.emailTemplate.updateMany({
        where: { userId, accountEmail: existing.accountEmail, isDefault: true },
        data: { isDefault: false },
      });
    }
    const updated = await prisma.emailTemplate.update({
      where: { id },
      data: {
        name: asStr(req.body?.name) || existing.name,
        subject: req.body?.subject !== undefined ? asStr(req.body?.subject) || null : existing.subject,
        bodyHtml: req.body?.bodyHtml !== undefined ? asStr(req.body?.bodyHtml) || null : existing.bodyHtml,
        bodyText: req.body?.bodyText !== undefined ? asStr(req.body?.bodyText) || null : existing.bodyText,
        isDefault,
      },
    });
    res.status(200).json({ template: updated });
    return;
  }

  if (req.method === "DELETE") {
    const id = asStr(req.body?.id);
    if (!id) {
      res.status(400).json({ message: "id is required" });
      return;
    }
    await prisma.emailTemplate.deleteMany({ where: { id, userId } });
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ message: "Method Not Allowed" });
}
