import type { NextApiRequest, NextApiResponse } from "next";
import { requireRole } from "@/lib/auth";
import { appendSetCookie, asStr, issueOauthStateCookie, resolveGoogleWebClientCredentials, resolveRuntimeBaseUrl } from "@/lib/api/oauth";
import { serialize as serializeCookie } from "cookie";

const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/contacts.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
  // Create booking events on the host's calendar. Accounts connected before this scope
  // was added keep read-only; the meeting booker falls back to emailed .ics invites for them.
  "https://www.googleapis.com/auth/calendar.events",
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.status(405).end();
    return;
  }

  const session = await requireRole(req, res);
  if (!session) return;

  const source = asStr(req.query.from)?.trim().toLowerCase() || "settings";
  const { clientId } = resolveGoogleWebClientCredentials();
  if (!clientId) {
    res.status(500).send("Configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.");
    return;
  }

  const redirectUri = `${resolveRuntimeBaseUrl(req)}/api/gmail/callback`;
  const reconnectAccount = asStr(req.query.account)?.trim().toLowerCase() || "";
  const state = issueOauthStateCookie(res, "gm_oauth_state", "/api/gmail/callback");

  appendSetCookie(
    res,
    serializeCookie("gm_oauth_redirect", redirectUri, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/api/gmail/callback",
      maxAge: 10 * 60,
    })
  );
  appendSetCookie(
    res,
    serializeCookie("gm_oauth_reconnect", reconnectAccount, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/api/gmail/callback",
      maxAge: 10 * 60,
    })
  );
  appendSetCookie(
    res,
    serializeCookie("gm_oauth_source", source, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/api/gmail/callback",
      maxAge: 10 * 60,
    })
  );
  const authUrl =
    "https://accounts.google.com/o/oauth2/v2/auth?" +
    new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: redirectUri,
      scope: SCOPES.join(" "),
      access_type: "offline",
      include_granted_scopes: "true",
      prompt: "consent select_account",
      ...(reconnectAccount ? { login_hint: reconnectAccount } : {}),
      state,
    }).toString();

  res.redirect(authUrl);
}
