import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { decrypt, encrypt } from "./crypto.ts";

/** Deno port of lib/api/genericOAuthToken.ts — provider-agnostic refresh-on-expiry pattern. */
export type PlatformTokenResult =
  | { ok: true; accessToken: string }
  | { ok: false; reason: "account_not_found" | "no_refresh_token" | "refresh_failed"; message: string };

export type RefreshResult =
  | { ok: true; accessToken: string; refreshToken: string | null; expiresIn: number }
  | { ok: false; error: string };

const REFRESH_BUFFER_MS = 60 * 1000;

export async function findPlatformTokenByPrefix(supabase: SupabaseClient, userId: string, prefix: string) {
  const { data } = await supabase
    .from("platform_tokens")
    .select("platform, access_token, refresh_token, expires_at, meta")
    .eq("user_id", userId)
    .like("platform", `${prefix}%`)
    .limit(1)
    .maybeSingle();
  return data;
}

export async function getValidPlatformAccessToken(
  supabase: SupabaseClient,
  userId: string,
  platform: string,
  refresh: (refreshToken: string) => Promise<RefreshResult>
): Promise<PlatformTokenResult> {
  const { data: row } = await supabase
    .from("platform_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .eq("platform", platform)
    .maybeSingle();
  if (!row?.access_token) return { ok: false, reason: "account_not_found", message: `${platform} token not found.` };

  const expiresAt = row.expires_at ? new Date(row.expires_at) : null;
  const expiringSoon = expiresAt ? expiresAt.getTime() <= Date.now() + REFRESH_BUFFER_MS : false;
  if (!expiringSoon) return { ok: true, accessToken: await decrypt(row.access_token) };

  if (!row.refresh_token) return { ok: false, reason: "no_refresh_token", message: "No refresh token available. Reconnect required." };
  const refreshed = await refresh(await decrypt(row.refresh_token));
  if (!refreshed.ok) return { ok: false, reason: "refresh_failed", message: `Failed to refresh token: ${refreshed.error}` };

  const nextExpiresAt = new Date(Date.now() + refreshed.expiresIn * 1000);
  await supabase
    .from("platform_tokens")
    .update({
      access_token: await encrypt(refreshed.accessToken),
      expires_at: nextExpiresAt.toISOString(),
      ...(refreshed.refreshToken ? { refresh_token: await encrypt(refreshed.refreshToken) } : {}),
    })
    .eq("user_id", userId)
    .eq("platform", platform);

  return { ok: true, accessToken: refreshed.accessToken };
}

/**
 * Merge keys into a platform_tokens row's `meta` JSON without clobbering unrelated flags. Bails
 * out on a failed read instead of treating it the same as "no existing row" — proceeding anyway
 * would overwrite `meta` with just `patch`, silently dropping whatever flags were already there
 * (e.g. `needsReconnect`) purely because of a transient read error.
 */
export async function mergePlatformTokenMeta(supabase: SupabaseClient, userId: string, platform: string, patch: Record<string, unknown>) {
  const { data: row, error } = await supabase
    .from("platform_tokens")
    .select("meta")
    .eq("user_id", userId)
    .eq("platform", platform)
    .maybeSingle();
  if (error) {
    console.error("mergePlatformTokenMeta: read failed, skipping merge", userId, platform, error);
    return;
  }
  const nextMeta = { ...((row?.meta as Record<string, unknown> | null) || {}), ...patch };
  await supabase.from("platform_tokens").update({ meta: nextMeta }).eq("user_id", userId).eq("platform", platform);
}

export async function getValidZoomAccessTokenForUser(supabase: SupabaseClient, userId: string): Promise<PlatformTokenResult> {
  const row = await findPlatformTokenByPrefix(supabase, userId, "zoom:");
  if (!row) return { ok: false, reason: "account_not_found", message: "No Zoom account connected." };
  return getValidPlatformAccessToken(supabase, userId, row.platform, (refreshToken) => refreshZoomToken(refreshToken));
}

export async function getValidMsTeamsAccessTokenForUser(supabase: SupabaseClient, userId: string): Promise<PlatformTokenResult> {
  const row = await findPlatformTokenByPrefix(supabase, userId, "msteams:");
  if (!row) return { ok: false, reason: "account_not_found", message: "No Microsoft Teams account connected." };
  return getValidPlatformAccessToken(supabase, userId, row.platform, (refreshToken) => refreshMsTeamsToken(refreshToken));
}

async function refreshZoomToken(refreshToken: string): Promise<RefreshResult> {
  const clientId = (Deno.env.get("ZOOM_CLIENT_ID") || "").trim();
  const clientSecret = (Deno.env.get("ZOOM_CLIENT_SECRET") || "").trim();
  if (!clientId || !clientSecret) return { ok: false, error: "Zoom OAuth credentials are not configured." };
  const res = await fetch("https://zoom.us/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  });
  if (!res.ok) return { ok: false, error: await res.text() };
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!data.access_token) return { ok: false, error: "Refresh response missing access token." };
  return { ok: true, accessToken: data.access_token, refreshToken: data.refresh_token || null, expiresIn: Number(data.expires_in || 3600) };
}

async function refreshMsTeamsToken(refreshToken: string): Promise<RefreshResult> {
  const clientId = (Deno.env.get("MSTEAMS_CLIENT_ID") || "").trim();
  const clientSecret = (Deno.env.get("MSTEAMS_CLIENT_SECRET") || "").trim();
  const tenant = (Deno.env.get("MSTEAMS_TENANT_ID") || "common").trim();
  if (!clientId || !clientSecret) return { ok: false, error: "Microsoft Teams OAuth credentials are not configured." };
  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      scope: ["offline_access", "OnlineMeetings.ReadWrite", "OnlineMeetingArtifact.Read.All", "User.Read"].join(" "),
    }),
  });
  if (!res.ok) return { ok: false, error: await res.text() };
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!data.access_token) return { ok: false, error: "Refresh response missing access token." };
  return { ok: true, accessToken: data.access_token, refreshToken: data.refresh_token || null, expiresIn: Number(data.expires_in || 3600) };
}
