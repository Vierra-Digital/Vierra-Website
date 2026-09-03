import { describe, expect, it } from "vitest";
import { matchRelated, type RelatedPost } from "@/lib/blog";

/**
 * matchRelated replaces a per-post database query during `next build`, so what matters is that it
 * returns exactly what the SQL returned — same rule, same order, same cut-off. The query is:
 *
 *   slug != this post
 *   AND (any of this post's comma-separated tags appears case-insensitively in the other post's
 *        tag string  OR  the other post has the same author)
 *   ORDER BY published_date DESC
 *   LIMIT n
 *
 * Parity against the real table was checked separately across all 28 live posts; these pin the
 * rule itself so a later edit cannot quietly drift from the query it stands in for.
 */

function post(slug: string, tag: string | null, author: string, date: string): RelatedPost {
  return {
    id: slug,
    title: slug,
    description: null,
    slug,
    tag,
    visits: null,
    published_date: date,
    updated_date: null,
    author: { name: author },
  };
}

// Ordered newest-first, the way the catalog query returns them.
const CATALOG: RelatedPost[] = [
  post("newest", "Marketing", "Alex Shick", "2026-05-01"),
  post("mid", "Sales,Technology", "Kylie Lappin", "2026-03-01"),
  post("tagless", null, "Alex Shick", "2026-02-01"),
  post("oldest", "marketing", "Paul Wahba", "2026-01-01"),
];

describe("matchRelated", () => {
  it("excludes the post itself", () => {
    const out = matchRelated(CATALOG, { slug: "newest", authorName: "Alex Shick" }, ["Marketing"], 10);
    expect(out.map((p) => p.slug)).not.toContain("newest");
  });

  it("matches a tag case-insensitively, as `mode: insensitive` did", () => {
    const out = matchRelated(CATALOG, { slug: "x", authorName: "Nobody" }, ["MARKETING"], 10);
    expect(out.map((p) => p.slug)).toEqual(["newest", "oldest"]);
  });

  it("matches a tag as a substring of a comma-joined tag string", () => {
    // "mid" carries "Sales,Technology"; the SQL used `contains`, not equality.
    const out = matchRelated(CATALOG, { slug: "x", authorName: "Nobody" }, ["Technology"], 10);
    expect(out.map((p) => p.slug)).toEqual(["mid"]);
  });

  it("matches on author even when no tag matches", () => {
    const out = matchRelated(CATALOG, { slug: "x", authorName: "Paul Wahba" }, ["Nonexistent"], 10);
    expect(out.map((p) => p.slug)).toEqual(["oldest"]);
  });

  it("treats a null tag as non-matching but still allows the author match", () => {
    const byTag = matchRelated(CATALOG, { slug: "x", authorName: "Nobody" }, ["Marketing"], 10);
    expect(byTag.map((p) => p.slug)).not.toContain("tagless");

    const byAuthor = matchRelated(CATALOG, { slug: "x", authorName: "Alex Shick" }, ["Nonexistent"], 10);
    expect(byAuthor.map((p) => p.slug)).toContain("tagless");
  });

  it("keeps the catalog's newest-first order", () => {
    const out = matchRelated(CATALOG, { slug: "x", authorName: "Alex Shick" }, ["marketing"], 10);
    expect(out.map((p) => p.slug)).toEqual(["newest", "tagless", "oldest"]);
  });

  it("applies the limit after filtering", () => {
    const out = matchRelated(CATALOG, { slug: "x", authorName: "Alex Shick" }, ["marketing"], 2);
    expect(out.map((p) => p.slug)).toEqual(["newest", "tagless"]);
  });

  it("falls back to author-only when the post has no tags", () => {
    const out = matchRelated(CATALOG, { slug: "newest", authorName: "Alex Shick" }, [], 10);
    expect(out.map((p) => p.slug)).toEqual(["tagless"]);
  });
});
