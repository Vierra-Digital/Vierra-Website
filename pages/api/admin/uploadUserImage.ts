import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

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
    const { userId, imageData, mimeType } = req.body;
    
    if (!userId || !imageData || !mimeType) {
      return res.status(400).json({ message: "User ID, image data and mime type are required" });
    }
    const imageBuffer = Buffer.from(imageData, 'base64');
    const updated = await prisma.user.update({
      where: { id: Number(userId) },
      data: { 
        image: imageBuffer,
        imageMimeType: mimeType
      },
      select: { id: true, name: true, email: true },
    });

    return res.status(200).json(updated);
  } catch (e) {
    console.error("admin/uploadUserImage", e);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}
