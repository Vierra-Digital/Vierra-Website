import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { decodeBase64Image, putImageAsset } from "@/lib/api/image";
import { STORAGE_BUCKETS } from "@/lib/storage";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireRole(req, res, ["admin"]);
  if (!session) return;

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const { userId, imageData, mimeType } = req.body;

    if (!userId || !imageData || !mimeType) {
      return res.status(400).json({ message: "User ID, image data and mime type are required" });
    }
    const imageBuffer = decodeBase64Image(imageData);
    const storageKey = await putImageAsset(
      STORAGE_BUCKETS.avatars,
      `user/${userId}`,
      imageBuffer,
      mimeType
    );
    await prisma.userPreference.upsert({
      where: { user_id: String(userId) },
      create: {
        user_id: String(userId),
        image_storage_key: storageKey,
        image_mime_type: mimeType,
        image_updated_at: new Date(),
      },
      update: {
        image_storage_key: storageKey,
        image_mime_type: mimeType,
        image_updated_at: new Date(),
      },
    });
    const updated = await prisma.user.findUnique({
      where: { id: String(userId) },
      select: { id: true, name: true, email: true },
    });

    return res.status(200).json(updated);
  } catch (e) {
    console.error("admin/uploadUserImage", e);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}
