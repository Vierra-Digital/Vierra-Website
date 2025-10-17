import { NextApiRequest, NextApiResponse } from "next"
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";




export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ message: "Method Not Allowed" });
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const skip = (page - 1) * limit;
    const includeTests = req.query.includeTests === '1';
    const where: Prisma.BlogPostWhereInput = includeTests ? {} : { is_test: false };
    const posts = await prisma.blogPost.findMany({
      where,
      orderBy: { published_date: "desc" },
      skip,
      take: limit,
      include: { author: true },
    });
    res.status(200).json({ posts });
  } catch (e) {
    console.error("blog posts", e);
    res.status(500).json({ message: "Internal Server Error" });
  }
}



