import { withAuth } from "@/lib/api/withAuth";
import { getValidGmailAccessToken } from "@/lib/gmail/tokens";
import { asStr } from "@/lib/api/parsing";

const LABELS_URL = "https://gmail.googleapis.com/gmail/v1/users/me/labels";

export default withAuth(
  async (req, res, session) => {
    const userId = session.user.id;
    const accountEmail = asStr(req.method === "GET" ? req.query.accountEmail : req.body?.accountEmail)
      .trim()
      .toLowerCase();
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

    if (req.method === "DELETE") {
      const id = asStr(req.body?.id).trim();
      if (!id) {
        res.status(400).json({ message: "Label id is required." });
        return;
      }
      const response = await fetch(`${LABELS_URL}/${encodeURIComponent(id)}`, { method: "DELETE", headers: auth });
      if (!response.ok && response.status !== 204) {
        res.status(502).json({ message: "Failed to delete label." });
        return;
      }
      res.status(200).json({ ok: true });
      return;
    }
  },
  { methods: ["GET", "POST", "DELETE"] }
);
