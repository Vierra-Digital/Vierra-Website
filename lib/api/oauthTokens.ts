import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { invalidateAccessibleAccountsCache } from "@/lib/email/mailboxAccess";

interface PersistTokenInput {
  platform: string;
  /** Raw (unencrypted) access token; encrypted here before storage. */
  accessToken: string;
  /** Raw refresh token, if the provider returned one. */
  refreshToken?: string | null;
  expiresAt?: Date | null;
  /** Per-connection flags (Workspace detection, attendance-report availability, etc). Replaces any existing value. */
  meta?: Record<string, unknown> | null;
}

/**
 * Store/refresh a connected platform's OAuth tokens for a logged-in user.
 * Centralizes the encrypt + conditional-field + upsert pattern that each OAuth
 * callback (gmail/facebook/googleads/linkedin) was repeating verbatim.
 */
export async function persistPlatformToken(userId: string, input: PersistTokenInput) {
  const access_token = encrypt(input.accessToken);
  const refresh_token = input.refreshToken ? encrypt(input.refreshToken) : undefined;
  const data = {
    access_token,
    ...(refresh_token && { refresh_token }),
    ...(input.expiresAt && { expires_at: input.expiresAt }),
    // Prisma's nullable Json fields require the Prisma.JsonNull sentinel to write SQL NULL —
    // a raw `null` here is ambiguous with "field not provided" and isn't a valid Json input.
    ...(input.meta !== undefined && { meta: (input.meta === null ? Prisma.JsonNull : (input.meta as Prisma.InputJsonValue)) }),
  };
  await prisma.platformToken.upsert({
    where: { user_id_platform: { user_id: userId, platform: input.platform } },
    update: data,
    create: { user_id: userId, platform: input.platform, ...data },
  });
  // A newly-connected (or reconnected) Gmail account changes what getAccessibleGmailAccounts
  // returns for this user — drop the cached list so it shows up immediately, not after its TTL.
  if (input.platform.startsWith("gmail:")) invalidateAccessibleAccountsCache(userId);
}

/** Same as persistPlatformToken, but for the pre-account onboarding flow. */
export async function persistOnboardingPlatformToken(sessionId: string, input: PersistTokenInput) {
  const access_token = encrypt(input.accessToken);
  const refresh_token = input.refreshToken ? encrypt(input.refreshToken) : undefined;
  const data = {
    access_token,
    ...(refresh_token && { refresh_token }),
    ...(input.expiresAt && { expires_at: input.expiresAt }),
  };
  await prisma.onboardingPlatformToken.upsert({
    where: { session_id_platform: { session_id: sessionId, platform: input.platform } },
    update: data,
    create: { session_id: sessionId, platform: input.platform, ...data },
  });
}
