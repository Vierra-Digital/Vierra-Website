import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { resolveAccountId } from "@/lib/api/emailAccounts";

function asStr(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function queryAccountEmail(req: NextApiRequest) {
  const raw = Array.isArray(req.query.accountEmail) ? req.query.accountEmail[0] : req.query.accountEmail;
  const value = asStr(raw).toLowerCase();
  return value || null;
}

function serializeTemplate(t: {
  id: string; user_id: string; account_id: string | null; name: string;
  subject: string | null; body_html: string | null; body_text: string | null;
  is_default: boolean; created_at: Date; updated_at: Date;
}) {
  return {
    id: t.id,
    userId: t.user_id,
    accountId: t.account_id,
    name: t.name,
    subject: t.subject,
    bodyHtml: t.body_html,
    bodyText: t.body_text,
    isDefault: t.is_default,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireRole(req, res);
  if (!session) return;
  const userId = session.user.id;

  if (req.method === "GET") {
    const accountEmail = queryAccountEmail(req);
    const accountId = accountEmail ? await resolveAccountId(userId, accountEmail) : null;
    const templates = await prisma.emailTemplate.findMany({
      where: {
        user_id: userId,
        ...(accountId !== undefined && accountEmail
          ? { OR: [{ account_id: accountId }, { account_id: null }] }
          : {}),
      },
      orderBy: [{ is_default: "desc" }, { created_at: "desc" }],
    });
    res.status(200).json({ templates: templates.map(serializeTemplate) });
    return;
  }

  if (req.method === "POST") {
    const accountEmail = asStr(req.body?.accountEmail).toLowerCase() || null;
    const name = asStr(req.body?.name);
    if (!name) {
      res.status(400).json({ message: "name is required" });
      return;
    }
    const accountId = accountEmail ? await resolveAccountId(userId, accountEmail) : null;
    const isDefault = Boolean(req.body?.isDefault);
    if (isDefault) {
      await prisma.emailTemplate.updateMany({
        where: { user_id: userId, account_id: accountId, is_default: true },
        data: { is_default: false },
      });
    }
    const created = await prisma.emailTemplate.create({
      data: {
        user_id: userId,
        account_id: accountId,
        name,
        subject: asStr(req.body?.subject) || null,
        body_html: asStr(req.body?.bodyHtml) || null,
        body_text: asStr(req.body?.bodyText) || null,
        is_default: isDefault,
      },
    });
    res.status(201).json({ template: serializeTemplate(created) });
    return;
  }

  if (req.method === "PUT") {
    const id = asStr(req.body?.id);
    if (!id) {
      res.status(400).json({ message: "id is required" });
      return;
    }
    const existing = await prisma.emailTemplate.findFirst({ where: { id, user_id: userId } });
    if (!existing) {
      res.status(404).json({ message: "Template not found" });
      return;
    }
    const isDefault = Boolean(req.body?.isDefault);
    if (isDefault) {
      await prisma.emailTemplate.updateMany({
        where: { user_id: userId, account_id: existing.account_id, is_default: true },
        data: { is_default: false },
      });
    }
    const updated = await prisma.emailTemplate.update({
      where: { id },
      data: {
        name: asStr(req.body?.name) || existing.name,
        subject: req.body?.subject !== undefined ? asStr(req.body?.subject) || null : existing.subject,
        body_html: req.body?.bodyHtml !== undefined ? asStr(req.body?.bodyHtml) || null : existing.body_html,
        body_text: req.body?.bodyText !== undefined ? asStr(req.body?.bodyText) || null : existing.body_text,
        is_default: isDefault,
      },
    });
    res.status(200).json({ template: serializeTemplate(updated) });
    return;
  }

  if (req.method === "DELETE") {
    const id = asStr(req.body?.id);
    if (!id) {
      res.status(400).json({ message: "id is required" });
      return;
    }
    await prisma.emailTemplate.deleteMany({ where: { id, user_id: userId } });
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ message: "Method Not Allowed" });
}
