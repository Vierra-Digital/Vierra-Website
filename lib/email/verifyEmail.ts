import { promises as dns } from "dns";

/**
 * Free email verification — syntax + MX-record check (DNS only, no cost). Catches
 * typos, fake domains, and domains that can't receive mail. This is the "free now"
 * tier; a paid SMTP-level verifier (ZeroBounce/NeverBounce) can be added later behind
 * an env key without changing callers. Reused by compose and (later) campaign sending.
 */

const SYNTAX = /^[^\s@]+@([a-z0-9.-]+\.[a-z]{2,})$/i;

export type VerifyReason = "ok" | "syntax" | "no_mx" | "error";
export type VerifyResult = { email: string; valid: boolean; reason: VerifyReason };

export async function verifyEmailAddress(rawEmail: string): Promise<VerifyResult> {
  const email = rawEmail.trim().toLowerCase();
  const match = email.match(SYNTAX);
  if (!match) return { email, valid: false, reason: "syntax" };
  const domain = match[1];
  try {
    const mx = await dns.resolveMx(domain);
    if (Array.isArray(mx) && mx.length > 0) return { email, valid: true, reason: "ok" };
    return { email, valid: false, reason: "no_mx" };
  } catch (error) {
    // NXDOMAIN / NODATA → the domain can't receive mail.
    const code = (error as { code?: string })?.code || "";
    if (code === "ENOTFOUND" || code === "ENODATA" || code === "NXDOMAIN") {
      return { email, valid: false, reason: "no_mx" };
    }
    return { email, valid: false, reason: "error" };
  }
}
