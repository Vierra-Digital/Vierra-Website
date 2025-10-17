import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ message: "Method Not Allowed" });

  try {
    const [users, clients, sessions, blogPosts] = await Promise.all([
      prisma.user.count(),
      prisma.client.count(),
      prisma.onboardingSession.count(),
      prisma.blogPost.count().catch(() => 0),
    ]);

    return res.status(200).json({ users, clients, sessions, blogPosts });
  } catch (e) {
    console.error("systemStats error", e);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}


