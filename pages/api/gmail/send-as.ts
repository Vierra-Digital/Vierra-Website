import { withAuth } from "@/lib/api/withAuth";
import { getValidGmailAccessToken } from "@/lib/gmail/tokens";
import { fetchSendAsAliases } from "@/lib/gmail/gmailApi";
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
    const aliases = await fetchSendAsAliases(token.accessToken);
    res.status(200).json({ aliases });
  },
  { methods: ["GET"] }
);
