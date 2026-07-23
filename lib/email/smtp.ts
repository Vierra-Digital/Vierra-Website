import nodemailer from "nodemailer";
import { decrypt } from "@/lib/crypto";

/** The stored SMTP fields from an email_provider_accounts row. */
type SmtpAccount = {
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_username: string;
  smtp_password_enc: string;
};

/**
 * Build a nodemailer SMTP transport from a stored provider-account row (decrypting the
 * password). Single source for the transport config — used by the live send path
 * (lib/gmail/sendCore), the campaign send queue, and the connection test endpoint.
 */
export function createSmtpTransport(account: SmtpAccount) {
  return nodemailer.createTransport({
    host: account.smtp_host,
    port: account.smtp_port,
    secure: account.smtp_secure,
    auth: { user: account.smtp_username, pass: decrypt(account.smtp_password_enc) },
  });
}
