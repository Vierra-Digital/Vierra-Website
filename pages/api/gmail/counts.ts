import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { getValidGmailAccessToken } from "@/lib/gmail/tokens";
import { getAccessibleGmailAccounts, getGmailAliasAccounts, selectFetchAccounts } from "@/lib/email/mailboxAccess";
import { asQueryStr } from "@/lib/api/parsing";
import { buildAliasScopeQuery } from "@/lib/gmail/gmailApi";

type GmailLabel = {
  messagesTotal?: number;
  messagesUnread?: number;
};

/**
 * Exact counts for one system label.
 *
 * These used to come from `messages.list?q=…&fields=resultSizeEstimate`. That field is, as its
 * name says, an estimate — Gmail rounds it and it drifts badly on large mailboxes, which is why
 * the sidebar showed an inbox unread count in the hundreds that matched nothing, and a Sent
 * "unread" count of 201 against 7 genuinely unread sent messages. labels.get returns the same
 * totals Gmail's own UI renders, and costs one cheap call per label instead of a search.
 */
async function fetchLabel(accessToken: string, labelId: string): Promise<GmailLabel> {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/labels/${labelId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`gmail label ${labelId} failed ${response.status}: ${text}`);
  }
  return (await response.json()) as GmailLabel;
}

/**
 * What each badge means follows Gmail: Inbox and Spam show unread, Drafts shows the total
 * (a draft is never "unread"). Sent, Archive and Trash carry no badge in Gmail and no longer
 * carry one here — a count on Sent was noise, and "Archive" isn't a Gmail label at all, so it
 * could only ever have been a guess assembled from a negated search.
 */
export function toBadgeCounts(inbox: GmailLabel, drafts: GmailLabel, spam: GmailLabel, starred?: GmailLabel) {
  const nonNegative = (value: unknown) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  };
  return {
    inbox: nonNegative(inbox?.messagesUnread),
    sent: 0,
    drafts: nonNegative(drafts?.messagesTotal),
    spam: nonNegative(spam?.messagesUnread),
    trash: 0,
    archive: 0,
    // Starred mirrors Inbox/Spam semantics: how many starred messages are still unread.
    starred: nonNegative(starred?.messagesUnread),
  };
}


/**
 * Badge counts for a send-as alias.
 *
 * An alias shares the owning account's mailbox, so labels.get — which is what gives every other
 * mailbox its exact numbers — can only report the whole account. There is no per-alias label, so
 * the only way to count just this address is a scoped search, and Gmail answers those with
 * resultSizeEstimate: an estimate it rounds on large mailboxes. Alias badges are therefore
 * approximate by necessity, while real accounts stay exact. Reported rather than hidden, because a
 * roughly-right unread count is still what tells someone to go and look.
 */
async function fetchAliasCounts(accessToken: string, aliasEmail: string) {
  const scope = buildAliasScopeQuery(aliasEmail, "to");
  const estimate = async (query: string) => {
    const params = new URLSearchParams({ q: query, maxResults: "1", fields: "resultSizeEstimate" });
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`gmail label ALIAS failed ${response.status}: ${text}`);
    }
    const payload = (await response.json()) as { resultSizeEstimate?: number };
    const value = Number(payload.resultSizeEstimate || 0);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  };
  const [inbox, spam, starred] = await Promise.all([
    estimate(`${scope} in:inbox is:unread`),
    estimate(`${scope} in:spam is:unread`),
    estimate(`${scope} is:starred is:unread`),
  ]);
  // Drafts are authored by the account, not addressed to the alias, so there is nothing
  // alias-specific to count.
  return { inbox, sent: 0, drafts: 0, spam, starred, archive: 0, trash: 0 };
}

async function fetchMailboxCounts(accessToken: string) {
  const [inbox, drafts, spam, starred] = await Promise.all([
    fetchLabel(accessToken, "INBOX"),
    fetchLabel(accessToken, "DRAFT"),
    fetchLabel(accessToken, "SPAM"),
    fetchLabel(accessToken, "STARRED"),
  ]);
  return toBadgeCounts(inbox, drafts, spam, starred);
}

