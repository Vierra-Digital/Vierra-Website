import type { NextApiRequest, NextApiResponse } from "next";
import { notifyIndexNow } from "@/lib/indexnow";
import { createPost, updatePost, deletePost } from "@/lib/blog";

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
      const input = { title, description, content, tag, authorName, date };

      if (req.method === "PUT" && id) {
        const { post, prevSlug } = await updatePost(String(id), input);
        await revalidateBlog(res, [post.slug, prevSlug]);
        await notifyIndexNow(["/blog", `/blog/${post.slug}`]);
        return res.status(200).json({ id: post.id });
      }

      const post = await createPost(input);
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
      const id = typeof req.query.id === "string" ? req.query.id : "";
      if (!id) return res.status(400).json({ message: "Missing id" });
      const deleted = await deletePost(id);
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
