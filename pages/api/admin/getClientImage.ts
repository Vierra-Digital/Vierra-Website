import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireSession(req, res);
  if (!session) return res.status(401).json({ message: "Not authenticated" });
  const role = (session.user as any)?.role;
  if (role !== "admin" && role !== "staff") return res.status(403).json({ message: "Forbidden" });

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
      select: { image: true, imageMimeType: true },
    });

    if (!client || !client.image) {
      return res.status(404).json({ message: "No image found" });
    }
    const imageBuffer = Buffer.from(client.image);
    res.setHeader('Content-Type', client.imageMimeType || 'image/jpeg');
    res.setHeader('Content-Length', imageBuffer.length);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate'); // Prevent caching
    res.end(imageBuffer);
  } catch (e) {
    console.error("admin/getClientImage", e);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}
