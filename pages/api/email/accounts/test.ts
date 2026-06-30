import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { decrypt } from "@/lib/crypto";
import { asStr } from "@/lib/api/parsing";

export default withAuth(async (req, res, session) => {
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
}, { methods: ["POST"] });
