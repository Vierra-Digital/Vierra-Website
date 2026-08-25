/**
 * Whether a mailbox view collapses a Gmail thread to a single row.
 *
 * This rule has been wrong twice, in opposite directions, so it lives in one place with tests.
 *
 * Archive and Sent collapse: in those views a reply you sent sits beside the original you
 * received — same thread, subjects one "Re:" apart — so the conversation reads as a duplicated row.
 *
 * The Inbox must not collapse. Gmail files two unrelated emails from the same person into one
 * thread whenever they share a subject and participants, so collapsing there hides one of them
 * behind a count. That was the reported bug where a sender's second email simply never appeared.
 *
 * Drafts are exempt because a draft is its own editable object, not a message in a conversation.
 */
export function collapsesThreads(mailbox: string): boolean {
  return mailbox === "archive" || mailbox === "sent";
}
