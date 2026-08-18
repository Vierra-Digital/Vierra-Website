import { describe, it, expect, beforeEach } from "vitest";
import {
  getCachedSenderPhoto,
  setCachedSenderPhoto,
  clearSenderPhotoCache,
} from "@/lib/gmail/senderPhotoCache";

const HOUR = 60 * 60 * 1000;

beforeEach(() => clearSenderPhotoCache());

describe("sender photo cache", () => {
  it("returns undefined for an unknown sender and the URL once stored", () => {
    expect(getCachedSenderPhoto("me@x.com", "dan@y.com", 0)).toBeUndefined();
    setCachedSenderPhoto("me@x.com", "dan@y.com", "https://photo", 0);
    expect(getCachedSenderPhoto("me@x.com", "dan@y.com", 0)).toBe("https://photo");
  });

  it("caches a miss as \"\" so a sender with no photo is not re-queried", () => {
    setCachedSenderPhoto("me@x.com", "nobody@y.com", "", 0);
    // "" is distinct from undefined: the caller must be able to tell "known to have none" from "unknown".
    expect(getCachedSenderPhoto("me@x.com", "nobody@y.com", 0)).toBe("");
  });

  it("expires a miss sooner than a hit, so a newly added photo appears", () => {
    setCachedSenderPhoto("me@x.com", "hit@y.com", "https://photo", 0);
    setCachedSenderPhoto("me@x.com", "miss@y.com", "", 0);
    const later = HOUR;
    expect(getCachedSenderPhoto("me@x.com", "miss@y.com", later)).toBeUndefined();
    expect(getCachedSenderPhoto("me@x.com", "hit@y.com", later)).toBe("https://photo");
  });

  it("expires a hit after its TTL", () => {
    setCachedSenderPhoto("me@x.com", "dan@y.com", "https://photo", 0);
    expect(getCachedSenderPhoto("me@x.com", "dan@y.com", 13 * HOUR)).toBeUndefined();
  });

  it("scopes entries per mailbox so one account's miss can't mask another's photo", () => {
    setCachedSenderPhoto("a@x.com", "dan@y.com", "", 0);
    setCachedSenderPhoto("b@x.com", "dan@y.com", "https://photo", 0);
    expect(getCachedSenderPhoto("a@x.com", "dan@y.com", 0)).toBe("");
    expect(getCachedSenderPhoto("b@x.com", "dan@y.com", 0)).toBe("https://photo");
  });

  it("matches regardless of address casing", () => {
    setCachedSenderPhoto("Me@X.com", "Dan@Y.com", "https://photo", 0);
    expect(getCachedSenderPhoto("me@x.com", "dan@y.com", 0)).toBe("https://photo");
  });

  it("stays bounded, evicting the oldest entries", () => {
    for (let i = 0; i < 2_100; i += 1) setCachedSenderPhoto("me@x.com", `s${i}@y.com`, "https://p", 0);
    expect(getCachedSenderPhoto("me@x.com", "s0@y.com", 0)).toBeUndefined();
    expect(getCachedSenderPhoto("me@x.com", "s2099@y.com", 0)).toBe("https://p");
  });
});
