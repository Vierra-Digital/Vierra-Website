import type { NextApiRequest, NextApiResponse } from "next";
import { incrementVisits } from "@/lib/blog";

/**
 * Records a blog post view: POST { slug } -> increments blog_posts.visits.
 * Called from the post page on mount. A failed count must never surface to the
 * reader, so all errors resolve to a benign 200 { ok: false }.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method Not Allowed" });
  const slug = typeof req.body?.slug === "string" ? req.body.slug : "";
  if (!slug) return res.status(400).json({ message: "Missing slug" });
  try {
    await incrementVisits(slug);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("blog view increment failed", e);
    return res.status(200).json({ ok: false });
  }
}
