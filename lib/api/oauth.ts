import { randomBytes } from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { parse as parseCookie, serialize as serializeCookie } from "cookie";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { requireSession } from "@/lib/auth";

export const asStr = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function issueOauthStateCookie(res: NextApiResponse, cookieName: string, callbackPath: string): string {
  const state = randomBytes(16).toString("hex");
  res.setHeader(
    "Set-Cookie",
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

export function clearOauthStateCookie(res: NextApiResponse, cookieName: string, callbackPath: string) {
  res.setHeader(
    "Set-Cookie",
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
  res.setHeader(
    "Set-Cookie",
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

