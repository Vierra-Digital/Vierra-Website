import type { NextApiRequest, NextApiResponse } from "next";
import { requireSession } from "@/lib/auth";
import { asStr, issueOauthStateCookie } from "@/lib/api/oauth";
import { serialize as serializeCookie } from "cookie";

const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/contacts.readonly",
];

function resolveRuntimeBaseUrl(req: NextApiRequest) {
  const host = req.headers.host || "localhost:3000";
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : forwardedProto || (host.includes("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`.replace(/\/+$/, "");
}

function appendSetCookie(res: NextApiResponse, value: string) {
  const existing = res.getHeader("Set-Cookie");
  const next = Array.isArray(existing) ? [...existing, value] : existing ? [String(existing), value] : [value];
  res.setHeader("Set-Cookie", next);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.status(405).end();
    return;
  }

  const session = await requireSession(req, res);
  if (!session) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  const source = asStr(req.query.from)?.trim().toLowerCase() || "settings";
  const explicitClient = asStr(req.query.client)?.toLowerCase() || "";
  const primaryClientId = process.env.GOOGLE_CLIENT_ID;
  const gmailClientId = process.env.GOOGLE_GMAIL_CLIENT_ID;
  // Default to dedicated Gmail OAuth credentials (the currently working client).
  // Optional override via ?client=primary if needed.
  const clientSelection =
    explicitClient === "primary" && primaryClientId
      ? "primary"
      : gmailClientId
        ? "gmail"
        : primaryClientId
          ? "primary"
          : "";
  const clientId = clientSelection === "gmail" ? gmailClientId : primaryClientId;
  if (!clientId) {
    res.status(500).send("GOOGLE_GMAIL_CLIENT_ID (or GOOGLE_CLIENT_ID) is not configured.");
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
  appendSetCookie(
    res,
    serializeCookie("gm_oauth_client", clientSelection, {
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
