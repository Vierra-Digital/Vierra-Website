import type { NextApiRequest, NextApiResponse } from "next";
import { randomBytes } from "crypto";
import cookie from "cookie";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

const asStr = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const clientId = process.env.FACEBOOK_CLIENT_ID!;
  const redirectUri = process.env.FACEBOOK_REDIRECT_URI!;
  const scope = "public_profile";

  // If ?session=<OnboardingSession.id> is present, run the ONBOARDING flow (no login required)
  const onboardingSessionId = asStr(req.query.session);
  if (onboardingSessionId) {
    // validate the onboarding session exists
    const sess = await prisma.onboardingSession.findUnique({ where: { id: onboardingSessionId } });
    if (!sess) return res.status(400).send("Invalid onboarding session");

    const authUrl =
      `https://www.facebook.com/v23.0/dialog/oauth?` +
      `client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(scope)}` +
      // Use the onboarding session id as state
      `&state=${encodeURIComponent(onboardingSessionId)}`;

    return res.redirect(authUrl);
  }

  // Otherwise, LOGGED-IN "Connect" flow
  const session = await requireSession(req, res);
  if (!session) return res.status(401).json({ message: "Not authenticated" });

  // CSRF state via cookie
  const state = randomBytes(16).toString("hex");
  res.setHeader(
    "Set-Cookie",
    cookie.serialize("fb_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/api/facebook/callback", // cookie only sent to callback
      maxAge: 10 * 60,
    })
  );

  const authUrl =
    `https://www.facebook.com/v23.0/dialog/oauth?` +
    `client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(scope)}` +
    `&state=${encodeURIComponent(state)}`;

  return res.redirect(authUrl);
}
