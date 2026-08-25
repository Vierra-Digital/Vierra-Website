import { prisma } from "@/lib/prisma";
import { getValidGmailAccessToken } from "@/lib/gmail/tokens";
import { fetchSendAsAliases } from "@/lib/gmail/gmailApi";

/**
 * Shared-inbox delegation helpers. A user can access a mailbox if they OWN it (their own
 * connected account) or an admin GRANTED it (mailbox_grants). These resolve the grant side;
 * callers combine with the user's owned accounts. Degrade to "no grants" if the table is
 * missing (P2021) so nothing breaks pre-migration.
 */

/**
 * Every Gmail mailbox a user can access = owned (their own connections) + granted (shared with
 * them by an admin), each tagged with the `ownerUserId` whose token/data to use. For owned
 * accounts ownerUserId === userId, so endpoints that swap in this list behave identically for
 * owners. Fail-safe: on any error, returns just the owned accounts.
 *
 * Short-TTL, per-instance cache: this is the first thing every /status, /messages, and /counts
 * request resolves, and the panel commonly calls two of those endpoints back to back (e.g. a
 * message-list load alongside a badge-count refresh) — uncached, that's 2 extra Prisma round
 * trips (owned connections + grants) duplicated across both requests for data that only changes
 * when a mailbox is connected/disconnected or a grant is made/revoked, all of which explicitly
 * call invalidateAccessibleAccountsCache. Same tradeoff as the alias cache below: doesn't survive
 * a cold start, but that's fine — a cache miss just falls through to the query it's saving.
 */
const ACCESSIBLE_CACHE_TTL_MS = 5 * 60 * 1000;
const accessibleCache = new Map<string, { expiresAt: number; data: Array<{ email: string; ownerUserId: string }> }>();

/**
 * Drop a user's cached accessible-accounts (and, since it derives from that list, their alias
 * cache) so the next request sees a mailbox that was just connected/disconnected, or a grant
 * that was just made/revoked, instead of stale data for up to ACCESSIBLE_CACHE_TTL_MS.
 */
export function invalidateAccessibleAccountsCache(userId: string) {
  accessibleCache.delete(userId);
  aliasCache.delete(userId);
}

export async function getAccessibleGmailAccounts(
  userId: string
): Promise<Array<{ email: string; ownerUserId: string }>> {
  const cached = accessibleCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const out: Array<{ email: string; ownerUserId: string }> = [];
  const seen = new Set<string>();
  try {
    // Ordered by connection age so downstream consumers (e.g. getGmailAliasAccounts' collision
    // tiebreak) can rely on "first in this list" meaning "earliest connected", deterministically.
    const owned = await prisma.platformToken.findMany({
      where: { user_id: userId, platform: { startsWith: "gmail:" } },
      select: { platform: true },
      orderBy: { created_at: "asc" },
    });
    for (const r of owned) {
      const email = r.platform.replace(/^gmail:/, "").toLowerCase();
      if (email && !seen.has(email)) {
        seen.add(email);
        out.push({ email, ownerUserId: userId });
      }
    }
  } catch {
    return out;
  }
  try {
    const grants = await prisma.mailboxGrant.findMany({
      where: { grantee_user_id: userId },
      select: { account_email: true },
    });
    const grantEmails = [...new Set(grants.map((g) => g.account_email.toLowerCase()))].filter((e) => e && !seen.has(e));
    if (grantEmails.length > 0) {
      // Resolve every granted mailbox's owner in ONE query (was a findFirst per grant). Ordered
      // by created_at asc so the earliest connection wins per email (kept via the first-seen map).
      const owners = await prisma.platformToken.findMany({
        where: { platform: { in: grantEmails.map((e) => `gmail:${e}`) } },
        orderBy: { created_at: "asc" },
        select: { user_id: true, platform: true },
      });
      const ownerByEmail = new Map<string, string>();
      for (const o of owners) {
        const email = o.platform.replace(/^gmail:/, "").toLowerCase();
        if (!ownerByEmail.has(email)) ownerByEmail.set(email, o.user_id);
      }
      for (const email of grantEmails) {
        const ownerUserId = ownerByEmail.get(email);
        if (ownerUserId) {
          seen.add(email);
          out.push({ email, ownerUserId });
        }
      }
    }
  } catch {
    /* grants table unavailable — owned accounts already returned */
  }
  accessibleCache.set(userId, { expiresAt: Date.now() + ACCESSIBLE_CACHE_TTL_MS, data: out });
  return out;
}

