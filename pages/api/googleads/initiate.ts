import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma"; 
import { requireSession } from "@/lib/auth";
import { asStr, issueOauthStateCookie } from "@/lib/api/oauth";

const SCOPES = ["https://www.googleapis.com/auth/adwords"];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") { res.status(405).end(); return; }

  const clientId   = process.env.GOOGLEADS_CLIENT_ID!;
  const redirectUri = process.env.GOOGLEADS_REDIRECT_URI!;
  const onboardingSessionId = asStr(req.query.session);
  if (onboardingSessionId) {
    const sess = await prisma.onboardingSession.findUnique({ where: { id: onboardingSessionId } });
    if (!sess) { res.status(400).send("Invalid onboarding session"); return; }

    const authUrl = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: redirectUri,
      scope: SCOPES.join(" "),
      access_type: "offline",
      include_granted_scopes: "true",
      prompt: "consent",
      state: onboardingSessionId,
    }).toString();

    res.redirect(authUrl);
    return;
  }
  const session = await requireSession(req, res);
  if (!session) { res.status(401).json({ message: "Not authenticated" }); return; }

  const state = issueOauthStateCookie(res, "ga_oauth_state", "/api/googleads/callback");

  const authUrl = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: SCOPES.join(" "),
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state,
  }).toString();

  res.redirect(authUrl);
}
