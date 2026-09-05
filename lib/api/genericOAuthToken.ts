import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { decrypt, encrypt } from "@/lib/crypto";

/**
 * Provider-agnostic version of lib/gmail/tokens.ts's refresh-on-expiry pattern, for the
 * Zoom/Teams connections added in Phase 2 (see lib/zoom/tokens.ts, lib/msteams/tokens.ts).
 * Gmail's own helper is left untouched/duplicated rather than rebuilt on top of this — it's
 * a working, well-exercised code path and not worth the risk of a shared-abstraction refactor.
 */
export type PlatformTokenResult =
  | { ok: true; accessToken: string; expiresAt: Date | null }
  | { ok: false; reason: "account_not_found" | "no_refresh_token" | "refresh_failed"; message: string };

export type RefreshResult =
  | { ok: true; accessToken: string; refreshToken: string | null; expiresIn: number }
  | { ok: false; error: string };

const REFRESH_BUFFER_MS = 60 * 1000;

/** Find the first PlatformToken row for a user whose platform key starts with `prefix` (e.g. "zoom:"). */
export async function findPlatformTokenByPrefix(userId: string, prefix: string) {
  return prisma.platformToken.findFirst({
    where: { user_id: userId, platform: { startsWith: prefix } },
    select: { platform: true, access_token: true, refresh_token: true, expires_at: true, meta: true },
  });
}

export async function getValidPlatformAccessToken(
  userId: string,
  platform: string,
  refresh: (refreshToken: string) => Promise<RefreshResult>
): Promise<PlatformTokenResult> {
  const row = await prisma.platformToken.findUnique({
    where: { user_id_platform: { user_id: userId, platform } },
    select: { access_token: true, refresh_token: true, expires_at: true },
  });
  if (!row?.access_token) return { ok: false, reason: "account_not_found", message: `${platform} token not found.` };

  const currentAccessToken = decrypt(row.access_token);
  const expiresAt = row.expires_at || null;
  const expiringSoon = expiresAt ? expiresAt.getTime() <= Date.now() + REFRESH_BUFFER_MS : false;
  if (!expiringSoon) return { ok: true, accessToken: currentAccessToken, expiresAt };

  if (!row.refresh_token) return { ok: false, reason: "no_refresh_token", message: "No refresh token available. Reconnect required." };
  const refreshed = await refresh(decrypt(row.refresh_token));
  if (!refreshed.ok) return { ok: false, reason: "refresh_failed", message: `Failed to refresh token: ${refreshed.error}` };

  const nextExpiresAt = new Date(Date.now() + refreshed.expiresIn * 1000);
  await prisma.platformToken.update({
    where: { user_id_platform: { user_id: userId, platform } },
    data: {
      access_token: encrypt(refreshed.accessToken),
      expires_at: nextExpiresAt,
      ...(refreshed.refreshToken ? { refresh_token: encrypt(refreshed.refreshToken) } : {}),
    },
  });
  return { ok: true, accessToken: refreshed.accessToken, expiresAt: nextExpiresAt };
}

/** Merge keys into a PlatformToken's `meta` JSON without clobbering unrelated flags. */
export async function mergePlatformTokenMeta(userId: string, platform: string, patch: Record<string, unknown>) {
  const row = await prisma.platformToken.findUnique({ where: { user_id_platform: { user_id: userId, platform } }, select: { meta: true } });
  const nextMeta = { ...((row?.meta as Record<string, unknown> | null) || {}), ...patch };
  await prisma.platformToken
    .update({ where: { user_id_platform: { user_id: userId, platform } }, data: { meta: nextMeta as Prisma.InputJsonValue } })
    .catch(() => {});
}
