import { afterEach, describe, expect, it, vi } from "vitest";
import type { NextApiRequest, NextApiResponse } from "next";
import {
  appendSetCookie,
  clearOauthStateCookie,
  issueOauthStateCookie,
  readCookies,
  resolveRuntimeBaseUrl,
  setOnboardingSessionCookie,
  setScopedOauthCookie,
} from "@/lib/api/oauth";

/**
 * The OAuth state cookie is the CSRF defence on every connect flow, and ob_session is the
 * onboarding session itself. Both were being written with res.setHeader, which replaces the whole
 * header rather than adding to it — so in /api/googleads/callback and /api/linkedin/callback,
 * clearOauthStateCookie ran first and setOnboardingSessionCookie ran second and silently dropped
 * it. The state cookie was never actually cleared. Reversing the order would have dropped the
 * session cookie instead.
 *
 * The composition cases below are the ones that matter: they fail if any helper goes back to
 * replacing the header.
 */

function fakeRes() {
  const headers: Record<string, string | string[] | number> = {};
  const res = {
    setHeader(name: string, value: string | string[] | number) {
      headers[name.toLowerCase()] = value;
    },
    getHeader(name: string) {
      return headers[name.toLowerCase()];
    },
  } as unknown as NextApiResponse;
  const cookies = () => {
    const v = headers["set-cookie"];
    return v === undefined ? [] : Array.isArray(v) ? v : [String(v)];
  };
  return { res, cookies };
}

/** The name each Set-Cookie header sets, in order. */
function names(cookies: string[]): string[] {
  return cookies.map((c) => c.split("=")[0]);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("cookie helpers compose", () => {
  it("keeps the state clear when a session cookie is set after it", () => {
    // Exactly the order /api/googleads/callback and /api/linkedin/callback use.
    const { res, cookies } = fakeRes();
    clearOauthStateCookie(res, "ga_oauth_state", "/api/googleads/callback");
    setOnboardingSessionCookie(res, "sess-123");

    expect(names(cookies())).toEqual(["ga_oauth_state", "ob_session"]);
    // The clear has to survive, or the state cookie lives on for its full 10 minutes.
    expect(cookies()[0]).toContain("Max-Age=0");
  });

  it("keeps the session cookie when the state clear comes after it", () => {
    // The mirror: the hazard was the ordering, so neither order may lose a cookie.
    const { res, cookies } = fakeRes();
    setOnboardingSessionCookie(res, "sess-123");
    clearOauthStateCookie(res, "ga_oauth_state", "/api/googleads/callback");

    expect(names(cookies())).toEqual(["ob_session", "ga_oauth_state"]);
  });

  it("keeps every scoped cookie alongside the state cookie", () => {
    // The order /api/gmail/initiate uses: state, then three scoped values.
    const { res, cookies } = fakeRes();
    issueOauthStateCookie(res, "gm_oauth_state", "/api/gmail/callback");
    setScopedOauthCookie(res, "gm_oauth_redirect", "https://x/cb", "/api/gmail/callback");
    setScopedOauthCookie(res, "gm_oauth_reconnect", "a@b.co", "/api/gmail/callback");
    setScopedOauthCookie(res, "gm_oauth_source", "panel", "/api/gmail/callback");

    expect(names(cookies())).toEqual([
      "gm_oauth_state",
      "gm_oauth_redirect",
      "gm_oauth_reconnect",
      "gm_oauth_source",
    ]);
  });

  it("survives the state cookie being issued last", () => {
    const { res, cookies } = fakeRes();
    setScopedOauthCookie(res, "gm_oauth_redirect", "https://x/cb", "/api/gmail/callback");
    issueOauthStateCookie(res, "gm_oauth_state", "/api/gmail/callback");

    expect(names(cookies())).toHaveLength(2);
  });
});

describe("the supabase session-refresh scenario", () => {
  /**
   * All six OAuth callbacks go through requireSession, which builds a Supabase server client.
   * When that client refreshes the access token it writes the new auth cookies through its own
   * setAll, as a single setHeader carrying an array. The callback body then sets its own cookies
   * afterwards.
   *
   * This is the case that made the overwrite worth fixing beyond the state cookie itself: with the
   * old res.setHeader setters, the callback discarded the refreshed sb-access-token and
   * sb-refresh-token, so a user who happened to connect an integration during a token refresh
   * lost the refresh and was signed out earlier than they should have been.
   */
  it("keeps the refreshed auth cookies when a callback then sets its own", () => {
    const { res, cookies } = fakeRes();
    // Exactly what lib/supabase/server.ts setAll does: one setHeader, an array of cookies.
    res.setHeader("Set-Cookie", ["sb-access-token=new1; Path=/", "sb-refresh-token=new2; Path=/"]);

    clearOauthStateCookie(res, "ga_oauth_state", "/api/googleads/callback");
    setOnboardingSessionCookie(res, "sess-1");

    expect(names(cookies())).toEqual([
      "sb-access-token",
      "sb-refresh-token",
      "ga_oauth_state",
      "ob_session",
    ]);
  });
});

describe("appendSetCookie", () => {
  it("handles no header, a single string header, and an existing array", () => {
    const { res, cookies } = fakeRes();
    appendSetCookie(res, "a=1");
    expect(cookies()).toEqual(["a=1"]);

    appendSetCookie(res, "b=2");
    expect(cookies()).toEqual(["a=1", "b=2"]);

    appendSetCookie(res, "c=3");
    expect(cookies()).toEqual(["a=1", "b=2", "c=3"]);
  });

  it("promotes a pre-existing string header rather than discarding it", () => {
    // Something else may have set one cookie the plain way before we get here.
    const { res, cookies } = fakeRes();
    res.setHeader("Set-Cookie", "existing=1");
    appendSetCookie(res, "new=2");
    expect(cookies()).toEqual(["existing=1", "new=2"]);
  });
});

describe("issueOauthStateCookie", () => {
  it("returns the state it set, so the caller can put it in the redirect", () => {
    const { res, cookies } = fakeRes();
    const state = issueOauthStateCookie(res, "gm_oauth_state", "/api/gmail/callback");
    expect(cookies()[0]).toContain(`gm_oauth_state=${state}`);
  });

  it("mints 32 hex characters of randomness, not something guessable", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 25; i++) {
      const { res } = fakeRes();
      const state = issueOauthStateCookie(res, "s", "/cb");
      expect(state).toMatch(/^[0-9a-f]{32}$/);
      seen.add(state);
    }
    expect(seen.size).toBe(25);
  });

  it("scopes the cookie to the callback path and expires it in ten minutes", () => {
    const { res, cookies } = fakeRes();
    issueOauthStateCookie(res, "gm_oauth_state", "/api/gmail/callback");
    const cookie = cookies()[0];
    expect(cookie).toContain("Path=/api/gmail/callback");
    expect(cookie).toContain("Max-Age=600");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
  });

  it("marks the cookie Secure only in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const prod = fakeRes();
    issueOauthStateCookie(prod.res, "s", "/cb");
    expect(prod.cookies()[0]).toContain("Secure");

    vi.stubEnv("NODE_ENV", "development");
    const dev = fakeRes();
    issueOauthStateCookie(dev.res, "s", "/cb");
    // Secure on http://localhost would stop the cookie being stored at all.
    expect(dev.cookies()[0]).not.toContain("Secure");
  });
});

