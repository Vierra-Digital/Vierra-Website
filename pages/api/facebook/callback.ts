import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { requireSession } from "@/lib/auth";
import { asStr, clearOauthStateCookie, readCookies } from "@/lib/api/oauth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const code = asStr(req.query.code);
  const state = asStr(req.query.state);
  if (!code || !state) return res.status(400).send("Missing code/state");
  const cookies = readCookies(req.headers.cookie);
  const hasStateCookie = !!cookies.fb_oauth_state;
  if (hasStateCookie) {
    if (cookies.fb_oauth_state !== state) return res.status(400).send("Invalid state");
    clearOauthStateCookie(res, "fb_oauth_state", "/api/facebook/callback");
  } else {
    const sess = await prisma.onboardingSession.findUnique({ where: { id: state } });
    if (!sess) return res.status(400).send("Invalid onboarding session");
  }
  const tokenUrl = "https://graph.facebook.com/v23.0/oauth/access_token";
  const params = new URLSearchParams({
    client_id: process.env.FACEBOOK_CLIENT_ID!,
    client_secret: process.env.FACEBOOK_CLIENT_SECRET!,
    redirect_uri: process.env.FACEBOOK_REDIRECT_URI!,
    code,
  });

  const r = await fetch(`${tokenUrl}?${params.toString()}`);
  if (!r.ok) return res.status(400).send(`Token exchange failed: ${await r.text()}`);
  const { access_token, expires_in } = (await r.json()) as {
    access_token: string;
    expires_in?: number;
  };
  if (!access_token) return res.status(400).send("No access_token in response");

  const enc = encrypt(access_token);
  const expiresAt = expires_in ? new Date(Date.now() + expires_in * 1000) : undefined;

  if (hasStateCookie) {
    const session = await requireSession(req, res);
    if (!session) return res.redirect("/login");
    const userId = (session.user as any).id;

    await prisma.platformToken.upsert({
      where: { user_id_platform: { user_id: userId, platform: "facebook" } },
      update: { access_token: enc, ...(expiresAt && { expires_at: expiresAt }) },
      create: { user_id: userId, platform: "facebook", access_token: enc, ...(expiresAt && { expires_at: expiresAt }) },
    });

    return res.redirect("/connect?connected=facebook");
  } else {
    const sessionId = state;

    await prisma.onboardingPlatformToken.upsert({
      where: { session_id_platform: { session_id: sessionId, platform: "facebook" } },
      update: { access_token: enc, ...(expiresAt && { expires_at: expiresAt }) },
      create: { session_id: sessionId, platform: "facebook", access_token: enc, ...(expiresAt && { expires_at: expiresAt }) },
    });

    return res.redirect(`/onboarding/${sessionId}?linked=facebook`);
  }
}
