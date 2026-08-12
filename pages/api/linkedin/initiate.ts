import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { asStr, issueOauthStateCookie, resolveRuntimeBaseUrl, setScopedOauthCookie } from "@/lib/api/oauth";

const BASIC_SCOPES = ["openid", "profile", "email", "w_member_social"];
const COMPANY_SCOPES = ["r_organization_admin", "w_organization_social"];

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
  const buildAuthUrl = (state: string) =>
    "https://www.linkedin.com/oauth/v2/authorization?" + new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: scopes.join(" "),
      state,
    }).toString();

  if (onboardingSessionId) {
    const sess = await prisma.onboardingSession.findUnique({ where: { id: onboardingSessionId } });
    if (!sess) { res.status(400).send("Invalid onboarding session"); return; }
    const state = isCompanyMode ? `company:${onboardingSessionId}` : onboardingSessionId;
    res.redirect(buildAuthUrl(state));
    return;
  }
  const session = await requireRole(req, res);
  if (!session) return;

  const baseState = issueOauthStateCookie(res, "li_oauth_state", "/api/linkedin/callback");
  setScopedOauthCookie(res, "li_oauth_redirect", redirectUri, "/api/linkedin/callback");
  const state = `${isCompanyMode ? "company:" : ""}${isSettingsSource ? "settings:" : ""}${baseState}`;
  res.redirect(buildAuthUrl(state));
}
