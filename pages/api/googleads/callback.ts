import type { NextApiRequest, NextApiResponse } from "next";
import { parse as parseCookie, serialize as serializeCookie } from "cookie";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";

const asStr = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

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

  const cookies = parseCookie(req.headers.cookie || "");
  const hasStateCookie = !!cookies.ga_oauth_state;

  if (hasStateCookie) {
    if (!state || cookies.ga_oauth_state !== state) { res.status(400).send("Invalid state"); return; }
    res.setHeader("Set-Cookie", serializeCookie("ga_oauth_state", "", {
      path: "/api/googleads/callback",
      maxAge: 0,
    }));

    const session = await getServerSession(req, res, authOptions);
    if (!session) { res.redirect("/login"); return; }
    const userId = Number((session.user as any).id);

    await prisma.userToken.upsert({
      where: { userId_platform: { userId, platform: "googleads" } as any }, 
      update: { accessToken: encAccess, ...(encRefresh && { refreshToken: encRefresh }), ...(expiresAt && { expiresAt }) },
      create: { userId, platform: "googleads", accessToken: encAccess, ...(encRefresh && { refreshToken: encRefresh }), ...(expiresAt && { expiresAt }) },
    });

    res.redirect("/connect?connected=googleads");
    return;
  }
  if (!state) { res.status(400).send("Missing state"); return; }

  const sess = await prisma.onboardingSession.findUnique({ where: { id: state } });
  if (!sess) { res.status(400).send("Invalid onboarding session"); return; }

  await prisma.onboardingPlatformToken.upsert({
    where: { sessionId_platform: { sessionId: state, platform: "googleads" } as any },
    update: { accessToken: encAccess, ...(encRefresh && { refreshToken: encRefresh }), ...(expiresAt && { expiresAt }) },
    create: { sessionId: state, platform: "googleads", accessToken: encAccess, ...(encRefresh && { refreshToken: encRefresh }), ...(expiresAt && { expiresAt }) },
  });
  res.setHeader("Set-Cookie", serializeCookie("ob_session", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24,
  }));

  res.redirect(`/onboarding/${state}?linked=googleads`);
}
