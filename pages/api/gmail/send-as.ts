import { withAuth } from "@/lib/api/withAuth";
import { getValidGmailAccessToken } from "@/lib/gmail/tokens";
import { asStr } from "@/lib/api/parsing";

/** Lists the verified send-as identities (aliases) for a connected Gmail account. */
export default withAuth(
  async (req, res, session) => {
    const userId = session.user.id;
    const accountEmail = asStr(req.query.accountEmail).trim().toLowerCase();
    if (!accountEmail) {
      res.status(400).json({ message: "accountEmail is required." });
      return;
    }
    const token = await getValidGmailAccessToken(userId, accountEmail);
    if (!token.ok) {
      res.status(400).json({ message: token.message });
      return;
    }
    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs", {
      headers: { Authorization: `Bearer ${token.accessToken}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      res.status(502).json({ message: "Failed to load send-as aliases." });
      return;
    }
    const aliases = (Array.isArray(data?.sendAs) ? data.sendAs : [])
      .filter((entry: { isPrimary?: boolean; verificationStatus?: string }) => entry?.isPrimary || entry?.verificationStatus === "accepted")
      .map((entry: { sendAsEmail?: string; displayName?: string; isPrimary?: boolean }) => ({
        email: String(entry.sendAsEmail || "").toLowerCase(),
        displayName: entry.displayName || "",
        isPrimary: Boolean(entry.isPrimary),
      }))
      .filter((entry: { email: string }) => entry.email);
    res.status(200).json({ aliases });
  },
  { methods: ["GET"] }
);
