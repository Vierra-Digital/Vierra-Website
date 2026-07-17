/** Shared types for the email panel (extracted from EmailingPlatformSection). */

export type ModuleKey =
  | "inbox"
  | "starred"
  | "important"
  | "sent"
  | "scheduled"
  | "drafts"
  | "allmail"
  | "analytics"
  | "campaigns"
  | "cryptography"
  | "contacts"
  | "archive"
  | "spam"
  | "trash";

export type GmailAccountConnection = {
  email: string;
  connected: boolean;
  expiresAt: string | null;
  reconnectReason?: string | null;
};

export type MessageRow = {
  id: string;
  threadId: string;
  accountEmail: string;
  subject: string;
  from: string;
  to: string;
  fromRaw: string;
  toRaw: string;
  date: string;
  timestamp: number;
  snippet: string;
  mailbox: "inbox" | "sent" | "drafts" | "spam" | "trash" | "archive";
  replyTo: string;
  messageIdHeader: string;
  references: string;
  unread: boolean;
  starred?: boolean;
  threadCount?: number;
  tracked: boolean;
  trackingOpenCount?: number;
  trackingClickCount?: number;
  trackingFirstOpenedAt?: string | null;
  trackingLastOpenedAt?: string | null;
  trackingTotalOpenWindowMs?: number;
  isComposeDraft?: boolean;
  draftKey?: string;
  composeCc?: string;
  composeBcc?: string;
  composeShowCc?: boolean;
  composeShowBcc?: boolean;
  composeBodyText?: string;
  composeBodyHtml?: string;
  composePreviewHtml?: string;
};

export type MessageDetail = {
  bodyHtml: string;
  bodyText: string;
  fromRaw?: string;
  toRaw?: string;
  subject?: string;
  replyTo?: string;
  date?: string;
  timestamp?: number;
  messageIdHeader?: string;
  references?: string;
  senderPhotoUrl?: string;
  threadMessages?: ThreadMessage[];
};

export type ThreadMessage = {
  id: string;
  threadId: string;
  subject: string;
  fromRaw: string;
  toRaw: string;
  replyTo: string;
  date: string;
  timestamp: number;
  snippet: string;
  bodyText: string;
  bodyHtml: string;
  messageIdHeader: string;
  references: string;
};

export type MailboxCounts = {
  inbox: number;
  sent: number;
  drafts: number;
  archive: number;
  spam: number;
  trash: number;
};

export type ModuleUnreadBadgeCounts = {
  inbox: number;
  sent: number;
  drafts: number;
  archive: number;
  spam: number;
  trash: number;
};

export type ContactTag = {
  id: string;
  name: string;
  color: string;
};

export type ContactRow = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  business: string | null;
  website: string | null;
  address: string | null;
  source: "MANUAL" | "GMAIL" | "CSV";
  accountEmail: string | null;
  tags: ContactTag[];
};

export type ContactVisibility = {
  showPhone: boolean;
  showBusiness: boolean;
  showWebsite: boolean;
};

export type ProviderAccount = {
  id: string;
  accountEmail: string;
  providerLabel?: string | null;
};

export type BlockedSenderRow = {
  id: string;
  email: string;
  accountEmail: string | null;
  name: string | null;
};

export type LocalEmailDraft = {
  to: string;
  cc?: string;
  bcc?: string;
  showCc?: boolean;
  showBcc?: boolean;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  previewHtml?: string;
  accountEmail?: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string;
  updatedAt: number;
};
