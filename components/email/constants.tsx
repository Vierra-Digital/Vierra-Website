/** Shared constants for the email panel (extracted from EmailingPlatformSection). */
import React from "react";
import { FiInbox, FiMail, FiSend, FiUsers, FiArchive, FiTrash2, FiKey, FiCheckSquare, FiBarChart2, FiStar, FiFlag, FiClock, FiLayers, FiLinkedin } from "react-icons/fi";
import type { ModuleKey, MailboxCounts } from "@/components/email/types";

export const PAGE_SIZE = 50;
export const CONTACTS_PAGE_SIZE = 50;

/** Neutral scrollbar; overrides global purple `::-webkit-scrollbar` in app/globals.css for compose UI. */
export const COMPOSE_NEUTRAL_SCROLLBAR =
  "[scrollbar-width:thin] [scrollbar-color:rgb(203_213_225)_rgb(241_245_249)] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-slate-100 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb:hover]:bg-slate-400";

/** Basic validation for comma-separated recipient fields (Cc / Bcc). */
export function validateRecipientCsv(label: "Cc" | "Bcc", raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(",").map((entry) => entry.trim()).filter(Boolean);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  for (const part of parts) {
    const addr = part.includes("<") ? (part.match(/<([^>]+)>/)?.[1] || part).trim() : part;
    if (!emailOk.test(addr)) return `${label}: invalid address "${part}"`;
  }
  return null;
}

export const EMPTY_COUNTS: MailboxCounts = {
  inbox: 0,
  sent: 0,
  drafts: 0,
  archive: 0,
  spam: 0,
  trash: 0,
};

export const MODULES: Array<{ key: ModuleKey; label: string; icon: React.ReactNode }> = [
  { key: "inbox", label: "Inbox", icon: <FiInbox className="w-4 h-4" /> },
  { key: "starred", label: "Starred", icon: <FiStar className="w-4 h-4" /> },
  { key: "important", label: "Important", icon: <FiFlag className="w-4 h-4" /> },
  { key: "sent", label: "Sent", icon: <FiSend className="w-4 h-4" /> },
  { key: "scheduled", label: "Scheduled", icon: <FiClock className="w-4 h-4" /> },
  { key: "drafts", label: "Drafts", icon: <FiMail className="w-4 h-4" /> },
  { key: "allmail", label: "All Mail", icon: <FiLayers className="w-4 h-4" /> },
  { key: "analytics", label: "Analytics", icon: <FiBarChart2 className="w-4 h-4" /> },
  { key: "contacts", label: "Contacts", icon: <FiUsers className="w-4 h-4" /> },
  { key: "cryptography", label: "Cartography", icon: <FiKey className="w-4 h-4" /> },
  { key: "campaigns", label: "Campaigns", icon: <FiCheckSquare className="w-4 h-4" /> },
  { key: "linkedin", label: "LinkedIn", icon: <FiLinkedin className="w-4 h-4" /> },
  { key: "archive", label: "Archive", icon: <FiArchive className="w-4 h-4" /> },
  { key: "spam", label: "Spam", icon: <FiMail className="w-4 h-4" /> },
  { key: "trash", label: "Trash", icon: <FiTrash2 className="w-4 h-4" /> },
];

export const BADGE_MODULES = new Set<ModuleKey>(["inbox", "sent", "drafts", "archive", "spam"]);
export const BADGE_MAILBOXES: Array<"inbox" | "sent" | "drafts" | "archive" | "spam" | "trash"> = [
  "inbox",
  "sent",
  "drafts",
  "archive",
  "spam",
  "trash",
];
