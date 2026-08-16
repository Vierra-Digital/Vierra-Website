/** Low-level Gmail REST helpers shared by the inbound loop and its hooks (no import cycle). */

const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";

export async function gmailGet(
  accessToken: string,
  path: string
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const res = await fetch(`${GMAIL}${path}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/** Case-insensitive lookup of a header value from a Gmail payload's headers array. */
export function extractHeader(headers: Array<{ name?: string; value?: string }> | undefined, key: string): string {
  if (!headers) return "";
  const target = headers.find((h) => (h.name || "").toLowerCase() === key.toLowerCase());
  return target?.value || "";
}

/** Extract the bare address from a `Name <addr>` header value. Lowercases unless `lower:false`. */
export function parseAddressFromHeader(value: string, opts?: { lower?: boolean }): string {
  const trimmed = (value || "").trim();
  const angle = trimmed.match(/<([^>]+)>/);
  const addr = angle?.[1] ? angle[1].trim() : trimmed;
  return opts?.lower === false ? addr : addr.toLowerCase();
}

export type GmailSendAsAlias = { email: string; displayName: string; isPrimary: boolean };

/**
 * Verified "send as" identities on a connected Gmail account — includes the primary address
 * plus any custom "From" address the user added under Gmail Settings > Accounts > Send mail as
 * (the mechanism behind "attach a domain address to my Gmail via forwarding"). Non-primary
 * aliases have no OAuth token of their own; their mail is delivered into THIS account's inbox.
 */
export async function fetchSendAsAliases(accessToken: string): Promise<GmailSendAsAlias[]> {
  const { ok, data } = await gmailGet(accessToken, "/settings/sendAs");
  if (!ok) return [];
  const list = (data as { sendAs?: unknown })?.sendAs;
  if (!Array.isArray(list)) return [];
  return list
    .filter((entry: { isPrimary?: boolean; verificationStatus?: string }) => entry?.isPrimary || entry?.verificationStatus === "accepted")
    .map((entry: { sendAsEmail?: string; displayName?: string; isPrimary?: boolean }) => ({
      email: String(entry.sendAsEmail || "").toLowerCase(),
      displayName: entry.displayName || "",
      isPrimary: Boolean(entry.isPrimary),
    }))
    .filter((entry: GmailSendAsAlias) => entry.email);
}

/**
 * A Gmail search fragment that scopes results to mail addressed to (or, for sent/drafts, sent
 * from) a "send as" alias's address — used to give an alias its own filtered view of the
 * account it shares a mailbox with. `deliveredto:` matches the `Delivered-To` header, which the
 * receiving MTA adds and which survives most forwarding setups even when a `To:` header gets
 * rewritten along the way; `to:`/`from:` cover the common case where it doesn't. Combining both
 * with OR is strictly wider (never narrower) than either alone, so this can only recover
 * messages a single-operator filter would have missed — it can't introduce false positives
 * beyond what `to:`/`from:` already would.
 */
export function buildAliasScopeQuery(aliasEmail: string, direction: "to" | "from"): string {
  const primary = `${direction}:${aliasEmail}`;
  return direction === "to" ? `(${primary} OR deliveredto:${aliasEmail})` : primary;
}

/** Create a Gmail draft (a plain-text reply). Returns the draft id or null. Never sends. */
export async function createGmailDraft(
  accessToken: string,
  opts: { to: string; subject: string; bodyText: string; threadId?: string; inReplyTo?: string; references?: string }
): Promise<string | null> {
  const nl = "\r\n";
  const headers = [`To: ${opts.to}`, "MIME-Version: 1.0", `Subject: ${opts.subject}`, "Content-Type: text/plain; charset=UTF-8"];
  if (opts.inReplyTo) headers.push(`In-Reply-To: ${opts.inReplyTo}`);
  if (opts.references || opts.inReplyTo) headers.push(`References: ${opts.references || opts.inReplyTo}`);
  const raw = toBase64Url(`${headers.join(nl)}${nl}${nl}${opts.bodyText}`);
  const body: { message: { raw: string; threadId?: string } } = { message: { raw } };
  if (opts.threadId) body.message.threadId = opts.threadId;
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => ({}));
  return typeof data?.id === "string" ? data.id : null;
}

/** Resolve a user label by name, creating it if needed. Returns the label id or null. */
export async function getOrCreateLabelId(accessToken: string, name: string): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const list = await gmailGet(accessToken, "/labels");
  if (list.ok) {
    const labels = (list.data as { labels?: Array<{ id?: string; name?: string }> })?.labels || [];
    const found = labels.find((l) => (l.name || "").toLowerCase() === trimmed.toLowerCase());
    if (found?.id) return found.id;
  }
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/labels", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: trimmed, labelListVisibility: "labelShow", messageListVisibility: "show" }),
  });
  if (!res.ok) return null;
  const created = await res.json().catch(() => ({}));
  return typeof created?.id === "string" ? created.id : null;
}

/** Add/remove Gmail labels on a message (INBOX, UNREAD, STARRED, TRASH, or custom ids). */
export async function modifyMessageLabels(
  accessToken: string,
  messageId: string,
  changes: { addLabelIds?: string[]; removeLabelIds?: string[] }
): Promise<boolean> {
  const res = await fetch(`${GMAIL}/messages/${encodeURIComponent(messageId)}/modify`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      addLabelIds: changes.addLabelIds || [],
      removeLabelIds: changes.removeLabelIds || [],
    }),
  });
  return res.ok;
}
