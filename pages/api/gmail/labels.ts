import { withAuth } from "@/lib/api/withAuth";
import { getValidGmailAccessToken } from "@/lib/gmail/tokens";
import { resolveMailboxOwner } from "@/lib/email/mailboxAccess";
import { asStr } from "@/lib/api/parsing";

const LABELS_URL = "https://gmail.googleapis.com/gmail/v1/users/me/labels";

export default withAuth(
  async (req, res, session) => {
    const userId = session.user.id;
    // Read identifiers from the query when present so DELETE works even where a request
    // body is dropped in transit (a silently-ignored DELETE body is why deletes never reached Gmail).
    const accountEmail = asStr(req.query.accountEmail ?? req.body?.accountEmail)
      .trim()
      .toLowerCase();
    if (!accountEmail) {
      res.status(400).json({ message: "accountEmail is required." });
      return;
    }
    const access = await resolveMailboxOwner(userId, accountEmail);
    if (!access) {
      res.status(403).json({ message: "You don't have access to this mailbox." });
      return;
    }
    // Listing labels is a read (allowed for any grant); creating/deleting a label modifies the
    // mailbox and requires send permission.
    if (req.method !== "GET" && !access.canSend) {
      res.status(403).json({ message: "You don't have permission to modify this mailbox." });
      return;
    }
    const token = await getValidGmailAccessToken(access.ownerUserId, accountEmail);
    if (!token.ok) {
      res.status(400).json({ message: token.message });
      return;
    }
    const auth = { Authorization: `Bearer ${token.accessToken}` };

    if (req.method === "GET") {
      const response = await fetch(LABELS_URL, { headers: auth });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        res.status(502).json({ message: "Failed to load labels." });
        return;
      }
      const labels = (Array.isArray(data?.labels) ? data.labels : [])
        .filter((label: { type?: string }) => label?.type === "user")
        .map((label: { id: string; name: string }) => ({ id: label.id, name: label.name }))
        .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));
      res.status(200).json({ labels });
      return;
    }

    if (req.method === "POST") {
      const name = asStr(req.body?.name).trim();
      if (!name) {
        res.status(400).json({ message: "Label name is required." });
        return;
      }
      const response = await fetch(LABELS_URL, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ name, labelListVisibility: "labelShow", messageListVisibility: "show" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        res.status(502).json({ message: data?.error?.message || "Failed to create label." });
        return;
      }
      res.status(200).json({ label: { id: data.id, name: data.name } });
      return;
    }

    // Rename — Gmail PATCH on the label resource, so the change lands in Gmail itself.
    if (req.method === "PATCH") {
      const id = asStr(req.body?.id).trim();
      const name = asStr(req.body?.name).trim();
      if (!id || !name) {
        res.status(400).json({ message: "Label id and name are required." });
        return;
      }
      const response = await fetch(`${LABELS_URL}/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        res.status(502).json({ message: data?.error?.message || "Failed to rename label." });
        return;
      }
      res.status(200).json({ label: { id: data.id, name: data.name } });
      return;
    }

    if (req.method === "DELETE") {
      const id = asStr(req.query.id ?? req.body?.id).trim();
      if (!id) {
        res.status(400).json({ message: "Label id is required." });
        return;
      }
      const response = await fetch(`${LABELS_URL}/${encodeURIComponent(id)}`, { method: "DELETE", headers: auth });
      if (!response.ok && response.status !== 204) {
        const detail = await response.json().catch(() => null);
        res.status(502).json({ message: detail?.error?.message || "Failed to delete label." });
        return;
      }
      res.status(200).json({ ok: true });
      return;
    }
  },
  { methods: ["GET", "POST", "PATCH", "DELETE"] }
);
