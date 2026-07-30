/** Shared types for the inbound-processing loop (kept separate to avoid import cycles). */

/** A newly-arrived inbound Gmail message, normalized for the processing hooks. */
export type InboundMessage = {
  id: string;
  threadId: string;
  userId: string;
  accountEmail: string;
  from: string; // raw From header
  fromEmail: string; // parsed address
  to: string;
  subject: string;
  snippet: string;
  labelIds: string[];
  messageIdHeader: string;
  inReplyTo: string;
  /** All headers, lowercased name -> value (last wins), for hooks that need more. */
  headers: Record<string, string>;
};

/** Context passed to each inbound hook. */
export type InboundContext = {
  accessToken: string;
  baseUrl: string;
  now: Date;
};
