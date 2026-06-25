import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { sendImageAsset } from "@/lib/api/image";
import { STORAGE_BUCKETS } from "@/lib/storage";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireRole(req, res, ["admin", "staff"]);
  if (!session) return;

  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
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
  } catch (e) {
    console.error("admin/getClientImage", e);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}
