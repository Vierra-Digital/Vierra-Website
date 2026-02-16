import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireSession(req, res);
  if (!session) return res.status(401).json({ message: "Not authenticated" });

  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const userEmail = (session.user as any)?.email;
    if (!userEmail) {
      return res.status(400).json({ message: "User email not found in session" });
    }

    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      select: { image: true, imageMimeType: true },
    });

    if (!user || !user.image) {
      return res.status(404).json({ message: "No image found" });
    }
    const imageBuffer = Buffer.from(user.image);
    res.setHeader('Content-Type', user.imageMimeType || 'image/jpeg');
    res.setHeader('Content-Length', imageBuffer.length);
    res.setHeader('Cache-Control', 'private, max-age=3600, stale-while-revalidate=86400');
    res.end(imageBuffer);
  } catch (e) {
    console.error("profile/getImage", e);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}
