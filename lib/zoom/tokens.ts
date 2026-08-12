import { findPlatformTokenByPrefix, getValidPlatformAccessToken, type PlatformTokenResult, type RefreshResult } from "@/lib/api/genericOAuthToken";

function zoomCredentials() {
  return {
    clientId: (process.env.ZOOM_CLIENT_ID || "").trim(),
    clientSecret: (process.env.ZOOM_CLIENT_SECRET || "").trim(),
  };
}

async function refreshZoomToken(refreshToken: string): Promise<RefreshResult> {
  const { clientId, clientSecret } = zoomCredentials();
  if (!clientId || !clientSecret) return { ok: false, error: "Zoom OAuth credentials are not configured." };
  const res = await fetch("https://zoom.us/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  });
  if (!res.ok) return { ok: false, error: await res.text() };
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!data.access_token) return { ok: false, error: "Refresh response missing access token." };
  return { ok: true, accessToken: data.access_token, refreshToken: data.refresh_token || null, expiresIn: Number(data.expires_in || 3600) };
}

/** A user has at most one Zoom connection today — booking links don't carry a Zoom identity field. */
export async function getValidZoomAccessTokenForUser(userId: string): Promise<PlatformTokenResult> {
  const row = await findPlatformTokenByPrefix(userId, "zoom:");
  if (!row) return { ok: false, reason: "account_not_found", message: "No Zoom account connected." };
  return getValidPlatformAccessToken(userId, row.platform, refreshZoomToken);
}
