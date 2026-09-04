import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

/**
 * The Markdown mirrors are the public `.md` surface: append `.md` to any page URL and this module
 * renders it. Nothing here was covered, and it is public, unauthenticated, and takes a slug from
 * the URL — so the first block below is the one that matters most.
 *
 * Only prisma is mocked. lib/careers, lib/faq and the real files in content/md are used as-is,
 * because a mirror that renders from stale fixtures proves nothing about the pages we serve.
 */

vi.mock("@/lib/prisma", () => ({
  prisma: { blogPost: { findUnique: vi.fn(), findMany: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { JOB_ROLES } from "@/lib/careers";
import { FAQ_ITEMS } from "@/lib/faq";
import {
  getAuthorMarkdown,
  getBlogIndexMarkdown,
  getBlogPostMarkdown,
  getCareersIndexMarkdown,
  getFaqMarkdown,
  getJobMarkdown,
  getLlmsTxt,
  getStaticPageMarkdown,
  getTagMarkdown,
} from "@/lib/markdownMirror";

const findUnique = prisma.blogPost.findUnique as unknown as Mock;
const findMany = prisma.blogPost.findMany as unknown as Mock;

/** The five pages that genuinely have a file in content/md. */
const STATIC_PAGES = ["index", "branding", "terms-of-service", "privacy-policy", "work-policy"];

/** Format a date the way the module does, so assertions do not depend on the runner's zone. */
const asDate = (d: Date) =>
  new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric" }).format(d);

/** The lines between the opening and closing `---` of a rendered document. */
function frontmatter(doc: string): string[] {
  const lines = doc.split("\n");
  expect(lines[0]).toBe("---");
  const end = lines.indexOf("---", 1);
  expect(end).toBeGreaterThan(0);
  return lines.slice(1, end);
}

const post = (over: Record<string, unknown> = {}) => ({
  slug: "scaling-outbound",
  title: "Scaling Outbound",
  description: "How we book more meetings.",
  content: "<p>Hello</p>",
  published_date: new Date("2026-03-15T12:00:00Z"),
  tag: "growth, outbound",
  authors: { name: "Sam Reed" },
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getStaticPageMarkdown — the slug comes straight from the URL", () => {
  it("serves each of the five pages that have a mirror file", () => {
    for (const slug of STATIC_PAGES) {
      const md = getStaticPageMarkdown(slug);
      expect(md, slug).toBeTruthy();
      expect(md!.length, slug).toBeGreaterThan(50);
    }
  });

  it("refuses a traversal that would otherwise resolve to a real file", () => {
    // This is the case that proves the allowlist is checked BEFORE path.join, not after:
    // content/md/../md/index.md exists and is readable. If the join happened first, this call
    // would hand back the home page's markdown. It must return null instead.
    expect(getStaticPageMarkdown("../md/index")).toBeNull();
    expect(getStaticPageMarkdown("./index")).toBeNull();
  });

  it("refuses traversal aimed outside the content directory", () => {
    for (const slug of [
      "../../package",
      "../../../etc/passwd",
      "../../.env",
      "..%2f..%2fpackage",
      "....//....//package",
      "/etc/passwd",
      "C:\\Windows\\win.ini",
    ]) {
      expect(getStaticPageMarkdown(slug), slug).toBeNull();
    }
  });

  it("refuses an allowlisted name that has been decorated", () => {
    // An allowlist on the exact string means there is no normalisation step to disagree with:
    // anything that is not character-for-character a known page is not a page.
    for (const slug of ["index ", " index", "Index", "INDEX", "index.md", "index%00", "index\u0000"]) {
      expect(getStaticPageMarkdown(slug), JSON.stringify(slug)).toBeNull();
    }
  });

  it("returns null for an unknown page and for an empty slug", () => {
    expect(getStaticPageMarkdown("")).toBeNull();
    expect(getStaticPageMarkdown("pricing")).toBeNull();
    expect(getStaticPageMarkdown("blog")).toBeNull();
  });

  it("does not throw for an allowlisted page", () => {
    // The read is wrapped, so a page added to the allowlist before its file exists degrades to a
    // 404 rather than a 500.
    expect(() => getStaticPageMarkdown("index")).not.toThrow();
  });
});

describe("getJobMarkdown", () => {
  it("renders every real role without throwing", () => {
    for (const role of JOB_ROLES) {
      const md = getJobMarkdown(role.slug);
      expect(md, role.slug).toBeTruthy();
      expect(md, role.slug).toContain(`# ${role.title} — Careers at Vierra`);
      expect(md, role.slug).toContain("## Responsibilities");
      expect(md, role.slug).toContain("## Qualifications");
      expect(md, role.slug).toContain("## What We Offer");
      expect(md, role.slug).toContain(`https://vierradev.com/careers/${role.slug}`);
    }
  });

  it("puts the role's own meta on the strip under the title", () => {
    const role = JOB_ROLES[0];
    const md = getJobMarkdown(role.slug)!;
    for (const field of [role.typeLabel, role.department, role.location, role.compensation, role.experience]) {
      if (field) expect(md).toContain(field);
    }
  });

  it("includes Nice to Have only for roles that have any", () => {
    const withNice = JOB_ROLES.find((r) => r.niceToHave?.length);
    const without = JOB_ROLES.find((r) => !r.niceToHave?.length);
    if (withNice) expect(getJobMarkdown(withNice.slug)).toContain("## Nice to Have");
    if (without) expect(getJobMarkdown(without.slug)).not.toContain("## Nice to Have");
  });

  it("returns null for an unknown or hostile slug", () => {
    for (const slug of ["", "not-a-role", "../md/index", "junior-software-engineer "]) {
      expect(getJobMarkdown(slug), slug).toBeNull();
    }
  });
});

describe("getFaqMarkdown", () => {
  it("renders every FAQ item as its own H2 with its answer", () => {
    const md = getFaqMarkdown();
    expect(FAQ_ITEMS.length).toBeGreaterThan(0);
    for (const item of FAQ_ITEMS) {
      expect(md).toContain(`## ${item.question}`);
      expect(md).toContain(item.answer);
    }
  });

  it("carries the canonical link so an answer engine can cite the page", () => {
    expect(getFaqMarkdown()).toContain("https://vierradev.com/faq");
  });
});

describe("getCareersIndexMarkdown", () => {
  it("lists every open role, each pointing at its own mirror", () => {
    const md = getCareersIndexMarkdown();
    for (const role of JOB_ROLES) {
      expect(md, role.slug).toContain(`https://vierradev.com/careers/${role.slug}.md`);
      expect(md, role.slug).toContain(role.title);
    }
  });

  it("does not claim there are no roles while roles exist", () => {
    const md = getCareersIndexMarkdown();
    if (JOB_ROLES.length) expect(md).not.toContain("_No open roles at this time._");
  });
});

describe("getBlogPostMarkdown", () => {
  it("returns null for a slug with no post, without inventing a page", async () => {
    findUnique.mockResolvedValue(null);
    expect(await getBlogPostMarkdown("nope")).toBeNull();
  });

  it("renders the frontmatter, byline, description and body", async () => {
    findUnique.mockResolvedValue(post());
    const md = (await getBlogPostMarkdown("scaling-outbound"))!;

    expect(frontmatter(md)).toEqual([
      'title: "Scaling Outbound"',
      'description: "How we book more meetings."',
      "source: https://vierradev.com/blog/scaling-outbound",
    ]);
    expect(md).toContain("# Scaling Outbound");
    expect(md).toContain("By **Sam Reed**");
    expect(md).toContain(asDate(new Date("2026-03-15T12:00:00Z")));
    expect(md).toContain("> How we book more meetings.");
    expect(md).toContain("Hello");
    expect(md).toContain("**Tags:** growth, outbound");
    expect(md).toContain("[Read on vierradev.com](https://vierradev.com/blog/scaling-outbound)");
  });

  it("converts stored HTML to Markdown rather than emitting it raw", async () => {
    findUnique.mockResolvedValue(
      post({
        content:
          "<h2>Why</h2><p>Some <strong>bold</strong> and <em>italic</em>.</p>" +
          '<ul><li>one</li><li>two</li></ul><a href="https://x.test">link</a>',
      })
    );
    const md = (await getBlogPostMarkdown("s"))!;
    expect(md).toContain("## Why");
    expect(md).toContain("**bold**");
    expect(md).toContain("_italic_");
    // Turndown pads list-item content, so match the bullet rather than a fixed indent.
    expect(md).toMatch(/^-\s+one$/m);
    expect(md).toMatch(/^-\s+two$/m);
    expect(md).toContain("[link](https://x.test)");
    expect(md).not.toContain("<strong>");
    expect(md).not.toContain("<ul>");
  });

  it("drops script, style and noscript from the stored body", async () => {
    // Post bodies are stored HTML written through the admin rich-text editor. The mirror is served
    // as text, but it is still published output, so executable markup must not ride along.
    findUnique.mockResolvedValue(
      post({
        content:
          "<p>Before</p><script>alert(1)</script><style>body{display:none}</style>" +
          "<noscript>fallback</noscript><p>After</p>",
      })
    );
    const md = (await getBlogPostMarkdown("s"))!;
    expect(md).toContain("Before");
    expect(md).toContain("After");
    expect(md).not.toContain("alert(1)");
    expect(md).not.toContain("display:none");
    expect(md).not.toContain("fallback");
    expect(md).not.toMatch(/<script|<style|<noscript/i);
  });

  it("cannot have its frontmatter forged by a post title or description", async () => {
    // JSON.stringify is what keeps a frontmatter value on one line.
    findUnique.mockResolvedValue(
      post({
        title: "Real\nsource: https://evil.test\ntitle: Forged",
        description: 'x"\ncanonical: https://evil.test',
      })
    );
    const md = (await getBlogPostMarkdown("s"))!;
    const fm = frontmatter(md);

    expect(fm.filter((l) => l.startsWith("source:"))).toEqual([
      "source: https://vierradev.com/blog/s",
    ]);
    expect(fm.some((l) => l.startsWith("title: Forged"))).toBe(false);
    expect(fm.some((l) => l.startsWith("canonical:"))).toBe(false);
  });

  it("cannot have its body forged by a newline in the title or description", async () => {
    // The frontmatter was already safe; the H1 and the blockquote built from the same values were
    // not, because `# ${title}` and `> ${description}` each end at a newline. A title of
    // "Real\n# Forged" used to emit a second H1 as page text. These mirrors are what answer
    // engines ingest, so an injected line reads as our own content.
    //
    // The text itself is preserved — collapsed onto one line, not removed. What is being pinned is
    // that no author-supplied value can introduce a new line, and so cannot introduce a new
    // Markdown construct.
    findUnique.mockResolvedValue(
      post({
        title: "Real\n# Forged Heading\nsource: https://evil.test",
        description: "Fine.\n# Also Forged",
        authors: { name: "Sam\n# Byline Forged" },
        tag: "growth\n# Tag Forged",
      })
    );
    const md = (await getBlogPostMarkdown("s"))!;
    const lines = md.split("\n");

    // Exactly one H1 in the document, and it is the one the module built.
    expect(lines.filter((l) => l.startsWith("# "))).toEqual([
      "# Real # Forged Heading source: https://evil.test",
    ]);
    // No line outside the frontmatter re-declares a frontmatter key.
    const end = lines.indexOf("---", 1);
    expect(lines.slice(end + 1).some((l) => /^(source|title|description):/.test(l))).toBe(false);
    // The description stays inside its blockquote.
    expect(lines.filter((l) => l.startsWith("> "))).toEqual(["> Fine. # Also Forged"]);
  });

  it("omits the byline, blockquote and tag line when those fields are absent", async () => {
    findUnique.mockResolvedValue(
      post({ description: null, authors: null, tag: null, published_date: null })
    );
    const md = (await getBlogPostMarkdown("s"))!;
    expect(frontmatter(md)).toEqual([
      'title: "Scaling Outbound"',
      "source: https://vierradev.com/blog/s",
    ]);
    expect(md).not.toContain("By **");
    expect(md).not.toContain("**Tags:**");
  });

  it("drops empty entries from a comma-separated tag string", async () => {
    findUnique.mockResolvedValue(post({ tag: " growth , , outbound ,, " }));
    expect(await getBlogPostMarkdown("s")).toContain("**Tags:** growth, outbound");
  });

  it("renders a post whose body is empty without emitting undefined", async () => {
    findUnique.mockResolvedValue(post({ content: "" }));
    const md = (await getBlogPostMarkdown("s"))!;
    expect(md).not.toContain("undefined");
    expect(md).toContain("# Scaling Outbound");
  });
});

describe("getBlogIndexMarkdown", () => {
  const listed = (over: Record<string, unknown> = {}) => ({
    slug: "a-post",
    title: "A Post",
    description: "Desc.",
    published_date: new Date("2026-03-15T12:00:00Z"),
    authors: { name: "Sam Reed" },
    ...over,
  });

  it("links each post at its .md mirror, with author and date", async () => {
    findMany.mockResolvedValue([listed()]);
    const md = await getBlogIndexMarkdown();
    expect(md).toContain("[A Post](https://vierradev.com/blog/a-post.md)");
    expect(md).toContain("Sam Reed");
    expect(md).toContain(asDate(new Date("2026-03-15T12:00:00Z")));
    expect(md).toContain("Desc.");
  });

  it("says so plainly when there are no posts", async () => {
    findMany.mockResolvedValue([]);
    expect(await getBlogIndexMarkdown()).toContain("_No posts found._");
  });

  it("hides placeholder posts from the public index", async () => {
    // Same rule the sitemap uses. A draft called "Test post" being publicly linked is the failure
    // this prevents.
    findMany.mockResolvedValue([
      listed({ slug: "real-one", title: "Real One" }),
      listed({ slug: "test-draft", title: "Fine Title" }),
      listed({ slug: "fine-slug", title: "Test Draft" }),
      listed({ slug: "TEST-UPPER", title: "Upper" }),
      listed({ slug: "", title: "Empty Slug" }),
      listed({ slug: "   ", title: "Blank Slug" }),
      listed({ slug: "route-[id]", title: "Bracketed" }),
      listed({ slug: "route-{x}", title: "Braced" }),
    ]);
    const md = await getBlogIndexMarkdown();

    expect(md).toContain("real-one.md");
    for (const gone of [
      "test-draft",
      "fine-slug",
      "TEST-UPPER",
      "route-[id]",
      "route-{x}",
      "Empty Slug",
      "Blank Slug",
    ]) {
      expect(md, gone).not.toContain(gone);
    }
  });

  it("renders a post with no author or date as a bare link", async () => {
    findMany.mockResolvedValue([listed({ authors: null, published_date: null, description: null })]);
    const md = await getBlogIndexMarkdown();
    expect(md).toContain("[A Post](https://vierradev.com/blog/a-post.md)");
    expect(md).not.toContain("undefined");
    expect(md).not.toContain("_()_");
  });
});

describe("getTagMarkdown", () => {
  const tagged = (slug: string, tag: string) => ({
    slug,
    title: slug,
    description: null,
    published_date: new Date("2026-03-15T12:00:00Z"),
    tag,
    authors: null,
  });

  it("keeps only exact comma-separated matches, not the database's substring hits", async () => {
    // The query uses `contains`, deliberately loose so it stays index-friendly; the JS pass is what
    // makes /blog/tag/sale stop returning every "sales" post.
    findMany.mockResolvedValue([
      tagged("exact", "sale, other"),
      tagged("substring", "sales"),
      tagged("prefixed", "wholesale"),
    ]);
    const md = (await getTagMarkdown("sale"))!;
    expect(md).toContain("exact");
    expect(md).not.toContain("substring");
    expect(md).not.toContain("prefixed");
  });

  it("matches regardless of case and surrounding spaces", async () => {
    findMany.mockResolvedValue([tagged("a", " Growth , Outbound ")]);
    expect(await getTagMarkdown("growth")).toContain("a");
    expect(await getTagMarkdown("OUTBOUND")).toContain("a");
  });

  it("returns null when nothing matches exactly, so the route can 404", async () => {
    findMany.mockResolvedValue([tagged("substring", "sales")]);
    expect(await getTagMarkdown("sale")).toBeNull();
    findMany.mockResolvedValue([]);
    expect(await getTagMarkdown("growth")).toBeNull();
  });

  it("still hides placeholder posts on a tag page", async () => {
    findMany.mockResolvedValue([tagged("test-post", "growth")]);
    expect(await getTagMarkdown("growth")).toBeNull();
  });

  it("percent-encodes the tag in the canonical link", async () => {
    findMany.mockResolvedValue([tagged("a", "lead gen")]);
    const md = (await getTagMarkdown("lead gen"))!;
    expect(md).toContain("https://vierradev.com/blog/tag/lead%20gen");
  });

  it("keeps a tag with regex metacharacters as a literal", async () => {
    // The JS pass compares strings, so a tag like "c++" must not be treated as a pattern.
    findMany.mockResolvedValue([tagged("a", "c++"), tagged("b", "cxx")]);
    const md = (await getTagMarkdown("c++"))!;
    expect(md).toContain("a");
    expect(md).not.toContain("cxx");
  });
});

describe("getAuthorMarkdown", () => {
  it("lists that author's posts", async () => {
    findMany.mockResolvedValue([
      {
        slug: "a-post",
        title: "A Post",
        description: null,
        published_date: new Date("2026-03-15T12:00:00Z"),
        authors: { name: "Sam Reed" },
      },
    ]);
    const md = (await getAuthorMarkdown("Sam Reed"))!;
    expect(md).toContain("# Posts by Sam Reed");
    expect(md).toContain("a-post.md");
  });

  it("returns null for an author with nothing publishable", async () => {
    findMany.mockResolvedValue([]);
    expect(await getAuthorMarkdown("Nobody")).toBeNull();

    findMany.mockResolvedValue([
      {
        slug: "test-x",
        title: "T",
        description: null,
        published_date: new Date("2026-03-15T12:00:00Z"),
        authors: { name: "Sam" },
      },
    ]);
    expect(await getAuthorMarkdown("Sam")).toBeNull();
  });

  it("percent-encodes the author name in the canonical link", async () => {
    findMany.mockResolvedValue([
      {
        slug: "p",
        title: "P",
        description: null,
        published_date: new Date("2026-03-15T12:00:00Z"),
        authors: { name: "Sam Reed" },
      },
    ]);
    expect(await getAuthorMarkdown("Sam Reed")).toContain("/blog/author/Sam%20Reed");
  });
});

describe("getLlmsTxt", () => {
  it("follows the llmstxt.org shape and points at every mirror section", async () => {
    findMany.mockResolvedValue([]);
    const txt = await getLlmsTxt();

    expect(txt.startsWith("# Vierra\n")).toBe(true);
    expect(txt).toContain("\n> Vierra is a digital marketing");
    for (const section of ["## Company", "## Main", "## Legal", "## Support", "## Careers", "## Blog"]) {
      expect(txt, section).toContain(section);
    }
    // Every allowlisted static page must be reachable from the index, or an agent cannot find it.
    for (const slug of STATIC_PAGES) {
      expect(txt, slug).toContain(`https://vierradev.com/${slug}.md`);
    }
    for (const role of JOB_ROLES) {
      expect(txt, role.slug).toContain(`/careers/${role.slug}.md`);
    }
  });

  it("appends each real post, collapsing whitespace in its description", async () => {
    findMany.mockResolvedValue([
      { slug: "a-post", title: "A Post", description: "Line one.\n\n  Line two." },
      { slug: "test-draft", title: "Draft" },
    ]);
    const txt = await getLlmsTxt();
    expect(txt).toContain("[A Post](https://vierradev.com/blog/a-post.md): Line one. Line two.");
    expect(txt).not.toContain("test-draft");
  });

  it("still serves the static index when the database is unreachable", async () => {
    // /llms.txt is the entry point agents fetch first. A database blip must degrade it to the
    // static sections, not turn it into a 500 and make the whole mirror surface undiscoverable.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    findMany.mockRejectedValue(new Error("connection refused"));

    const txt = await getLlmsTxt();
    expect(txt).toContain("## Careers");
    expect(txt).toContain("https://vierradev.com/faq.md");
    expect(txt).toContain("[Vierra Blog](https://vierradev.com/blog.md)");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
