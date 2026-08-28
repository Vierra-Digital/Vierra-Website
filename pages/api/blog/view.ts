import type { NextApiRequest, NextApiResponse } from "next";
import { incrementVisits } from "@/lib/blog";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

/**
 * Records a blog post view: POST { slug } -> increments blog_posts.visits.
 * Called from the post page on mount. A failed count must never surface to the
 * reader, so all errors resolve to a benign 200 { ok: false }.
 *
 * Rate limited per IP per slug. This endpoint is necessarily public and does one database write per
 * call, so without a limit anyone could inflate a post's count arbitrarily and drive unbounded
 * writes. The window doubles as view de-duplication: a reader refreshing or navigating back counts
 * once per half hour rather than once per mount, which makes the number mean something.
 *
 * Over-limit still answers 200 { ok: false } — the same shape as any other failure. The count is
 * not the reader's concern, and a distinct status would only tell a scraper where the ceiling is.
 *
 * The limiter is per-instance and in-memory (see lib/rateLimit), so this is a soft limit under
 * scaled-out concurrency rather than a hard guarantee.
 */
const VIEW_LIMIT = 1;
const VIEW_WINDOW_MS = 30 * 60 * 1000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method Not Allowed" });
  const slug = typeof req.body?.slug === "string" ? req.body.slug : "";
  if (!slug) return res.status(400).json({ message: "Missing slug" });

  if (!checkRateLimit(`blog-view:${getClientIp(req)}:${slug}`, VIEW_LIMIT, VIEW_WINDOW_MS)) {
    return res.status(200).json({ ok: false });
  }

  try {
    await incrementVisits(slug);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("blog view increment failed", e);
    return res.status(200).json({ ok: false });
  }
}
