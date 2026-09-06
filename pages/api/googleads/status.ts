import type { NextApiRequest, NextApiResponse } from "next";
import { handlePlatformStatus } from "@/lib/api/oauth";

async function tokenIsValid(accessToken: string) {
  try {
    const r = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`
    );
    if (!r.ok) return false;
    const j = (await r.json()) as { scope?: string };
    return (j.scope ?? "").includes("https://www.googleapis.com/auth/adwords");
  } catch {
    return false;
  }
}

// No Ads-specific "which account" call here — that needs a developer token against the Ads API.
// The connected Google *account* (email) is still a meaningful identity check for "is this the
// right login", fetched from the standard OAuth userinfo endpoint the access token already covers.
async function fetchGaLabel(token: string): Promise<string | null> {
  try {
    const r = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    const j = await r.json();
    return typeof j?.email === "string" ? j.email : null;
  } catch {
    return null;
  }
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return handlePlatformStatus(req, res, "googleads", tokenIsValid, fetchGaLabel);
}
