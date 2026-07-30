import type { NextApiRequest, NextApiResponse } from "next";
import { resolveConfidential, sanitizeConfidentialHtml, logConfidentialView, hashIp } from "@/lib/email/confidential";
import { asStr } from "@/lib/api/parsing";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

/** Public passcode-unlock for a confidential message viewer. No session — token + passcode gated. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ message: "Method not allowed." });
    return;
  }
  const token = asStr(req.query.token).trim();
  const passcode = asStr(req.body?.passcode).trim();
  if (!token) {
    res.status(400).json({ message: "Missing token." });
    return;
  }

  // Throttle passcode attempts to defeat online brute-force of short numeric PINs (per token+IP,
  // plus a global-per-token cap so a distributed attempt is still bounded). The store is a soft
  // in-memory limiter, but it raises the bar substantially with no added infra.
  const ip = getClientIp(req);
  if (
    !checkRateLimit(`c-unlock:${token}:${ip}`, 10, 10 * 60 * 1000) ||
    !checkRateLimit(`c-unlock:${token}`, 60, 10 * 60 * 1000)
  ) {
    res.status(429).json({ status: "rate_limited", message: "Too many attempts. Please try again later." });
    return;
  }

  const ipRaw = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
  const state = await resolveConfidential(token, new Date(), passcode);

  if (state.status === "not_found") {
    res.status(404).json({ status: "not_found" });
    return;
  }
  if (state.status === "revoked" || state.status === "expired") {
    res.status(410).json({ status: state.status });
    return;
  }
  if (state.status === "locked") {
    await logConfidentialView(state.id, ipRaw ? hashIp(ipRaw) : null, false);
    res.status(401).json({ status: "locked", message: "Incorrect passcode." });
    return;
  }

  await logConfidentialView(state.id, ipRaw ? hashIp(ipRaw) : null, true);
  res.status(200).json({
    status: "ok",
    subject: state.subject,
    bodyHtml: sanitizeConfidentialHtml(state.bodyHtml),
    restrict: state.restrict,
    expiresAt: state.expiresAt,
  });
}
