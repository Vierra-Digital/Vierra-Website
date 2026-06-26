import type { NextApiRequest, NextApiResponse } from "next";
import { requireSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ message: "Password is required." });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long." });
    }

    const session = await requireSession(req, res);
    if (!session) return;

    const userId = (session.user as any).id;
    const { error } = await getSupabaseAdmin().auth.admin.updateUserById(userId, { password });
    if (error) {
      console.error("auth/setPassword: Supabase update failed", error);
      return res.status(500).json({ message: "Failed to set password. Please try again." });
    }

    return res.status(200).json({ message: "Password set successfully. You can now log in." });
  } catch (e) {
    console.error("auth/setPassword", e);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}
