import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { decrypt, encrypt } from "@/lib/crypto";

function asStr(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asPort(value: unknown, fallback: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return Math.floor(numeric);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireSession(req, res);
  if (!session) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  const userId = Number((session.user as any).id);
  if (req.method === "GET") {
    const rows = await prisma.emailProviderAccount.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json({
      accounts: rows.map((row) => ({
        ...row,
        smtpPasswordEnc: undefined,
        hasPassword: Boolean(row.smtpPasswordEnc),
      })),
    });
    return;
  }

  if (req.method === "POST") {
    const accountEmail = asStr(req.body?.accountEmail).toLowerCase();
    const smtpHost = asStr(req.body?.smtpHost);
    const smtpUsername = asStr(req.body?.smtpUsername);
    const smtpPassword = asStr(req.body?.smtpPassword);
    if (!accountEmail || !smtpHost || !smtpUsername || !smtpPassword) {
      res.status(400).json({ message: "accountEmail, smtpHost, smtpUsername, and smtpPassword are required." });
      return;
    }

    const created = await prisma.emailProviderAccount.create({
      data: {
        userId,
        accountEmail,
        providerLabel: asStr(req.body?.providerLabel) || null,
        smtpHost,
        smtpPort: asPort(req.body?.smtpPort, 465),
        smtpSecure: Boolean(req.body?.smtpSecure ?? true),
        smtpUsername,
        smtpPasswordEnc: encrypt(smtpPassword),
        imapHost: asStr(req.body?.imapHost) || null,
        imapPort: req.body?.imapPort ? asPort(req.body?.imapPort, 993) : null,
        imapSecure: req.body?.imapSecure === undefined ? null : Boolean(req.body?.imapSecure),
        popHost: asStr(req.body?.popHost) || null,
        popPort: req.body?.popPort ? asPort(req.body?.popPort, 995) : null,
        popSecure: req.body?.popSecure === undefined ? null : Boolean(req.body?.popSecure),
        isDefaultSender: Boolean(req.body?.isDefaultSender),
      },
    });
    if (created.isDefaultSender) {
      await prisma.emailProviderAccount.updateMany({
        where: { userId, id: { not: created.id } },
        data: { isDefaultSender: false },
      });
    }
    res.status(201).json({ account: { ...created, smtpPasswordEnc: undefined, hasPassword: true } });
    return;
  }

  if (req.method === "PUT") {
    const id = asStr(req.body?.id);
    if (!id) {
      res.status(400).json({ message: "id is required." });
      return;
    }
    const existing = await prisma.emailProviderAccount.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      res.status(404).json({ message: "Provider account not found." });
      return;
    }

    const nextPassword = asStr(req.body?.smtpPassword);
    const updated = await prisma.emailProviderAccount.update({
      where: { id },
      data: {
        providerLabel: req.body?.providerLabel !== undefined ? asStr(req.body?.providerLabel) || null : existing.providerLabel,
        accountEmail: req.body?.accountEmail !== undefined ? asStr(req.body?.accountEmail).toLowerCase() || existing.accountEmail : existing.accountEmail,
        smtpHost: req.body?.smtpHost !== undefined ? asStr(req.body?.smtpHost) || existing.smtpHost : existing.smtpHost,
        smtpPort: req.body?.smtpPort !== undefined ? asPort(req.body?.smtpPort, existing.smtpPort) : existing.smtpPort,
        smtpSecure: req.body?.smtpSecure !== undefined ? Boolean(req.body?.smtpSecure) : existing.smtpSecure,
        smtpUsername: req.body?.smtpUsername !== undefined ? asStr(req.body?.smtpUsername) || existing.smtpUsername : existing.smtpUsername,
        smtpPasswordEnc: nextPassword ? encrypt(nextPassword) : existing.smtpPasswordEnc,
        imapHost: req.body?.imapHost !== undefined ? asStr(req.body?.imapHost) || null : existing.imapHost,
        imapPort: req.body?.imapPort !== undefined ? (req.body?.imapPort ? asPort(req.body?.imapPort, 993) : null) : existing.imapPort,
        imapSecure: req.body?.imapSecure !== undefined ? (req.body?.imapSecure === null ? null : Boolean(req.body?.imapSecure)) : existing.imapSecure,
        popHost: req.body?.popHost !== undefined ? asStr(req.body?.popHost) || null : existing.popHost,
        popPort: req.body?.popPort !== undefined ? (req.body?.popPort ? asPort(req.body?.popPort, 995) : null) : existing.popPort,
        popSecure: req.body?.popSecure !== undefined ? (req.body?.popSecure === null ? null : Boolean(req.body?.popSecure)) : existing.popSecure,
        isDefaultSender: req.body?.isDefaultSender !== undefined ? Boolean(req.body?.isDefaultSender) : existing.isDefaultSender,
      },
    });
    if (updated.isDefaultSender) {
      await prisma.emailProviderAccount.updateMany({
        where: { userId, id: { not: updated.id } },
        data: { isDefaultSender: false },
      });
    }
    res.status(200).json({ account: { ...updated, smtpPasswordEnc: undefined, hasPassword: true } });
    return;
  }

  if (req.method === "DELETE") {
    const id = asStr(req.body?.id || req.query.id);
    if (!id) {
      res.status(400).json({ message: "id is required." });
      return;
    }
    const existing = await prisma.emailProviderAccount.findFirst({
      where: { id, userId },
      select: { id: true, smtpPasswordEnc: true },
    });
    if (!existing) {
      res.status(404).json({ message: "Provider account not found." });
      return;
    }
    // Validate decryption before delete to surface corrupted secrets early.
    decrypt(existing.smtpPasswordEnc);
    await prisma.emailProviderAccount.delete({ where: { id } });
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ message: "Method Not Allowed" });
}

