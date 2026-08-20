import { prisma } from "@/lib/prisma";

/**
 * Server-only counterpart to profileImageSrc: looks up the same name/imageVersion
 * that /api/profile/getUser returns, for use in getServerSideProps so the first
 * render already has the real avatar instead of the DefaultAvatar "U" flashing in
 * before the client-side fetch resolves.
 */
export async function getInitialUserProfile(
  userId: string
): Promise<{ name: string | null; imageVersion: number | string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      user_preferences: { select: { image_storage_key: true, image_updated_at: true } },
    },
  });

  if (!user) return { name: null, imageVersion: 0 };

  const prefs = user.user_preferences;
  const hasImage = Boolean(prefs?.image_storage_key);
  const imageVersion = prefs?.image_updated_at
    ? prefs.image_updated_at.getTime()
    : hasImage
      ? userId
      : 0;

  return { name: user.name, imageVersion };
}
