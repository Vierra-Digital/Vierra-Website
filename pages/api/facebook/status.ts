import type { NextApiRequest, NextApiResponse } from "next";
import { handlePlatformStatus } from "@/lib/api/oauth";

async function isFbTokenValid(token: string) {
  const appToken = `${process.env.FACEBOOK_CLIENT_ID}|${process.env.FACEBOOK_CLIENT_SECRET}`;
  const url = new URL("https://graph.facebook.com/v23.0/debug_token");
  url.searchParams.set("input_token", token);
  url.searchParams.set("access_token", appToken);

  try {
    const r = await fetch(url.toString());
    if (!r.ok) return false;
    const j = await r.json();
    return !!j?.data?.is_valid;
  } catch {
    return false;
  }
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return handlePlatformStatus(req, res, "facebook", isFbTokenValid);
}
