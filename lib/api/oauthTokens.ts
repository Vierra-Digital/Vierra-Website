import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";

interface PersistTokenInput {
  platform: string;
  /** Raw (unencrypted) access token; encrypted here before storage. */
  accessToken: string;
  /** Raw refresh token, if the provider returned one. */
  refreshToken?: string | null;
  expiresAt?: Date | null;
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
  };
  await prisma.platformToken.upsert({
    where: { user_id_platform: { user_id: userId, platform: input.platform } },
    update: data,
    create: { user_id: userId, platform: input.platform, ...data },
  });
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
