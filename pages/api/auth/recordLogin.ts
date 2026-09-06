import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { getClientIp } from "@/lib/rateLimit";

/**
 * Records a successful sign-in.
 *
 * Nothing wrote to login_attempts. Sign-in happens entirely in the browser via
 * `supabase.auth.signInWithPassword` (see pages/login.tsx), so no request ever reached a route
 * that could see the address it came from — which is why User Management's Last Login column
 * showed "Never" for everyone but one stale row.
 *
 * Called after the browser has a session, so the caller is already authenticated and cannot
 * write a row for anybody else. The address comes from the first x-forwarded-for hop, which is
 * the visitor rather than the proxy once this is behind Netlify.
 */
export default withAuth(
  async (req, res, session) => {
    // login_attempts.company_id is NOT NULL, so someone who has signed in but does not yet
    // belong to a company (mid-onboarding) has nowhere to record against. Not an error — there
    // is simply nothing to write yet.
    if (!session.companyId) {
      res.status(204).end();
      return;
    }

    const userAgent = req.headers["user-agent"];
    try {
      await prisma.loginAttempt.create({
        data: {
          company_id: session.companyId,
          user_id: session.user.id,
          success: true,
          ip_address: getClientIp(req) || null,
          user_agent: typeof userAgent === "string" ? userAgent.slice(0, 500) : null,
        },
      });
    } catch (error) {
      // A sign-in must never fail because its audit row did not write.
      console.error("auth/recordLogin", error);
    }
    res.status(204).end();
  },
  { methods: ["POST"] }
);
