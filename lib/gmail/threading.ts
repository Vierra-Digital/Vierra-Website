/**
 * Splitting a Gmail "thread" into the real conversations inside it.
 *
 * Gmail assigns one threadId to messages that merely share a subject and participants, so a thread
 * can contain several genuinely unrelated conversations. Treating threadId as the conversation
 * boundary therefore collapses independent emails into one row (hiding all but the newest) and
 * makes the reader stitch unrelated messages into a single chain — which is how mail gets missed.
 *
 * RFC 5322 carries the real structure: a reply lists the Message-IDs it answers in
 * `In-Reply-To` / `References`; a brand-new message lists none. Linking messages only through
 * those references recovers the actual conversations.
 */

/** The fields these helpers need. Anything with these shapes works (list rows and thread rows). */
export type ThreadableMessage = {
  id: string;
  /** Value of the message's own `Message-ID` header. */
  messageIdHeader?: string;
  /** Value of the `References` header (space-separated Message-IDs, oldest first). */
  references?: string;
  /** Value of the `In-Reply-To` header, when available. */
  inReplyTo?: string;
};

/** Pull `<id>` tokens out of a References/In-Reply-To header value. */
export function parseMessageIds(value?: string): string[] {
  if (!value) return [];
  const matches = value.match(/<[^<>\s]+>/g);
  if (matches) return matches.map((id) => id.trim().toLowerCase());
  // Some senders omit the angle brackets; fall back to whitespace splitting.
  return value
    .split(/\s+/)
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.includes("@"));
}

/** Normalize a single Message-ID for comparison. */
export function normalizeMessageId(value?: string): string {
  const ids = parseMessageIds(value);
  return ids.length > 0 ? ids[0] : (value || "").trim().toLowerCase();
}

/** Every Message-ID a message points at (its parent plus any earlier ancestors). */
function referencedIds(message: ThreadableMessage): string[] {
  return [...parseMessageIds(message.references), ...parseMessageIds(message.inReplyTo)];
}

/**
 * Stable key for the conversation a message belongs to, usable for grouping a LIST where the
 * other messages may not be loaded.
 *
 * A reply's References begins with the root of its chain, so replies to the same original share a
 * key even across Gmail's thread boundaries. A message that references nothing is itself a root and
 * gets a key unique to it, so two independent sends never group together.
 */
export function chainKeyFor(message: ThreadableMessage): string {
  const refs = referencedIds(message);
  if (refs.length > 0) return `chain:${refs[0]}`;
  const own = normalizeMessageId(message.messageIdHeader);
  return own ? `chain:${own}` : `msg:${message.id}`;
}

/**
 * The messages that are genuinely part of the same conversation as `targetId`.
 *
 * Builds an undirected graph over reference links (A→B when A references B's Message-ID, in either
 * direction) and returns the connected component containing the target, preserving input order.
 * A message linked to nothing comes back on its own.
 */
export function chainFor<T extends ThreadableMessage>(messages: T[], targetId: string): T[] {
  if (messages.length <= 1) return messages;

  // Message-ID -> index, so a reference can be resolved to a message in this thread.
  const indexByMessageId = new Map<string, number>();
  messages.forEach((message, index) => {
    const own = normalizeMessageId(message.messageIdHeader);
    if (own && !indexByMessageId.has(own)) indexByMessageId.set(own, index);
  });

  const adjacency: Set<number>[] = messages.map(() => new Set<number>());
  messages.forEach((message, index) => {
    for (const ref of referencedIds(message)) {
      const parent = indexByMessageId.get(ref);
      if (parent === undefined || parent === index) continue;
      adjacency[index].add(parent);
      adjacency[parent].add(index);
    }
  });

  const startIndex = messages.findIndex((message) => message.id === targetId);
  if (startIndex === -1) return messages;

  const keep = new Set<number>([startIndex]);
  const queue = [startIndex];
  while (queue.length > 0) {
    const current = queue.shift() as number;
    for (const neighbour of adjacency[current]) {
      if (keep.has(neighbour)) continue;
      keep.add(neighbour);
      queue.push(neighbour);
    }
  }

  return messages.filter((_, index) => keep.has(index));
}
