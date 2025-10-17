import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

function slugify(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST" || req.method === "PUT") {
    try {
      const { id, title, description, content, date, tag, authorName, isTest } = req.body || {};
      const published_date = date ? new Date(date) : new Date();
      // Author has unique email in schema; use upsert via find/create by name
      const existingAuthor = await prisma.author.findFirst({ where: { name: authorName || "Unknown" } })
      const author = existingAuthor ?? (await prisma.author.create({ data: { name: authorName || "Unknown" } }))

      const baseSlug = slugify(String(title || "untitled"));
      const slug = isTest ? `test-${baseSlug}-${Date.now()}` : baseSlug;

      if (req.method === "PUT" && id) {
        const post = await prisma.blogPost.update({
          where: { id: Number(id) },
          data: {
            title,
            description,
            content,
            tag,
            author_id: author.id,
            published_date,
            is_test: Boolean(isTest),
            slug,
          },
        });
        return res.status(200).json({ id: post.id });
      }

      const post = await prisma.blogPost.create({
        data: {
          title,
          description,
          content,
          tag,
          author_id: author.id,
          published_date,
          is_test: Boolean(isTest),
          slug,
        },
      });

      // Cleanup: when a test post is created, remove any test posts older than 24 hours
      if (isTest) {
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
        try {
          await prisma.blogPost.deleteMany({
            where: { is_test: true, published_date: { lt: cutoff } },
          })
        } catch (e) {
          console.warn("test post cleanup failed", e)
        }
      }

      // For test posts, return a temporary link (24h implied by a note; not enforced here)
      const link = isTest ? `/blog/test/${post.slug}` : `/blog/${post.slug}`;
      return res.status(200).json({ id: post.id, link, isTest: Boolean(isTest) });
    } catch (e) {
      console.error("blog admin post", e);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  }

  if (req.method === "DELETE") {
    try {
      const id = Number(req.query.id);
      if (!id) return res.status(400).json({ message: "Missing id" });
      await prisma.blogPost.delete({ where: { id } });
      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error("blog admin delete", e);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  }

  return res.status(405).json({ message: "Method Not Allowed" });
}
