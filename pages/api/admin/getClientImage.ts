import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { sendImageAsset } from "@/lib/api/image";
import { STORAGE_BUCKETS } from "@/lib/storage";

export default withAuth(
  async (req, res) => {
    const { clientId } = req.query;

    if (!clientId) {
      return res.status(400).json({ message: "Client ID is required" });
    }

    const client = await prisma.client.findUnique({
      where: { id: String(clientId) },
      select: { image_storage_key: true, image_mime_type: true },
    });

    if (!client) {
      return res.status(404).json({ message: "No image found" });
    }
    const sent = await sendImageAsset(res, {
      bucket: STORAGE_BUCKETS.avatars,
      storageKey: client.image_storage_key,
      mimeType: client.image_mime_type,
      cacheControl: "no-cache, no-store, must-revalidate",
    });
    if (!sent) {
      return res.status(404).json({ message: "No image found" });
    }
  },
  { methods: ["GET"], roles: ["admin", "staff"] }
);
