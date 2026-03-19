import { prisma } from "@/lib/prisma";
import { decrypt, encrypt } from "@/lib/crypto";

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
  const pairs = [
    {
      clientId: process.env.GOOGLE_GMAIL_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_GMAIL_CLIENT_SECRET || "",
    },
    {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    },
  ].filter((pair) => pair.clientId && pair.clientSecret);
  return pairs;
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

export async function getValidGmailAccessToken(
  userId: number,
  accountEmail: string,
  options?: { forceRefresh?: boolean }
): Promise<GmailTokenResult> {
  const normalizedEmail = accountEmail.trim().toLowerCase();
  const row = await prisma.userToken.findUnique({
    where: {
      userId_platform: {
        userId,
        platform: `gmail:${normalizedEmail}`,
      } as any,
    },
    select: {
      accessToken: true,
      refreshToken: true,
      expiresAt: true,
    },
  });

  if (!row?.accessToken) {
    return { ok: false, reason: "account_not_found", message: "Gmail account token not found." };
  }

  const currentAccessToken = decrypt(row.accessToken);
  const expiresAt = row.expiresAt || null;
  if (!options?.forceRefresh && !isExpiringSoon(expiresAt)) {
    return { ok: true, accessToken: currentAccessToken, expiresAt };
  }

  if (!row.refreshToken) {
    return { ok: false, reason: "no_refresh_token", message: "No refresh token available. Reconnect required." };
  }

  const refreshToken = decrypt(row.refreshToken);
  const refreshed = await refreshAccessToken(refreshToken);
  if (!refreshed.ok) {
    return { ok: false, reason: "refresh_failed", message: `Failed to refresh token: ${refreshed.error}` };
  }

  const nextExpiresAt = new Date(nowMs() + refreshed.expiresIn * 1000);
  await prisma.userToken.update({
    where: {
      userId_platform: {
        userId,
        platform: `gmail:${normalizedEmail}`,
      } as any,
    },
    data: {
      accessToken: encrypt(refreshed.accessToken),
      expiresAt: nextExpiresAt,
      ...(refreshed.refreshToken ? { refreshToken: encrypt(refreshed.refreshToken) } : {}),
    },
  });

  return { ok: true, accessToken: refreshed.accessToken, expiresAt: nextExpiresAt };
}

