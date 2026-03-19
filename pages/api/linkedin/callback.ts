import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { requireSession } from "@/lib/auth";
import { asStr, clearOauthStateCookie, readCookies, setOnboardingSessionCookie } from "@/lib/api/oauth";
import { serialize as serializeCookie } from "cookie";

type TokenExchangeResult = {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
};

function appendSetCookie(res: NextApiResponse, value: string) {
  const existing = res.getHeader("Set-Cookie");
  const next = Array.isArray(existing) ? [...existing, value] : existing ? [String(existing), value] : [value];
  res.setHeader("Set-Cookie", next);
}

async function exchangeLinkedInToken(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}) {
  const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: params.code,
      redirect_uri: params.redirectUri,
      client_id: params.clientId,
      client_secret: params.clientSecret,
    }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    return { ok: false as const, status: tokenRes.status, text };
  }

  const json = (await tokenRes.json()) as TokenExchangeResult;
  return { ok: true as const, data: json };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") { res.status(405).end(); return; }

  const code = asStr(req.query.code);
  const cookies = readCookies(req.headers.cookie);
  const hasStateCookie = !!cookies.li_oauth_state;
  const redirectFromCookie = asStr(cookies.li_oauth_redirect as string | undefined);
  const rawState = asStr(req.query.state);
  let state = rawState || "";
  const isCompanyMode = state.startsWith("company:");
  if (isCompanyMode) state = state.replace(/^company:/, "");
  const isSettingsSource = state.startsWith("settings:");
  if (isSettingsSource) state = state.replace(/^settings:/, "");
  const clientId = (isCompanyMode ? process.env.LINKEDIN_COMPANY_CLIENT_ID : process.env.LINKEDIN_CLIENT_ID) || process.env.LINKEDIN_CLIENT_ID!;
  const clientSecret = (isCompanyMode ? process.env.LINKEDIN_COMPANY_CLIENT_SECRET : process.env.LINKEDIN_CLIENT_SECRET) || process.env.LINKEDIN_CLIENT_SECRET!;
  const redirectUri =
    (hasStateCookie ? redirectFromCookie : undefined) ||
    (isCompanyMode ? process.env.LINKEDIN_COMPANY_REDIRECT_URI : process.env.LINKEDIN_REDIRECT_URI) ||
    process.env.LINKEDIN_REDIRECT_URI!;
  const connectedRedirect = isSettingsSource ? "/client?settings=1&connected=linkedin" : "/connect?connected=linkedin";
  if (!code) { res.status(400).send("Missing code"); return; }
  const primary = await exchangeLinkedInToken({
    code,
    clientId,
    clientSecret,
    redirectUri,
  });

  let tokenPayload: TokenExchangeResult | null = primary.ok ? primary.data : null;
  if (!primary.ok) {
    const primaryErr = primary.text;
    const canRetryWithAltCreds =
      /appid\/redirect uri\/code verifier does not match authorization code|authorization code expired|external member binding exists/i.test(primaryErr);

    if (canRetryWithAltCreds) {
      const altClientId = isCompanyMode ? process.env.LINKEDIN_CLIENT_ID : process.env.LINKEDIN_COMPANY_CLIENT_ID;
      const altClientSecret = isCompanyMode ? process.env.LINKEDIN_CLIENT_SECRET : process.env.LINKEDIN_COMPANY_CLIENT_SECRET;
      const altRedirectUri = isCompanyMode ? process.env.LINKEDIN_REDIRECT_URI : process.env.LINKEDIN_COMPANY_REDIRECT_URI;

      if (altClientId && altClientSecret && altRedirectUri) {
        const secondary = await exchangeLinkedInToken({
          code,
          clientId: altClientId,
          clientSecret: altClientSecret,
          redirectUri: altRedirectUri,
        });
        if (secondary.ok) {
          tokenPayload = secondary.data;
        } else {
          console.error("[LI] token exchange failed (primary+secondary)", primary.status, primary.text, secondary.status, secondary.text);
        }
      } else {
        console.error("[LI] token exchange failed (no alternate creds configured)", primary.status, primary.text);
      }
    } else {
      console.error("[LI] token exchange failed", primary.status, primary.text);
    }
  }

  if (!tokenPayload) {
    const detail = primary.ok ? "Unknown token exchange failure." : primary.text;
    res.status(400).send(`LinkedIn token exchange failed: ${detail}`);
    return;
  }

  const { access_token, expires_in, refresh_token } = tokenPayload;
  if (!access_token) { res.status(400).send("No access token received"); return; }

  const encAccess = encrypt(access_token);
  const encRefresh = refresh_token ? encrypt(refresh_token) : undefined;
  const expiresAt = expires_in ? new Date(Date.now() + expires_in * 1000) : undefined;
  if (hasStateCookie) {
    if (!state || cookies.li_oauth_state !== state) { res.status(400).send("Invalid state"); return; }
    clearOauthStateCookie(res, "li_oauth_state", "/api/linkedin/callback");
    appendSetCookie(
      res,
      serializeCookie("li_oauth_redirect", "", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/api/linkedin/callback",
        maxAge: 0,
      })
    );

    const session = await requireSession(req, res);
    if (!session) { res.redirect("/login"); return; }
    const userId = Number((session.user as any).id);

    await prisma.userToken.upsert({
      where: { userId_platform: { userId, platform: "linkedin" } as any },
      update: { accessToken: encAccess, ...(encRefresh && { refreshToken: encRefresh }), ...(expiresAt && { expiresAt }) },
      create: { userId, platform: "linkedin", accessToken: encAccess, ...(encRefresh && { refreshToken: encRefresh }), ...(expiresAt && { expiresAt }) },
    });

    res.redirect(connectedRedirect);
    return;
  }
  if (!state) { res.status(400).send("Missing state"); return; }
  const sess = await prisma.onboardingSession.findUnique({ where: { id: state } });
  if (!sess) {
    const session = await requireSession(req, res);
    if (session) {
      const userId = Number((session.user as any).id);
      await prisma.userToken.upsert({
        where: { userId_platform: { userId, platform: "linkedin" } as any },
        update: { accessToken: encAccess, ...(encRefresh && { refreshToken: encRefresh }), ...(expiresAt && { expiresAt }) },
        create: { userId, platform: "linkedin", accessToken: encAccess, ...(encRefresh && { refreshToken: encRefresh }), ...(expiresAt && { expiresAt }) },
      });
      res.redirect(connectedRedirect);
      return;
    }
    if (isSettingsSource) {
      res.redirect("/login?callbackUrl=%2Fclient%3Fsettings%3D1");
      return;
    }
    res.status(400).send("Invalid onboarding session");
    return;
  }

  await prisma.onboardingPlatformToken.upsert({
    where: { sessionId_platform: { sessionId: state, platform: "linkedin" } as any },
    update: { accessToken: encAccess, ...(encRefresh && { refreshToken: encRefresh }), ...(expiresAt && { expiresAt }) },
    create: { sessionId: state, platform: "linkedin", accessToken: encAccess, ...(encRefresh && { refreshToken: encRefresh }), ...(expiresAt && { expiresAt }) },
  });
  setOnboardingSessionCookie(res, state);

  res.redirect(`/onboarding/${state}?linked=linkedin`);
}
