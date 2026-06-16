import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { sendImageAsset } from "@/lib/api/image";
import { STORAGE_BUCKETS } from "@/lib/storage";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const { id } = req.query;
    if (!id || typeof id !== "string") {
      return res.status(400).json({ message: "Image ID is required" });
    }

    const image = await prisma.blogImage.findUnique({
      where: { id },
      select: { storageKey: true, mimeType: true },
    });

    if (!image) {
      return res.status(404).json({ message: "Image not found" });
    }

    const sent = await sendImageAsset(res, {
      bucket: STORAGE_BUCKETS.blog,
      storageKey: image.storageKey,
      mimeType: image.mimeType,
      cacheControl: "public, max-age=31536000, immutable",
    });
    if (!sent) {
      return res.status(404).json({ message: "Image not found" });
    }
  } catch (e) {
    console.error("blog/image/[id]", e);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}
