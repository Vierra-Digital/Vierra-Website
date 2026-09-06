import { decrypt, encrypt } from "./crypto.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

/** Deno port of lib/gmail/tokens.ts::getValidGmailAccessToken — no in-flight dedup (Edge
 * Functions are single-request, so the race it guards against doesn't apply here). */
export type GmailTokenResult =
  | { ok: true; accessToken: string }
  | { ok: false; reason: "account_not_found" | "no_refresh_token" | "refresh_failed"; message: string };

const REFRESH_BUFFER_MS = 60 * 1000;

export async function getValidGmailAccessToken(
  supabase: SupabaseClient,
  userId: string,
  accountEmail: string,
  opts?: { forceRefresh?: boolean }
): Promise<GmailTokenResult> {
  const normalizedEmail = accountEmail.trim().toLowerCase();
  const platform = `gmail:${normalizedEmail}`;

  const { data: row } = await supabase
    .from("platform_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .eq("platform", platform)
    .maybeSingle();

  if (!row?.access_token) {
    return { ok: false, reason: "account_not_found", message: "Gmail account token not found." };
  }

  const expiresAt = row.expires_at ? new Date(row.expires_at) : null;
  const expiringSoon = expiresAt ? expiresAt.getTime() <= Date.now() + REFRESH_BUFFER_MS : false;
  if (!expiringSoon && !opts?.forceRefresh) {
    return { ok: true, accessToken: await decrypt(row.access_token) };
  }

  if (!row.refresh_token) {
    return { ok: false, reason: "no_refresh_token", message: "No refresh token available. Reconnect required." };
  }

  const refreshToken = await decrypt(row.refresh_token);
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID") || "";
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    return { ok: false, reason: "refresh_failed", message: `Failed to refresh token: ${error}` };
  }
  const payload = (await response.json()) as { access_token?: string; expires_in?: number; refresh_token?: string };
  if (!payload.access_token) {
    return { ok: false, reason: "refresh_failed", message: "Refresh response missing access token." };
  }

  const nextExpiresAt = new Date(Date.now() + Number(payload.expires_in || 3600) * 1000);
  await supabase
    .from("platform_tokens")
    .update({
      access_token: await encrypt(payload.access_token),
      expires_at: nextExpiresAt.toISOString(),
      ...(payload.refresh_token ? { refresh_token: await encrypt(payload.refresh_token) } : {}),
    })
    .eq("user_id", userId)
    .eq("platform", platform);

  return { ok: true, accessToken: payload.access_token };
}
