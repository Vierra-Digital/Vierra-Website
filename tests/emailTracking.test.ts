import { describe, it, expect } from "vitest";
import type { NextApiRequest } from "next";
import { asToken, hashIp, trackingClientIp, isLikelySelfPreview, isPrefetchOpen } from "@/lib/api/emailTracking";

const req = (headers: Record<string, string | string[] | undefined>, remoteAddress = ""): NextApiRequest =>
  ({ headers, socket: { remoteAddress } } as unknown as NextApiRequest);

describe("asToken", () => {
  it("returns the value, the first array element, or empty string", () => {
    expect(asToken("abc")).toBe("abc");
    expect(asToken(["a", "b"])).toBe("a");
    expect(asToken(undefined)).toBe("");
  });
});

describe("hashIp", () => {
  it("returns null for an empty ip", () => {
    expect(hashIp("")).toBeNull();
  });
  it("is a deterministic 64-char sha256 hex, distinct per ip", () => {
    const h = hashIp("1.2.3.4");
    expect(h).toMatch(/^[a-f0-9]{64}$/);
    expect(hashIp("1.2.3.4")).toBe(h);
    expect(hashIp("1.2.3.5")).not.toBe(h);
  });
});

describe("trackingClientIp", () => {
  it("uses the first x-forwarded-for hop", () => {
    expect(trackingClientIp(req({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" }))).toBe("9.9.9.9");
  });
  it("falls back to the socket address", () => {
    expect(trackingClientIp(req({}, "5.5.5.5"))).toBe("5.5.5.5");
  });
  it("returns empty string when nothing is available", () => {
    expect(trackingClientIp(req({}))).toBe("");
  });
});

describe("isLikelySelfPreview", () => {
  it("treats a same-origin fetch as self-preview", () => {
    expect(isLikelySelfPreview(req({ "sec-fetch-site": "same-origin" }))).toBe(true);
  });
  it("treats a /panel referer on the same origin as self-preview", () => {
    expect(
      isLikelySelfPreview(req({ host: "app.test", "x-forwarded-proto": "https", referer: "https://app.test/panel/email" }))
    ).toBe(true);
  });
  it("does not flag a non-panel path, a cross-origin referer, or no referer", () => {
    expect(isLikelySelfPreview(req({ host: "app.test", referer: "http://app.test/other" }))).toBe(false);
    expect(isLikelySelfPreview(req({ host: "app.test", referer: "http://evil.test/panel" }))).toBe(false);
    expect(isLikelySelfPreview(req({}))).toBe(false);
  });
});

describe("isPrefetchOpen", () => {
  it("flags known security-gateway user agents", () => {
    expect(isPrefetchOpen("Proofpoint-Scanner", 999_999)).toBe(true);
    expect(isPrefetchOpen("delivered via Mimecast", 999_999)).toBe(true);
  });
  it("flags generic scanner/bot/preview user agents", () => {
    expect(isPrefetchOpen("HeadlessChrome/120", 999_999)).toBe(true);
    expect(isPrefetchOpen("Some Crawler", 999_999)).toBe(true);
    expect(isPrefetchOpen("link preview bot", 999_999)).toBe(true);
  });
  it("flags any open within 10s of send (Apple MPP / inbound scanners)", () => {
    expect(isPrefetchOpen("Mozilla/5.0", 0)).toBe(true);
    expect(isPrefetchOpen("Mozilla/5.0", 5_000)).toBe(true);
  });
  it("treats a later open as real — including Gmail's image proxy", () => {
    expect(isPrefetchOpen("Mozilla/5.0", 60_000)).toBe(false);
    expect(isPrefetchOpen("GoogleImageProxy", 60_000)).toBe(false); // proxy fetches on genuine open
    expect(isPrefetchOpen(null, 60_000)).toBe(false);
  });
});
