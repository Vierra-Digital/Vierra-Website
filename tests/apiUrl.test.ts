import { describe, expect, it } from "vitest";
import { toSameSiteUrl } from "@/lib/api/url";

const BASE = "https://vierradev.com";

describe("toSameSiteUrl", () => {
  it("keeps a relative path on the base", () => {
    expect(toSameSiteUrl("/session/abc123", BASE)).toBe("https://vierradev.com/session/abc123");
  });

  it("keeps the query string", () => {
    expect(toSameSiteUrl("/session/abc?step=2", BASE)).toBe("https://vierradev.com/session/abc?step=2");
  });

  it("passes an absolute link that is already on the base through unchanged", () => {
    expect(toSameSiteUrl("https://vierradev.com/session/abc", BASE)).toBe("https://vierradev.com/session/abc");
  });

  it("rewrites a link sent from another origin onto the base", () => {
    // The panel sends window.location.origin, which differs from the configured base on www and on
    // deploy previews. Those must keep working, pointing at the base.
    expect(toSameSiteUrl("https://www.vierradev.com/session/abc", BASE)).toBe("https://vierradev.com/session/abc");
  });

  it("strips an off-site origin instead of emailing it out", () => {
    expect(toSameSiteUrl("https://evil.example/phish", BASE)).toBe("https://vierradev.com/phish");
  });

  it("drops credentials and ports smuggled in via the authority", () => {
    expect(toSameSiteUrl("https://user:pw@evil.example:8443/x", BASE)).toBe("https://vierradev.com/x");
  });

  it("does not preserve a javascript: payload", () => {
    // Parsed as a URL with no path of its own, so nothing dangerous survives onto the base.
    expect(toSameSiteUrl("javascript:alert(1)", BASE)).toBe("https://vierradev.com/alert(1)");
  });

  it("neutralises a protocol-relative link", () => {
    // //host/path is the classic way past a naive "starts with /" check.
    expect(toSameSiteUrl("//evil.example/x", BASE)).toBe("https://vierradev.com/x");
  });

  it("falls back to the base root for an empty link", () => {
    // The handler rejects a missing link before this point; asserted so the behaviour is pinned.
    expect(toSameSiteUrl("", BASE)).toBe("https://vierradev.com/");
  });

  it("returns null when the input cannot be parsed as a URL", () => {
    expect(toSameSiteUrl("http://", BASE)).toBeNull();
  });
});
