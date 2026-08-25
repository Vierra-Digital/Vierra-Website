import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: unknown[]) => twMerge(clsx(inputs));

/**
 * Canonical lightweight email-shape check (non-empty local part, one @, a dotted domain).
 * This is a format sanity check for forms/inputs — NOT deliverability. For MX/DNS-backed
 * verification use lib/email/verifyEmail.ts instead.
 */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Convenience wrapper: trims then format-checks. */
export const isValidEmail = (value: string): boolean => EMAIL_REGEX.test(value.trim());

/** Escape untrusted text before inserting it into an HTML document. */
export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
