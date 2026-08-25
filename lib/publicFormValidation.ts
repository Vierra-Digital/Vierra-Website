import { asStr } from "@/lib/api/parsing";
import { EMAIL_REGEX } from "@/lib/utils";

export const PUBLIC_FORM_LIMITS = {
  fullName: 100,
  email: 254,
  phoneNumber: 32,
  website: 2048,
  desiredRevenue: 32,
} as const;

export const AUDIT_REVENUE_OPTIONS = [
  "$10k - $25k",
  "$25k - $50k",
  "$50k - $100k",
  "$100k - $250k",
  "$250k - $500k",
  "$500k+",
] as const;

const PHONE_CHARACTERS = /^[\d\s().+\-]+$/;
const REVENUE_PATTERN = /^\$?\d[\d,]*(?:\+)?$/;

export type AuditRevenue = (typeof AUDIT_REVENUE_OPTIONS)[number];

export interface AuditSubmission {
  fullName: string;
  email: string;
  phoneNumber: string;
  website: string;
  monthlyRevenue: AuditRevenue;
  desiredRevenue: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeSingleLine(value: unknown, maxLength: number): string | null {
  const text = asStr(value).replace(/\s+/g, " ");
  if (!text || text.length > maxLength) return null;
  return text;
}

function normalizeEnum<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  const normalized = asStr(value);
  return allowed.includes(normalized as T) ? (normalized as T) : null;
}

/** Trim and lowercase an email address, enforcing a practical RFC-sized limit. */
export function normalizeEmailAddress(value: unknown): string | null {
  const email = asStr(value).toLowerCase();
  if (!email || email.length > PUBLIC_FORM_LIMITS.email || !EMAIL_REGEX.test(email)) return null;
  return email;
}

/** Format a ten-digit US phone number while accepting common punctuation. */
export function normalizePhoneNumber(value: unknown): string | null {
  const phone = asStr(value);
  if (!phone || phone.length > PUBLIC_FORM_LIMITS.phoneNumber || !PHONE_CHARACTERS.test(phone)) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length !== 10) return null;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** Normalize a website to an HTTP(S) URL, rejecting arbitrary URI schemes. */
export function normalizeHttpUrl(value: unknown): string | null {
  const raw = asStr(value);
  if (!raw || raw.length > PUBLIC_FORM_LIMITS.website || /[\u0000-\u001f\u007f\s]/.test(raw)) return null;

  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    if (!( ["http:", "https:"] as string[]).includes(url.protocol) || !url.hostname) return null;
    if (url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

/** Normalize the desired-revenue text to the format shown by the audit form. */
export function normalizeRevenueAmount(value: unknown): string | null {
  const raw = asStr(value);
  if (!raw || raw.length > PUBLIC_FORM_LIMITS.desiredRevenue || !REVENUE_PATTERN.test(raw)) return null;

  const hasPlus = raw.endsWith("+");
  const digits = raw.replace(/[$,+]/g, "");
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `$${grouped}${hasPlus ? "+" : ""}`;
}

/** Normalize and validate the complete public free-audit payload. */
export function normalizeAuditSubmission(value: unknown): AuditSubmission | null {
  if (!isRecord(value)) return null;

  const fullName = normalizeSingleLine(value.fullName, PUBLIC_FORM_LIMITS.fullName);
  const email = normalizeEmailAddress(value.email);
  const phoneNumber = normalizePhoneNumber(value.phoneNumber);
  const website = normalizeHttpUrl(value.website);
  const monthlyRevenue = normalizeEnum(value.monthlyRevenue, AUDIT_REVENUE_OPTIONS);
  const desiredRevenue = normalizeRevenueAmount(value.desiredRevenue);

  if (!fullName || !email || !phoneNumber || !website || !monthlyRevenue || !desiredRevenue) return null;
  return { fullName, email, phoneNumber, website, monthlyRevenue, desiredRevenue };
}
