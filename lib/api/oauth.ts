import { randomBytes } from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { parseCookie, serializeCookie } from "@/lib/api/cookies";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { requireSession } from "@/lib/auth";
import { asQueryStr } from "@/lib/api/parsing";

// Delegates to the shared, trimmed query-param parser so there's ONE
// implementation. (This used to be a separate, untrimmed copy with the same
// name as parsing.ts's asStr — a footgun where identical calls behaved differently.)
export const asStr = asQueryStr;

/** Append a Set-Cookie value without clobbering any already set on the response. */
/**
 * Add a Set-Cookie header without discarding the ones already there.
 *
 * Every cookie helper below goes through this. Three of them used res.setHeader directly, which
 * replaces the whole header: in /api/googleads/callback and /api/linkedin/callback,
 * clearOauthStateCookie ran first and setOnboardingSessionCookie ran second, so the clear was
 * dropped and the OAuth state cookie was never actually cleared. Reversing that order would have
 * dropped the session cookie instead. Appending removes the ordering hazard rather than
 * documenting it.
 */
export function appendSetCookie(res: NextApiResponse, value: string) {
  const existing = res.getHeader("Set-Cookie");
  const next = Array.isArray(existing) ? [...existing, value] : existing ? [String(existing), value] : [value];
  res.setHeader("Set-Cookie", next);
}

/**
 * Base URL derived from the live request — used to build OAuth redirect URIs.
 * Falls back to localhost (http) for local dev, https otherwise. Distinct from
 * resolveBaseUrl in lib/api/url.ts, which prefers NEXT_PUBLIC_APP_URL.
 */
export function resolveRuntimeBaseUrl(req: NextApiRequest) {
  const host = req.headers.host || "localhost:3000";
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : forwardedProto || (host.includes("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`.replace(/\/+$/, "");
}

export function issueOauthStateCookie(res: NextApiResponse, cookieName: string, callbackPath: string): string {
  const state = randomBytes(16).toString("hex");
  appendSetCookie(
    res,
    serializeCookie(cookieName, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: callbackPath,
      maxAge: 10 * 60,
    })
  );
  return state;
}

/**
 * Append a short-lived, callback-scoped OAuth cookie (redirect target, reconnect account,
 * source, etc.). Uses appendSetCookie so it composes with the state cookie and other scoped
 * cookies set on the same response. Same hardening as issueOauthStateCookie.
 */
export function setScopedOauthCookie(
  res: NextApiResponse,
  name: string,
  value: string,
  callbackPath: string,
  maxAgeSec = 10 * 60
) {
  appendSetCookie(
    res,
    serializeCookie(name, value, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: callbackPath,
      maxAge: maxAgeSec,
    })
  );
}

export function clearOauthStateCookie(res: NextApiResponse, cookieName: string, callbackPath: string) {
  appendSetCookie(
    res,
    serializeCookie(cookieName, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: callbackPath,
      maxAge: 0,
    })
  );
}

export function readCookies(rawCookie: string | undefined) {
  return parseCookie(rawCookie || "");
}

export function setOnboardingSessionCookie(res: NextApiResponse, sessionId: string) {
  appendSetCookie(
    res,
    serializeCookie("ob_session", sessionId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24,
    })
  );
}

/**
 * Single Google OAuth Web client credentials (NextAuth, Gmail connect, token
 * refresh). Reads GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.
 */
export function resolveGoogleWebClientCredentials() {
  const trim = (v: string | undefined) => (typeof v === "string" ? v.trim() : "");
  return {
    clientId: trim(process.env.GOOGLE_CLIENT_ID),
    clientSecret: trim(process.env.GOOGLE_CLIENT_SECRET),
  };
}

/**
 * Shared handler for the platform "status" endpoints (facebook / googleads /
 * linkedin). All three had the same shape — no-cache headers, an onboarding
 * `?session=` branch, then an authed-user branch — differing only by platform
 * key and how a token is validated. Each route supplies those two things.
 */
export async function handlePlatformStatus(
  req: NextApiRequest,
  res: NextApiResponse,
  platform: string,
  validateToken: (token: string) => Promise<boolean>
) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  if (req.method !== "GET") {
    res.status(405).json({ message: "Method Not Allowed" });
    return;
  }

  const sessionId = asStr(req.query.session);
  if (sessionId) {
    try {
      const row = await prisma.onboardingPlatformToken.findUnique({
        where: { session_id_platform: { session_id: sessionId, platform } },
        select: { access_token: true },
      });
      if (!row) {
        res.status(200).json({ connected: false });
        return;
      }
      const connected = await validateToken(decrypt(row.access_token));
      res.status(200).json({ connected });
      return;
    } catch (e) {
      console.error(`${platform} onboarding status error`, e);
      res.status(200).json({ connected: false });
      return;
    }
  }

  const session = await requireSession(req, res);
  if (!session) {
    res.status(401).json({ connected: false });
    return;
  }

  const userId = (session.user as { id: string }).id;
  try {
    const row = await prisma.platformToken.findUnique({
      where: { user_id_platform: { user_id: userId, platform } },
      select: { access_token: true },
    });
    if (!row) {
      res.status(200).json({ connected: false });
      return;
    }
    const connected = await validateToken(decrypt(row.access_token));
    res.status(200).json({ connected });
  } catch (e) {
    console.error(`${platform} status error`, e);
    res.status(200).json({ connected: false });
  }
}

