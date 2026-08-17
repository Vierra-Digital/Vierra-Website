import { describe, it, expect } from "vitest";
import { scoreTrackerImage, decodeProxiedUrl, scanHtmlForTrackers } from "@/lib/email/trackerDetection";

describe("scoreTrackerImage", () => {
  it("ignores inline/embedded images (data:, cid:) and empty src", () => {
    for (const src of ["", "data:image/png;base64,AAAA", "cid:logo@x"]) {
      const v = scoreTrackerImage({ src });
      expect(v.tracked).toBe(false);
      expect(v.score).toBe(0);
    }
  });

  it("flags a 1x1 remote beacon carrying a high-entropy per-recipient token", () => {
    const v = scoreTrackerImage({
      src: "https://track.example.com/o/abcd1234efgh5678",
      width: "1",
      height: "1",
    });
    expect(v.tracked).toBe(true);
    // tiny (3) + third-party (1) + random-token (2) alone clear the medium threshold.
    expect(v.score).toBeGreaterThanOrEqual(3);
    expect(v.reasons).toContain("tiny");
    expect(v.reasons).toContain("random-token");
  });

  it("does not flag an ordinary sized content image with alt text", () => {
    const v = scoreTrackerImage({
      src: "https://www.example.com/images/hero.jpg",
      width: "600",
      height: "300",
      alt: "Product hero",
    });
    expect(v.tracked).toBe(false);
  });

  it("names the vendor on a known tracker-pixel host (high confidence)", () => {
    const v = scoreTrackerImage({ src: "https://mailtrack.io/trace/abc123" });
    expect(v.tracked).toBe(true);
    expect(v.vendor).toBe("Mailtrack");
    expect(v.confidence).toBe("high");
    expect(v.score).toBeGreaterThanOrEqual(5);
  });

  it("detects a 1px beacon declared via inline style", () => {
    const v = scoreTrackerImage({
      src: "https://beacon.example.com/p/z9y8x7w6v5u4t3s2",
      style: "width:1px;height:1px;display:none",
    });
    expect(v.reasons).toContain("tiny");
    expect(v.reasons).toContain("hidden");
    expect(v.tracked).toBe(true);
  });

  it("treats a known CDN image with no vendor hit as not-a-beacon", () => {
    const v = scoreTrackerImage({ src: "https://d111111abcdef8.cloudfront.net/banner.png" });
    expect(v.tracked).toBe(false);
    expect(v.reasons).toContain("cdn");
  });
});

describe("scanHtmlForTrackers (server-side, DOM-free)", () => {
  it("returns nothing for empty or tracker-free HTML", () => {
    expect(scanHtmlForTrackers("")).toEqual({ count: 0, vendors: [] });
    expect(
      scanHtmlForTrackers('<p>Hi</p><img src="https://www.example.com/logo.png" width="200" alt="Logo">')
    ).toEqual({ count: 0, vendors: [] });
  });

  it("names the vendor for a known tracker-pixel <img>", () => {
    const r = scanHtmlForTrackers('<img src="https://mailtrack.io/trace/abc" width="1" height="1">');
    expect(r.count).toBe(1);
    expect(r.vendors).toContain("Mailtrack");
  });

  it("catches a beacon hidden in a background-image style", () => {
    const r = scanHtmlForTrackers(
      '<div style="background-image:url(\'https://track.example.com/o/abcd1234efgh5678\');width:1px;height:1px"></div>'
    );
    expect(r.count).toBeGreaterThanOrEqual(1);
  });
});

describe("decodeProxiedUrl", () => {
  it("unwraps a googleusercontent proxy to the original tracked URL", () => {
    expect(
      decodeProxiedUrl("https://ci3.googleusercontent.com/proxy/xyz#https://track.foo.com/o/123")
    ).toBe("https://track.foo.com/o/123");
  });

  it("returns non-proxied URLs unchanged", () => {
    expect(decodeProxiedUrl("https://track.foo.com/o/123")).toBe("https://track.foo.com/o/123");
  });
});

describe("visible images are content, not beacons", () => {
  // Regression: a hosted signature logo scored third-party(+1) + random-token(+2) = 3, hitting the
  // flag threshold, so the reader stripped it. A beacon is invisible by definition — anything
  // declaring real dimensions must survive heuristics.
  it("keeps a remote logo with a hashed filename when it declares a visible width", () => {
    const verdict = scoreTrackerImage({
      src: "https://mail.assets-cdn.io/a1b2c3d4e5f6a7b8/vierra-logo.png",
      width: "180",
      height: "48",
      alt: "",
      style: null,
    });
    expect(verdict.tracked).toBe(false);
  });

  it("keeps a visible logo sized only via inline style", () => {
    const verdict = scoreTrackerImage({
      src: "https://email.somehost.net/9f8e7d6c5b4a3210/logo.png",
      width: null,
      height: null,
      alt: null,
      style: "width: 200px; height: 60px;",
    });
    expect(verdict.tracked).toBe(false);
  });

  it("still flags a 1x1 beacon on the same kind of host", () => {
    const verdict = scoreTrackerImage({
      src: "https://track.somehost.net/9f8e7d6c5b4a3210/open.gif",
      width: "1",
      height: "1",
      alt: "",
      style: null,
    });
    expect(verdict.tracked).toBe(true);
  });

  it("still flags a known vendor beacon even when it claims a large size", () => {
    // A vendor-pattern hit is direct evidence, so it must outrank the visible-size exemption.
    const verdict = scoreTrackerImage({
      src: "https://t.yesware.com/t/abc123/spacer.gif",
      width: "600",
      height: "200",
      alt: null,
      style: null,
    });
    expect(verdict.tracked).toBe(true);
  });
});
