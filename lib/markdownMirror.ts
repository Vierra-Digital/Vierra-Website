import fs from "fs";
import path from "path";
import TurndownService from "turndown";
import { prisma } from "@/lib/prisma";
import { JOB_ROLES, getJobRole, type JobRole } from "@/lib/careers";
import { FAQ_ITEMS } from "@/lib/faq";

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
function htmlToMarkdown(html: string): string {
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
      authors: { select: { name: true } },
    },
  });
  if (!post) return null;

  const canonical = `${SITE_URL}/blog/${slug}`;
  const meta: string[] = [];
  if (post.authors?.name) meta.push(`By **${post.authors.name}**`);
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
  authors: { name: string } | null;
};

function renderPostList(posts: PostListItem[]): string {
  if (!posts.length) return "_No posts found._";
  return posts
    .map((p) => {
      const date = p.published_date ? formatDate(p.published_date) : "";
      const by = p.authors?.name ? ` — ${p.authors.name}` : "";
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
      authors: { select: { name: true } },
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
      authors: { select: { name: true } },
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

/** One-line meta strip shown under a role's title (type · dept · location · pay · experience). */
function jobMetaLine(role: JobRole): string {
  return [role.typeLabel, role.department, role.location, role.compensation, role.experience]
    .filter(Boolean)
    .join(" · ");
}

/** A single career posting rendered as Markdown, sourced from lib/careers. */
export function getJobMarkdown(slug: string): string | null {
  const role = getJobRole(slug);
  if (!role) return null;

  const canonical = `${SITE_URL}/careers/${role.slug}`;
  const bullets = (items: string[]) => items.map((i) => `- ${i}`).join("\n");
  const parts = [
    header({
      title: `${role.title} — Careers at Vierra`,
      description: role.summary,
      canonical,
    }),
    `_${jobMetaLine(role)}_`,
    "",
    `> ${role.summary}`,
    "",
    "## About the Role",
    "",
    role.about.join("\n\n"),
    "",
    "## Responsibilities",
    "",
    bullets(role.responsibilities),
    "",
    "## Qualifications",
    "",
    bullets(role.qualifications),
  ];
  if (role.niceToHave?.length) {
    parts.push("", "## Nice to Have", "", bullets(role.niceToHave));
  }
  parts.push(
    "",
    "## What We Offer",
    "",
    bullets(role.benefits),
    "",
    "---",
    `[Apply for this role on vierradev.com](${canonical})`
  );
  return parts.join("\n");
}

/** The FAQ page rendered as Markdown — Q&A blocks for AI answer engines. */
export function getFaqMarkdown(): string {
  const qa = FAQ_ITEMS.map((item) => `## ${item.question}\n\n${item.answer}`).join("\n\n");
  return [
    header({
      title: "Frequently Asked Questions — Vierra",
      description:
        "Answers about Vierra Digital: what we do, how risk-averse lead generation works, who we serve, location, and how to get started.",
      canonical: `${SITE_URL}/faq`,
    }),
    qa,
    "",
    "---",
    `[Read on vierradev.com](${SITE_URL}/faq)`,
  ].join("\n");
}

/** The careers index rendered as Markdown — lists every open role with its mirror link. */
export function getCareersIndexMarkdown(): string {
  const roleLines = JOB_ROLES.map(
    (role) =>
      `- [${role.title}](${SITE_URL}/careers/${role.slug}.md) _(${jobMetaLine(role)})_\n  ${role.summary}`
  ).join("\n");
  return [
    header({
      title: "Careers at Vierra",
      description:
        "Open roles at Vierra. Join a small, fast-moving team building the products that power our growth platform.",
      canonical: `${SITE_URL}/careers`,
    }),
    "> Vierra is hiring across engineering, sales, marketing, operations, and design. All roles are in-person in NYC.",
    "",
    "## Open Roles",
    "",
    JOB_ROLES.length ? roleLines : "_No open roles at this time._",
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
    "> Vierra is a digital marketing and lead generation platform that helps businesses increase ROI, leads, and conversions through case-study-proven lead generation services.",
    "",
    "Append `.md` to any page URL to fetch a clean Markdown version of that page. The links below point directly to those Markdown mirrors.",
    "",
    "## Main",
    "",
    `- [Vierra — Home](${SITE_URL}/index.md): Risk-averse lead engine for your business.`,
    `- [Brand Kit](${SITE_URL}/branding.md): Logo, colors, gradients, and typography guidelines.`,
    "",
    "## Legal",
    "",
    `- [Terms of Service](${SITE_URL}/terms-of-service.md)`,
    `- [Privacy Policy](${SITE_URL}/privacy-policy.md)`,
    `- [Work Policy](${SITE_URL}/work-policy.md)`,
    "",
    "## Support",
    "",
    `- [Frequently Asked Questions](${SITE_URL}/faq.md): What Vierra does, how lead generation works, who we serve, and how to start.`,
    "",
    "## Careers",
    "",
    `- [Careers at Vierra](${SITE_URL}/careers.md): Open roles across engineering, sales, marketing, operations, and design.`,
    ...JOB_ROLES.map(
      (role) =>
        `- [${role.title}](${SITE_URL}/careers/${role.slug}.md): ${role.summary.replace(/\s+/g, " ").trim()}`
    ),
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
    where: { authors: { name } },
    select: {
      slug: true,
      title: true,
      description: true,
      published_date: true,
      authors: { select: { name: true } },
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
