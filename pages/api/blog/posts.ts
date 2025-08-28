import { NextApiRequest, NextApiResponse } from "next"
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
    const { page = "1", limit = "6", search = "", sortBy = "latest" } = req.query;

    const pageNum = parseInt(page as string, 10);
    const pageLimit = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * pageLimit;

    let orderBy: any = { published_date: "desc" };
    if (sortBy === "trending") orderBy = { visits: "desc" };

    const where: Prisma.BlogPostWhereInput = search
      ? {
          OR: [
            { title: { contains: search as string, mode: "insensitive" } },
            { content: { contains: search as string, mode: "insensitive" } },
          ],
        }
      : {};

    const total = await prisma.blogPost.count({ where });

    const posts = await prisma.blogPost.findMany({
      where,
      orderBy,
      skip,
      take: pageLimit,
      include: {
        author: true,
      },
    });

    res.status(200).json({ posts, total });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}