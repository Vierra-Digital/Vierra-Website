import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { sendImageAsset } from "@/lib/api/image";
import { STORAGE_BUCKETS } from "@/lib/storage";

export default withAuth(
  async (req, res, session) => {
    const userEmail = (session.user as any)?.email;
    if (!userEmail) {
      return res.status(400).json({ message: "User email not found in session" });
    }

    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      select: {
        user_preferences: { select: { image_storage_key: true, image_mime_type: true } },
      },
    });

    if (!user) {
      return res.status(404).json({ message: "No image found" });
    }
    const prefs = user.user_preferences;
    const sent = await sendImageAsset(res, {
      bucket: STORAGE_BUCKETS.avatars,
      storageKey: prefs?.image_storage_key ?? null,
      mimeType: prefs?.image_mime_type ?? null,
      cacheControl: "private, max-age=3600, stale-while-revalidate=86400",
    });
    if (!sent) {
      return res.status(404).json({ message: "No image found" });
    }
  },
  { methods: ["GET"] }
);
