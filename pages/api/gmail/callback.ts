import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { requireSession } from "@/lib/auth";
import { asStr, clearOauthStateCookie, readCookies } from "@/lib/api/oauth";
import { serialize as serializeCookie } from "cookie";

type GoogleTokenResponse = {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
};

type GoogleUserInfo = {
  email?: string;
  email_verified?: boolean;
};

function appendSetCookie(res: NextApiResponse, value: string) {
  const existing = res.getHeader("Set-Cookie");
  const next = Array.isArray(existing) ? [...existing, value] : existing ? [String(existing), value] : [value];
  res.setHeader("Set-Cookie", next);
}

function resolveRuntimeBaseUrl(req: NextApiRequest) {
  const host = req.headers.host || "localhost:3000";
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : forwardedProto || (host.includes("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`.replace(/\/+$/, "");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.status(405).end();
    return;
  }

  const code = asStr(req.query.code);
  const state = asStr(req.query.state);
  if (!code || !state) {
    res.status(400).send("Missing code/state");
    return;
  }

  const cookies = readCookies(req.headers.cookie);
  if (!cookies.gm_oauth_state || cookies.gm_oauth_state !== state) {
    res.status(400).send("Invalid state");
    return;
  }
  clearOauthStateCookie(res, "gm_oauth_state", "/api/gmail/callback");
  appendSetCookie(
    res,
    serializeCookie("gm_oauth_reconnect", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/api/gmail/callback",
      maxAge: 0,
    })
  );
  appendSetCookie(
    res,
    serializeCookie("gm_oauth_source", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/api/gmail/callback",
      maxAge: 0,
    })
  );
  appendSetCookie(
    res,
    serializeCookie("gm_oauth_client", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/api/gmail/callback",
      maxAge: 0,
    })
  );

  const session = await requireSession(req, res);
  const oauthSource = asStr(cookies.gm_oauth_source as string | undefined) || "settings";
  if (!session) {
    const loginCallbackUrl =
      oauthSource === "panel-settings"
        ? "/login?callbackUrl=%2Fpanel%3Fsettings%3D1"
        : "/login?callbackUrl=%2Fclient%3Fsettings%3D1";
    res.redirect(loginCallbackUrl);
    return;
  }
  const userId = Number((session.user as any).id);

  const oauthClientSelection = asStr(cookies.gm_oauth_client as string | undefined);
  const useGmailClient = oauthClientSelection === "gmail";
  const clientId = useGmailClient
    ? process.env.GOOGLE_GMAIL_CLIENT_ID || process.env.GOOGLE_CLIENT_ID
    : process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_GMAIL_CLIENT_ID;
  const clientSecret = useGmailClient
    ? process.env.GOOGLE_GMAIL_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET
    : process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_GMAIL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    res.status(500).send("Google OAuth credentials are not configured.");
    return;
  }

  const redirectFromCookie = asStr(cookies.gm_oauth_redirect as string | undefined);
  const redirectUri = redirectFromCookie || `${resolveRuntimeBaseUrl(req)}/api/gmail/callback`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    res.status(400).send(`Google token exchange failed: ${text}`);
    return;
  }

  const tokenJson = (await tokenRes.json()) as GoogleTokenResponse;
  if (!tokenJson.access_token) {
    res.status(400).send("No access token returned by Google.");
    return;
  }

  const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  if (!profileRes.ok) {
    res.status(400).send("Failed to fetch Google account profile.");
    return;
  }
  const profile = (await profileRes.json()) as GoogleUserInfo;
  const email = (profile.email || "").toLowerCase().trim();
  if (!email) {
    res.status(400).send("Google account did not return an email address.");
    return;
  }

  const platform = `gmail:${email}`;
  const encAccess = encrypt(tokenJson.access_token);
  const encRefresh = tokenJson.refresh_token ? encrypt(tokenJson.refresh_token) : undefined;
  const expiresAt = tokenJson.expires_in ? new Date(Date.now() + tokenJson.expires_in * 1000) : undefined;

  await prisma.userToken.upsert({
    where: { userId_platform: { userId, platform } as any },
    update: {
      accessToken: encAccess,
      ...(encRefresh && { refreshToken: encRefresh }),
      ...(expiresAt && { expiresAt }),
    },
    create: {
      userId,
      platform,
      accessToken: encAccess,
      ...(encRefresh && { refreshToken: encRefresh }),
      ...(expiresAt && { expiresAt }),
    },
  });

  appendSetCookie(
    res,
    serializeCookie("gm_oauth_redirect", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/api/gmail/callback",
      maxAge: 0,
    })
  );

  const role = String((session.user as any).role || "").toLowerCase();
  const isPanelSource = oauthSource === "panel-settings";
  const isPanelRole = role === "admin" || role === "staff";
  const settingsRedirect = isPanelSource
    ? "/panel?settings=1&connected=gmail"
    : isPanelRole
      ? "/panel?settings=1&connected=gmail"
      : "/client?settings=1&connected=gmail";

  res.redirect(settingsRedirect);
}
