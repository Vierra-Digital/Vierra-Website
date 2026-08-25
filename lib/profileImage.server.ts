import { prisma } from "@/lib/prisma";

/** What every caller falls back to: the client-side fetch backfills the real values. */
const FALLBACK_PROFILE: { name: string | null; imageVersion: number | string } = {
  name: null,
  imageVersion: 0,
};

/**
 * Server-only counterpart to profileImageSrc: looks up the same name/imageVersion
 * that /api/profile/getUser returns, for use in getServerSideProps so the first
 * render already has the real avatar instead of the DefaultAvatar "U" flashing in
 * before the client-side fetch resolves.
 *
 * Never throws. This is a cosmetic prefetch — every page that calls it also fetches
 * the same data client-side, so the worst case of failing here is the avatar flash
 * this exists to avoid. It used to reject, and because /panel, /client and /connect
 * all await it directly in getServerSideProps, one unavailable database took the
 * whole page down with an unhandled PrismaClientInitializationError. Pool exhaustion
 * ("max clients reached in session mode") made that a routine occurrence in dev.
 */
export async function getInitialUserProfile(
  userId: string
): Promise<{ name: string | null; imageVersion: number | string }> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        user_preferences: { select: { image_storage_key: true, image_updated_at: true } },
      },
    });

    if (!user) return FALLBACK_PROFILE;

    const prefs = user.user_preferences;
    const hasImage = Boolean(prefs?.image_storage_key);
    const imageVersion = prefs?.image_updated_at
      ? prefs.image_updated_at.getTime()
      : hasImage
        ? userId
        : 0;

    return { name: user.name, imageVersion };
  } catch (error) {
    // Log once, server-side, then degrade. Callers render with the client fetch filling in.
    console.error("getInitialUserProfile failed; falling back to defaults:", error);
    return FALLBACK_PROFILE;
  }
}