function isAuthError(error: unknown) {
  return error instanceof Error && /gmail label [A-Z]+ failed 401/i.test(error.message);
}

export default withAuth(async (req, res, session) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  const userId = session.user.id;
  const accountsParam = asQueryStr(req.query.accounts);
  const selectedEmails = (accountsParam || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  // Owned + admin-granted (shared) mailboxes, each tagged with the ownerUserId whose Gmail token to
  // use. For owned accounts ownerUserId === userId, so this is unchanged for non-delegated users —
  // it just lets granted shared inboxes contribute to the unread badges.
  const accessible = await getAccessibleGmailAccounts(userId);

  // Same selection the message list uses, so a badge can never describe a different set of
  // mailboxes than the list it sits next to.
  const accountRows = selectFetchAccounts(
    accessible,
    selectedEmails.some((email) => !accessible.some((row) => row.email === email))
      ? await getGmailAliasAccounts(userId)
      : [],
    selectedEmails
  );

  let selectedAccountIds: string[] = [];
  if (selectedEmails.length > 0) {
    const accounts = await prisma.emailProviderAccount.findMany({
      where: { user_id: userId, account_email: { in: selectedEmails } },
      select: { id: true },
    });
    selectedAccountIds = accounts.map((a) => a.id);
  }

  const composeDraftWhere = {
    user_id: userId,
    ...(selectedEmails.length
      ? {
          OR: [
            { account_id: null },
            { account_id: { in: selectedAccountIds } },
          ],
        }
      : {}),
  } as const;

  if (accountRows.length === 0) {
    const composeDraftCount = await prisma.emailComposeDraft.count({ where: composeDraftWhere });
    res.status(200).json({
      counts: { inbox: 0, sent: 0, drafts: composeDraftCount, spam: 0, trash: 0, archive: 0, starred: 0 },
      accountErrors: [],
    });
    return;
  }

  const accountErrors: Array<{ accountEmail: string; message: string }> = [];
  const aggregated = { inbox: 0, sent: 0, drafts: 0, spam: 0, trash: 0, archive: 0, starred: 0 };

  // Independent of the Gmail label fetches — start it now so it runs in parallel with them.
  const composeDraftPromise = prisma.emailComposeDraft.count({ where: composeDraftWhere });

  await Promise.all(
    accountRows.map(async (account) => {
      try {
        // An alias has no token of its own; count against the account that owns it.
        const tokenAccountEmail = account.aliasOfEmail || account.email;
        const countsFor = (accessToken: string) =>
          account.aliasOfEmail
            ? fetchAliasCounts(accessToken, account.email)
            : fetchMailboxCounts(accessToken);
        const tokenResult = await getValidGmailAccessToken(account.ownerUserId, tokenAccountEmail);
        if (!tokenResult.ok) {
          throw new Error(tokenResult.message);
        }
        let counts: Awaited<ReturnType<typeof fetchMailboxCounts>>;
        try {
          counts = await countsFor(tokenResult.accessToken);
        } catch (error) {
          if (!isAuthError(error)) throw error;
          const refreshResult = await getValidGmailAccessToken(account.ownerUserId, tokenAccountEmail, { forceRefresh: true });
          if (!refreshResult.ok) {
            throw new Error(refreshResult.message);
          }
          counts = await countsFor(refreshResult.accessToken);
        }
        aggregated.inbox += counts.inbox;
        aggregated.sent += counts.sent;
        aggregated.drafts += counts.drafts;
        aggregated.spam += counts.spam;
        aggregated.trash += counts.trash;
        aggregated.archive += counts.archive;
        aggregated.starred += counts.starred;
      } catch (error) {
        accountErrors.push({
          accountEmail: account.email,
          message: error instanceof Error ? error.message : "Failed to load label counts",
        });
      }
    })
  );

  aggregated.drafts += await composeDraftPromise;

  res.status(200).json({
    counts: aggregated,
    accountErrors,
  });
}, { methods: ["GET"] });
