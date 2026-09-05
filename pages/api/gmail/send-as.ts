import { withAuth } from "@/lib/api/withAuth";
import { getValidGmailAccessToken } from "@/lib/gmail/tokens";
import { resolveMailboxOwner } from "@/lib/email/mailboxAccess";
import { asStr } from "@/lib/api/parsing";

export type SendAsEntry = {
  sendAsEmail?: string;
  displayName?: string;
  isPrimary?: boolean;
  verificationStatus?: string;
};

/**
 * Keep the identities Gmail will actually let us send as: the primary address, plus any alias
 * whose verification Gmail reports as "accepted". Gmail omits verificationStatus entirely on
 * the primary address, so the isPrimary branch is load-bearing — filtering on the status alone
 * drops the user's own address from the From selector.
 */
export function mapSendAsEntries(raw: unknown) {
  return (Array.isArray(raw) ? (raw as SendAsEntry[]) : [])
    .filter((entry) => entry?.isPrimary || entry?.verificationStatus === "accepted")
    .map((entry) => ({
      email: String(entry?.sendAsEmail || "").trim().toLowerCase(),
      displayName: entry?.displayName || "",
      isPrimary: Boolean(entry?.isPrimary),
    }))
    .filter((entry) => entry.email);
}

/** Lists the verified send-as identities (aliases) for a connected Gmail account. */
export default withAuth(
  async (req, res, session) => {
    const userId = session.user.id;
    const accountEmail = asStr(req.query.accountEmail).trim().toLowerCase();
    if (!accountEmail) {
      res.status(400).json({ message: "accountEmail is required." });
      return;
    }
    // Resolve whose Gmail token backs this mailbox, exactly like every other mailbox route.
    // This used to mint the token against session.user.id, so any mailbox not owned by the
    // signed-in user (a shared/granted inbox, or one connected under a different member
    // record) failed here while its messages loaded fine — the composer just showed no
    // aliases, with nothing to explain why.
    const access = await resolveMailboxOwner(userId, accountEmail);
    if (!access) {
      res.status(403).json({ message: "You don't have permission to read this mailbox." });
      return;
    }
    const token = await getValidGmailAccessToken(access.ownerUserId, access.tokenEmail);
    if (!token.ok) {
      res.status(400).json({ message: token.message });
      return;
    }
    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs", {
      headers: { Authorization: `Bearer ${token.accessToken}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      res.status(502).json({
        message: String(data?.error?.message || "Failed to load send-as aliases."),
      });
      return;
    }
    res.status(200).json({ aliases: mapSendAsEntries(data?.sendAs) });
  },
  { methods: ["GET"] }
);
