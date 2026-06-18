import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { notifyIndexNow } from "@/lib/indexnow";

function slugify(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/**
 * On-demand ISR revalidation: regenerate the affected blog post page(s) immediately
 * so a newly published/edited post is live at once (no 404 window, no waiting for the
 * 60s revalidate). Best-effort — a revalidation failure must not fail the write.
 */
async function revalidateBlog(res: NextApiResponse, slugs: Array<string | null | undefined>) {
  const unique = Array.from(new Set(slugs.filter((s): s is string => Boolean(s))));
  await Promise.all(
    unique.map((s) =>
      res.revalidate(`/blog/${s}`).catch((e) => console.warn(`revalidate /blog/${s} failed`, e))
    )
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST" || req.method === "PUT") {
    try {
      const { id, title, description, content, date, tag, authorName } = req.body || {};
      const published_date = date ? new Date(date) : new Date();
      const existingAuthor = await prisma.author.findFirst({ where: { name: authorName || "Unknown" } })
      const author = existingAuthor ?? (await prisma.author.create({ data: { name: authorName || "Unknown" } }))

      const slug = slugify(String(title || "untitled"));

      if (req.method === "PUT" && id) {
        // Capture the previous slug so we can also revalidate the old URL if the title/slug changed.
        const prev = await prisma.blogPost.findUnique({ where: { id: Number(id) }, select: { slug: true } });
        const post = await prisma.blogPost.update({
          where: { id: Number(id) },
          data: {
            title,
            description,
            content,
            tag,
            author_id: author.id,
            published_date,
            updated_date: new Date(),
            slug,
          },
        });
        await revalidateBlog(res, [post.slug, prev?.slug]);
        await notifyIndexNow(["/blog", `/blog/${post.slug}`]);
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
          slug,
        },
      });

      await revalidateBlog(res, [post.slug]);
      await notifyIndexNow(["/blog", `/blog/${post.slug}`]);
      return res.status(200).json({ id: post.id, link: `/blog/${post.slug}` });
    } catch (e) {
      console.error("blog admin post", e);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  }

  if (req.method === "DELETE") {
    try {
      const id = Number(req.query.id);
      if (!id) return res.status(400).json({ message: "Missing id" });
      const deleted = await prisma.blogPost.delete({ where: { id }, select: { slug: true } });
      // Regenerate the (now-removed) page so it correctly serves a 404 going forward.
      await revalidateBlog(res, [deleted.slug]);
      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error("blog admin delete", e);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  }

  return res.status(405).json({ message: "Method Not Allowed" });
}
