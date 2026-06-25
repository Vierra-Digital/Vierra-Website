import type { NextApiRequest, NextApiResponse } from "next";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { putImageAsset } from "@/lib/api/image";
import { STORAGE_BUCKETS } from "@/lib/storage";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "50mb",
    },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireRole(req, res, ["admin", "staff"]);
  if (!session) return;

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const { imageData, mimeType, filename } = req.body;

    if (!imageData || !mimeType) {
      return res.status(400).json({ message: "Image data and mime type are required" });
    }

    const imageBuffer = Buffer.from(imageData, "base64");

    // Upload to object storage first so no orphan row is created if the upload fails.
    const storageKey = await putImageAsset(
      STORAGE_BUCKETS.blog,
      `blog/${uuidv4()}`,
      imageBuffer,
      mimeType
    );

    const image = await prisma.blogImage.create({
      data: {
        storage_key: storageKey,
        mime_type: mimeType,
        filename: filename || null,
      },
    });
    const url = `/api/blog/image/${image.id}`;
    return res.status(200).json({ url, id: image.id });
  } catch (e) {
    console.error("blog/admin/uploadImage", e);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}
