import type { NextApiRequest, NextApiResponse } from "next";
import { parse as parseCookie, serialize as serializeCookie } from "cookie";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { Platform } from "@prisma/client";

const asStr = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const code = asStr(req.query.code);
  const state = asStr(req.query.state);
  if (!code || !state) return res.status(400).send("Missing code/state");

  // Decide which flow we're in by presence of the state cookie
  const cookies = parseCookie(req.headers.cookie || "");
  const hasStateCookie = !!cookies.fb_oauth_state;

  // Verify state
  if (hasStateCookie) {
    if (cookies.fb_oauth_state !== state) return res.status(400).send("Invalid state");
    // clear cookie
    res.setHeader(
      "Set-Cookie",
      serializeCookie("fb_oauth_state", "", {
        path: "/api/facebook/callback",
        maxAge: 0,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      })
    );
  } else {
    // Onboarding: ensure the state is a valid onboarding session id
    const sess = await prisma.onboardingSession.findUnique({ where: { id: state } });
    if (!sess) return res.status(400).send("Invalid onboarding session");
  }

  // Exchange code -> token
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

    // LOGGED-IN CONNECT FLOW
    const session = await getServerSession(req, res, authOptions);
    if (!session) return res.redirect("/login");
    const userId = Number((session.user as any).id);

    await prisma.userToken.upsert({
      where: { userId_platform: { userId, platform: Platform.facebook } },
      update: { accessToken: enc, ...(expiresAt && { expiresAt }) },
      create: { userId, platform: Platform.facebook, accessToken: enc, ...(expiresAt && { expiresAt }) },
    });

    return res.redirect("/connect?connected=facebook");
  } else {
    // ONBOARDING FLOW (no login)
    const sessionId = state;

    await prisma.onboardingPlatformToken.upsert({
      where: { sessionId_platform: { sessionId, platform: Platform.facebook } },
      update: { accessToken: enc, ...(expiresAt && { expiresAt }) },
      create: { sessionId, platform: Platform.facebook, accessToken: enc, ...(expiresAt && { expiresAt }) },
    });

    return res.redirect("/session?linked=facebook");

  }
}
