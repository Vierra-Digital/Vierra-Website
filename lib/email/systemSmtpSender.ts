import nodemailer from "nodemailer";

export interface SystemSmtpEmailInput {
  to: string;
  subject: string;
  html: string;
}

/**
 * Password-reset email only (see lib/emailSender.ts's sendPasswordResetEmail) — sent via SMTP
 * against the same Google Workspace mailbox lib/email/systemSender.ts uses for every other
 * transactional email, just over smtp.gmail.com with an app password instead of the Gmail API.
 * Still DMARC/SPF/DKIM-aligned (Google sends it, as that mailbox, through Google's own servers) —
 * unlike relaying through an unrelated SMTP provider (e.g. Brevo) with an @vierradev.com From
 * header, which is what systemSender.ts's own comment documents as the failure this whole system
 * moved off of. Not a general-purpose SMTP path: every other send in lib/emailSender.ts stays on
 * sendSystemEmail (Gmail API).
 */
let transport: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransport() {
  if (transport) return transport;
  const user = (process.env.SYSTEM_EMAIL_ACCOUNT || process.env.FROM_EMAIL || "").trim().toLowerCase();
  const pass = process.env.SYSTEM_EMAIL_SMTP_APP_PASSWORD;
  if (!user || !pass) {
    throw new Error(
      "SYSTEM_EMAIL_ACCOUNT and SYSTEM_EMAIL_SMTP_APP_PASSWORD must both be set to send password-reset email via SMTP."
    );
  }
  transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });
  return transport;
}

export async function sendSystemEmailViaSmtp(input: SystemSmtpEmailInput): Promise<void> {
  const user = (process.env.SYSTEM_EMAIL_ACCOUNT || process.env.FROM_EMAIL || "").trim().toLowerCase();
  const fromName = process.env.FROM_NAME || "Vierra";
  await getTransport().sendMail({
    from: `"${fromName}" <${user}>`,
    to: input.to,
    subject: input.subject,
    html: input.html,
  });
}
