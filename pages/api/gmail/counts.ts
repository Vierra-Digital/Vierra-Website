import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { getValidGmailAccessToken } from "@/lib/gmail/tokens";
import { getAccessibleGmailAccounts, getGmailAliasAccounts } from "@/lib/email/mailboxAccess";
import { buildAliasScopeQuery } from "@/lib/gmail/gmailApi";
import { asQueryStr } from "@/lib/api/parsing";

type GmailListEstimateResponse = {
  resultSizeEstimate?: number;
};


async function fetchEstimate(accessToken: string, query: string) {
  const params = new URLSearchParams({
    q: query,
    maxResults: "1",
    fields: "resultSizeEstimate",
  });
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`gmail unread estimate failed ${response.status}: ${text}`);
  }
  const payload = (await response.json()) as GmailListEstimateResponse;
  return Number(payload.resultSizeEstimate || 0);
}

/** Draft count for the DRAFT label — matches `labelIds=DRAFT` in messages list (not `q=in:drafts`, whose resultSizeEstimate can be wildly off). */
async function fetchDraftLabelMessageTotal(accessToken: string) {
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/labels/DRAFT", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`gmail label DRAFT failed ${response.status}: ${text}`);
  }
  const payload = (await response.json()) as { messagesTotal?: number };
  return Number(payload.messagesTotal ?? 0);
}

/**
 * `aliasEmail` scopes every count to mail addressed to (or, for sent, from) that alias — an
 * alias shares its owning account's mailbox, so an unscoped count would show the WHOLE
 * account's badges under the alias's name. Drafts for an alias use `in:drafts from:<alias>`
 * (an estimate — a draft's "From" reflects whichever send-as identity was selected when it was
 * composed) rather than the exact DRAFT label total, since that total has no per-recipient
 * filter; it's an approximation, but a closer one than showing 0 regardless of real draft count.
 */
async function fetchMailboxCounts(accessToken: string, aliasEmail?: string) {
  const toFilter = aliasEmail ? `${buildAliasScopeQuery(aliasEmail, "to")} ` : "";
  const fromFilter = aliasEmail ? `${buildAliasScopeQuery(aliasEmail, "from")} ` : "";
  const [inbox, sent, draftsTotal, spam, trash, archive] = await Promise.all([
    fetchEstimate(accessToken, `${toFilter}in:inbox is:unread`),
    fetchEstimate(accessToken, `${fromFilter}in:sent is:unread`),
    aliasEmail ? fetchEstimate(accessToken, `${fromFilter}in:drafts`) : fetchDraftLabelMessageTotal(accessToken),
    fetchEstimate(accessToken, `${toFilter}in:spam is:unread`),
    fetchEstimate(accessToken, `${toFilter}in:trash is:unread`),
    fetchEstimate(accessToken, `${toFilter}-in:inbox -in:sent -in:drafts -in:spam -in:trash is:unread`),
  ]);

  return { inbox, sent, drafts: draftsTotal, spam, trash, archive };
}

function isAuthError(error: unknown) {
  return error instanceof Error && /gmail (unread estimate|label DRAFT) failed 401/i.test(error.message);
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
  const accessibleEmails = new Set(accessible.map((row) => row.email));
  type FetchAccount = { email: string; ownerUserId: string; aliasOfEmail?: string };
  let accountRows: FetchAccount[] = accessible;

  if (selectedEmails.length) {
    const direct: FetchAccount[] = accessible.filter((row) => selectedEmails.includes(row.email));
    // A selected email that isn't directly connected may be a Gmail "send as" alias sharing its
    // owning account's mailbox (see messages.ts) — resolve it the same way here.
    const unresolved = selectedEmails.filter((email) => !accessibleEmails.has(email));
    let aliasRows: FetchAccount[] = [];
    if (unresolved.length) {
      const aliasAccounts = await getGmailAliasAccounts(userId);
      aliasRows = aliasAccounts
        .filter((alias) => unresolved.includes(alias.email))
        .map((alias) => ({ email: alias.email, ownerUserId: alias.ownerUserId, aliasOfEmail: alias.viaAccountEmail }));
    }
    accountRows = [...direct, ...aliasRows];
  }

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
        const tokenAccountEmail = account.aliasOfEmail || account.email;
        const tokenResult = await getValidGmailAccessToken(account.ownerUserId, tokenAccountEmail);
        if (!tokenResult.ok) {
          throw new Error(tokenResult.message);
        }
        const aliasEmail = account.aliasOfEmail ? account.email : undefined;
        let counts: Awaited<ReturnType<typeof fetchMailboxCounts>>;
        try {
          counts = await fetchMailboxCounts(tokenResult.accessToken, aliasEmail);
        } catch (error) {
          if (!isAuthError(error)) throw error;
          const refreshResult = await getValidGmailAccessToken(account.ownerUserId, tokenAccountEmail, { forceRefresh: true });
          if (!refreshResult.ok) {
            throw new Error(refreshResult.message);
          }
          counts = await fetchMailboxCounts(refreshResult.accessToken, aliasEmail);
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
