import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { asStr, issueOauthStateCookie } from "@/lib/api/oauth";

const SCOPES = ["openid", "profile", "email", "w_member_social"];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") { res.status(405).end(); return; }

  const clientId = process.env.LINKEDIN_CLIENT_ID!;
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI!;
  const onboardingSessionId = asStr(req.query.session);
  if (onboardingSessionId) {
    const sess = await prisma.onboardingSession.findUnique({ where: { id: onboardingSessionId } });
    if (!sess) { res.status(400).send("Invalid onboarding session"); return; }

    const authUrl = "https://www.linkedin.com/oauth/v2/authorization?" + new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: SCOPES.join(" "),
      state: onboardingSessionId,
    }).toString();

    res.redirect(authUrl);
    return;
  }
  const session = await requireSession(req, res);
  if (!session) { res.status(401).json({ message: "Not authenticated" }); return; }

  const state = issueOauthStateCookie(res, "li_oauth_state", "/api/linkedin/callback");

  const authUrl = "https://www.linkedin.com/oauth/v2/authorization?" + new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: SCOPES.join(" "),
    state,
  }).toString();

  res.redirect(authUrl);
}
