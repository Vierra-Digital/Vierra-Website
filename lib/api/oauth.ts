import { randomBytes } from "crypto";
import type { NextApiResponse } from "next";
import { parse as parseCookie, serialize as serializeCookie } from "cookie";

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