export type GmailAliasAccount = { email: string; ownerUserId: string; viaAccountEmail: string };

/**
 * A "domain address forwarded into Gmail" (e.g. added under Gmail Settings > Accounts > Send
 * mail as, verified) has no OAuth token of its own — its mail is delivered straight into the
 * connected Gmail account's inbox. Without this, selecting that address as an "account" in the
 * panel matches nothing in getAccessibleGmailAccounts and silently returns an empty inbox, even
 * though the mail is really sitting in an account the user already has access to. Resolves each
 * accessible Gmail account's verified send-as aliases (skipping the primary — that's the account
 * itself) so callers can route a request for the alias's mail back to the real account + token.
 * Best-effort: a Gmail API failure for one account just omits its aliases, it never throws.
 *
 * Short-TTL, per-instance cache: this is called on every /status, and every /messages or
 * /counts request for an unrecognized account, so an uncached version means one extra Gmail
 * sendAs.list call per accessible account on every poll. Aliases change rarely, so a few
 * minutes of staleness is an acceptable trade — worst case a newly-added alias takes up to
 * ALIAS_CACHE_TTL_MS to appear. Scoped to the warm serverless instance only (no shared store),
 * so this helps hot polling within an instance but doesn't survive cold starts.
 */
const ALIAS_CACHE_TTL_MS = 5 * 60 * 1000;
const aliasCache = new Map<string, { expiresAt: number; data: GmailAliasAccount[] }>();

export async function getGmailAliasAccounts(userId: string): Promise<GmailAliasAccount[]> {
  const cached = aliasCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const accessible = await getAccessibleGmailAccounts(userId);
  // Fetch every account's aliases concurrently, but keep `results[i]` aligned with
  // `accessible[i]` and merge them back in that (deterministic, connection-order) sequence —
  // so if two accounts somehow share an alias email, the earliest-connected account always
  // wins, regardless of which Gmail API call happens to resolve first.
  const results = await Promise.all(
    accessible.map(async (acct) => {
      try {
        const token = await getValidGmailAccessToken(acct.ownerUserId, acct.email);
        if (!token.ok) return [];
        return await fetchSendAsAliases(token.accessToken);
      } catch {
        /* best effort — one account's alias lookup failing shouldn't break the rest */
        return [];
      }
    })
  );

  const seen = new Set<string>(accessible.map((a) => a.email));
  const out: GmailAliasAccount[] = [];
  results.forEach((aliases, index) => {
    const acct = accessible[index];
    for (const alias of aliases) {
      if (alias.isPrimary || seen.has(alias.email)) continue;
      seen.add(alias.email);
      out.push({ email: alias.email, ownerUserId: acct.ownerUserId, viaAccountEmail: acct.email });
    }
  });

  aliasCache.set(userId, { expiresAt: Date.now() + ALIAS_CACHE_TTL_MS, data: out });
  return out;
}

export type FetchAccount = { email: string; ownerUserId: string; aliasOfEmail?: string };

/**
 * Which mailboxes to actually read for a request, given what the caller selected.
 *
 * Selecting nothing means every accessible account. Otherwise: the selected accounts, plus any
 * selected address that is a send-as alias resolved back to the account holding its mail.
 *
 * An alias is skipped when its parent account is also being read. The two share one Gmail mailbox
 * and the alias query is a subset of the parent's, so reading both returns the alias's mail twice
 * and counts it twice — which is exactly what made messages appear twice in the inbox and archive
 * and the sidebar badge read far higher than the mailbox held. The panel selects every connected
 * account and aliases are listed among them, so this is the normal case rather than an edge one.
 *
 * Pure, so both the message list and the badge counts can share it and be tested against it.
 */
