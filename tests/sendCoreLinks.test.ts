import { describe, expect, it } from "vitest";
import { linkifyTextWithTrackedHrefs, mergeClickTrackUrls, rewriteTrackedLinksInHtml } from "@/lib/gmail/clickTracking";
import { normalizeEmail, parseAttachments } from "@/lib/gmail/sendCore";

/**
 * Click tracking works in two steps that must agree: mergeClickTrackUrls decides which URLs get a
 * token and a database row, and rewriteTrackedLinksInHtml swaps those URLs for the tracked ones in
 * the HTML that actually goes out. sendCore says so in a comment on the extraction regex —
 * "MUST match rewriteTrackedLinksInHtml's pattern exactly, or a URL gets a tracking token + DB row
 * here but is never rewritten in the sent HTML (orphan token, untracked link)" — and nothing
 * enforced it.
 *
 * The parity block below is the point of this file: it holds the two regexes together, so editing
 * one without the other fails here instead of silently shipping untracked links.
 */

/** Stand in for the real token minting: every URL maps to a distinct tracked URL. */
function trackAll(urls: string[]): Map<string, string> {
  return new Map(urls.map((u, i) => [u, `https://vierradev.com/api/email/track/click/tok${i}`]));
}

describe("click-tracking parity between extraction and rewriting", () => {
  const bodies = [
    '<a href="https://acme.co/a">a</a>',
    "<a href='https://acme.co/b'>b</a>",
    '<p>x</p><a href="https://acme.co/c?q=1&r=2">c</a>',
    '<a class="btn" href="https://acme.co/d" target="_blank">d</a>',
    '<a href="http://acme.co/e">e</a>',
    '<a HREF="https://acme.co/f">f</a>',
    '<a href="https://acme.co/g">g</a><a href="https://acme.co/h">h</a>',
    '<a href="https://acme.co/dup">1</a><a href="https://acme.co/dup">2</a>',
    '<td><a href="https://acme.co/nested">n</a></td>',
    '<a href="https://acme.co/path/with-dash_and.dot">p</a>',
    '<a href="https://acme.co/i#frag">i</a>',
    '<a href="https://sub.acme.co:8443/j">j</a>',
  ];

  it("rewrites every URL it decided to track", () => {
    for (const html of bodies) {
      const urls = mergeClickTrackUrls("", html);
      expect(urls.length, `no URL extracted from ${html}`).toBeGreaterThan(0);

      const rewritten = rewriteTrackedLinksInHtml(html, trackAll(urls));
      for (const url of urls) {
        // An extracted URL still present in the output means a token and a database row were
        // created for a link that goes out untracked.
        expect(rewritten, `${url} left un-rewritten in ${html}`).not.toContain(`href="${url}"`);
        expect(rewritten, `${url} left un-rewritten in ${html}`).not.toContain(`href='${url}'`);
      }
      expect(rewritten).toContain("/api/email/track/click/tok0");
    }
  });

  it("does not track anything it cannot rewrite", () => {
    // The mirror of the case above: a shape the rewriter cannot handle must not be extracted
    // either, or the row is orphaned from the moment it is written.
    const unrewritable = [
      "<a href=https://acme.co/unquoted>u</a>", // no quotes — the rewriter requires them
      '<a href="ftp://acme.co/x">f</a>', // not http(s)
      '<a href="/relative">r</a>',
      '<a href="mailto:a@b.co">m</a>',
      "<p>bare https://acme.co/in-text stays text</p>", // not in an href
    ];
    for (const html of unrewritable) {
      expect(mergeClickTrackUrls("", html), html).toEqual([]);
    }
  });
});

