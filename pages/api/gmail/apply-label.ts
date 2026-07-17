import { withAuth } from "@/lib/api/withAuth";
import { getValidGmailAccessToken } from "@/lib/gmail/tokens";
import { asStr } from "@/lib/api/parsing";

export default withAuth(
  async (req, res, session) => {
    const userId = session.user.id;
    const accountEmail = asStr(req.body?.accountEmail).trim().toLowerCase();
    const messageId = asStr(req.body?.messageId).trim();
    const labelId = asStr(req.body?.labelId).trim();
    const remove = Boolean(req.body?.remove);
    if (!accountEmail || !messageId || !labelId) {
      res.status(400).json({ message: "accountEmail, messageId, and labelId are required." });
      return;
    }
    const token = await getValidGmailAccessToken(userId, accountEmail);
    if (!token.ok) {
      res.status(400).json({ message: token.message });
      return;
    }
    const body = remove ? { removeLabelIds: [labelId] } : { addLabelIds: [labelId] };
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}/modify`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    if (!response.ok) {
      const text = await response.text();
      res.status(502).json({ message: text || "Failed to update label." });
      return;
    }
    res.status(200).json({ ok: true });
  },
  { methods: ["POST"] }
);
