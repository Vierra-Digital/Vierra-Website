import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireSession(req, res);
  if (!session) return res.status(401).json({ message: "Not authenticated" });

  if (req.method !== "PUT") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { name } = req.body ?? {};
  
  if (typeof name !== "string") {
    return res.status(400).json({ message: "Name must be a string" });
  }

  try {
    const userEmail = (session.user as any)?.email;
    if (!userEmail) {
      return res.status(400).json({ message: "User email not found in session" });
    }

    // First check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: userEmail },
      select: { id: true, name: true, email: true },
    });

    if (!existingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const updated = await prisma.user.update({
      where: { email: userEmail },
      data: { name: name.trim() || null },
      select: { id: true, name: true, email: true },
    });

    return res.status(200).json(updated);
  } catch (e) {
    console.error("profile/updateName", e);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}
