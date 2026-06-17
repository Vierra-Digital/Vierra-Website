import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireRole(req, res);
  if (!session) return;

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
      select: { id: true, name: true, email: true, imageStorageKey: true, imageUpdatedAt: true, position: true, role: true },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { imageStorageKey, ...rest } = user;
    const hasImage = Boolean(imageStorageKey);
    const imageVersion = user.imageUpdatedAt
      ? user.imageUpdatedAt.getTime()
      : hasImage
        ? user.id
        : 0;

    return res.status(200).json({ ...rest, hasImage, imageVersion });
  } catch (e) {
    console.error("profile/getUser", e);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}
