import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetLink } from "@/lib/auth/passwordReset";
import { resolveBaseUrl } from "@/lib/api/url";
import { isValidEmail } from "@/lib/utils";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 15 * 60 * 1000;

/**
 * Self-service "Forgot password?" from the login page. Replaces the old client-side
 * supabase.auth.resetPasswordForEmail() call — that handed the whole email (template + delivery)
 * to Supabase's own SMTP config, which was misconfigured in the dashboard and failing DMARC (see
 * the chat this shipped from). This route mints the link and sends the email through
 * lib/auth/passwordReset.ts's sendPasswordResetLink — the same helper the admin-triggered reset in
 * pages/api/admin/userPassword.ts calls, so both flows share one implementation rather than two
 * copies that could drift.
 *
 * Always responds with the same generic success message regardless of whether the email matches
 * an account — Supabase's own resetPasswordForEmail behaved the same way, and this route must not
 * become a way to enumerate which emails have accounts.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method Not Allowed" });

  const ip = getClientIp(req);
  if (!checkRateLimit(`forgot-password:${ip}`, RATE_LIMIT, RATE_WINDOW_MS)) {
    return res.status(429).json({ message: "Too many attempts. Wait a minute, then try again." });
  }

  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const generic = { message: "If that account exists, a reset link has been sent." };
  if (!email || !isValidEmail(email)) {
    // Still generic: a malformed email can't belong to anyone, but the response must not
    // distinguish "bad format" from "valid but unknown" for an enumeration-safe API.
    return res.status(200).json(generic);
  }

  try {
    const user = await prisma.user.findFirst({ where: { email }, select: { id: true, email: true, name: true } });
    if (user?.email) {
      const baseUrl = resolveBaseUrl(req);
      await sendPasswordResetLink(user, baseUrl, true);
    }
    return res.status(200).json(generic);
  } catch (err) {
    console.error("auth/forgotPassword error", err);
    // Fails generically too — surfacing which step broke would leak account existence just as
    // much as a differently-worded error would.
    return res.status(200).json(generic);
  }
}
