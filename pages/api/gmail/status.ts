import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { getValidGmailAccessToken } from "@/lib/gmail/tokens";
import { getAccessibleGmailAccounts, getGmailAliasAccounts } from "@/lib/email/mailboxAccess";

type GmailConnection = {
  email: string;
  connected: boolean;
  expiresAt: string | null;
  reconnectReason: string | null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  if (req.method !== "GET") {
    res.status(405).json({ message: "Method Not Allowed" });
    return;
  }

  const session = await requireSession(req, res);
  if (!session) {
    res.status(401).json({ connected: false, accounts: [] });
    return;
  }

  const userId = session.user.id;
  try {
    const rows = await prisma.platformToken.findMany({
      where: { user_id: userId, platform: { startsWith: "gmail:" } },
      select: {
        platform: true,
        access_token: true,
        refresh_token: true,
        expires_at: true,
        created_at: true,
      },
      orderBy: { created_at: "desc" },
    });

    const accounts: GmailConnection[] = await Promise.all(
      rows.map(async (row) => {
        // Lowercase to match the normalized unique key (gmail:<lowercased email>); a mixed-case
        // stored platform would otherwise miss the token lookup and read as disconnected.
        const email = row.platform.replace(/^gmail:/, "").toLowerCase();
        // Reuse the row we already fetched above instead of re-querying it inside
        // getValidGmailAccessToken (it only re-hits Prisma if it needs to persist a refreshed token).
        let tokenResult = await getValidGmailAccessToken(userId, email, {
          preloadedRow: {
            access_token: row.access_token,
            refresh_token: row.refresh_token,
            expires_at: row.expires_at,
          },
        });
        // A page load fires this alongside /api/gmail/messages and /api/gmail/counts, all racing
        // to refresh the same near-expiry token (see the in-flight dedup in lib/gmail/tokens.ts).
        // Unlike those two callers, this endpoint used to report "disconnected" on the first
        // failure with no retry — losing that race flipped the whole panel to the reconnect gate
        // even though the account was fine. One forced retry matches messages.ts/counts.ts.
        if (!tokenResult.ok && tokenResult.reason === "refresh_failed") {
          tokenResult = await getValidGmailAccessToken(userId, email, { forceRefresh: true });
        }
        const connected = tokenResult.ok;
        return {
          email,
          connected,
          expiresAt:
            tokenResult.ok && tokenResult.expiresAt
              ? tokenResult.expiresAt.toISOString()
              : row.expires_at
                ? row.expires_at.toISOString()
                : null,
          reconnectReason: tokenResult.ok ? null : tokenResult.reason,
        };
      })
    );

    // Fetch shared-inbox grants and "send as" aliases concurrently — they're independent lookups
    // that were previously awaited one after another.
    const [accessibleResult, aliasAccountsResult] = await Promise.allSettled([
      getAccessibleGmailAccounts(userId),
      getGmailAliasAccounts(userId),
    ]);

    // Append shared inboxes granted to this user (read/send happens via the owner's token).
    if (accessibleResult.status === "fulfilled") {
      const ownedEmails = new Set(accounts.map((a) => a.email.toLowerCase()));
      const accessible = accessibleResult.value.filter((acc) => !ownedEmails.has(acc.email));
      const sharedAccounts = await Promise.all(
        accessible.map(async (acc) => {
          const tokenResult = await getValidGmailAccessToken(acc.ownerUserId, acc.email);
          return {
            email: acc.email,
            connected: tokenResult.ok,
            expiresAt: tokenResult.ok && tokenResult.expiresAt ? tokenResult.expiresAt.toISOString() : null,
            reconnectReason: tokenResult.ok ? null : "shared",
          };
        })
      );
      accounts.push(...sharedAccounts);
    } else {
      console.error("gmail status: granted accounts", accessibleResult.reason);
    }

    // Append verified Gmail "send as" aliases (a domain address forwarded into Gmail, e.g. via
    // Settings > Accounts > Send mail as) — they have no OAuth token of their own, but their mail
    // lands in the owning account's inbox, so they should be selectable in the switcher too.
    if (aliasAccountsResult.status === "fulfilled") {
      const knownEmails = new Set(accounts.map((a) => a.email.toLowerCase()));
      for (const alias of aliasAccountsResult.value) {
        if (knownEmails.has(alias.email)) continue;
        knownEmails.add(alias.email);
        accounts.push({ email: alias.email, connected: true, expiresAt: null, reconnectReason: null });
      }
    } else {
      console.error("gmail status: alias accounts", aliasAccountsResult.reason);
    }

    res.status(200).json({
      connected: accounts.some((a) => a.connected),
      accounts,
    });
  } catch (e) {
    console.error("gmail status error", e);
    res.status(200).json({ connected: false, accounts: [] });
  }
}
