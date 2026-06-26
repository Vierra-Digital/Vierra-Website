import type { NextApiRequest, NextApiResponse } from "next";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";

function asStr(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ message: "Method Not Allowed" });
    return;
  }

  const session = await requireRole(req, res);
  if (!session) return;

  const userId = (session.user as any).id;
  const id = asStr(req.body?.id);
  if (!id) {
    res.status(400).json({ message: "id is required." });
    return;
  }

  const account = await prisma.emailProviderAccount.findFirst({
    where: { id, user_id: userId },
  });
  if (!account) {
    res.status(404).json({ message: "Provider account not found." });
    return;
  }

  const transporter = nodemailer.createTransport({
    host: account.smtp_host,
    port: account.smtp_port,
    secure: account.smtp_secure,
    auth: {
      user: account.smtp_username,
      pass: decrypt(account.smtp_password_enc),
    },
  });

  try {
    await transporter.verify();
    res.status(200).json({ ok: true });
  } catch (error) {
    res.status(400).json({
      ok: false,
      message: error instanceof Error ? error.message : "SMTP test failed.",
    });
  }
}
