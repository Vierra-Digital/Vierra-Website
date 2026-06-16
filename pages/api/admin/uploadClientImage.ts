import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
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
  const session = await requireSession(req, res);
  if (!session) return res.status(401).json({ message: "Not authenticated" });
  const role = (session.user as any)?.role;
  if (role !== "admin") return res.status(403).json({ message: "Forbidden" });

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const { clientId, imageData, mimeType } = req.body;
    
    if (!clientId || !imageData || !mimeType) {
      return res.status(400).json({ message: "Client ID, image data and mime type are required" });
    }
    const imageBuffer = decodeBase64Image(imageData);
    const storageKey = await putImageAsset(
      STORAGE_BUCKETS.avatars,
      `client/${String(clientId)}`,
      imageBuffer,
      mimeType
    );
    const updated = await prisma.client.update({
      where: { id: String(clientId) },
      data: {
        imageStorageKey: storageKey,
        imageMimeType: mimeType
      },
      select: { id: true, name: true, email: true, businessName: true },
    });

    return res.status(200).json(updated);
  } catch (e) {
    console.error("admin/uploadClientImage", e);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}
