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

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return handlePlatformStatus(req, res, "googleads", tokenIsValid);
}
