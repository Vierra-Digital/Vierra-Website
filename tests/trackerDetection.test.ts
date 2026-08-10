import { describe, it, expect } from "vitest";
import { scoreTrackerImage, decodeProxiedUrl } from "@/lib/email/trackerDetection";

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
