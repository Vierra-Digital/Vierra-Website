import type { NextApiRequest, NextApiResponse } from "next";
import { requireSession } from "@/lib/auth";
import { appendSetCookie, asStr, clearOauthStateCookie, readCookies, resolveRuntimeBaseUrl } from "@/lib/api/oauth";
import { persistPlatformToken } from "@/lib/api/oauthTokens";
import { serializeCookie } from "@/lib/api/cookies";

type ZoomTokenResponse = { access_token: string; refresh_token?: string; expires_in?: number };
// type: 1 = Basic (free), 2 = Licensed, 3 = On-prem.
type ZoomUserResponse = { id: string; email?: string; type?: number };

function zoomCredentials() {
  return {
    clientId: (process.env.ZOOM_CLIENT_ID || "").trim(),
    clientSecret: (process.env.ZOOM_CLIENT_SECRET || "").trim(),
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
  if (!cookies.zoom_oauth_state || cookies.zoom_oauth_state !== state) {
    res.status(400).send("Invalid state");
    return;
  }
  clearOauthStateCookie(res, "zoom_oauth_state", "/api/zoom/callback");

  const session = await requireSession(req, res);
  if (!session) {
    res.redirect("/login?callbackUrl=%2Fpanel%3Fsettings%3D1");
    return;
  }
  const userId = session.user.id;

  const { clientId, clientSecret } = zoomCredentials();
  if (!clientId || !clientSecret) {
    res.status(500).send("Zoom OAuth credentials are not configured.");
    return;
  }

  const redirectFromCookie = asStr(cookies.zoom_oauth_redirect as string | undefined);
  const redirectUri = redirectFromCookie || `${resolveRuntimeBaseUrl(req)}/api/zoom/callback`;
  appendSetCookie(
    res,
    serializeCookie("zoom_oauth_redirect", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/api/zoom/callback",
      maxAge: 0,
    })
  );

  const tokenRes = await fetch("https://zoom.us/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri }),
  });
  if (!tokenRes.ok) {
    res.status(400).send(`Zoom token exchange failed: ${await tokenRes.text()}`);
    return;
  }
  const tokenJson = (await tokenRes.json()) as ZoomTokenResponse;
  if (!tokenJson.access_token) {
    res.status(400).send("No access token returned by Zoom.");
    return;
  }

  const profileRes = await fetch("https://api.zoom.us/v2/users/me", {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  if (!profileRes.ok) {
    res.status(400).send("Failed to fetch Zoom account profile.");
    return;
  }
  const profile = (await profileRes.json()) as ZoomUserResponse;
  if (!profile.id) {
    res.status(400).send("Zoom account did not return an id.");
    return;
  }

  const platform = `zoom:${profile.id}`;
  const expiresAt = tokenJson.expires_in ? new Date(Date.now() + tokenJson.expires_in * 1000) : undefined;
  // Heuristic — see DESIGN.md §14.13, needs verification against current Zoom docs. Licensed+
  // (type >= 2) generally has Report API access; Basic (free, type 1) generally doesn't.
  const attendanceReportsAvailable = Number(profile.type || 0) >= 2;

  await persistPlatformToken(userId, {
    platform,
    accessToken: tokenJson.access_token,
    refreshToken: tokenJson.refresh_token,
    expiresAt,
    meta: { zoomEmail: profile.email || null, attendanceReportsAvailable },
  });

  res.redirect("/panel?settings=1&connected=zoom");
}
