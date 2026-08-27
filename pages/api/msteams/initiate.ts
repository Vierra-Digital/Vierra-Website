import type { NextApiRequest, NextApiResponse } from "next";
import { requireRole } from "@/lib/auth";
import { appendSetCookie, issueOauthStateCookie, resolveRuntimeBaseUrl } from "@/lib/api/oauth";
import { MSTEAMS_SCOPES } from "@/lib/msteams/tokens";
import { stringifySetCookie as serializeCookie } from "cookie";

/** Microsoft Teams (Graph) OAuth connect — mirrors pages/api/gmail/initiate.ts's cookie state pattern. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.status(405).end();
    return;
  }

  const session = await requireRole(req, res);
  if (!session) return;

  const clientId = (process.env.MSTEAMS_CLIENT_ID || "").trim();
  const tenant = (process.env.MSTEAMS_TENANT_ID || "common").trim();
  if (!clientId) {
    res.status(500).send("Configure MSTEAMS_CLIENT_ID and MSTEAMS_CLIENT_SECRET.");
    return;
  }

  const redirectUri = `${resolveRuntimeBaseUrl(req)}/api/msteams/callback`;
  const state = issueOauthStateCookie(res, "msteams_oauth_state", "/api/msteams/callback");
  appendSetCookie(
    res,
    serializeCookie("msteams_oauth_redirect", redirectUri, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/api/msteams/callback",
      maxAge: 10 * 60,
    })
  );

  const authUrl =
    `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?` +
    new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      response_mode: "query",
      redirect_uri: redirectUri,
      scope: MSTEAMS_SCOPES.join(" "),
      state,
    }).toString();

  res.redirect(authUrl);
}
