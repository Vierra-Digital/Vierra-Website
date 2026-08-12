import { describe, it, expect, vi } from "vitest";

// sendCore pulls in prisma/smtp/tokens at import; mock them so we can exercise its pure, exported
// tracking helpers (which power click tracking for both regular and campaign sends).
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/gmail/tokens", () => ({ getValidGmailAccessToken: vi.fn() }));
vi.mock("@/lib/email/smtp", () => ({ createSmtpTransport: vi.fn() }));
vi.mock("@/lib/api/emailAccounts", () => ({ resolveAccountId: vi.fn() }));

import {
  mergeClickTrackUrls,
  rewriteTrackedLinksInHtml,
  escapeHtml,
  normalizeEmail,
  parseAttachments,
} from "@/lib/gmail/sendCore";

describe("escapeHtml", () => {
  it("escapes HTML metacharacters", () => {
    expect(escapeHtml(`<a href="x">& '`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp; &#39;");
  });
});

describe("mergeClickTrackUrls", () => {
  it("collects URLs from plain text and from HTML hrefs, deduped", () => {
    const urls = mergeClickTrackUrls(
      "see https://a.com now",
      '<a href="https://b.com">L</a> plus https://a.com'
    );
    // plain text contributes a.com; html contributes the href b.com. (A bare URL in html TEXT is
    // not an href, so it isn't added from the html side — and a.com dedupes.)
    expect(urls.sort()).toEqual(["https://a.com", "https://b.com"]);
  });

  it("extracts single- and double-quoted hrefs", () => {
    expect(mergeClickTrackUrls("", `<a href='https://q1.com'>a</a><a href="https://q2.com">b</a>`).sort()).toEqual([
      "https://q1.com",
      "https://q2.com",
    ]);
  });
});

describe("rewriteTrackedLinksInHtml", () => {
  it("rewrites only hrefs present in the replacements map", () => {
    const map = new Map([["https://a.com", "https://t.example.com/c/tok1"]]);
    const out = rewriteTrackedLinksInHtml('<a href="https://a.com">A</a><a href="https://b.com">B</a>', map);
    expect(out).toContain('href="https://t.example.com/c/tok1"');
    expect(out).toContain('href="https://b.com"'); // untracked link left alone
  });

  it("returns the input unchanged when there are no replacements", () => {
    const html = '<a href="https://a.com">A</a>';
    expect(rewriteTrackedLinksInHtml(html, new Map())).toBe(html);
    expect(rewriteTrackedLinksInHtml("", new Map([["x", "y"]]))).toBe("");
  });
});

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Alex@Example.COM ")).toBe("alex@example.com");
  });
});

describe("parseAttachments", () => {
  it("returns empty parts for null/undefined input", () => {
    expect(parseAttachments(null)).toEqual({ ok: true, parts: [] });
    expect(parseAttachments(undefined)).toEqual({ ok: true, parts: [] });
  });

  it("rejects a non-array", () => {
    expect(parseAttachments("nope").ok).toBe(false);
  });

  it("parses valid attachments, applies filename/type defaults, strips newlines", () => {
    const r = parseAttachments([
      { filename: "f.txt", contentType: "text/plain", contentBase64: "aGVsbG8=" },
      { contentBase64: "d29ybGQ=" },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.parts).toHaveLength(2);
      expect(r.parts[0]).toEqual({ filename: "f.txt", contentType: "text/plain", base64: "aGVsbG8=" });
      expect(r.parts[1].filename).toBe("attachment");
      expect(r.parts[1].contentType).toBe("application/octet-stream");
    }
  });

  it("skips items with missing or empty content", () => {
    const r = parseAttachments([{ filename: "empty" }, { contentBase64: "" }]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.parts).toHaveLength(0);
  });
});
