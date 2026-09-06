import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { asStr, clearOauthStateCookie, readCookies } from "@/lib/api/oauth";
import { persistPlatformToken, persistOnboardingPlatformToken } from "@/lib/api/oauthTokens";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const code = asStr(req.query.code);
  const state = asStr(req.query.state);
  const oauthError = asStr(req.query.error) || asStr(req.query.error_description);
  const cookies = readCookies(req.headers.cookie);
  const hasStateCookie = !!cookies.fb_oauth_state;

  // Onboarding-context failures (denied consent, an expired link, a failed token exchange) land
  // on a small page that tells the opener what happened and closes itself — a bare text response
  // left the popup open with nothing readable and the original tab waiting forever. Settings-
  // context failures (hasStateCookie) are unchanged; that flow isn't a popup opened from onboarding.
  const failOnboarding = (reason: string) => {
    res.redirect(`/social-connect-failed?provider=facebook&reason=${encodeURIComponent(reason)}`);
  };

  if (!code || !state) {
    if (!hasStateCookie) { failOnboarding(oauthError || "missing_code"); return; }
    return res.status(400).send("Missing code/state");
  }
  if (hasStateCookie) {
    if (cookies.fb_oauth_state !== state) return res.status(400).send("Invalid state");
    clearOauthStateCookie(res, "fb_oauth_state", "/api/facebook/callback");
  } else {
    const sess = await prisma.onboardingSession.findUnique({ where: { id: state } });
    if (!sess) { failOnboarding("invalid_session"); return; }
  }
  const tokenUrl = "https://graph.facebook.com/v23.0/oauth/access_token";
  const params = new URLSearchParams({
    client_id: process.env.FACEBOOK_CLIENT_ID!,
    client_secret: process.env.FACEBOOK_CLIENT_SECRET!,
    redirect_uri: process.env.FACEBOOK_REDIRECT_URI!,
    code,
  });

  const r = await fetch(`${tokenUrl}?${params.toString()}`);
  if (!r.ok) {
    if (!hasStateCookie) { failOnboarding("token_exchange_failed"); return; }
    return res.status(400).send(`Token exchange failed: ${await r.text()}`);
  }
  const { access_token, expires_in } = (await r.json()) as {
    access_token: string;
    expires_in?: number;
  };
  if (!access_token) {
    if (!hasStateCookie) { failOnboarding("no_access_token"); return; }
    return res.status(400).send("No access_token in response");
  }

  const expiresAt = expires_in ? new Date(Date.now() + expires_in * 1000) : undefined;

  if (hasStateCookie) {
    const session = await requireSession(req, res);
    if (!session) return res.redirect("/login");
    const userId = (session.user as any).id;

    await persistPlatformToken(userId, { platform: "facebook", accessToken: access_token, expiresAt });

    return res.redirect("/connect?connected=facebook");
  } else {
    const sessionId = state;

    await persistOnboardingPlatformToken(sessionId, { platform: "facebook", accessToken: access_token, expiresAt });

    // This is always opened as a popup (window.open, never same-tab) — land on a small page that
    // posts back to the opener and closes itself, rather than redirecting into the onboarding
    // wizard itself, which would mount a second full copy of it inside the popup.
    return res.redirect("/facebook/connected");
  }
}
