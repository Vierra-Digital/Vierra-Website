/**
 * Grouping a page of messages into the conversations a user would recognise.
 *
 * Gmail's own threadId is not that boundary: it also groups messages that merely share a subject
 * and participants, so two unrelated emails from the same person collapse into one row and one of
 * them is effectively hidden. Grouping purely by threadId reproduces that.
 *
 * The fix is to split each Gmail thread into reference-linked components. RFC 5322 says a reply
 * names what it answers in `In-Reply-To` / `References`; two messages with no reference path
 * between them are not the same conversation, even when Gmail filed them together.
 */

export type GroupableMessage = {
  id: string;
  threadId?: string;
  messageIdHeader?: string;
  references?: string;
  inReplyTo?: string;
};

/** Extract `<id>` tokens from a References / In-Reply-To header value, lowercased. */
export function parseMessageIds(value?: string): string[] {
  if (!value) return [];
  const bracketed = value.match(/<[^<>\s]+>/g);
  if (bracketed) return bracketed.map((id) => id.trim().toLowerCase());
  return value
    .split(/\s+/)
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.includes("@"));
}

/** This message's own Message-ID, normalized for comparison. */
function ownId(message: GroupableMessage): string {
  return parseMessageIds(message.messageIdHeader)[0] || "";
}

/** Every Message-ID this message points at. */
function parentIds(message: GroupableMessage): string[] {
  return [...parseMessageIds(message.inReplyTo), ...parseMessageIds(message.references)];
}

/**
 * Assign each message a conversation key.
 *
 * Messages are unioned only when a reference actually links them, and the union is confined to a
 * single Gmail thread so a shared quoted history can never merge across threads. Anything with no
 * link stands alone, which is what makes two unrelated emails in one Gmail thread show as two rows.
 *
 * Returns keys parallel to the input array.
 */
export function conversationKeys(messages: GroupableMessage[]): string[] {
  // Union-find over message indices.
  const parent = messages.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const union = (a: number, b: number) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent[rootB] = rootA;
  };

  // Message-ID -> index, scoped per thread so identical ids in different threads can't bridge them.
  const indexById = new Map<string, number>();
  messages.forEach((message, index) => {
    const id = ownId(message);
    if (!id) return;
    const key = `${message.threadId || ""}::${id}`;
    if (!indexById.has(key)) indexById.set(key, index);
  });

  messages.forEach((message, index) => {
    for (const ref of parentIds(message)) {
      const target = indexById.get(`${message.threadId || ""}::${ref}`);
      if (target === undefined || target === index) continue;
      union(index, target);
    }
  });

  // Stable key per component: thread id plus the earliest member's index.
  return messages.map((message, index) => `${message.threadId || `m:${message.id}`}#${find(index)}`);
}

/**
 * Collapse a page of messages into conversation rows.
 *
 * The first message of each conversation (in input order) represents it, carrying a count of how
 * many messages it stands for. `standalone` forces a message to its own row — used for local
 * compose drafts, which have no Gmail thread.
 */
export function groupConversations<T extends GroupableMessage>(
  messages: T[],
  standalone: (message: T) => boolean = () => false
): Array<T & { threadCount: number }> {
  const rows: Array<T & { threadCount: number }> = [];
  const groupable: T[] = [];
  const groupableSlots: number[] = [];

  messages.forEach((message) => {
    if (standalone(message)) {
      rows.push({ ...message, threadCount: 1 });
      return;
    }
    groupableSlots.push(rows.length);
    rows.push({ ...message, threadCount: 1 });
    groupable.push(message);
  });

  if (groupable.length === 0) return rows;

  const keys = conversationKeys(groupable);
  const firstRowByKey = new Map<string, number>();
  const drop = new Set<number>();

  keys.forEach((key, i) => {
    const rowIndex = groupableSlots[i];
    const existing = firstRowByKey.get(key);
    if (existing === undefined) {
      firstRowByKey.set(key, rowIndex);
    } else {
      rows[existing].threadCount += 1;
      drop.add(rowIndex);
    }
  });

  return rows.filter((_, index) => !drop.has(index));
}

/**
 * The messages forming the same conversation as `targetId`, preserving input order.
 *
 * Used by the reader so it shows exactly what the list row represents. Without this the list could
 * split a Gmail thread into two rows while opening either one still stitched the whole thread back
 * together, which is how a message ends up looking merged even after the list is correct.
 */
export function conversationFor<T extends GroupableMessage>(messages: T[], targetId: string): T[] {
  if (messages.length <= 1) return messages;
  const targetIndex = messages.findIndex((message) => message.id === targetId);
  // Unknown target: return everything rather than risk hiding the thread entirely.
  if (targetIndex === -1) return messages;
  const keys = conversationKeys(messages);
  const targetKey = keys[targetIndex];
  return messages.filter((_, index) => keys[index] === targetKey);
}
