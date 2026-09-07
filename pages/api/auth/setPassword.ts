import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { resolveUser } from "@/lib/auth/resolveUser";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { password, accessToken, refreshToken } = req.body;
  if (!password) return res.status(400).json({ message: "Password is required." });
  if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters long." });
  if (!accessToken || !refreshToken) {
    return res.status(401).json({ message: "This recovery link is invalid or has expired." });
  }

  // Scoped strictly to the tokens carried by this specific recovery link, never the caller's
  // ambient cookie session. Reading the ambient session here let a client's recovery link silently
  // change whichever account happened to already be logged in in that browser (e.g. staff testing
  // the onboarding flow while signed into /panel) instead of the client's own account.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (sessionError || !sessionData.session) {
    return res.status(401).json({ message: "This recovery link is invalid or has expired." });
  }

  // Accept any pending invitation and create the membership row.
  await resolveUser(supabase, sessionData.session.user);

  // Update via the recovery session resolved above — the admin SDK invalidates the current
  // session when it changes a password, which breaks the post-invite redirect.
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    console.error("auth/setPassword: update failed", error);
    return res.status(500).json({ message: "Failed to set password. Please try again." });
  }

  return res.status(200).json({ message: "Password set successfully." });
}