export function selectFetchAccounts(
  accessible: Array<{ email: string; ownerUserId: string }>,
  aliases: GmailAliasAccount[],
  selectedEmails: string[]
): FetchAccount[] {
  if (selectedEmails.length === 0) return accessible.map((row) => ({ ...row }));

  const selected = new Set(selectedEmails.map((email) => email.toLowerCase()));
  const direct = accessible.filter((row) => selected.has(row.email));
  const accessibleEmails = new Set(accessible.map((row) => row.email));
  const parentsBeingRead = new Set(direct.map((row) => row.email));

  const aliasRows = aliases
    .filter(
      (alias) =>
        selected.has(alias.email) &&
        !accessibleEmails.has(alias.email) &&
        !parentsBeingRead.has(alias.viaAccountEmail)
    )
    .map((alias) => ({
      email: alias.email,
      ownerUserId: alias.ownerUserId,
      aliasOfEmail: alias.viaAccountEmail,
    }));

  return [...direct.map((row) => ({ ...row })), ...aliasRows];
}

/**
 * The enforcement primitive for shared inboxes. Resolves WHOSE token/data should be used for
 * `accountEmail` when `requesterId` asks for it:
 *   - owns it (Gmail token or SMTP account)  → { ownerUserId: requesterId } (identical to today)
 *   - granted it                             → { ownerUserId: <real owner>, canSend: grant.can_send }
 *   - a Gmail send-as alias of an account they can access → resolved to that account, tokenEmail
 *     pointed at the real Gmail address (aliases have no OAuth token of their own)
 *   - neither                                → null (FAIL-CLOSED — no access)
 * Wire endpoints to use ownerUserId + **tokenEmail** (not accountEmail) for token lookups —
 * they're the same for owned/granted accounts, but differ for aliases.
 */
export async function resolveMailboxOwner(
  requesterId: string,
  accountEmail: string
): Promise<{ ownerUserId: string; canSend: boolean; tokenEmail: string } | null> {
  const email = accountEmail.toLowerCase();
  try {
    // Own-mailbox is the overwhelmingly common case, so it's worth firing both ownership checks
    // together rather than paying two sequential round-trips before falling through to grants.
    const [ownsGmail, ownsSmtp] = await Promise.all([
      prisma.platformToken.findFirst({
        where: { user_id: requesterId, platform: `gmail:${email}` },
        select: { id: true },
      }),
      prisma.emailProviderAccount.findFirst({
        where: { user_id: requesterId, account_email: email },
        select: { id: true },
      }),
    ]);
    if (ownsGmail || ownsSmtp) return { ownerUserId: requesterId, canSend: true, tokenEmail: email };

    const grant = await prisma.mailboxGrant.findFirst({
      where: { grantee_user_id: requesterId, account_email: email },
      select: { can_send: true },
    });
    if (grant) {
      const [gmailOwner, smtpOwner] = await Promise.all([
        prisma.platformToken.findFirst({
          where: { platform: `gmail:${email}` },
          orderBy: { created_at: "asc" },
          select: { user_id: true },
        }),
        prisma.emailProviderAccount.findFirst({
          where: { account_email: email },
          select: { user_id: true },
        }),
      ]);
      if (gmailOwner) return { ownerUserId: gmailOwner.user_id, canSend: grant.can_send, tokenEmail: email };
      if (smtpOwner) return { ownerUserId: smtpOwner.user_id, canSend: grant.can_send, tokenEmail: email };
    }

    // Not a directly-connected or granted mailbox — check whether it's a verified "send as"
    // alias of an account this requester can already reach (owned or granted).
    const alias = (await getGmailAliasAccounts(requesterId)).find((a) => a.email === email);
    if (alias) return { ownerUserId: alias.ownerUserId, canSend: true, tokenEmail: alias.viaAccountEmail };

    return null;
  } catch {
    return null;
  }
}
