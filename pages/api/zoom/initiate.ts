import type { NextApiRequest, NextApiResponse } from "next";
import { requireRole } from "@/lib/auth";
import { appendSetCookie, issueOauthStateCookie, resolveRuntimeBaseUrl } from "@/lib/api/oauth";
import { serialize as serializeCookie } from "cookie";

/** Zoom OAuth connect — mirrors pages/api/gmail/initiate.ts's cookie-based state pattern. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.status(405).end();
    return;
  }

  const session = await requireRole(req, res);
  if (!session) return;

  const clientId = (process.env.ZOOM_CLIENT_ID || "").trim();
  if (!clientId) {
    res.status(500).send("Configure ZOOM_CLIENT_ID and ZOOM_CLIENT_SECRET.");
    return;
  }

  const redirectUri = `${resolveRuntimeBaseUrl(req)}/api/zoom/callback`;
  const state = issueOauthStateCookie(res, "zoom_oauth_state", "/api/zoom/callback");
  appendSetCookie(
    res,
    serializeCookie("zoom_oauth_redirect", redirectUri, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/api/zoom/callback",
      maxAge: 10 * 60,
    })
  );

  const authUrl =
    "https://zoom.us/oauth/authorize?" +
    new URLSearchParams({ response_type: "code", client_id: clientId, redirect_uri: redirectUri, state }).toString();

  res.redirect(authUrl);
}
