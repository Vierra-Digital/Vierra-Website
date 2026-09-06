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

async function fetchFbLabel(token: string): Promise<string | null> {
  try {
    const url = new URL("https://graph.facebook.com/me");
    url.searchParams.set("fields", "name");
    url.searchParams.set("access_token", token);
    const r = await fetch(url.toString());
    if (!r.ok) return null;
    const j = await r.json();
    return typeof j?.name === "string" ? j.name : null;
  } catch {
    return null;
  }
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return handlePlatformStatus(req, res, "facebook", isFbTokenValid, fetchFbLabel);
}
