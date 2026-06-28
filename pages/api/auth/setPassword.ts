import type { NextApiRequest, NextApiResponse } from "next";
import { createSupabasePagesClient } from "@/lib/supabase/server";
import { resolveUser } from "@/lib/auth/resolveUser";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { password } = req.body;
  if (!password) return res.status(400).json({ message: "Password is required." });
  if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters long." });

  const supabase = createSupabasePagesClient(req, res);
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return res.status(401).json({ message: "Not authenticated." });

  // Accept any pending invitation and create the membership row.
  await resolveUser(supabase, user);

  // Update via the user's own session — the admin SDK invalidates the current
  // session when it changes a password, which breaks the post-invite redirect.
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    console.error("auth/setPassword: update failed", error);
    return res.status(500).json({ message: "Failed to set password. Please try again." });
  }

  return res.status(200).json({ message: "Password set successfully." });
}
