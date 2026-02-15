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
      select: { id: true, name: true, email: true, imageUpdatedAt: true },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const hasImageResult = await prisma.$queryRaw<[{ hasImage: boolean }]>`
      SELECT (image IS NOT NULL AND octet_length(image) > 0) as "hasImage"
      FROM users WHERE email = ${userEmail} LIMIT 1
    `;
    const hasImage = hasImageResult[0]?.hasImage ?? false;
    // Use imageUpdatedAt timestamp for cache busting; fallback to user id for existing images (unique per user)
    const imageVersion = user.imageUpdatedAt
      ? user.imageUpdatedAt.getTime()
      : hasImage
        ? user.id
        : 0;

    return res.status(200).json({ ...user, hasImage, imageVersion });
  } catch (e) {
    console.error("profile/getUser", e);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}
