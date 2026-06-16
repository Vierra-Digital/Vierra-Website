import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { sendImageAsset } from "@/lib/api/image";
import { STORAGE_BUCKETS } from "@/lib/storage";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireSession(req, res);
  if (!session) return res.status(401).json({ message: "Not authenticated" });
  const role = (session.user as any)?.role;
  if (role !== "admin" && role !== "staff") return res.status(403).json({ message: "Forbidden" });

  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const user = await prisma.user.findUnique({
      where: { id: Number(userId) },
      select: { imageStorageKey: true, imageMimeType: true },
    });

    if (!user) {
      return res.status(404).json({ message: "No image found" });
    }
    const sent = await sendImageAsset(res, {
      bucket: STORAGE_BUCKETS.avatars,
      storageKey: user.imageStorageKey,
      mimeType: user.imageMimeType,
      cacheControl: "no-cache, no-store, must-revalidate",
    });
    if (!sent) {
      return res.status(404).json({ message: "No image found" });
    }
  } catch (e) {
    console.error("admin/getUserImage", e);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}
