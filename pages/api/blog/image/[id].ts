import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

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
      select: { data: true, mimeType: true },
    });

    if (!image || !image.data) {
      return res.status(404).json({ message: "Image not found" });
    }

    const imageBuffer = Buffer.from(image.data);

    res.setHeader("Content-Type", image.mimeType || "image/jpeg");
    res.setHeader("Content-Length", imageBuffer.length);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.end(imageBuffer);
  } catch (e) {
    console.error("blog/image/[id]", e);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}
