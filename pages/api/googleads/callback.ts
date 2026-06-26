import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { requireSession } from "@/lib/auth";
import { asStr, clearOauthStateCookie, readCookies, setOnboardingSessionCookie } from "@/lib/api/oauth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") { res.status(405).end(); return; }

  const code  = asStr(req.query.code);
  const state = asStr(req.query.state);
  if (!code) { res.status(400).send("Missing code"); return; }
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
    const text = await tokenRes.text();
    res.status(400).send(`Token exchange failed: ${text}`);
    return;
  }

  const { access_token, refresh_token, expires_in } = await tokenRes.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!access_token) { res.status(400).send("No access_token in response"); return; }

  const encAccess  = encrypt(access_token);
  const encRefresh = refresh_token ? encrypt(refresh_token) : undefined;
  const expiresAt  = expires_in ? new Date(Date.now() + expires_in * 1000) : undefined;

  const cookies = readCookies(req.headers.cookie);
  const hasStateCookie = !!cookies.ga_oauth_state;

  if (hasStateCookie) {
    if (!state || cookies.ga_oauth_state !== state) { res.status(400).send("Invalid state"); return; }
    clearOauthStateCookie(res, "ga_oauth_state", "/api/googleads/callback");

    const session = await requireSession(req, res);
    if (!session) { res.redirect("/login"); return; }
    const userId = (session.user as any).id;

    await prisma.platformToken.upsert({
      where: { user_id_platform: { user_id: userId, platform: "googleads" } },
      update: { access_token: encAccess, ...(encRefresh && { refresh_token: encRefresh }), ...(expiresAt && { expires_at: expiresAt }) },
      create: { user_id: userId, platform: "googleads", access_token: encAccess, ...(encRefresh && { refresh_token: encRefresh }), ...(expiresAt && { expires_at: expiresAt }) },
    });

    res.redirect("/connect?connected=googleads");
    return;
  }
  if (!state) { res.status(400).send("Missing state"); return; }

  const sess = await prisma.onboardingSession.findUnique({ where: { id: state } });
  if (!sess) { res.status(400).send("Invalid onboarding session"); return; }

  await prisma.onboardingPlatformToken.upsert({
    where: { session_id_platform: { session_id: state, platform: "googleads" } },
    update: { access_token: encAccess, ...(encRefresh && { refresh_token: encRefresh }), ...(expiresAt && { expires_at: expiresAt }) },
    create: { session_id: state, platform: "googleads", access_token: encAccess, ...(encRefresh && { refresh_token: encRefresh }), ...(expiresAt && { expires_at: expiresAt }) },
  });
  setOnboardingSessionCookie(res, state);

  res.redirect(`/onboarding/${state}?linked=googleads`);
}
