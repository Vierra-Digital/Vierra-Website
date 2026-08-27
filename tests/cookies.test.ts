import { describe, expect, it } from "vitest";
import { serializeCookie } from "@/lib/api/cookies";

/**
 * cookie 2 removed the positional `serialize(name, value, options)` signature, so lib/api/cookies
 * adapts the object-based `stringifySetCookie` back to it. These are the exact strings cookie 1's
 * `serialize` produced for the same inputs, captured before the upgrade — the point is that the
 * adapter is byte-for-byte equivalent, not merely type-correct.
 *
 * Auth cookies depend on these attributes, so a silent change here would weaken a session rather
 * than fail a build.
 */
describe("serializeCookie", () => {
  it("matches cookie 1 output for a secure session cookie", () => {
    expect(
      serializeCookie("ob_session", "tok123", {
        httpOnly: true,
        sameSite: "lax",
        secure: true,
        path: "/",
        maxAge: 86400,
      })
    ).toBe("ob_session=tok123; Max-Age=86400; Path=/; HttpOnly; Secure; SameSite=Lax");
  });

  it("omits Secure when it is false, as cookie 1 did", () => {
    expect(
      serializeCookie("ob_session", "tok123", {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        path: "/",
        maxAge: 3600,
      })
    ).toBe("ob_session=tok123; Max-Age=3600; Path=/; HttpOnly; SameSite=Lax");
  });

  it("handles an OAuth state cookie", () => {
    expect(
      serializeCookie("state", "abc-def", {
        httpOnly: true,
        sameSite: "lax",
        secure: true,
        path: "/",
        maxAge: 600,
      })
    ).toBe("state=abc-def; Max-Age=600; Path=/; HttpOnly; Secure; SameSite=Lax");
  });

  it("keeps Max-Age=0, which is how a cookie is cleared", () => {
    // A falsy maxAge must still be emitted; dropping it would leave the cookie in place.
    expect(serializeCookie("x", "del", { httpOnly: true, path: "/", maxAge: 0 })).toBe(
      "x=del; Max-Age=0; Path=/; HttpOnly"
    );
  });

  it("emits nothing beyond name=value when no options are given", () => {
    expect(serializeCookie("plain", "v")).toBe("plain=v");
  });
});
