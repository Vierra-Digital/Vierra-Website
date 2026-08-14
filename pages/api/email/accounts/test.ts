import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { createSmtpTransport, isBlockedSmtpHost, requireSmtpCredentials } from "@/lib/email/smtp";
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
  if (!account.smtp_host) {
    res.status(400).json({ ok: false, message: "This mailbox has no SMTP credentials configured." });
    return;
  }
  if (isBlockedSmtpHost(account.smtp_host)) {
    res.status(400).json({ ok: false, message: "That SMTP host isn't allowed." });
    return;
  }

  const transporter = createSmtpTransport(requireSmtpCredentials(account));

  try {
    await transporter.verify();
    res.status(200).json({ ok: true });
  } catch {
    // Deliberately generic: returning the raw connect error would let a caller distinguish
    // open/closed/non-SMTP ports on the internal network (SSRF oracle).
    res.status(400).json({ ok: false, message: "Couldn't connect with those SMTP settings." });
  }
}, { methods: ["POST"] });
