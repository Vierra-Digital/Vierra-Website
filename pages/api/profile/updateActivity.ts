import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireSession(req, res);
  if (!session) return res.status(401).json({ message: "Not authenticated" });

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const userEmail = (session.user as any)?.email;
    if (!userEmail) {
      return res.status(400).json({ message: "User email not found in session" });
    }

    const { status } = req.body;
    
    // Validate status
    if (status && !["online", "offline", "away", "busy"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const updateData: any = {
      lastActiveAt: new Date(),
    };
    
    if (status) {
      updateData.status = status;
    }

    const updated = await prisma.user.update({
      where: { email: userEmail },
      data: updateData,
      select: { 
        id: true,
        name: true,
        email: true,
        status: true,
        lastActiveAt: true
      },
    });

    return res.status(200).json(updated);
  } catch (e) {
    console.error("profile/updateActivity", e);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}
