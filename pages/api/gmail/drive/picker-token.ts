import { withAuth } from "@/lib/api/withAuth";
import { getValidGmailAccessToken } from "@/lib/gmail/tokens";
import { resolveAccountId } from "@/lib/api/emailAccounts";
import { queryAccountEmail } from "@/lib/api/parsing";

/**
 * Mints a short-lived Drive-scoped access token for the Google Picker widget, which runs
 * client-side and needs the token directly (there's no server-side picker API). Safe to hand
 * to the browser: it's the requesting user's own token, scoped to their own account and to
 * drive.readonly, and expires in under an hour.
 */
export default withAuth(
  async (req, res, session) => {
    const accountEmail = queryAccountEmail(req.query.accountEmail);
    if (!accountEmail) {
      res.status(400).json({ message: "accountEmail is required." });
      return;
    }

    const accountId = await resolveAccountId(session.user.id, accountEmail);
    if (!accountId) {
      res.status(404).json({ message: "Email account not found." });
      return;
    }

    const tokenResult = await getValidGmailAccessToken(session.user.id, accountEmail);
    if (!tokenResult.ok) {
      res.status(tokenResult.reason === "account_not_found" ? 404 : 401).json({ message: tokenResult.message });
      return;
    }

    res.status(200).json({ accessToken: tokenResult.accessToken, expiresAt: tokenResult.expiresAt });
  },
  { methods: ["GET"] }
);
