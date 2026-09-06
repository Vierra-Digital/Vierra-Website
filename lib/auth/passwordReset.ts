import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendPasswordResetEmail } from "@/lib/emailSender";

/**
 * Shared by both password-reset entry points — the self-service "Forgot password?" flow
 * (pages/api/auth/forgotPassword.ts) and the admin-triggered reset (pages/api/admin/userPassword.ts)
 * — so minting the recovery link and sending the email is one code path, not two copies that could
 * drift (e.g. one changing the redirect target or email template without the other).
 */
export async function sendPasswordResetLink(
  user: { email: string; name: string | null },
  baseUrl: string,
  selfRequested: boolean
): Promise<void> {
  const admin = getSupabaseAdmin();
  const { data: linkData } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: user.email,
    // Server-minted recovery links redirect with tokens in a URL hash fragment (never a
    // server-visible ?code=), so this must point straight at the page that reads
    // window.location.hash itself — see app/set-password/page.tsx.
    options: { redirectTo: `${baseUrl}/set-password` },
  });
  const resetLink = (linkData as any)?.properties?.action_link ?? `${baseUrl}/set-password`;
  await sendPasswordResetEmail(user.email, user.name || "", resetLink, selfRequested);
}
