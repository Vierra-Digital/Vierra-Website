/**
 * Reply threading headers.
 *
 * Gmail threads on its own conversation id, so a reply sent from this panel looked correctly threaded
 * to us even with an incomplete chain. Recipients on clients that thread on References instead saw
 * the reply detached from the message it answered.
 */

/**
 * The References header for a reply to a parent message.
 *
 * RFC 5322: the parent's References followed by the parent's Message-ID — the ancestry, then the
 * message actually being answered. Passing only the parent's References leaves that last hop out.
 */
export function buildReplyReferences(parentReferences?: string, parentMessageId?: string): string {
  const chain = (parentReferences || "").trim().replace(/\s+/g, " ");
  const parentId = (parentMessageId || "").trim();
  if (!parentId) return chain;
  // Already present (a client that pre-appended it, or a reply to our own reply): don't duplicate.
  if (chain.split(/\s+/).includes(parentId)) return chain;
  return chain ? `${chain} ${parentId}` : parentId;
}
