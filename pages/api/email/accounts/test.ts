import type { NextApiRequest, NextApiResponse } from "next";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";

function asStr(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ message: "Method Not Allowed" });
    return;
  }

  const session = await requireSession(req, res);
  if (!session) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  const userId = Number((session.user as any).id);
  const id = asStr(req.body?.id);
  if (!id) {
    res.status(400).json({ message: "id is required." });
    return;
  }

  const account = await prisma.emailProviderAccount.findFirst({
    where: { id, userId },
  });
  if (!account) {
    res.status(404).json({ message: "Provider account not found." });
    return;
  }

  const transporter = nodemailer.createTransport({
    host: account.smtpHost,
    port: account.smtpPort,
    secure: account.smtpSecure,
    auth: {
      user: account.smtpUsername,
      pass: decrypt(account.smtpPasswordEnc),
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

