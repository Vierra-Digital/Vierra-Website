import { describe, it, expect, beforeEach } from "vitest";
import {
  parseBimiRecord,
  rootDomain,
  bimiLookupDomains,
  resolveBimiLogoUrl,
  clearBimiCache,
} from "@/lib/email/bimi";
import { senderAvatarSources } from "@/lib/email/senderAvatar";

beforeEach(() => clearBimiCache());

describe("parseBimiRecord", () => {
  it("reads the logo from Apple's real record", () => {
    // Verified live at default._bimi.email.apple.com — the case that had no favicon at all.
    const record = "v=BIMI1;l=https://www.apple.com/bimi/v2/apple.svg;a=https://www.apple.com/bimi/v2/apple.pem;";
    expect(parseBimiRecord(record)).toBe("https://www.apple.com/bimi/v2/apple.svg");
  });

  it("tolerates spacing variants, as seen on cnn.com and linkedin.com", () => {
    expect(parseBimiRecord("v=BIMI1; l=https://cdn.example.com/logo.svg; a=https://cdn.example.com/c.pem"))
      .toBe("https://cdn.example.com/logo.svg");
  });

  it("never returns the certificate in place of the logo", () => {
    // a= vouches for the logo and is not an image; an empty l= must not fall through to it.
    expect(parseBimiRecord("v=BIMI1; l=; a=https://cdn.example.com/cert.pem")).toBe("");
  });

  it("rejects anything that is not an https SVG", () => {
    expect(parseBimiRecord("v=BIMI1; l=http://example.com/logo.svg")).toBe("");
    expect(parseBimiRecord("v=BIMI1; l=https://example.com/logo.png")).toBe("");
    expect(parseBimiRecord("v=BIMI1; l=not-a-url")).toBe("");
  });

  it("ignores records that are not BIMI", () => {
    expect(parseBimiRecord("v=spf1 include:_spf.google.com ~all")).toBe("");
    expect(parseBimiRecord("")).toBe("");
  });

  it("keeps a query string intact rather than splitting on its =", () => {
    expect(parseBimiRecord("v=BIMI1; l=https://cdn.example.com/logo.svg?v=2")).toBe(
      "https://cdn.example.com/logo.svg?v=2"
    );
  });
});

describe("rootDomain", () => {
  it("reduces a sending subdomain to its registrable domain", () => {
    expect(rootDomain("email.apple.com")).toBe("apple.com");
    expect(rootDomain("insideapple.apple.com")).toBe("apple.com");
    expect(rootDomain("e.notion.so")).toBe("notion.so");
    expect(rootDomain("apple.com")).toBe("apple.com");
  });

  it("does not reduce a multi-label public suffix to nonsense", () => {
    expect(rootDomain("mail.company.co.uk")).toBe("company.co.uk");
    expect(rootDomain("news.example.com.au")).toBe("example.com.au");
  });
});

describe("bimiLookupDomains", () => {
  it("tries the sending subdomain before the root", () => {
    expect(bimiLookupDomains("email.apple.com")).toEqual(["email.apple.com", "apple.com"]);
  });

  it("does not look the same domain up twice", () => {
    expect(bimiLookupDomains("apple.com")).toEqual(["apple.com"]);
  });
});

describe("resolveBimiLogoUrl", () => {
  const record = (url: string) => [[`v=BIMI1;l=${url};`]];

  it("finds a record on the sending subdomain", async () => {
    const seen: string[] = [];
    const url = await resolveBimiLogoUrl("email.apple.com", 0, async (host) => {
      seen.push(host);
      return record("https://www.apple.com/bimi/v2/apple.svg");
    });
    expect(url).toBe("https://www.apple.com/bimi/v2/apple.svg");
    expect(seen).toEqual(["default._bimi.email.apple.com"]);
  });

  it("falls back to the root domain when the subdomain has none", async () => {
    const seen: string[] = [];
    const url = await resolveBimiLogoUrl("e.brand.com", 0, async (host) => {
      seen.push(host);
      if (host.includes("e.brand.com")) throw Object.assign(new Error("nope"), { code: "ENOTFOUND" });
      return record("https://brand.com/logo.svg");
    });
    expect(url).toBe("https://brand.com/logo.svg");
    expect(seen).toEqual(["default._bimi.e.brand.com", "default._bimi.brand.com"]);
  });

  it("treats a DNS failure as no logo rather than an error", async () => {
    await expect(
      resolveBimiLogoUrl("stripe.com", 0, async () => {
        throw Object.assign(new Error("ENODATA"), { code: "ENODATA" });
      })
    ).resolves.toBe("");
  });

  it("joins the chunks of a split TXT record before parsing", async () => {
    const url = await resolveBimiLogoUrl("brand.com", 0, async () => [
      ["v=BIMI1;l=https://brand.com/very", "-long-logo-name.svg;"],
    ]);
    expect(url).toBe("https://brand.com/very-long-logo-name.svg");
  });

  it("caches, so repeat senders cost no further DNS lookups", async () => {
    let calls = 0;
    const resolver = async () => {
      calls += 1;
      return record("https://brand.com/logo.svg");
    };
    await resolveBimiLogoUrl("brand.com", 0, resolver);
    await resolveBimiLogoUrl("brand.com", 1_000, resolver);
    expect(calls).toBe(1);
  });

  it("re-checks a miss sooner than a hit", async () => {
    let calls = 0;
    const resolver = async () => {
      calls += 1;
      throw Object.assign(new Error("nope"), { code: "ENOTFOUND" });
    };
    await resolveBimiLogoUrl("brand.com", 0, resolver);
    await resolveBimiLogoUrl("brand.com", 2 * 60 * 60 * 1000, resolver);
    // Two lookups: a brand that publishes a record later should start showing it.
    expect(calls).toBeGreaterThan(1);
  });
});

describe("senderAvatarSources with the new sources", () => {
  it("puts the published logo ahead of anything inferred", () => {
    const sources = senderAvatarSources("noreply@email.apple.com", "", "https://www.apple.com/bimi/v2/apple.svg");
    expect(sources[0]).toEqual({ url: "https://www.apple.com/bimi/v2/apple.svg", kind: "logo" });
  });

  it("adds a root-domain favicon for a sending subdomain", () => {
    const urls = senderAvatarSources("noreply@email.apple.com").map((s) => s.url);
    // email.apple.com 404s at the favicon service; apple.com returns a logo.
    expect(urls.some((u) => u.includes(encodeURIComponent("https://email.apple.com")))).toBe(true);
    expect(urls.some((u) => u.includes(encodeURIComponent("https://apple.com")))).toBe(true);
  });

  it("does not duplicate the favicon when the sender is already on the root domain", () => {
    const urls = senderAvatarSources("someone@apple.com").map((s) => s.url);
    const faviconCount = urls.filter((u) => u.includes("faviconV2")).length;
    expect(faviconCount).toBe(1);
  });
});
