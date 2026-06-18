import type { NextApiRequest, NextApiResponse } from "next";
import {
  getStaticPageMarkdown,
  getBlogPostMarkdown,
  getBlogIndexMarkdown,
  getTagMarkdown,
  getAuthorMarkdown,
  getLlmsTxt,
} from "@/lib/markdownMirror";

/**
 * Markdown mirror handler.
 *
 * Reached via the `.md` rewrite in middleware.ts. Resolves the underlying
 * route and returns a `text/markdown` representation of that content page.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).send("Method Not Allowed");
    return;
  }

  // The page identity is carried in the `x-md-path` request header (set by
  // middleware). Without this, Netlify's edge caches every `.md` URL under the
  // single `/api/md` key and serves whichever page was requested first to all
  // of them. Varying on the header makes the header part of the cache key.
  res.setHeader("Vary", "x-md-path");

  // The route is provided by middleware via the `x-md-path` request header
  // (e.g. "blog/my-post"). Fall back to the `path` query param or the dynamic
  // catch-all segments when the handler is hit directly.
  const headerPath = req.headers["x-md-path"];
  const pathStr =
    (typeof headerPath === "string" ? headerPath : undefined) ??
    (typeof req.query.path === "string" ? req.query.path : undefined);
  const raw = req.query.slug;
  const segments = pathStr
    ? pathStr.split("/").filter(Boolean)
    : Array.isArray(raw)
      ? raw
      : raw
        ? [raw]
        : [];
  const decoded = segments.map((s) => decodeURIComponent(s));

  // /llms.txt — index of mirrors. Served as plain text and kept indexable so
  // crawlers and AI tools can discover it.
  if (decoded[0] === "__llms__") {
    try {
      const body = await getLlmsTxt();
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400");
      res.status(200).send(body.endsWith("\n") ? body : `${body}\n`);
    } catch (error) {
      console.error("llms.txt error:", error);
      res.status(500).send("Failed to generate llms.txt\n");
    }
    return;
  }

  // The Markdown mirrors duplicate the canonical HTML pages, so keep them out
  // of search indexes while remaining fetchable by agents.
  res.setHeader("X-Robots-Tag", "noindex");

  try {
    const markdown = await resolve(decoded);
    if (markdown == null) {
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.status(404).send("# 404 — Not Found\n\nNo Markdown mirror exists for this page.\n");
      return;
    }

    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader(
      "Cache-Control",
      "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400"
    );
    res.status(200).send(markdown.endsWith("\n") ? markdown : `${markdown}\n`);
  } catch (error) {
    console.error("Markdown mirror error:", error);
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.status(500).send("# 500 — Error\n\nFailed to generate Markdown for this page.\n");
  }
}

async function resolve(segments: string[]): Promise<string | null> {
  // Homepage: /index.md
  const key = segments.join("/");
  if (segments.length === 0 || key === "index") {
    return getStaticPageMarkdown("index");
  }

  // Blog routes
  if (segments[0] === "blog") {
    if (segments.length === 1) return getBlogIndexMarkdown();
    if (segments.length === 3 && segments[1] === "tag") return getTagMarkdown(segments[2]);
    if (segments.length === 3 && segments[1] === "author") return getAuthorMarkdown(segments[2]);
    if (segments.length === 2) return getBlogPostMarkdown(segments[1]);
    return null;
  }

  // Static content pages: /branding.md, /terms-of-service.md, etc.
  if (segments.length === 1) {
    return getStaticPageMarkdown(segments[0]);
  }

  return null;
}
