import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { decrypt, encrypt } from "@/lib/crypto";
import { asStr, asPort } from "@/lib/api/parsing";

function serializeAccount<T extends { smtp_password_enc: string }>(row: T) {
  const { smtp_password_enc, ...rest } = row;
  return { ...rest, hasPassword: Boolean(smtp_password_enc) };
}

export default withAuth(async (req, res, session) => {
  const userId = session.user.id;
  if (req.method === "GET") {
    const rows = await prisma.emailProviderAccount.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
    });
    res.status(200).json({ accounts: rows.map(serializeAccount) });
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
        company_id: session.companyId,
        user_id: userId,
        account_email: accountEmail,
        provider_label: asStr(req.body?.providerLabel) || null,
        smtp_host: smtpHost,
        smtp_port: asPort(req.body?.smtpPort, 465),
        smtp_secure: Boolean(req.body?.smtpSecure ?? true),
        smtp_username: smtpUsername,
        smtp_password_enc: encrypt(smtpPassword),
        imap_host: asStr(req.body?.imapHost) || null,
        imap_port: req.body?.imapPort ? asPort(req.body?.imapPort, 993) : null,
        imap_secure: req.body?.imapSecure === undefined ? null : Boolean(req.body?.imapSecure),
        pop_host: asStr(req.body?.popHost) || null,
        pop_port: req.body?.popPort ? asPort(req.body?.popPort, 995) : null,
        pop_secure: req.body?.popSecure === undefined ? null : Boolean(req.body?.popSecure),
        is_default_sender: Boolean(req.body?.isDefaultSender),
      },
    });
    if (created.is_default_sender) {
      await prisma.emailProviderAccount.updateMany({
        where: { user_id: userId, id: { not: created.id } },
        data: { is_default_sender: false },
      });
    }
    res.status(201).json({ account: serializeAccount(created) });
    return;
  }

  if (req.method === "PUT") {
    const id = asStr(req.body?.id);
    if (!id) {
      res.status(400).json({ message: "id is required." });
      return;
    }
    const existing = await prisma.emailProviderAccount.findFirst({
      where: { id, user_id: userId },
    });
    if (!existing) {
      res.status(404).json({ message: "Provider account not found." });
      return;
    }

    const nextPassword = asStr(req.body?.smtpPassword);
    const updated = await prisma.emailProviderAccount.update({
      where: { id },
      data: {
        provider_label: req.body?.providerLabel !== undefined ? asStr(req.body?.providerLabel) || null : existing.provider_label,
        account_email: req.body?.accountEmail !== undefined ? asStr(req.body?.accountEmail).toLowerCase() || existing.account_email : existing.account_email,
        smtp_host: req.body?.smtpHost !== undefined ? asStr(req.body?.smtpHost) || existing.smtp_host : existing.smtp_host,
        smtp_port: req.body?.smtpPort !== undefined ? asPort(req.body?.smtpPort, existing.smtp_port) : existing.smtp_port,
        smtp_secure: req.body?.smtpSecure !== undefined ? Boolean(req.body?.smtpSecure) : existing.smtp_secure,
        smtp_username: req.body?.smtpUsername !== undefined ? asStr(req.body?.smtpUsername) || existing.smtp_username : existing.smtp_username,
        smtp_password_enc: nextPassword ? encrypt(nextPassword) : existing.smtp_password_enc,
        imap_host: req.body?.imapHost !== undefined ? asStr(req.body?.imapHost) || null : existing.imap_host,
        imap_port: req.body?.imapPort !== undefined ? (req.body?.imapPort ? asPort(req.body?.imapPort, 993) : null) : existing.imap_port,
        imap_secure: req.body?.imapSecure !== undefined ? (req.body?.imapSecure === null ? null : Boolean(req.body?.imapSecure)) : existing.imap_secure,
        pop_host: req.body?.popHost !== undefined ? asStr(req.body?.popHost) || null : existing.pop_host,
        pop_port: req.body?.popPort !== undefined ? (req.body?.popPort ? asPort(req.body?.popPort, 995) : null) : existing.pop_port,
        pop_secure: req.body?.popSecure !== undefined ? (req.body?.popSecure === null ? null : Boolean(req.body?.popSecure)) : existing.pop_secure,
        is_default_sender: req.body?.isDefaultSender !== undefined ? Boolean(req.body?.isDefaultSender) : existing.is_default_sender,
      },
    });
    if (updated.is_default_sender) {
      await prisma.emailProviderAccount.updateMany({
        where: { user_id: userId, id: { not: updated.id } },
        data: { is_default_sender: false },
      });
    }
    res.status(200).json({ account: serializeAccount(updated) });
    return;
  }

  if (req.method === "DELETE") {
    const id = asStr(req.body?.id || req.query.id);
    if (!id) {
      res.status(400).json({ message: "id is required." });
      return;
    }
    const existing = await prisma.emailProviderAccount.findFirst({
      where: { id, user_id: userId },
      select: { id: true, smtp_password_enc: true },
    });
    if (!existing) {
      res.status(404).json({ message: "Provider account not found." });
      return;
    }
    // Validate decryption before delete to surface corrupted secrets early.
    decrypt(existing.smtp_password_enc);
    await prisma.emailProviderAccount.delete({ where: { id } });
    res.status(200).json({ ok: true });
    return;
  }
}, { methods: ["GET", "POST", "PUT", "DELETE"] });
