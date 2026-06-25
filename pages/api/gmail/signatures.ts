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

function serializeSignature(s: {
  id: string; user_id: string; account_id: string | null; name: string;
  signature_html: string | null; signature_text: string | null;
  is_default: boolean; created_at: Date; updated_at: Date;
}) {
  return {
    id: s.id,
    userId: s.user_id,
    accountId: s.account_id,
    name: s.name,
    signatureHtml: s.signature_html,
    signatureText: s.signature_text,
    isDefault: s.is_default,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireRole(req, res);
  if (!session) return;
  const userId = session.user.id;

  if (req.method === "GET") {
    const accountEmail = queryAccountEmail(req);
    const accountId = accountEmail ? await resolveAccountId(userId, accountEmail) : null;
    const signatures = await prisma.emailSignature.findMany({
      where: {
        user_id: userId,
        ...(accountId !== undefined && accountEmail
          ? { OR: [{ account_id: accountId }, { account_id: null }] }
          : {}),
      },
      orderBy: [{ is_default: "desc" }, { created_at: "desc" }],
    });
    res.status(200).json({ signatures: signatures.map(serializeSignature) });
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
      await prisma.emailSignature.updateMany({
        where: { user_id: userId, account_id: accountId, is_default: true },
        data: { is_default: false },
      });
    }
    const created = await prisma.emailSignature.create({
      data: {
        user_id: userId,
        account_id: accountId,
        name,
        signature_html: asStr(req.body?.signatureHtml) || null,
        signature_text: asStr(req.body?.signatureText) || null,
        is_default: isDefault,
      },
    });
    res.status(201).json({ signature: serializeSignature(created) });
    return;
  }

  if (req.method === "PUT") {
    const id = asStr(req.body?.id);
    if (!id) {
      res.status(400).json({ message: "id is required" });
      return;
    }
    const existing = await prisma.emailSignature.findFirst({ where: { id, user_id: userId } });
    if (!existing) {
      res.status(404).json({ message: "Signature not found" });
      return;
    }
    const isDefault = Boolean(req.body?.isDefault);
    if (isDefault) {
      await prisma.emailSignature.updateMany({
        where: { user_id: userId, account_id: existing.account_id, is_default: true },
        data: { is_default: false },
      });
    }
    const updated = await prisma.emailSignature.update({
      where: { id },
      data: {
        name: asStr(req.body?.name) || existing.name,
        signature_html: req.body?.signatureHtml !== undefined ? asStr(req.body?.signatureHtml) || null : existing.signature_html,
        signature_text: req.body?.signatureText !== undefined ? asStr(req.body?.signatureText) || null : existing.signature_text,
        is_default: isDefault,
      },
    });
    res.status(200).json({ signature: serializeSignature(updated) });
    return;
  }

  if (req.method === "DELETE") {
    const id = asStr(req.body?.id);
    if (!id) {
      res.status(400).json({ message: "id is required" });
      return;
    }
    await prisma.emailSignature.deleteMany({ where: { id, user_id: userId } });
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ message: "Method Not Allowed" });
}
