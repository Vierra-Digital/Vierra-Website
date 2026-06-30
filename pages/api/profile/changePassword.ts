import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { withAuth } from "@/lib/api/withAuth";

export default withAuth(
  async (req, res, session) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current password and new password are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters long" });
    }

    const userEmail = (session.user as any)?.email;
    const userId = (session.user as any)?.id;
    if (!userEmail || !userId) {
      return res.status(400).json({ message: "User email not found in session" });
    }

    // Verify the current password with a throwaway client (not the shared admin
    // singleton, so this sign-in attempt doesn't touch its in-memory session state).
    const verifyClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { error: verifyError } = await verifyClient.auth.signInWithPassword({
      email: userEmail,
      password: currentPassword,
    });
    if (verifyError) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    const { error: updateError } = await getSupabaseAdmin().auth.admin.updateUserById(userId, { password: newPassword });
    if (updateError) {
      return res.status(500).json({ message: "Failed to update password" });
    }

    return res.status(200).json({ message: "Password changed successfully" });
  },
  { methods: ["POST"] }
);
