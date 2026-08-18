import type { NextApiRequest, NextApiResponse } from "next";
import { requireRole } from "@/lib/auth";
import { asStr, issueOauthStateCookie, resolveGoogleWebClientCredentials, resolveRuntimeBaseUrl, setScopedOauthCookie } from "@/lib/api/oauth";

const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
  // RESTRICTED scope. Required only for messages.delete (permanent delete) — gmail.modify
  // can trash but never hard-delete, which is why "Delete permanently" in Trash/Spam failed
  // with a reconnect prompt. Must also be added to the OAuth consent screen in Google Cloud,
  // and every already-connected account has to reconnect before it takes effect.
  "https://mail.google.com/",
  // Postmaster Tools: spam-complaint rate + Gmail-observed SPF/DKIM/DMARC pass rates, which are
  // the only real source for complaint data (a "Report spam" click is reported to Google, not us).
  // Already-connected accounts must reconnect before it takes effect; the analytics panel degrades
  // to an explanatory note until then.
  "https://www.googleapis.com/auth/postmaster.readonly",
  "https://www.googleapis.com/auth/contacts.readonly",
  // "Other contacts" — addresses corresponded with but never saved. This is where Gmail sources
  // most sender profile photos; saved contacts alone covered almost none, so avatars fell through
  // to initials for nearly every message. Mailboxes connected before this scope 403 on that lookup
  // and fall back gracefully, so it only needs a reconnect to start working.
  "https://www.googleapis.com/auth/contacts.other.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
  // Create booking events on the host's calendar. Accounts connected before this scope
  // was added keep read-only; the meeting booker falls back to emailed .ics invites for them.
  "https://www.googleapis.com/auth/calendar.events",
  // Read Meet attendance reports for bookings made through this account. Workspace-only —
  // personal Gmail accounts are granted the scope but the API 403s for them at call time;
  // lib/calendar/googleMeet.ts treats that as "no attendance data available", not an error.
  "https://www.googleapis.com/auth/meetings.space.readonly",
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

  setScopedOauthCookie(res, "gm_oauth_redirect", redirectUri, "/api/gmail/callback");
  setScopedOauthCookie(res, "gm_oauth_reconnect", reconnectAccount, "/api/gmail/callback");
  setScopedOauthCookie(res, "gm_oauth_source", source, "/api/gmail/callback");
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
