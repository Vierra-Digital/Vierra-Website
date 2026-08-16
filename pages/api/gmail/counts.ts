import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { getValidGmailAccessToken } from "@/lib/gmail/tokens";
import { getAccessibleGmailAccounts } from "@/lib/email/mailboxAccess";
import { asQueryStr } from "@/lib/api/parsing";

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
export function toBadgeCounts(inbox: GmailLabel, drafts: GmailLabel, spam: GmailLabel) {
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
  };
}

async function fetchMailboxCounts(accessToken: string) {
  const [inbox, drafts, spam] = await Promise.all([
    fetchLabel(accessToken, "INBOX"),
    fetchLabel(accessToken, "DRAFT"),
    fetchLabel(accessToken, "SPAM"),
  ]);
  return toBadgeCounts(inbox, drafts, spam);
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

  const accountRows = accessible.filter((row) =>
    selectedEmails.length ? selectedEmails.includes(row.email) : true
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
      counts: { inbox: 0, sent: 0, drafts: composeDraftCount, spam: 0, trash: 0, archive: 0 },
      accountErrors: [],
    });
    return;
  }

  const accountErrors: Array<{ accountEmail: string; message: string }> = [];
  const aggregated = { inbox: 0, sent: 0, drafts: 0, spam: 0, trash: 0, archive: 0 };

  // Independent of the Gmail label fetches — start it now so it runs in parallel with them.
  const composeDraftPromise = prisma.emailComposeDraft.count({ where: composeDraftWhere });

  await Promise.all(
    accountRows.map(async (account) => {
      try {
        const tokenResult = await getValidGmailAccessToken(account.ownerUserId, account.email);
        if (!tokenResult.ok) {
          throw new Error(tokenResult.message);
        }
        let counts: Awaited<ReturnType<typeof fetchMailboxCounts>>;
        try {
          counts = await fetchMailboxCounts(tokenResult.accessToken);
        } catch (error) {
          if (!isAuthError(error)) throw error;
          const refreshResult = await getValidGmailAccessToken(account.ownerUserId, account.email, { forceRefresh: true });
          if (!refreshResult.ok) {
            throw new Error(refreshResult.message);
          }
          counts = await fetchMailboxCounts(refreshResult.accessToken);
        }
        aggregated.inbox += counts.inbox;
        aggregated.sent += counts.sent;
        aggregated.drafts += counts.drafts;
        aggregated.spam += counts.spam;
        aggregated.trash += counts.trash;
        aggregated.archive += counts.archive;
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
