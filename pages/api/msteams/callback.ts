import type { NextApiRequest, NextApiResponse } from "next";
import { requireSession } from "@/lib/auth";
import { appendSetCookie, asStr, clearOauthStateCookie, readCookies, resolveRuntimeBaseUrl } from "@/lib/api/oauth";
import { persistPlatformToken } from "@/lib/api/oauthTokens";
import { MSTEAMS_SCOPES } from "@/lib/msteams/tokens";
import { serializeCookie } from "@/lib/api/cookies";

type MsTokenResponse = { access_token: string; refresh_token?: string; expires_in?: number };
type MsUserResponse = { id: string; mail?: string; userPrincipalName?: string };

function msTeamsCredentials() {
  return {
    clientId: (process.env.MSTEAMS_CLIENT_ID || "").trim(),
    clientSecret: (process.env.MSTEAMS_CLIENT_SECRET || "").trim(),
    tenant: (process.env.MSTEAMS_TENANT_ID || "common").trim(),
  };
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
  if (!cookies.msteams_oauth_state || cookies.msteams_oauth_state !== state) {
    res.status(400).send("Invalid state");
    return;
  }
  clearOauthStateCookie(res, "msteams_oauth_state", "/api/msteams/callback");

  const session = await requireSession(req, res);
  if (!session) {
    res.redirect("/login?callbackUrl=%2Fpanel%3Fsettings%3D1");
    return;
  }
  const userId = session.user.id;

  const { clientId, clientSecret, tenant } = msTeamsCredentials();
  if (!clientId || !clientSecret) {
    res.status(500).send("Microsoft Teams OAuth credentials are not configured.");
    return;
  }

  const redirectFromCookie = asStr(cookies.msteams_oauth_redirect as string | undefined);
  const redirectUri = redirectFromCookie || `${resolveRuntimeBaseUrl(req)}/api/msteams/callback`;
  appendSetCookie(
    res,
    serializeCookie("msteams_oauth_redirect", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/api/msteams/callback",
      maxAge: 0,
    })
  );

  const tokenRes = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
      scope: MSTEAMS_SCOPES.join(" "),
    }),
  });
  if (!tokenRes.ok) {
    res.status(400).send(`Microsoft token exchange failed: ${await tokenRes.text()}`);
    return;
  }
  const tokenJson = (await tokenRes.json()) as MsTokenResponse;
  if (!tokenJson.access_token) {
    res.status(400).send("No access token returned by Microsoft.");
    return;
  }

  const profileRes = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  if (!profileRes.ok) {
    res.status(400).send("Failed to fetch Microsoft account profile.");
    return;
  }
  const profile = (await profileRes.json()) as MsUserResponse;
  if (!profile.id) {
    res.status(400).send("Microsoft account did not return an id.");
    return;
  }

  const platform = `msteams:${profile.id}`;
  const expiresAt = tokenJson.expires_in ? new Date(Date.now() + tokenJson.expires_in * 1000) : undefined;

  await persistPlatformToken(userId, {
    platform,
    accessToken: tokenJson.access_token,
    refreshToken: tokenJson.refresh_token,
    expiresAt,
    // Unlike Zoom's plan-tier heuristic, there's no reliable signal at connect time for whether
    // the tenant admin has granted OnlineMeetingArtifact.Read.All — this flips to true the first
    // time getTeamsAttendance actually returns data (see lib/booking/syncAttendance.ts).
    meta: { msTeamsEmail: profile.mail || profile.userPrincipalName || null, attendanceReportsAvailable: false },
  });

  res.redirect("/panel?settings=1&connected=msteams");
}
