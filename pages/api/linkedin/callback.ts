import type { NextApiRequest, NextApiResponse } from "next";
import { parse as parseCookie, serialize as serializeCookie } from "cookie";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { requireSession } from "@/lib/auth";

const asStr = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") { res.status(405).end(); return; }

  console.log("[LI] start", { url: req.url, query: req.query });

  const code = asStr(req.query.code);
  const state = asStr(req.query.state);
  if (!code) { res.status(400).send("Missing code"); return; }
  const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.LINKEDIN_REDIRECT_URI!,
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
    }),
  });
  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    console.error("[LI] token exchange failed", tokenRes.status, text);
    res.status(400).send(`LinkedIn token exchange failed: ${text}`);
    return;
  }

  const { access_token, expires_in, refresh_token } = await tokenRes.json() as {
    access_token: string;
    expires_in?: number;
    refresh_token?: string;
  };
  if (!access_token) { res.status(400).send("No access token received"); return; }

  const encAccess = encrypt(access_token);
  const encRefresh = refresh_token ? encrypt(refresh_token) : undefined;
  const expiresAt = expires_in ? new Date(Date.now() + expires_in * 1000) : undefined;
  const cookies = parseCookie(req.headers.cookie || "");
  const hasStateCookie = !!cookies.li_oauth_state;
  console.log("[LI] cookies", Object.keys(cookies));
  console.log("[LI] env.redirect_uri", process.env.LINKEDIN_REDIRECT_URI);
  console.log("[LI] hasStateCookie", !!cookies.li_oauth_state);

  if (hasStateCookie) {
    if (!state || cookies.li_oauth_state !== state) { res.status(400).send("Invalid state"); return; }
    res.setHeader("Set-Cookie", serializeCookie("li_oauth_state", "", {
      path: "/api/linkedin/callback",
      maxAge: 0,
    }));

    const session = await requireSession(req, res);
    if (!session) { res.redirect("/login"); return; }
    const userId = Number((session.user as any).id);

    await prisma.userToken.upsert({
      where: { userId_platform: { userId, platform: "linkedin" } as any },
      update: { accessToken: encAccess, ...(encRefresh && { refreshToken: encRefresh }), ...(expiresAt && { expiresAt }) },
      create: { userId, platform: "linkedin", accessToken: encAccess, ...(encRefresh && { refreshToken: encRefresh }), ...(expiresAt && { expiresAt }) },
    });

    res.redirect("/connect?connected=linkedin");
    return;
  }
  if (!state) { res.status(400).send("Missing state"); return; }
  const sess = await prisma.onboardingSession.findUnique({ where: { id: state } });
  if (!sess) { res.status(400).send("Invalid onboarding session"); return; }

  await prisma.onboardingPlatformToken.upsert({
    where: { sessionId_platform: { sessionId: state, platform: "linkedin" } as any },
    update: { accessToken: encAccess, ...(encRefresh && { refreshToken: encRefresh }), ...(expiresAt && { expiresAt }) },
    create: { sessionId: state, platform: "linkedin", accessToken: encAccess, ...(encRefresh && { refreshToken: encRefresh }), ...(expiresAt && { expiresAt }) },
  });
  res.setHeader("Set-Cookie", serializeCookie("ob_session", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24,
  }));

  res.redirect(`/session/onboarding/${state}?linked=linkedin`);
}
