import type { NextApiRequest, NextApiResponse } from "next";
import { handlePlatformStatus } from "@/lib/api/oauth";

async function linkedinTokenIsValid(token: string) {
  try {
    const r1 = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r1.ok) return true;
    const r2 = await fetch("https://api.linkedin.com/v2/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return r2.ok;
  } catch {
    return false;
  }
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return handlePlatformStatus(req, res, "linkedin", linkedinTokenIsValid);
}
