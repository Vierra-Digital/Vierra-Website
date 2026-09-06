import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { asStr, clearOauthStateCookie, readCookies, setOnboardingSessionCookie } from "@/lib/api/oauth";
import { persistPlatformToken, persistOnboardingPlatformToken } from "@/lib/api/oauthTokens";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") { res.status(405).end(); return; }

  const code  = asStr(req.query.code);
  const state = asStr(req.query.state);
  const oauthError = asStr(req.query.error) || asStr(req.query.error_description);
  const cookies = readCookies(req.headers.cookie);
  const hasStateCookie = !!cookies.ga_oauth_state;

  // Onboarding-context failures land on a small page that tells the opener what happened and
  // closes itself, instead of leaving the popup on a bare text response. Settings-context
  // failures (hasStateCookie) are unchanged.
  const failOnboarding = (reason: string) => {
    res.redirect(`/social-connect-failed?provider=googleads&reason=${encodeURIComponent(reason)}`);
  };

  if (!code) {
    if (!hasStateCookie) { failOnboarding(oauthError || "missing_code"); return; }
    res.status(400).send("Missing code");
    return;
  }
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLEADS_CLIENT_ID!,
      client_secret: process.env.GOOGLEADS_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLEADS_REDIRECT_URI!,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    if (!hasStateCookie) { failOnboarding("token_exchange_failed"); return; }
    const text = await tokenRes.text();
    res.status(400).send(`Token exchange failed: ${text}`);
    return;
  }

  const { access_token, refresh_token, expires_in } = await tokenRes.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!access_token) {
    if (!hasStateCookie) { failOnboarding("no_access_token"); return; }
    res.status(400).send("No access_token in response");
    return;
  }

  const expiresAt  = expires_in ? new Date(Date.now() + expires_in * 1000) : undefined;

  if (hasStateCookie) {
    if (!state || cookies.ga_oauth_state !== state) { res.status(400).send("Invalid state"); return; }
    clearOauthStateCookie(res, "ga_oauth_state", "/api/googleads/callback");

    const session = await requireSession(req, res);
    if (!session) { res.redirect("/login"); return; }
    const userId = (session.user as any).id;

    await persistPlatformToken(userId, { platform: "googleads", accessToken: access_token, refreshToken: refresh_token, expiresAt });

    res.redirect("/connect?connected=googleads");
    return;
  }
  if (!state) { failOnboarding("missing_code"); return; }

  const sess = await prisma.onboardingSession.findUnique({ where: { id: state } });
  if (!sess) { failOnboarding("invalid_session"); return; }

  await persistOnboardingPlatformToken(state, { platform: "googleads", accessToken: access_token, refreshToken: refresh_token, expiresAt });
  setOnboardingSessionCookie(res, state);

  // This is always opened as a popup (window.open, never same-tab) — land on a small page that
  // posts back to the opener and closes itself, rather than redirecting into the onboarding
  // wizard itself, which would mount a second full copy of it inside the popup.
  res.redirect("/googleads/connected");
}
