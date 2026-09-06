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

async function fetchLiLabel(token: string): Promise<string | null> {
  try {
    const r = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    const j = await r.json();
    if (typeof j?.name === "string") return j.name;
    if (typeof j?.email === "string") return j.email;
    return null;
  } catch {
    return null;
  }
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return handlePlatformStatus(req, res, "linkedin", linkedinTokenIsValid, fetchLiLabel);
}
