import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { createSmtpTransport } from "@/lib/email/smtp";
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

  const transporter = createSmtpTransport(account);

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
