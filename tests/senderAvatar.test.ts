import { describe, it, expect } from "vitest";
import {
  gravatarHash,
  gravatarUrl,
  faviconUrl,
  senderDomain,
  senderAvatarCandidates,
  senderAvatarSources,
} from "@/lib/email/senderAvatar";

describe("gravatarHash", () => {
  it("matches Gravatar's published example vector (trimmed + lowercased md5)", () => {
    // From Gravatar's own docs: "MyEmailAddress@example.com " hashes to this.
    expect(gravatarHash("MyEmailAddress@example.com ")).toBe("0bc83cb571cd1c50ba6f3e8a78ef1346");
  });

  it("is case- and whitespace-insensitive", () => {
    expect(gravatarHash("  Foo@Bar.COM ")).toBe(gravatarHash("foo@bar.com"));
  });
});

describe("gravatarUrl", () => {
  it("requests d=404 so a missing avatar falls through instead of returning a placeholder", () => {
    const url = gravatarUrl("foo@bar.com");
    expect(url).toContain("d=404");
    expect(url).toContain(gravatarHash("foo@bar.com"));
  });

  it("honours the requested size", () => {
    expect(gravatarUrl("foo@bar.com", 128)).toContain("s=128");
  });
});

describe("senderDomain", () => {
  it("extracts and lowercases a valid domain", () => {
    expect(senderDomain("Person@Example.COM")).toBe("example.com");
  });
  it("rejects malformed addresses", () => {
    expect(senderDomain("no-at-sign")).toBe("");
    expect(senderDomain("a@localhost")).toBe("");
    expect(senderDomain("")).toBe("");
  });
});

describe("faviconUrl", () => {
  it("builds a favicon URL for a company domain", () => {
    const url = faviconUrl("someone@vierradev.com");
    expect(url).toContain("faviconV2");
    expect(url).toContain(encodeURIComponent("https://vierradev.com"));
  });

  it("skips consumer domains, where a favicon is the provider's logo for every sender", () => {
    expect(faviconUrl("someone@gmail.com")).toBe("");
    expect(faviconUrl("someone@outlook.com")).toBe("");
    expect(faviconUrl("someone@icloud.com")).toBe("");
  });
});

describe("senderAvatarCandidates", () => {
  it("puts the Google Contacts photo first when one exists", () => {
    const candidates = senderAvatarCandidates("someone@vierradev.com", "https://lh3.googleusercontent.com/x");
    expect(candidates[0]).toBe("https://lh3.googleusercontent.com/x");
    expect(candidates.length).toBe(3);
  });

  it("still offers gravatar + favicon when there is no contact photo — the case that used to show initials only", () => {
    const candidates = senderAvatarCandidates("someone@vierradev.com", "");
    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toContain("gravatar");
    expect(candidates[1]).toContain("faviconV2");
  });

  it("offers only gravatar for a consumer domain", () => {
    const candidates = senderAvatarCandidates("someone@gmail.com");
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toContain("gravatar");
  });

  it("returns nothing usable for a malformed address, so the caller shows initials", () => {
    expect(senderAvatarCandidates("not-an-email")).toEqual([]);
    expect(senderAvatarCandidates("")).toEqual([]);
  });

  it("de-duplicates so the error-walk cannot stall on a repeat", () => {
    const photo = gravatarUrl("someone@vierradev.com");
    expect(senderAvatarCandidates("someone@vierradev.com", photo).filter((u) => u === photo)).toHaveLength(1);
  });
});

describe("senderAvatarSources", () => {
  it("tags a favicon as a logo so the UI contains rather than crops it", () => {
    const sources = senderAvatarSources("someone@vierradev.com", "");
    expect(sources.map((s) => s.kind)).toEqual(["photo", "logo"]);
  });

  it("requests 2x assets so a 40px avatar stays crisp on retina", () => {
    const sources = senderAvatarSources("someone@vierradev.com", "");
    expect(sources[0].url).toContain("s=160");
    expect(sources[1].url).toContain("size=128");
  });

  it("treats a Google Contacts photo as a photo and puts it first", () => {
    const sources = senderAvatarSources("someone@vierradev.com", "https://lh3.googleusercontent.com/x");
    expect(sources[0]).toEqual({ url: "https://lh3.googleusercontent.com/x", kind: "photo" });
  });

  it("returns nothing for a malformed address", () => {
    expect(senderAvatarSources("nope")).toEqual([]);
  });
});
