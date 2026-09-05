import nodemailer from "npm:nodemailer@9.0.3";
import { decrypt } from "./crypto.ts";

/**
 * Deno port of lib/email/smtp.ts. nodemailer's raw-socket SMTP transport (Node's net/tls under
 * the hood) was confirmed working under Supabase's edge runtime via a throwaway spike function
 * (deployed, curl-tested against a real Ethereal test account, got back {"ok":true,...} with a
 * live preview URL, then deleted per its own comment) on 2026-09-04.
 */

type SmtpAccount = {
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_username: string;
  smtp_password_enc: string;
};

export function requireSmtpCredentials(account: {
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_secure: boolean;
  smtp_username: string | null;
  smtp_password_enc: string | null;
}): SmtpAccount {
  if (!account.smtp_host || !account.smtp_port || !account.smtp_username || !account.smtp_password_enc) {
    throw new Error("This mailbox has no SMTP credentials configured.");
  }
  return {
    smtp_host: account.smtp_host,
    smtp_port: account.smtp_port,
    smtp_secure: account.smtp_secure,
    smtp_username: account.smtp_username,
    smtp_password_enc: account.smtp_password_enc,
  };
}

/** Verbatim port of lib/email/smtp.ts's SSRF guard — pure string/regex logic, no Node deps. */
export function isBlockedSmtpHost(host: string): boolean {
  const h = host.trim().toLowerCase().replace(/\.$/, "");
  if (!h) return true;
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (h === "::1" || h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return true;
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }
  return false;
}

export async function createSmtpTransport(account: SmtpAccount) {
  return nodemailer.createTransport({
    host: account.smtp_host,
    port: account.smtp_port,
    secure: account.smtp_secure,
    auth: { user: account.smtp_username, pass: await decrypt(account.smtp_password_enc) },
  });
}
