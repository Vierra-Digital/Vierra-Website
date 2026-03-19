import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { asStr, issueOauthStateCookie } from "@/lib/api/oauth";
import { serialize as serializeCookie } from "cookie";

const BASIC_SCOPES = ["openid", "profile", "email", "w_member_social"];
const COMPANY_SCOPES = ["r_organization_admin", "w_organization_social"];

function resolveRuntimeBaseUrl(req: NextApiRequest) {
  const host = req.headers.host || "localhost:3000";
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : forwardedProto || (host.includes("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`.replace(/\/+$/, "");
}

function appendSetCookie(res: NextApiResponse, value: string) {
  const existing = res.getHeader("Set-Cookie");
  const next = Array.isArray(existing) ? [...existing, value] : existing ? [String(existing), value] : [value];
  res.setHeader("Set-Cookie", next);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") { res.status(405).end(); return; }

  const onboardingSessionId = asStr(req.query.session);
  const from = asStr(req.query.from);
  const isSettingsSource = from === "settings" && !onboardingSessionId;
  const mode = asStr(req.query.mode);
  const isCompanyMode = mode === "company";
  const clientId = (isCompanyMode ? process.env.LINKEDIN_COMPANY_CLIENT_ID : process.env.LINKEDIN_CLIENT_ID) || process.env.LINKEDIN_CLIENT_ID!;
  const envRedirectUri =
    (isCompanyMode ? process.env.LINKEDIN_COMPANY_REDIRECT_URI : process.env.LINKEDIN_REDIRECT_URI) ||
    process.env.LINKEDIN_REDIRECT_URI!;
  const redirectUri = isSettingsSource ? `${resolveRuntimeBaseUrl(req)}/api/linkedin/callback` : envRedirectUri;
  const scopes = mode === "company" ? [...BASIC_SCOPES, ...COMPANY_SCOPES] : BASIC_SCOPES;
  if (onboardingSessionId) {
    const sess = await prisma.onboardingSession.findUnique({ where: { id: onboardingSessionId } });
    if (!sess) { res.status(400).send("Invalid onboarding session"); return; }
    const state = isCompanyMode ? `company:${onboardingSessionId}` : onboardingSessionId;

    const authUrl = "https://www.linkedin.com/oauth/v2/authorization?" + new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: scopes.join(" "),
      state,
    }).toString();

    res.redirect(authUrl);
    return;
  }
  const session = await requireSession(req, res);
  if (!session) { res.status(401).json({ message: "Not authenticated" }); return; }

  const baseState = issueOauthStateCookie(res, "li_oauth_state", "/api/linkedin/callback");
  appendSetCookie(
    res,
    serializeCookie("li_oauth_redirect", redirectUri, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/api/linkedin/callback",
      maxAge: 10 * 60,
    })
  );
  const state = `${isCompanyMode ? "company:" : ""}${isSettingsSource ? "settings:" : ""}${baseState}`;

  const authUrl = "https://www.linkedin.com/oauth/v2/authorization?" + new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes.join(" "),
    state,
  }).toString();

  res.redirect(authUrl);
}
