import fs from "fs";
import path from "path";
import TurndownService from "turndown";
import { prisma } from "@/lib/prisma";

const SITE_URL = "https://vierradev.com";

/** Public, content-bearing static pages that have a hand-authored Markdown mirror. */
const STATIC_PAGES = new Set([
  "index",
  "branding",
  "terms-of-service",
  "privacy-policy",
  "work-policy",
]);

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
  emDelimiter: "_",
});

// Drop elements that carry no meaning in plain Markdown.
turndown.remove(["script", "style", "noscript"]);

/** Convert a rich-text/HTML body (as stored for blog posts) into clean Markdown. */
export function htmlToMarkdown(html: string): string {
  if (!html) return "";
  return turndown
    .turndown(html)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Read a hand-authored Markdown mirror file from /content/md, if one exists. */
export function getStaticPageMarkdown(slug: string): string | null {
  if (!STATIC_PAGES.has(slug)) return null;
  const filePath = path.join(process.cwd(), "content", "md", `${slug}.md`);
  try {
    return fs.readFileSync(filePath, "utf8").trim();
  } catch {
    return null;
  }
}

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
}

/** Frontmatter + H1 header shared by generated pages. */
function header(opts: { title: string; description?: string | null; canonical: string }): string {
  const lines = ["---", `title: ${JSON.stringify(opts.title)}`];
  if (opts.description) lines.push(`description: ${JSON.stringify(opts.description)}`);
  lines.push(`source: ${opts.canonical}`, "---", "", `# ${opts.title}`, "");
  return lines.join("\n");
}

/** A single blog post rendered as Markdown, sourced from the database. */
export async function getBlogPostMarkdown(slug: string): Promise<string | null> {
  const post = await prisma.blogPost.findUnique({
    where: { slug },
    select: {
      title: true,
      description: true,
      content: true,
      published_date: true,
      tag: true,
      author: { select: { name: true } },
    },
  });
  if (!post) return null;

  const canonical = `${SITE_URL}/blog/${slug}`;
  const meta: string[] = [];
  if (post.author?.name) meta.push(`By **${post.author.name}**`);
  if (post.published_date) meta.push(formatDate(post.published_date));
  const tags = (post.tag ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const parts = [header({ title: post.title, description: post.description, canonical })];
  if (meta.length) parts.push(`_${meta.join(" · ")}_`, "");
  if (post.description) parts.push(`> ${post.description}`, "");
  parts.push(htmlToMarkdown(post.content));
  if (tags.length) parts.push("", `**Tags:** ${tags.join(", ")}`);
  parts.push("", `---`, `[Read on vierradev.com](${canonical})`);
  return parts.join("\n");
}

type PostListItem = {
  slug: string;
  title: string;
  description: string | null;
  published_date: Date;
  author: { name: string } | null;
};

function renderPostList(posts: PostListItem[]): string {
  if (!posts.length) return "_No posts found._";
  return posts
    .map((p) => {
      const date = p.published_date ? formatDate(p.published_date) : "";
      const by = p.author?.name ? ` — ${p.author.name}` : "";
      const meta = [date, by.replace(/^ — /, "")].filter(Boolean).join(" · ");
      const desc = p.description ? `\n  ${p.description}` : "";
      return `- [${p.title}](${SITE_URL}/blog/${p.slug}.md)${meta ? ` _(${meta})_` : ""}${desc}`;
    })
    .join("\n");
}

/** Excludes obvious test/placeholder posts, mirroring sitemap behavior. */
function isRealPost(slug: string, title: string): boolean {
  if (!slug || !slug.trim()) return false;
  if (/[[\]{}]/.test(slug)) return false;
  return !slug.toLowerCase().includes("test") && !title.toLowerCase().includes("test");
}

export async function getBlogIndexMarkdown(): Promise<string> {
  const posts = await prisma.blogPost.findMany({
    select: {
      slug: true,
      title: true,
      description: true,
      published_date: true,
      author: { select: { name: true } },
    },
    orderBy: { published_date: "desc" },
  });
  const filtered = posts.filter((p) => isRealPost(p.slug, p.title));
  return [
    header({
      title: "Vierra Blog",
      description: "Insights and strategies from Vierra to scale revenue and acquire more clients.",
      canonical: `${SITE_URL}/blog`,
    }),
    renderPostList(filtered),
  ].join("\n");
}

export async function getTagMarkdown(tag: string): Promise<string | null> {
  const posts = await prisma.blogPost.findMany({
    select: {
      slug: true,
      title: true,
      description: true,
      published_date: true,
      tag: true,
      author: { select: { name: true } },
    },
    orderBy: { published_date: "desc" },
  });
  const filtered = posts.filter(
    (p) =>
      isRealPost(p.slug, p.title) &&
      (p.tag ?? "")
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .includes(tag.toLowerCase())
  );
  if (!filtered.length) return null;
  return [
    header({
      title: `Posts tagged “${tag}”`,
      canonical: `${SITE_URL}/blog/tag/${encodeURIComponent(tag)}`,
    }),
    renderPostList(filtered),
  ].join("\n");
}

/**
 * The /llms.txt index — points AI agents and tools at the Markdown mirrors.
 * Follows the https://llmstxt.org convention: H1 title, blockquote summary,
 * then H2 sections of `[name](url): description` links.
 */
export async function getLlmsTxt(): Promise<string> {
  const lines: string[] = [
    "# Vierra",
    "",
    "> Vierra is a digital marketing and lead generation platform that helps businesses increase ROI, leads, and conversions through guaranteed, case-study-proven lead generation services.",
    "",
    "Append `.md` to any page URL to fetch a clean Markdown version of that page. The links below point directly to those Markdown mirrors.",
    "",
    "## Main",
    "",
    `- [Vierra — Home](${SITE_URL}/index.md): Guaranteed, risk-averse lead generation for your business.`,
    `- [Brand Kit](${SITE_URL}/branding.md): Logo, colors, gradients, and typography guidelines.`,
    "",
    "## Legal",
    "",
    `- [Terms of Service](${SITE_URL}/terms-of-service.md)`,
    `- [Privacy Policy](${SITE_URL}/privacy-policy.md)`,
    `- [Work Policy](${SITE_URL}/work-policy.md)`,
    "",
    "## Blog",
    "",
    `- [Vierra Blog](${SITE_URL}/blog.md): All articles and insights.`,
  ];

  try {
    const posts = await prisma.blogPost.findMany({
      select: { slug: true, title: true, description: true },
      orderBy: { published_date: "desc" },
    });
    for (const p of posts.filter((post) => isRealPost(post.slug, post.title))) {
      const desc = p.description ? `: ${p.description.replace(/\s+/g, " ").trim()}` : "";
      lines.push(`- [${p.title}](${SITE_URL}/blog/${p.slug}.md)${desc}`);
    }
  } catch (error) {
    console.warn("llms.txt: database unavailable, listing static pages only:", error);
  }

  return lines.join("\n");
}

export async function getAuthorMarkdown(name: string): Promise<string | null> {
  const posts = await prisma.blogPost.findMany({
    where: { author: { name } },
    select: {
      slug: true,
      title: true,
      description: true,
      published_date: true,
      author: { select: { name: true } },
    },
    orderBy: { published_date: "desc" },
  });
  const filtered = posts.filter((p) => isRealPost(p.slug, p.title));
  if (!filtered.length) return null;
  return [
    header({
      title: `Posts by ${name}`,
      canonical: `${SITE_URL}/blog/author/${encodeURIComponent(name)}`,
    }),
    renderPostList(filtered),
  ].join("\n");
}
