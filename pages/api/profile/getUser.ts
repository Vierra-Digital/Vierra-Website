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
      select: {
        id: true,
        name: true,
        email: true,
        user_preferences: { select: { image_storage_key: true, image_updated_at: true } },
        company_memberships_company_memberships_user_idTousers: { select: { role: true, position: true } },
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const prefs = user.user_preferences;
    const membership = user.company_memberships_company_memberships_user_idTousers;
    const hasImage = Boolean(prefs?.image_storage_key);
    const imageVersion = prefs?.image_updated_at
      ? prefs.image_updated_at.getTime()
      : hasImage
        ? user.id
        : 0;

    return res.status(200).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: membership?.role ?? null,
      position: membership?.position ?? null,
      hasImage,
      imageVersion,
    });
  } catch (e) {
    console.error("profile/getUser", e);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}
