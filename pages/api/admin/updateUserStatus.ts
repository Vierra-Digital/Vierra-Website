import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireSession(req, res);
  if (!session) return res.status(401).json({ message: "Not authenticated" });
  const role = (session.user as any)?.role;
  if (role !== "admin" && role !== "staff") return res.status(403).json({ message: "Forbidden" });

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    // Get all users with their lastActiveAt timestamps
    const users = await prisma.user.findMany({
      select: {
        id: true,
        lastActiveAt: true,
        status: true,
      },
    });

    const now = new Date();
    const updates = [];

    for (const user of users) {
      if (!user.lastActiveAt) {
        // If no lastActiveAt, set status to offline
        if (user.status !== "offline") {
          updates.push({ id: user.id, status: "offline" });
        }
        continue;
      }

      const lastActive = new Date(user.lastActiveAt);
      const diffMinutes = (now.getTime() - lastActive.getTime()) / (1000 * 60);
      
      let newStatus = "offline";
      if (diffMinutes <= 10) {
        newStatus = "online";
      } else if (diffMinutes <= 30) {
        newStatus = "away";
      }

      // Only update if status has changed
      if (user.status !== newStatus) {
        updates.push({ id: user.id, status: newStatus });
      }
    }

    // Batch update all users whose status needs to change
    if (updates.length > 0) {
      await Promise.all(
        updates.map(update =>
          prisma.user.update({
            where: { id: update.id },
            data: { status: update.status },
          })
        )
      );
    }

    return res.status(200).json({ 
      message: "Status updated successfully", 
      updatedCount: updates.length 
    });
  } catch (e) {
    console.error("admin/updateUserStatus", e);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}
