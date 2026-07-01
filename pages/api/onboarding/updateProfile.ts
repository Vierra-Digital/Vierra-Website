import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { putImageAsset } from "@/lib/api/image";
import { STORAGE_BUCKETS } from "@/lib/storage";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method Not Allowed" });

  const { token, name, imageData, mimeType } = req.body ?? {};
  if (!token || typeof token !== "string") {
    return res.status(400).json({ message: "Missing or invalid token" });
  }

  try {
    const session = await prisma.onboardingSession.findUnique({ where: { id: token } });
    if (!session) return res.status(404).json({ message: "Session not found" });

    const data: { name?: string; image_storage_key?: string; image_mime_type?: string } = {};

    if (typeof name === "string" && name.trim()) {
      data.name = name.trim();
    }

    if (imageData && mimeType) {
      const imageBuffer = Buffer.from(imageData, "base64");
      data.image_storage_key = await putImageAsset(
        STORAGE_BUCKETS.avatars,
        `client/${session.client_id}`,
        imageBuffer,
        mimeType
      );
      data.image_mime_type = mimeType;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    const client = await prisma.client.update({
      where: { id: session.client_id },
      data,
      select: { name: true },
    });

    return res.status(200).json({ name: client.name });
  } catch (err) {
    console.error("Failed to update onboarding profile:", err);
    return res.status(500).json({ message: "Failed to update profile" });
  }
}
