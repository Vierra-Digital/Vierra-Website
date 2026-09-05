import { prisma } from "@/lib/prisma";
import { decrypt, encrypt } from "@/lib/crypto";
import { resolveGoogleWebClientCredentials } from "@/lib/api/oauth";

export type GmailTokenResult =
  | {
      ok: true;
      accessToken: string;
      expiresAt: Date | null;
    }
  | {
      ok: false;
      reason: "account_not_found" | "no_refresh_token" | "refresh_failed";
      message: string;
    };

const REFRESH_BUFFER_MS = 60 * 1000;

function nowMs() {
  return Date.now();
}

function isExpiringSoon(expiresAt: Date | null) {
  if (!expiresAt) return false;
  return expiresAt.getTime() <= nowMs() + REFRESH_BUFFER_MS;
}

function oauthCredentialPairs() {
  const { clientId, clientSecret } = resolveGoogleWebClientCredentials();
  if (!clientId || !clientSecret) return [];
  return [{ clientId, clientSecret }];
}

async function refreshAccessToken(refreshToken: string) {
  const pairs = oauthCredentialPairs();
  let lastError = "No valid OAuth client credentials configured.";

  for (const pair of pairs) {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: pair.clientId,
        client_secret: pair.clientSecret,
      }),
    });

    if (response.ok) {
      const payload = (await response.json()) as {
        access_token?: string;
        expires_in?: number;
        refresh_token?: string;
      };
      if (!payload.access_token) {
        lastError = "Refresh response missing access token.";
        continue;
      }
      return {
        ok: true as const,
        accessToken: payload.access_token,
        refreshToken: payload.refresh_token || null,
        expiresIn: Number(payload.expires_in || 3600),
      };
    }

    lastError = await response.text();
    if (response.status !== 401 && response.status !== 400) {
      // Transient/unexpected issues should not burn all credential pairs.
      continue;
    }
  }

  return {
    ok: false as const,
    error: lastError,
  };
}

type PreloadedTokenRow = {
  access_token: string | null;
  refresh_token: string | null;
  expires_at: Date | null;
};

/**
 * A page load fires several endpoints in parallel (status, messages, counts, ...) that each call
 * this for the same account. When the stored token happens to be within REFRESH_BUFFER_MS of
 * expiry, every one of them independently POSTs a refresh_token exchange to Google and writes the
 * result to the same row — wasteful, and occasionally one of the N racing exchanges fails (Google
 * transient error, or the row write racing another). /api/gmail/status has no retry on that
 * failure, so a single lost race reports the whole account as disconnected and the panel's mailbox
 * view collapses to the "reconnect" gate even though the account is fine — the "emails disappear
 * on refresh" bug. Sharing one in-flight refresh across concurrent callers for the same
 * (userId, accountEmail) removes the race instead of papering over it with a retry.
 */
const inFlightRefreshes = new Map<string, Promise<GmailTokenResult>>();

export async function getValidGmailAccessToken(
  userId: string,
  accountEmail: string,
  options?: { forceRefresh?: boolean; preloadedRow?: PreloadedTokenRow }
): Promise<GmailTokenResult> {
  const normalizedEmail = accountEmail.trim().toLowerCase();
  const inFlightKey = `${userId}::${normalizedEmail}`;

  // forceRefresh means "the caller already tried the shared/cached path and it turned out stale
  // (a 401 despite our DB thinking the token was still valid) — bypass whatever's in flight
  // rather than possibly handing back that same stale result to a caller that specifically asked
  // not to get it." Only the common, non-forced path (the vast majority of concurrent callers on
  // a page load) is deduped.
  if (!options?.forceRefresh) {
    const existing = inFlightRefreshes.get(inFlightKey);
    if (existing) return existing;
  }

  const promise = getValidGmailAccessTokenUncached(userId, normalizedEmail, options);
  inFlightRefreshes.set(inFlightKey, promise);
  try {
    return await promise;
  } finally {
    // Only clear if we're still the current entry — a caller that started after this one
    // resolved (e.g. a forceRefresh call that replaced it) may have already replaced it.
    if (inFlightRefreshes.get(inFlightKey) === promise) inFlightRefreshes.delete(inFlightKey);
  }
}

async function getValidGmailAccessTokenUncached(
  userId: string,
  normalizedEmail: string,
  options?: { forceRefresh?: boolean; preloadedRow?: PreloadedTokenRow }
): Promise<GmailTokenResult> {
  const row =
    options?.preloadedRow ??
    (await prisma.platformToken.findUnique({
      where: {
        user_id_platform: {
          user_id: userId,
          platform: `gmail:${normalizedEmail}`,
        },
      },
      select: {
        access_token: true,
        refresh_token: true,
        expires_at: true,
      },
    }));

  if (!row?.access_token) {
    return { ok: false, reason: "account_not_found", message: "Gmail account token not found." };
  }

  const currentAccessToken = decrypt(row.access_token);
  const expiresAt = row.expires_at || null;
  if (!options?.forceRefresh && !isExpiringSoon(expiresAt)) {
    return { ok: true, accessToken: currentAccessToken, expiresAt };
  }

  if (!row.refresh_token) {
    return { ok: false, reason: "no_refresh_token", message: "No refresh token available. Reconnect required." };
  }

  const refreshToken = decrypt(row.refresh_token);
  const refreshed = await refreshAccessToken(refreshToken);
  if (!refreshed.ok) {
    return { ok: false, reason: "refresh_failed", message: `Failed to refresh token: ${refreshed.error}` };
  }

  const nextExpiresAt = new Date(nowMs() + refreshed.expiresIn * 1000);
  await prisma.platformToken.update({
    where: {
      user_id_platform: {
        user_id: userId,
        platform: `gmail:${normalizedEmail}`,
      },
    },
    data: {
      access_token: encrypt(refreshed.accessToken),
      expires_at: nextExpiresAt,
      ...(refreshed.refreshToken ? { refresh_token: encrypt(refreshed.refreshToken) } : {}),
    },
  });

  return { ok: true, accessToken: refreshed.accessToken, expiresAt: nextExpiresAt };
}