describe("rewriteTrackedLinksInHtml", () => {
  it("keeps the original quote style", () => {
    const map = new Map([["https://acme.co/a", "https://t.co/1"]]);
    expect(rewriteTrackedLinksInHtml('<a href="https://acme.co/a">x</a>', map)).toContain('href="https://t.co/1"');
    expect(rewriteTrackedLinksInHtml("<a href='https://acme.co/a'>x</a>", map)).toContain("href='https://t.co/1'");
  });

  it("leaves URLs it was not given alone", () => {
    const html = '<a href="https://acme.co/a">a</a><a href="https://other.co/b">b</a>';
    const out = rewriteTrackedLinksInHtml(html, new Map([["https://acme.co/a", "https://t.co/1"]]));
    expect(out).toContain('href="https://t.co/1"');
    expect(out).toContain('href="https://other.co/b"');
  });

  it("returns the input untouched when there is nothing to do", () => {
    const html = '<a href="https://acme.co/a">a</a>';
    expect(rewriteTrackedLinksInHtml(html, new Map())).toBe(html);
    expect(rewriteTrackedLinksInHtml("", new Map([["a", "b"]]))).toBe("");
  });

  it("escapes the tracked URL it writes in", () => {
    // The replacement lands inside an attribute; an unescaped & would produce invalid HTML and an
    // unescaped quote would let a crafted tracked URL break out of the attribute.
    const out = rewriteTrackedLinksInHtml(
      '<a href="https://acme.co/a">a</a>',
      new Map([["https://acme.co/a", 'https://t.co/1?a=1&b=2"onmouseover="x']])
    );
    expect(out).not.toContain('"onmouseover="');
    expect(out).toContain("&amp;");
  });

  it("rewrites the same URL everywhere it appears", () => {
    const html = '<a href="https://acme.co/x">1</a> and <a href="https://acme.co/x">2</a>';
    const out = rewriteTrackedLinksInHtml(html, new Map([["https://acme.co/x", "https://t.co/1"]]));
    expect(out.match(/https:\/\/t\.co\/1/g)).toHaveLength(2);
    expect(out).not.toContain("acme.co/x");
  });
});

describe("mergeClickTrackUrls", () => {
  it("takes bare URLs from the plain-text body", () => {
    expect(mergeClickTrackUrls("see https://acme.co/a for more", "")).toEqual(["https://acme.co/a"]);
  });

  it("de-duplicates across the plain and html bodies", () => {
    const urls = mergeClickTrackUrls("https://acme.co/a", '<a href="https://acme.co/a">a</a>');
    expect(urls).toEqual(["https://acme.co/a"]);
  });

  it("stops a plain-text URL at whitespace and quotes rather than swallowing the rest", () => {
    expect(mergeClickTrackUrls('go to https://acme.co/a then "https://acme.co/b"', "")).toEqual([
      "https://acme.co/a",
      "https://acme.co/b",
    ]);
  });

  it("returns nothing for bodies with no links", () => {
    expect(mergeClickTrackUrls("", "")).toEqual([]);
    expect(mergeClickTrackUrls("no links here", "<p>none</p>")).toEqual([]);
  });
});

