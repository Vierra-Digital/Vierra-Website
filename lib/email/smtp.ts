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
 * Reject SMTP hosts that point at loopback / private / link-local space, so an authenticated
 * user can't turn "add a mailbox + test connection" into a blind SSRF / internal port scanner
 * against the server's own network (e.g. host=169.254.169.254 cloud metadata). This blocks
 * literal private IPs and obvious internal hostnames; a DNS-rebinding-resistant check (resolving
 * the host and re-validating each address) would be the stronger follow-up.
 */
export function isBlockedSmtpHost(host: string): boolean {
  const h = host.trim().toLowerCase().replace(/\.$/, "");
  if (!h) return true;
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (h === "::1" || h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return true; // IPv6 loopback/link-local/ULA
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local incl. cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  }
  return false;
}

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
