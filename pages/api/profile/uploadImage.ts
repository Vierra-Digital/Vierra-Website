import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { putImageAsset } from "@/lib/api/image";
import { STORAGE_BUCKETS } from "@/lib/storage";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireRole(req, res);
  if (!session) return;

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const userEmail = (session.user as any)?.email;
    if (!userEmail) {
      return res.status(400).json({ message: "User email not found in session" });
    }
    const existingUser = await prisma.user.findUnique({
      where: { email: userEmail },
      select: { id: true, name: true, email: true },
    });

    if (!existingUser) {
      return res.status(404).json({ message: "User not found" });
    }
    const { imageData, mimeType } = req.body;
    if (imageData === null && mimeType === null) {
      const updated = await prisma.user.update({
        where: { email: userEmail },
        data: {
          imageStorageKey: null,
          imageMimeType: null,
          imageUpdatedAt: null
        },
        select: { id: true, name: true, email: true },
      });

      return res.status(200).json(updated);
    }
    
    if (!imageData || !mimeType) {
      return res.status(400).json({ message: "Image data and mime type are required" });
    }
    const imageBuffer = Buffer.from(imageData, 'base64');
    const storageKey = await putImageAsset(
      STORAGE_BUCKETS.avatars,
      `user/${existingUser.id}`,
      imageBuffer,
      mimeType
    );
    const updated = await prisma.user.update({
      where: { email: userEmail },
      data: {
        imageStorageKey: storageKey,
        imageMimeType: mimeType,
        imageUpdatedAt: new Date()
      },
      select: { id: true, name: true, email: true },
    });

    return res.status(200).json(updated);
  } catch (e) {
    console.error("profile/uploadImage", e);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}