describe("parseAttachments", () => {
  const png = Buffer.from("iVBORw0KGgo=", "base64").toString("base64");

  it("treats absent attachments as an empty list, not an error", () => {
    expect(parseAttachments(undefined)).toEqual({ ok: true, parts: [] });
    expect(parseAttachments(null)).toEqual({ ok: true, parts: [] });
  });

  it("rejects a non-array outright", () => {
    for (const bad of ["a", 1, {}, true]) {
      expect(parseAttachments(bad).ok, JSON.stringify(bad)).toBe(false);
    }
  });

  it("fills in a filename and content type when the client omits them", () => {
    const result = parseAttachments([{ contentBase64: png }]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.parts[0].filename).toBe("attachment");
      expect(result.parts[0].contentType).toBe("application/octet-stream");
    }
  });

  it("skips entries with no content instead of failing the whole send", () => {
    const result = parseAttachments([
      { filename: "a.png", contentBase64: png },
      { filename: "empty.txt", contentBase64: "" },
      { filename: "nocontent.txt" },
      null,
      "junk",
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.parts.map((p) => p.filename)).toEqual(["a.png"]);
  });

  it("strips the newlines a base64 payload arrives wrapped in", () => {
    // Wrapped base64 is normal on the wire; leaving the newlines in corrupts the MIME part.
    const wrapped = `${png}\r\n${""}`;
    const result = parseAttachments([{ filename: "a.png", contentBase64: wrapped }]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.parts[0].base64).not.toMatch(/[\r\n]/);
  });

  it("refuses a set of attachments over the size limit", () => {
    // 24MB cap; two 13MB parts are individually fine and together are not.
    const big = Buffer.alloc(13 * 1024 * 1024, 1).toString("base64");
    const result = parseAttachments([
      { filename: "a.bin", contentBase64: big },
      { filename: "b.bin", contentBase64: big },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/size limit/i);
  });

  it("allows a single attachment under the limit", () => {
    const ok = Buffer.alloc(1024, 1).toString("base64");
    expect(parseAttachments([{ filename: "a.bin", contentBase64: ok }]).ok).toBe(true);
  });
});

describe("normalizeEmail", () => {
  it("trims and lowercases, since addresses are compared as strings elsewhere", () => {
    expect(normalizeEmail("  Sam@Example.COM  ")).toBe("sam@example.com");
    expect(normalizeEmail("a@b.co")).toBe("a@b.co");
    expect(normalizeEmail("")).toBe("");
  });
});

describe("linkifyTextWithTrackedHrefs", () => {
  /**
   * The fallback when a send has no HTML body: the plain text becomes the HTML part, with bare
   * URLs turned into anchors. It is the only path that builds HTML out of user text, so the
   * escaping here is what stops a plain-text body injecting markup.
   */
  it("turns a bare URL into an anchor, tracked when a replacement exists", () => {
    const out = linkifyTextWithTrackedHrefs("see https://acme.co/a", new Map([["https://acme.co/a", "https://t.co/1"]]));
    expect(out).toContain('href="https://t.co/1"');
    // The visible text stays the original URL — the recipient should see where they are going.
    expect(out).toContain(">https://acme.co/a<");
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener noreferrer"');
  });

  it("still links an untracked URL, using the URL itself as the href", () => {
    const out = linkifyTextWithTrackedHrefs("see https://acme.co/a", new Map());
    expect(out).toContain('href="https://acme.co/a"');
  });

  it("escapes the surrounding text so a plain-text body cannot inject markup", () => {
    const out = linkifyTextWithTrackedHrefs("<script>alert(1)</script> and https://acme.co/a", new Map());
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;script&gt;");
  });

  it("escapes markup that appears after the last URL too", () => {
    // The trailing chunk is handled by a separate branch from the leading one.
    const out = linkifyTextWithTrackedHrefs("https://acme.co/a then <img onerror=x>", new Map());
    expect(out).not.toContain("<img");
    expect(out).toContain("&lt;img");
  });

  it("turns newlines into breaks so the text keeps its shape", () => {
    const out = linkifyTextWithTrackedHrefs("line one\nline two", new Map());
    expect(out).toContain("<br>");
    expect(out).not.toContain("\n");
  });

  it("handles several URLs and the text between them", () => {
    const out = linkifyTextWithTrackedHrefs(
      "a https://acme.co/1 b https://acme.co/2 c",
      new Map([["https://acme.co/1", "https://t.co/1"]])
    );
    expect(out).toContain('href="https://t.co/1"');   // tracked
    expect(out).toContain('href="https://acme.co/2"'); // untracked but still linked
    expect(out.indexOf("a ")).toBeLessThan(out.indexOf("https://t.co/1"));
    expect(out).toContain(" c");
  });

  it("returns an empty string for empty input rather than an empty anchor", () => {
    expect(linkifyTextWithTrackedHrefs("", new Map())).toBe("");
  });

  it("leaves text with no URLs as escaped text", () => {
    expect(linkifyTextWithTrackedHrefs("just words & symbols", new Map())).toBe("just words &amp; symbols");
  });
});
