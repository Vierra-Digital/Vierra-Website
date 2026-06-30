import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { sendImageAsset } from "@/lib/api/image";
import { STORAGE_BUCKETS } from "@/lib/storage";

export default withAuth(
  async (req, res) => {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const user = await prisma.user.findUnique({
      where: { id: String(userId) },
      include: { user_preferences: { select: { image_storage_key: true, image_mime_type: true } } },
    });

    if (!user) {
      return res.status(404).json({ message: "No image found" });
    }
    const sent = await sendImageAsset(res, {
      bucket: STORAGE_BUCKETS.avatars,
      storageKey: user.user_preferences?.image_storage_key ?? null,
      mimeType: user.user_preferences?.image_mime_type ?? null,
      cacheControl: "no-cache, no-store, must-revalidate",
    });
    if (!sent) {
      return res.status(404).json({ message: "No image found" });
    }
  },
  { methods: ["GET"], roles: ["admin", "staff"] }
);
