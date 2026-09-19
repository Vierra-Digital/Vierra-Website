import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { invalidateAccessibleAccountsCache } from "@/lib/email/mailboxAccess";
import { resolveExplicitTargetCompanyId } from "@/lib/api/targetCompany";
import { resolveBillingClient } from "@/lib/api/billingClient";

/**
 * Disconnect one of a client's connected accounts, from the client view.
 *
 * The existing routes cannot serve this page. /api/gmail/delete and the social status routes are
 * all scoped to `session.user.id`, so calling them while looking at a client would have revoked
 * the STAFF member's own grant under the client's name; /api/email/accounts scopes mailboxes to
 * the row's creator, which is not necessarily whoever is looking.
 *
 * Only removal is offered, and that is not a gap. A grant is made by signing in to Google,
 * LinkedIn or Meta as that account — nobody can make one on someone else's behalf, so
 * "reconnect" is a thing the client does, not a button an admin can press. What an admin can do
 * is clear a wrong or stale grant so the client's next attempt starts clean.
 *
 * Admins only. Staff run campaigns; revoking a client's authorizations is not part of that.
 */

const PLATFORMS = new Set(["linkedin", "facebook", "googleads"]);

const asEmail = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

export default withAuth(
  async (req, res, session) => {
    const companyId = resolveExplicitTargetCompanyId(session, req);
    if (!companyId) return res.status(400).json({ message: "companyId is required" });

    // The same resolver every other client-scoped route on this page uses, so they all act on one
    // row when a company has more than one client.
    const client = await resolveBillingClient({ kind: "member", companyId });
    if (!client) return res.status(404).json({ message: "No client for that company." });

    const kind = typeof req.body?.kind === "string" ? req.body.kind : "";
    const value = typeof req.body?.value === "string" ? req.body.value : "";

    try {
      if (kind === "mailbox") {
        // Company-owned, so this one does not need the client to have a login at all.
        const email = asEmail(value);
        if (!email) return res.status(400).json({ message: "A mailbox address is required." });
        const removed = await prisma.emailProviderAccount.deleteMany({
          where: { company_id: companyId, account_email: email },
        });
        if (removed.count === 0) return res.status(404).json({ message: "No such mailbox." });
        return res.status(200).json({ ok: true });
      }

      if (!client.user_id) {
        return res.status(400).json({ message: "This client has no login yet." });
      }

      if (kind === "google") {
        const email = asEmail(value);
        if (!email) return res.status(400).json({ message: "An account address is required." });
        const removed = await prisma.platformToken.deleteMany({
          where: { user_id: client.user_id, platform: `gmail:${email}` },
        });
        if (removed.count === 0) return res.status(404).json({ message: "No such Google account." });
        // The client's mailbox access is cached per user; leaving it would keep serving a grant
        // that no longer exists.
        invalidateAccessibleAccountsCache(client.user_id);
        return res.status(200).json({ ok: true });
      }

      if (kind === "platform") {
        if (!PLATFORMS.has(value)) return res.status(400).json({ message: "Unknown platform." });
        const removed = await prisma.platformToken.deleteMany({
          where: { user_id: client.user_id, platform: value },
        });
        if (removed.count === 0) return res.status(404).json({ message: "That is not connected." });
        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ message: "Unknown connection type." });
    } catch (e) {
      console.error("client/connections", e);
      return res.status(500).json({ message: "Could not disconnect that account." });
    }
  },
  { methods: ["DELETE"], roles: ["admin"] }
);
