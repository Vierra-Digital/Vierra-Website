import { withAuth } from "@/lib/api/withAuth";
import { getValidGmailAccessToken } from "@/lib/gmail/tokens";
import { asStr } from "@/lib/api/parsing";

/**
 * Inbound-sync scaffold — see EMAIL_PANEL_REVAMP_PLAN §6g.
 *
 * Returns the account's current Gmail `historyId`, and — when a `startHistoryId`
 * is supplied — the message ids added since then (via `users.history.list`).
 * A cron will call this per account and persist `historyId` in a future
 * `GmailInboxSyncState` model; consumers (auto-draft, filters, snooze, vacation)
 * then react to the returned changes. This is the loop's first working step.
 */
export default withAuth(
  async (req, res, session) => {
    const userId = session.user.id;
    const accountEmail = asStr(req.query.accountEmail).trim().toLowerCase();
    const startHistoryId = asStr(req.query.startHistoryId).trim();
    if (!accountEmail) {
      res.status(400).json({ message: "accountEmail is required." });
      return;
    }
    const token = await getValidGmailAccessToken(userId, accountEmail);
    if (!token.ok) {
      res.status(400).json({ message: token.message });
      return;
    }
    const auth = { Authorization: `Bearer ${token.accessToken}` };

    const profileRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", { headers: auth });
    const profile = await profileRes.json().catch(() => ({}));
    if (!profileRes.ok) {
      res.status(502).json({ message: "Failed to read Gmail profile." });
      return;
    }
    const currentHistoryId = String(profile?.historyId || "");

    const addedMessageIds: string[] = [];
    if (startHistoryId) {
      const params = new URLSearchParams({ startHistoryId, historyTypes: "messageAdded" });
      const histRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/history?${params.toString()}`, {
        headers: auth,
      });
      const hist = await histRes.json().catch(() => ({}));
      if (histRes.ok && Array.isArray(hist?.history)) {
        const ids = new Set<string>();
        for (const entry of hist.history) {
          for (const added of entry?.messagesAdded || []) {
            if (added?.message?.id) ids.add(added.message.id);
          }
        }
        addedMessageIds.push(...ids);
      }
    }

    res.status(200).json({ accountEmail, historyId: currentHistoryId, changes: { addedMessageIds } });
  },
  { methods: ["GET", "POST"] }
);
