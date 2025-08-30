import type { NextApiRequest, NextApiResponse } from "next";
import { randomBytes } from "crypto";
import { serialize as serializeCookie } from "cookie";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

const asStr = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const SCOPES = ["openid", "profile", "email"];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") { res.status(405).end(); return; }

  const clientId = process.env.LINKEDIN_CLIENT_ID!;
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI!;

  // onboarding (no login)
  const onboardingSessionId = asStr(req.query.session);
  if (onboardingSessionId) {
    const sess = await prisma.onboardingSession.findUnique({ where: { id: onboardingSessionId } });
    if (!sess) { res.status(400).send("Invalid onboarding session"); return; }

    const authUrl = "https://www.linkedin.com/oauth/v2/authorization?" + new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: SCOPES.join(" "),
      state: onboardingSessionId, // callback treats this as sessionId
    }).toString();

    res.redirect(authUrl);
    return;
  }

  // logged in connect
  const session = await requireSession(req, res);
  if (!session) { res.status(401).json({ message: "Not authenticated" }); return; }

  const state = randomBytes(16).toString("hex");
  res.setHeader(
    "Set-Cookie",
    serializeCookie("li_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/api/linkedin/callback",
      maxAge: 10 * 60, // 10 minutes
    })
  );

  const authUrl = "https://www.linkedin.com/oauth/v2/authorization?" + new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: SCOPES.join(" "),
    state,
  }).toString();

  res.redirect(authUrl);
}
