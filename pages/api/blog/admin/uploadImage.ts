import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "50mb",
    },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireSession(req, res);
  if (!session) return res.status(401).json({ message: "Not authenticated" });
  const role = (session.user as any)?.role;
  if (role !== "admin" && role !== "staff")
    return res.status(403).json({ message: "Forbidden" });

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const { imageData, mimeType, filename } = req.body;

    if (!imageData || !mimeType) {
      return res.status(400).json({ message: "Image data and mime type are required" });
    }

    const imageBuffer = Buffer.from(imageData, "base64");

    const image = await prisma.blogImage.create({
      data: {
        data: imageBuffer,
        mimeType,
        filename: filename || null,
      },
    });

    // Return the permanent URL for this image
    const url = `/api/blog/image/${image.id}`;
    return res.status(200).json({ url, id: image.id });
  } catch (e) {
    console.error("blog/admin/uploadImage", e);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}
