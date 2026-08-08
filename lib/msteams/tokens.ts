import { findPlatformTokenByPrefix, getValidPlatformAccessToken, type PlatformTokenResult, type RefreshResult } from "@/lib/api/genericOAuthToken";

export const MSTEAMS_SCOPES = ["offline_access", "OnlineMeetings.ReadWrite", "OnlineMeetingArtifact.Read.All", "User.Read"];

function msTeamsCredentials() {
  return {
    clientId: (process.env.MSTEAMS_CLIENT_ID || "").trim(),
    clientSecret: (process.env.MSTEAMS_CLIENT_SECRET || "").trim(),
    tenant: (process.env.MSTEAMS_TENANT_ID || "common").trim(),
  };
}

async function refreshMsTeamsToken(refreshToken: string): Promise<RefreshResult> {
  const { clientId, clientSecret, tenant } = msTeamsCredentials();
  if (!clientId || !clientSecret) return { ok: false, error: "Microsoft Teams OAuth credentials are not configured." };
  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      scope: MSTEAMS_SCOPES.join(" "),
    }),
  });
  if (!res.ok) return { ok: false, error: await res.text() };
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!data.access_token) return { ok: false, error: "Refresh response missing access token." };
  return { ok: true, accessToken: data.access_token, refreshToken: data.refresh_token || null, expiresIn: Number(data.expires_in || 3600) };
}

/** A user has at most one Microsoft Teams connection today — booking links don't carry a Teams identity field. */
export async function getValidMsTeamsAccessTokenForUser(userId: string): Promise<PlatformTokenResult> {
  const row = await findPlatformTokenByPrefix(userId, "msteams:");
  if (!row) return { ok: false, reason: "account_not_found", message: "No Microsoft Teams account connected." };
  return getValidPlatformAccessToken(userId, row.platform, refreshMsTeamsToken);
}