describe("clearOauthStateCookie", () => {
  it("clears on the same path it was set on", () => {
    // A path-scoped cookie is only replaced by a Set-Cookie carrying the same path; get this
    // wrong and the browser keeps the original alongside a second empty one.
    const issued = fakeRes();
    issueOauthStateCookie(issued.res, "gm_oauth_state", "/api/gmail/callback");
    const cleared = fakeRes();
    clearOauthStateCookie(cleared.res, "gm_oauth_state", "/api/gmail/callback");

    const pathOf = (c: string) => c.split("; ").find((p) => p.startsWith("Path="));
    expect(pathOf(cleared.cookies()[0])).toBe(pathOf(issued.cookies()[0]));
    expect(cleared.cookies()[0]).toContain("Max-Age=0");
  });
});

describe("setOnboardingSessionCookie", () => {
  it("sets ob_session at the site root for a day", () => {
    const { res, cookies } = fakeRes();
    setOnboardingSessionCookie(res, "sess-abc");
    const cookie = cookies()[0];
    expect(cookie).toContain("ob_session=sess-abc");
    expect(cookie).toContain("Path=/"); // the onboarding flow spans several routes
    expect(cookie).toContain("Max-Age=86400");
    expect(cookie).toContain("HttpOnly");
  });
});

describe("resolveRuntimeBaseUrl", () => {
  const req = (headers: Record<string, string | string[]>) =>
    ({ headers } as unknown as NextApiRequest);

  it("honours x-forwarded-proto, which is what a proxy sets", () => {
    expect(resolveRuntimeBaseUrl(req({ host: "vierradev.com", "x-forwarded-proto": "https" }))).toBe(
      "https://vierradev.com"
    );
  });

  it("takes the first value when the proxy sends a list", () => {
    expect(
      resolveRuntimeBaseUrl(req({ host: "vierradev.com", "x-forwarded-proto": ["https", "http"] }))
    ).toBe("https://vierradev.com");
  });

  it("assumes http for localhost and https for everything else", () => {
    // Guessing https on localhost would build an OAuth redirect the dev server cannot serve.
    expect(resolveRuntimeBaseUrl(req({ host: "localhost:3000" }))).toBe("http://localhost:3000");
    expect(resolveRuntimeBaseUrl(req({ host: "127.0.0.1:3000" }))).toBe("http://127.0.0.1:3000");
    expect(resolveRuntimeBaseUrl(req({ host: "vierradev.com" }))).toBe("https://vierradev.com");
  });

  it("falls back to localhost when there is no host header at all", () => {
    expect(resolveRuntimeBaseUrl(req({}))).toBe("http://localhost:3000");
  });

  it("leaves no trailing slash for callers that append a path", () => {
    expect(resolveRuntimeBaseUrl(req({ host: "vierradev.com" }))).not.toMatch(/\/$/);
  });
});

describe("readCookies", () => {
  it("parses a cookie header, and tolerates none", () => {
    expect(readCookies("a=1; b=2")).toMatchObject({ a: "1", b: "2" });
    expect(readCookies(undefined)).toEqual({});
    expect(readCookies("")).toEqual({});
  });
});
