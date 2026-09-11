import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Geist } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import {
  FiAlertCircle,
  FiArchive,
  FiCheckSquare,
  FiCheck,
  FiClock,
  FiChevronsRight,
  FiCornerUpLeft,
  FiCalendar,
  FiEdit3,
  FiPaperclip,
  FiMail,
  FiMove,
  FiPlus,
  FiRefreshCw,
  FiChevronLeft,
  FiChevronRight,
  FiSearch,
  FiSend,
  FiSettings,
  FiStar,
  FiShield,
  FiTag,
  FiTrash2,
  FiX,
} from "react-icons/fi";
// Feather has no reply-all glyph; two overlapping arrows read as a smudge at 16px. Material's
// is the same double-arrow Gmail uses.
import { MdReplyAll } from "react-icons/md";
import SuccessStatusModal from "@/components/ui/SuccessStatusModal";
import ConfirmActionModal from "@/components/ui/ConfirmActionModal";
import PromptModal from "@/components/ui/PromptModal";
import { MdRefresh } from "react-icons/md";
import { scoreTrackerImage } from "@/lib/email/trackerDetection";

import { isSafeEmailHref, stripRemoteUrlsFromStyle, UNSAFE_EMAIL_TAG_SELECTOR } from "@/lib/email/htmlSafety";
import { useDraftGuard, usePageLeaveGuard } from "@/hooks/useDraftGuard";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import KeyboardShortcutsModal from "@/components/email/KeyboardShortcutsModal";
import BrandLoadingScreen from "@/components/ui/BrandLoadingScreen";
import MoveToMenu from "@/components/email/MoveToMenu";
import MeetingInviteCard from "@/components/email/MeetingInviteCard";
import {
  BRAND_LOGO,
  ICON_BUTTON, ALERT,
} from "@/components/email/emailTheme";
import { useComposeWindow } from "./EmailingPlatformSection/hooks/useComposeWindow";
import ComposeWindow from "./EmailingPlatformSection/ComposeWindow";
import InlineReply from "./EmailingPlatformSection/InlineReply";
import { useContactsPanel } from "./EmailingPlatformSection/hooks/useContactsPanel";
import ContactsPanel, { ContactsModals } from "./EmailingPlatformSection/ContactsPanel";
import { MailboxLoader } from "./EmailingPlatformSection/mailboxUi";
import {
  PAGE_SIZE,
  EMPTY_COUNTS,
  MODULES,
  orderModules,
  BADGE_MODULES,
} from "@/components/email/constants";
import type {
  ModuleKey,
  GmailAccountConnection,
  MessageRow,
  MessageDetail,
  ThreadMessage,
  MailboxCounts,
  ModuleUnreadBadgeCounts,
  ProviderAccount,
  BlockedSenderRow,
} from "@/components/email/types";

// Site brand font (matches vierradev.com); replaces the panel's former Inter.
const panelFont = Geist({ subsets: ["latin"] });

// Lazy-load the Analytics view (recharts is heavy) so it stays out of the initial panel bundle.
const EmailAnalyticsView = dynamic(() => import("@/components/email/EmailAnalyticsView"), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-4 border-[#E9D4FB] border-t-[#701CC0] motion-safe:animate-spin" />
    </div>
  ),
});

// Lazy-load the Campaigns view (incorporated from the campaigns branch) so its bundle
// only loads when the Campaigns module is opened.
const CampaignsView = dynamic(() => import("@/components/PanelPages/CampaignsSection"), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-4 border-[#E9D4FB] border-t-[#701CC0] motion-safe:animate-spin" />
    </div>
  ),
});

// Lazy-load the Cartography view so its bundle only loads when that module is opened.
const CartographyView = dynamic(() => import("@/components/PanelPages/CartographySection"), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-4 border-[#E9D4FB] border-t-[#701CC0] motion-safe:animate-spin" />
    </div>
  ),
});

type EmailingPlatformSectionProps = {
  initialSelectedAccounts?: string[];
  /** Gmail thread id to auto-open (the whole conversation) once the inbox loads — deep link, e.g. from a Discord alert. */
  initialOpenThreadId?: string;
};

const MailboxEmpty: React.FC = () => (
  <div className="h-full min-h-[320px] flex items-center justify-center px-6">
    <div className="text-center rounded-2xl border border-[#ECEAF1] bg-white px-9 py-11 shadow-[0_10px_40px_-12px_rgba(46,16,80,0.10)]">
      {/* Gently animated mark: the halo breathes and the envelope drifts, so an empty
          mailbox still feels alive. Both are motion-safe (static for reduced-motion users). */}
      <div className="relative w-12 h-12 mx-auto">
        <span className="absolute inset-0 rounded-full bg-[#701CC0]/10 motion-safe:animate-ping" aria-hidden />
        <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-[#701CC0]/10">
          <FiMail className="w-6 h-6 text-[#701CC0] motion-safe:animate-[mailboxFloat_2.6s_ease-in-out_infinite]" />
        </span>
      </div>
      <p className="mt-4 text-sm font-semibold text-[#1E1B2E]">No Emails Found</p>
      <p className="text-xs text-[#847FA0] mt-1">Try another mailbox or refresh this view.</p>
    </div>
  </div>
);

/**
 * Cap on a mailbox action (trash, archive, move…). Comfortably above a normal Gmail round trip but
 * well under the serverless function limit, so a stalled upstream surfaces as a clear message
 * rather than a spinner that never ends.
 */
const ACTION_TIMEOUT_MS = 15_000;

/** How many mailbox views to keep in the message cache (each is up to PAGE_SIZE rows). */
const MESSAGE_CACHE_LIMIT = 12;

/** Mailbox destinations a message can be dropped onto. */
const MESSAGE_DROP_ACTIONS: Record<string, "moveToInbox" | "moveToSpam" | "moveToTrash" | "archive"> = {
  inbox: "moveToInbox",
  spam: "moveToSpam",
  trash: "moveToTrash",
  archive: "archive",
};

/**
 * Last-known enabled account selection, so a repeat visit can start fetching messages/counts
 * immediately instead of waiting out a full /api/gmail/status + account-preferences round trip
 * before it even knows which accounts to ask for. Not user-scoped: on a shared browser this can
 * seed a stale guess from a previous session, but the server always re-derives access from the
 * live session, so a stale/foreign email just yields an empty result that self-corrects the
 * moment the real connections response lands — never someone else's data.
 */
const LAST_ACCOUNTS_STORAGE_KEY = "vierra:email-panel:last-accounts";

function readCachedSelectedAccounts(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LAST_ACCOUNTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string" && v.length > 0) : [];
  } catch {
    return [];
  }
}

function writeCachedSelectedAccounts(accounts: string[]): void {
  if (typeof window === "undefined") return;
  try {
    if (accounts.length === 0) {
      window.localStorage.removeItem(LAST_ACCOUNTS_STORAGE_KEY);
    } else {
      window.localStorage.setItem(LAST_ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
    }
  } catch {
    /* storage unavailable (disabled, quota, private mode) — the panel just falls back to the gate wait */
  }
}

const EmailingPlatformSection: React.FC<EmailingPlatformSectionProps> = ({
  initialSelectedAccounts = [],
  initialOpenThreadId = "",
}) => {
  const router = useRouter();
  const initialAccountsRef = useRef(initialSelectedAccounts);
  const deepLinkAppliedRef = useRef(false);
  // Browser back/forward for the email panel: module, label, and open-message are pushed to the
  // URL as they change so the browser's own history stack can step through them. `isApplyingNavRef`
  // marks a state change as "already reflected in the URL" (came from the URL itself, either the
  // initial mount sync or a back/forward pop) so the push-effect below doesn't turn around and
  // push a duplicate/incorrect entry for it. `navReadyRef` withholds any pushes until the very
  // first URL->state sync has run, so mount doesn't overwrite a deep-linked URL with defaults.
  const isApplyingNavRef = useRef(false);
  const navReadyRef = useRef(false);
  const pendingNavThreadRef = useRef("");
  // The very first URL write (priming the address bar with the starting module, e.g. "?module=inbox"
  // on a bare "/panel/email" visit) uses replace so it doesn't consume a "back" step before the
  // panel is even navigated within; every write after that is a real push.
  const hasWrittenNavUrlRef = useRef(false);
  // No URL-preselected accounts: fall back to last time's enabled selection (if any) so the panel
  // can start fetching messages/counts immediately instead of sitting on the gate loading screen
  // for a full connections round trip. loadGmailConnections still runs and corrects this if it's wrong.
  const cachedAccountsRef = useRef(initialSelectedAccounts.length > 0 ? [] : readCachedSelectedAccounts());
  const initialResolvedAccounts = initialSelectedAccounts.length > 0 ? initialSelectedAccounts : cachedAccountsRef.current;
  const [step, setStep] = useState<"gate" | "client">(initialResolvedAccounts.length > 0 ? "client" : "gate");
  const [activeModule, setActiveModule] = useState<ModuleKey>("inbox");
  const [hiddenModules, setHiddenModules] = useState<string[]>([]);
  /** User's custom sidebar order (module keys). Empty = fall back to MODULES order. */
  const [moduleOrder, setModuleOrder] = useState<string[]>([]);
  /** Ids already sent for scanning, so a page never re-scans rows it has seen. */
  const scannedIdsRef = useRef<Set<string>>(new Set());
  /** messageId → tracker verdict. Filled in just after the list paints (see the scan effect). */
  /** Index into the sender's ordered avatar candidates; advanced on each image error. */
  const [messageTrackers, setMessageTrackers] = useState<
    Record<string, { tracked: boolean; count: number; vendors: string[]; hasAttachment?: boolean; hasMeetingInvite?: boolean }>
  >({});
  const [gmailAccounts, setGmailAccounts] = useState<GmailAccountConnection[]>([]);
  const [gmailLoading, setGmailLoading] = useState(false);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>(initialResolvedAccounts);

  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState("");
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [accountErrors, setAccountErrors] = useState<Array<{ accountEmail: string; message: string }>>([]);
  const [senderAvatarIndex, setSenderAvatarIndex] = useState(0);
  const [selectedMessageId, setSelectedMessageId] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [selectedMessageDetail, setSelectedMessageDetail] = useState<MessageDetail | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "message">("list");

  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);

  const [mailboxCounts, setMailboxCounts] = useState<MailboxCounts>(EMPTY_COUNTS);
  const [, setCountsLoading] = useState(false);
  const [moduleUnreadBadges, setModuleUnreadBadges] = useState<ModuleUnreadBadgeCounts>({
    inbox: 0,
    sent: 0,
    drafts: 0,
    archive: 0,
    spam: 0,
    trash: 0,
  });

  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [moveMenuOpen, setMoveMenuOpen] = useState<null | "list" | "message">(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [labels, setLabels] = useState<Array<{ id: string; name: string }>>([]);
  const [activeLabelId, setActiveLabelId] = useState("");
  const [activeLabelName, setActiveLabelName] = useState("");
  const [labelMenuOpen, setLabelMenuOpen] = useState(false);
  // Scheduled-send queue (our own queue, shown in the "Scheduled" module — not Gmail's in:scheduled).
  type ScheduledQueueItem = {
    id: string;
    accountEmail: string;
    scheduledAt: string;
    status: string;
    lastError: string | null;
    to: string;
    subject: string;
  };
  const [scheduledItems, setScheduledItems] = useState<ScheduledQueueItem[]>([]);
  const [scheduledLoading, setScheduledLoading] = useState(false);
  const [scheduledError, setScheduledError] = useState("");
  const [cancelingScheduledId, setCancelingScheduledId] = useState("");

  const [newLabelModalOpen, setNewLabelModalOpen] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [creatingLabel, setCreatingLabel] = useState(false);
  /** Guards double-fires without greying the toolbar out for the whole round trip. */
  /**
   * Rows with an action in flight, keyed by rowKey.
   *
   * This was a single boolean, so ANY action anywhere blocked every other action until Gmail
   * answered — archive one message, immediately move a different one, and the second was refused
   * outright with "Still finishing the last action". That is the slowness and the "takes several
   * attempts": the click was rejected, not slow. Per-row means only the same message is guarded,
   * which is all the guard was ever for (double-submitting one mutation).
   */
  const actionInFlightRef = useRef<Set<string>>(new Set());
  /** Set below; lets applyAction re-sync after a partial failure without a cyclic dep. */
  const loadMessagesRef = useRef<() => void>(() => {});
  const [labelToDelete, setLabelToDelete] = useState<{ id: string; name: string } | null>(null);
  /** Open when the trash button is about to hard-delete (Spam/Trash) — that has no undo. */
  const [confirmHardDelete, setConfirmHardDelete] = useState(false);
  const [labelToRename, setLabelToRename] = useState<{ id: string; name: string } | null>(null);
  const [renamingLabel, setRenamingLabel] = useState(false);
  const [deletingLabel, setDeletingLabel] = useState(false);
  const [sentToast, setSentToast] = useState<{ message: string; undo?: () => void } | null>(null);
  const sentToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [blockedSenders, setBlockedSenders] = useState<BlockedSenderRow[]>([]);
  const [blockSuccessModal, setBlockSuccessModal] = useState<{
    open: boolean;
    title: string;
    message: string;
  }>({
    open: false,
    title: "",
    message: "",
  });
  const [providerAccounts, setProviderAccounts] = useState<ProviderAccount[]>([]);
  const loadMessagesRequestRef = useRef(0);
  /**
   * Per-view message cache (key = the messages query string) powering stale-while-revalidate,
   * so revisiting a mailbox/page paints instantly instead of spinning. Cleared whenever an action
   * mutates mail, so a deleted/moved message can never flash back from cache.
   */
  const messagesCacheRef = useRef<
    Map<
      string,
      { messages: MessageRow[]; accountErrors: Array<{ accountEmail: string; message: string }>; hasNextPage: boolean }
    >
  >(new Map());
  const invalidateMessagesCache = useCallback(() => {
    messagesCacheRef.current.clear();
  }, []);
  /** Cache keys currently being prefetched, so a fast re-render doesn't fire the same fetch twice. */
  const prefetchInFlightRef = useRef<Set<string>>(new Set());
  const storeMessagesCache = useCallback(
    (key: string, messages: MessageRow[], accountErrors: Array<{ accountEmail: string; message: string }>, hasNextPage: boolean) => {
      // Bounded LRU-ish cache: re-inserting moves the key to the end, and we evict the oldest.
      messagesCacheRef.current.delete(key);
      messagesCacheRef.current.set(key, { messages, accountErrors, hasNextPage });
      if (messagesCacheRef.current.size > MESSAGE_CACHE_LIMIT) {
        const oldest = messagesCacheRef.current.keys().next().value;
        if (oldest !== undefined) messagesCacheRef.current.delete(oldest);
      }
    },
    []
  );
  const selectedMessageIdRef = useRef("");
  const moveListMenuRef = useRef<HTMLDivElement | null>(null);
  const snoozeMenuRef = useRef<HTMLDivElement | null>(null);
  const [snoozeMenuOpen, setSnoozeMenuOpen] = useState(false);
  const moveMessageMenuRef = useRef<HTMLDivElement | null>(null);
  const labelMenuRef = useRef<HTMLDivElement | null>(null);

  const connectedAccounts = useMemo(() => gmailAccounts.filter((a) => a.connected), [gmailAccounts]);
  const selectedAccountsKey = useMemo(() => selectedAccounts.join(","), [selectedAccounts]);
  const selectedMessage = useMemo(
    () => messages.find((message) => message.id === selectedMessageId) || null,
    [messages, selectedMessageId]
  );
  const threadMessages = useMemo(() => {
    const rows = Array.isArray(selectedMessageDetail?.threadMessages) ? selectedMessageDetail.threadMessages : [];
    if (rows.length > 0) return rows;
    if (!selectedMessage) return [] as ThreadMessage[];
    return [
      {
        id: selectedMessage.id,
        threadId: selectedMessage.threadId,
        subject: selectedMessage.subject,
        fromRaw: selectedMessage.fromRaw || selectedMessage.from,
        toRaw: selectedMessage.toRaw || selectedMessage.to,
        replyTo: selectedMessage.replyTo || selectedMessage.fromRaw || selectedMessage.from,
        date: selectedMessage.date,
        timestamp: selectedMessage.timestamp,
        snippet: selectedMessage.snippet,
        bodyText: selectedMessageDetail?.bodyText || selectedMessage.snippet || "",
        bodyHtml: selectedMessageDetail?.bodyHtml || "",
        messageIdHeader: selectedMessage.messageIdHeader,
        references: selectedMessage.references,
      },
    ];
  }, [selectedMessage, selectedMessageDetail]);
  const canLoadMessages =
    activeModule === "inbox" ||
    activeModule === "sent" ||
    activeModule === "drafts" ||
    activeModule === "spam" ||
    activeModule === "trash" ||
    activeModule === "archive" ||
    activeModule === "allmail" ||
    activeModule === "starred" ||
    activeModule === "important" ||
    Boolean(activeLabelId);

  const filteredMessages = useMemo(() => {
    if (!searchTerm.trim()) return messages;
    const q = searchTerm.trim().toLowerCase();
    return messages.filter((message) =>
      [message.from, message.to, message.subject, message.snippet, message.accountEmail]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [messages, searchTerm]);

  // One row per message. No conversation grouping of any kind.
  //
  // Every rule that combined messages got this wrong in practice: Gmail's threadId merges unrelated
  // mail that shares a subject and participants, and reference headers merge a sender's separate
  // emails whenever an intervening reply of ours sits in Sent rather than in this mailbox. Both hid
  // messages, which is worse than showing a chain across several rows. A message is a row.
  const conversationRows = filteredMessages;

  /** Rows per mailbox page. PAGE_SIZE is the default; Settings → Layout can override it. */
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/gmail/nav-layout")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        if (Array.isArray(d.hiddenModules)) setHiddenModules(d.hiddenModules);
        if (Array.isArray(d.moduleOrder)) setModuleOrder(d.moduleOrder);
        if (Number.isFinite(Number(d.pageSize)) && Number(d.pageSize) > 0) setPageSize(Number(d.pageSize));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);


  const rowKey = useCallback((message: MessageRow) => `${message.accountEmail}::${message.id}`, []);

  const selectedMessageRows = useMemo(() => {
    if (selectedRows.length > 0) {
      return messages.filter((message) => selectedRows.includes(rowKey(message)));
    }
    if (selectedMessage) {
      return [selectedMessage];
    }
    return [];
  }, [messages, rowKey, selectedRows, selectedMessage]);

  const hasSelectedEmails = selectedRows.length > 0;
  /**
   * Mailboxes where the trash button hard-deletes instead of moving to Trash — matching Gmail,
   * where Spam and Trash both delete outright. Needs the restricted https://mail.google.com/
   * scope (gmail.modify can only trash); accounts connected before that scope was requested
   * get the "reconnect" error from the actions API until they reauthorize.
   */
  const deletesPermanently = activeModule === "trash" || activeModule === "spam";
  /** Any unread in the selection (all-unread or mixed) → offer "Mark As Read".
      Only when every selected email is already read do we offer "Mark As Unread". */
  const selectionHasUnread =
    selectedMessageRows.length > 0 && selectedMessageRows.some((message) => message.unread);
  const showSentToast = useCallback((message: string, undo?: () => void) => {
    setSentToast({ message, undo });
    if (sentToastTimerRef.current) clearTimeout(sentToastTimerRef.current);
    // Undo toasts stay up longer — the whole point is giving a misclick time to be reversed.
    sentToastTimerRef.current = setTimeout(() => {
      setSentToast(null);
      sentToastTimerRef.current = null;
    }, undo ? 6000 : 4500);
  }, []);

  useEffect(() => {
    return () => {
      if (sentToastTimerRef.current) clearTimeout(sentToastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    selectedMessageIdRef.current = selectedMessageId;
  }, [selectedMessageId]);

  const loadProviderAccounts = useCallback(async () => {
    try {
      const response = await fetch("/api/email/accounts");
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setProviderAccounts([]);
        return;
      }
      const rows = Array.isArray(payload?.accounts) ? payload.accounts : [];
      setProviderAccounts(
        rows
          .map((row: any) => ({
            id: typeof row?.id === "string" ? row.id : "",
            accountEmail: typeof row?.accountEmail === "string" ? row.accountEmail.toLowerCase() : "",
            providerLabel: typeof row?.providerLabel === "string" ? row.providerLabel : null,
          }))
          .filter((row: ProviderAccount) => row.id && row.accountEmail)
      );
    } catch {
      setProviderAccounts([]);
    }
  }, []);

  const formatDate = (timestamp: number, rawDate?: string) => {
    if (timestamp > 0) {
      const date = new Date(timestamp);
      const now = new Date();
      const isToday =
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate();
      // Gmail-style: today -> time, this year -> "Mar 4", anything older -> 03/04/2024
      // (the month/day always belong to that message's own year).
      if (isToday) {
        return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
      }
      if (date.getFullYear() === now.getFullYear()) {
        return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      }
      return date.toLocaleDateString(undefined, { year: "numeric", month: "2-digit", day: "2-digit" });
    }
    return rawDate || "";
  };

  const toggleStar = useCallback(async (message: MessageRow) => {
    const next = !message.starred;
    const match = (m: MessageRow) => m.id === message.id && m.accountEmail === message.accountEmail;
    setMessages((prev) => prev.map((m) => (match(m) ? { ...m, starred: next } : m)));
    try {
      await fetch("/api/gmail/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: next ? "star" : "unstar",
          items: [{ accountEmail: message.accountEmail, messageId: message.id }],
        }),
      });
    } catch {
      setMessages((prev) => prev.map((m) => (match(m) ? { ...m, starred: !next } : m)));
    }
  }, []);

  const parseMailboxAddress = (value: string) => {
    const trimmed = (value || "").trim();
    const angleMatch = trimmed.match(/^(.*?)(?:<([^>]+)>)?$/);
    const email = (angleMatch?.[2] || "").trim();
    const label = (angleMatch?.[1] || "").trim().replace(/^"|"$/g, "");
    if (email && label) return { name: label, email };
    if (email) return { name: email, email };
    if (trimmed.includes("@")) return { name: trimmed, email: trimmed };
    return { name: trimmed || "-", email: "" };
  };

  const selectedSenderIdentity = useMemo(() => {
    if (!selectedMessage) return null;
    const fallback = selectedMessage.fromRaw || selectedMessage.replyTo || selectedMessage.from;
    return parseMailboxAddress(selectedMessageDetail?.fromRaw || fallback);
  }, [selectedMessage, selectedMessageDetail?.fromRaw]);

  const selectedBlockedEntry = useMemo(() => {
    const senderEmail = selectedSenderIdentity?.email?.toLowerCase() || "";
    if (!senderEmail) return null;
    return blockedSenders.find((entry) => entry.email.toLowerCase() === senderEmail) || null;
  }, [blockedSenders, selectedSenderIdentity?.email]);

  const formatIdentity = (value: string) => {
    const identity = parseMailboxAddress(value);
    return identity.email ? `${identity.name} <${identity.email}>` : identity.name;
  };

  const formatRelativeAge = (timestamp: number) => {
    if (!timestamp) return "";
    const diffMs = Math.max(0, Date.now() - timestamp);
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 1) return "Less than 1 hour ago";
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  };

  const formatTrackingAge = (value?: string | null) => {
    if (!value) return "never";
    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp)) return "unknown";
    return formatRelativeAge(timestamp);
  };

  const formatDuration = (ms: number) => {
    if (!Number.isFinite(ms) || ms <= 0) return "0s";
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

  const formatDetailedDate = (timestamp: number, rawDate?: string) => {
    const source = timestamp > 0 ? new Date(timestamp) : rawDate ? new Date(rawDate) : null;
    if (!source || Number.isNaN(source.getTime())) return rawDate || "-";
    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thur", "Fri", "Sat"];
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const day = source.getDate();
    const suffix = day % 10 === 1 && day % 100 !== 11 ? "st" : day % 10 === 2 && day % 100 !== 12 ? "nd" : day % 10 === 3 && day % 100 !== 13 ? "rd" : "th";
    const rawHours = source.getHours();
    const hh = String(rawHours % 12 || 12).padStart(2, "0");
    const mm = String(source.getMinutes()).padStart(2, "0");
    const meridiem = rawHours >= 12 ? "PM" : "AM";
    const relative = formatRelativeAge(timestamp || source.getTime());
    return `${weekdays[source.getDay()]}, ${months[source.getMonth()]} ${day}${suffix} ${source.getFullYear()} ${hh}:${mm} ${meridiem}${relative ? ` (${relative})` : ""}`;
  };

  const getInitials = (identityValue: string) => {
    const identity = parseMailboxAddress(identityValue);
    const source = identity.name || identity.email || "?";
    return source
      .replace(/["']/g, "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "?";
  };

  /**
   * Domain of the message being read, so images the sender hosts on its own domain aren't scored as
   * third-party. Without this the client stripped legitimate sender-hosted images and its count
   * disagreed with the server's authoritative scan.
   */
  const readerSenderDomain = useMemo(() => {
    const fromRaw = selectedMessageDetail?.fromRaw || selectedMessage?.fromRaw || selectedMessage?.from || "";
    const email = parseMailboxAddress(fromRaw).email;
    return (email.split("@")[1] || "").trim().toLowerCase();
  }, [selectedMessageDetail, selectedMessage]);

  const isTrackerPixel = (img: HTMLImageElement, srcValue: string) =>
    scoreTrackerImage({
      src: srcValue,
      width: img.getAttribute("width"),
      height: img.getAttribute("height"),
      style: img.getAttribute("style"),
      alt: img.getAttribute("alt"),
      senderDomain: readerSenderDomain,
    }).tracked;

  const detectTrackers = (rawHtml: string): { count: number; vendors: string[] } => {
    if (!rawHtml || typeof window === "undefined") return { count: 0, vendors: [] };
    try {
      const doc = new window.DOMParser().parseFromString(rawHtml, "text/html");
      let count = 0;
      const vendors = new Set<string>();
      const record = (verdict: ReturnType<typeof scoreTrackerImage>) => {
        if (!verdict.tracked) return;
        count += 1;
        if (verdict.vendor) vendors.add(verdict.vendor);
      };
      doc.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
        record(
          scoreTrackerImage({
            src: img.getAttribute("src") || "",
            width: img.getAttribute("width"),
            height: img.getAttribute("height"),
            style: img.getAttribute("style"),
            alt: img.getAttribute("alt"),
          })
        );
      });
      // Also catch CSS background-image pixels (some trackers hide the beacon in a style rule).
      doc.querySelectorAll<HTMLElement>("[style*='url(']").forEach((el) => {
        const match = (el.getAttribute("style") || "").match(/background(?:-image)?\s*:\s*url\((['"]?)([^'")]+)\1\)/i);
        if (match) record(scoreTrackerImage({ src: match[2], style: el.getAttribute("style") }));
      });
      return { count, vendors: [...vendors] };
    } catch {
      return { count: 0, vendors: [] };
    }
  };

  const sanitizeHtml = (rawHtml: string) => {
    if (!rawHtml) return "";
    if (typeof window === "undefined") return rawHtml;
    const parser = new window.DOMParser();
    const parsed = parser.parseFromString(rawHtml, "text/html");
    parsed.querySelectorAll(UNSAFE_EMAIL_TAG_SELECTOR).forEach((node) => node.remove());
    parsed.querySelectorAll<HTMLElement>("*").forEach((node) => {
      Array.from(node.attributes).forEach((attribute) => {
        if (/^on/i.test(attribute.name)) node.removeAttribute(attribute.name);
      });
      // Stripping on* handlers does not cover a javascript: destination: the scheme was never
      // checked, so a link in an email anyone can send ran script here as soon as it was clicked.
      for (const attr of ["href", "xlink:href", "action", "formaction", "src"]) {
        const value = node.getAttribute(attr);
        if (value !== null && !isSafeEmailHref(value)) node.removeAttribute(attr);
      }
      // A background:url() beacons the reader IP and open time on render — the same signal the
      // pixel stripping below exists to withhold, arriving through CSS instead.
      const style = node.getAttribute("style");
      if (style) {
        const safe = stripRemoteUrlsFromStyle(style);
        if (safe) node.setAttribute("style", safe);
        else node.removeAttribute("style");
      }
    });
    const isInternalOpenTrackingPixel = (srcValue: string) => {
      const src = (srcValue || "").trim();
      if (!src) return false;
      if (/\/api\/email\/track\/open\/[^/\s]+(?:\.gif)?(?:\?.*)?$/i.test(src)) return true;
      try {
        const url = new URL(src, window.location.origin);
        const isSameOrigin = url.origin === window.location.origin;
        const isOpenPath = /\/api\/email\/track\/open\/[^/]+(?:\.gif)?$/i.test(url.pathname);
        return isSameOrigin && isOpenPath;
      } catch {
        return false;
      }
    };
    parsed.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
      const src = img.getAttribute("src") || "";
      // Strip our own open-pixel AND third-party tracking pixels so opens aren't leaked back to the sender.
      if (isInternalOpenTrackingPixel(src) || isTrackerPixel(img, src)) {
        img.remove();
        return;
      }
      img.style.maxWidth = "100%";
      img.style.height = "auto";
      img.loading = "lazy";
      img.decoding = "async";
      // Many sender CDNs reject requests carrying a cross-site referrer, which is a common cause of
      // email images silently failing to load. Ask the browser not to send one.
      img.referrerPolicy = "no-referrer";
    });
    parsed.querySelectorAll<HTMLAnchorElement>("a").forEach((link) => {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    });
    return parsed.body.innerHTML;
  };

  const loadGmailConnections = useCallback(async () => {
    setGmailLoading(true);
    try {
      // Both together: these reads are independent, and this pair gates the whole panel opening —
      // waiting for status before even asking for preferences cost a full round trip of blank screen.
      const [response, prefRes] = await Promise.all([
        fetch("/api/gmail/status"),
        fetch("/api/gmail/account-preferences").catch(() => null),
      ]);
      if (!response.ok) {
        setGmailAccounts([]);
        setSelectedAccounts([]);
        setStep("gate");
        return;
      }
      const data = await response.json();
      const accounts = Array.isArray(data?.accounts) ? data.accounts : [];
      const normalized: GmailAccountConnection[] = accounts
        .map((account: any) => ({
          email: typeof account?.email === "string" ? account.email : "",
          connected: !!account?.connected,
          expiresAt: typeof account?.expiresAt === "string" ? account.expiresAt : null,
        }))
        .filter((a: GmailAccountConnection) => a.email.length > 0);

      setGmailAccounts(normalized);
      const connected = normalized.filter((a) => a.connected).map((a) => a.email);

      // Accounts default to enabled; only accounts explicitly disabled in settings are excluded.
      const disabled = new Set<string>();
      let primary = "";
      try {
        if (prefRes?.ok) {
          const prefData = await prefRes.json();
          for (const pref of Array.isArray(prefData?.preferences) ? prefData.preferences : []) {
            const email = typeof pref?.accountEmail === "string" ? pref.accountEmail.toLowerCase() : "";
            if (!email) continue;
            if (pref?.enabled === false) disabled.add(email);
            if (pref?.isPrimary === true) primary = email;
          }
        }
      } catch {
        /* default to all enabled, no primary */
      }
      // The main inbox leads every list of accounts, so the panel opens on it and it reads as the
      // account's own mailbox rather than one of several in arbitrary order.
      if (primary) {
        const byPrimaryFirst = (a: GmailAccountConnection, b: GmailAccountConnection) =>
          Number(b.email.toLowerCase() === primary) - Number(a.email.toLowerCase() === primary);
        setGmailAccounts([...normalized].sort(byPrimaryFirst));
      }
      const enabledConnected = connected
        .filter((email) => !disabled.has(email.toLowerCase()))
        .sort((a, b) => Number(b.toLowerCase() === primary) - Number(a.toLowerCase() === primary));
      const preselected = initialAccountsRef.current.filter((email) => connected.includes(email));

      // The full-page client opens with the chosen accounts (URL param) or all enabled;
      // the "gate" is only shown as a "no accounts connected" state.
      const resolvedAccounts = preselected.length > 0 ? preselected : enabledConnected;
      setSelectedAccounts(resolvedAccounts);
      setStep(connected.length === 0 ? "gate" : "client");
      // Remember this for next visit's optimistic seed (see cachedAccountsRef above).
      writeCachedSelectedAccounts(resolvedAccounts);
    } catch {
      // Transient failure (network blip, etc.) — leave the cached selection alone rather than
      // wiping it, so the next visit still gets the fast path instead of being punished for this.
      setGmailAccounts([]);
      setSelectedAccounts([]);
      setStep("gate");
    } finally {
      setGmailLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGmailConnections();
  }, [loadGmailConnections]);

  useEffect(() => {
    loadProviderAccounts();
  }, [loadProviderAccounts]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeModule, selectedAccountsKey]);

  const loadMailboxCounts = useCallback(async () => {
    if (step !== "client" || selectedAccounts.length === 0) {
      setMailboxCounts(EMPTY_COUNTS);
      return;
    }
    setCountsLoading(true);
    try {
      const query = new URLSearchParams({ accounts: selectedAccounts.join(",") });
      const response = await fetch(`/api/gmail/counts?${query.toString()}`, { cache: "no-store" });
      if (response.status === 304) {
        return;
      }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to load mailbox counts.");
      }
      const counts = payload?.counts || {};
      const next = {
        inbox: Number(counts.inbox || 0),
        sent: Number(counts.sent || 0),
        drafts: Number(counts.drafts || 0),
        archive: Number(counts.archive || 0),
        spam: Number(counts.spam || 0),
        trash: Number(counts.trash || 0),
        // Was missing, so mailboxCounts.starred stayed undefined and the badge never rendered
        // even though the API returns it.
        starred: Number(counts.starred || 0),
      };
      setMailboxCounts(next);
      // Sidebar badges render from this. They used to be counted off the first page of each
      // mailbox, which silently capped every badge at PAGE_SIZE — an inbox with 80 unread read
      // as 50. These are Gmail's own totals, so they're both correct and cheap. Local mark
      // read/unread still adjusts the number optimistically between refreshes.
      setModuleUnreadBadges(next);
    } catch {
      setMailboxCounts(EMPTY_COUNTS);
    } finally {
      setCountsLoading(false);
    }
  }, [selectedAccounts, step]);

  useEffect(() => {
    loadMailboxCounts();
  }, [loadMailboxCounts]);

  const compose = useComposeWindow({
    selectedMessage,
    selectedMessageId,
    threadMessages,
    selectedMessageDetail,
    selectedAccounts,
    connectedAccounts,
    providerAccounts,
    activeModule,
    loadMessagesRef,
    loadMailboxCounts,
    invalidateMessagesCache,
    showSentToast,
    setDetailError,
    setSelectedMessageDetail,
  });

  const contacts = useContactsPanel({
    step,
    activeModule,
    selectedAccounts,
  });

  /**
   * Unstar every selected message. The Starred view is a label view, so removing the star is the
   * meaningful bulk action there (Move To / Archive are hidden for it). Rows are dropped from the
   * list optimistically since they no longer belong in this view, then counts are refreshed.
   */
  const unstarSelected = useCallback(async () => {
    const selected = conversationRows.filter((message) => selectedRows.includes(rowKey(message)));
    if (selected.length === 0) return;
    const items = selected.map((message) => ({ accountEmail: message.accountEmail, messageId: message.id }));
    const affected = new Set(items.map((i) => `${i.accountEmail}::${i.messageId}`));
    setActionLoading(true);
    try {
      const response = await fetch("/api/gmail/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unstar", items }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message || "Could not unstar the selected messages.");
      }
      setMessages((prev) => prev.filter((m) => !affected.has(`${m.accountEmail}::${m.id}`)));
      setSelectedRows([]);
      invalidateMessagesCache();
      // Not awaited: the rows are already gone from the view, so holding the button disabled until
      // the badge numbers come back only makes the action feel slower than it was.
      void loadMailboxCounts();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not unstar the selected messages.");
    } finally {
      setActionLoading(false);
    }
  }, [conversationRows, selectedRows, rowKey, invalidateMessagesCache, loadMailboxCounts]);

  const loadMessages = useCallback(async () => {
    const requestId = ++loadMessagesRequestRef.current;
    if (step !== "client" || !canLoadMessages || selectedAccounts.length === 0) {
      if (requestId !== loadMessagesRequestRef.current) return;
      setMessages([]);
      setHasNextPage(false);
      return;
    }

    const mailbox = activeModule as "inbox" | "sent" | "drafts" | "spam" | "trash" | "archive" | "allmail" | "starred" | "important" | "scheduled";
    const query = new URLSearchParams({
      mailbox,
      accounts: activeLabelId ? selectedAccounts[0] || "" : selectedAccounts.join(","),
      limit: String(pageSize),
      page: String(currentPage),
    });
    if (activeLabelId) query.set("labelId", activeLabelId);
    if (debouncedSearch) query.set("q", debouncedSearch);
    const cacheKey = query.toString();

    // Stale-while-revalidate: paint the last-known rows for this exact view instantly, then
    // refresh in the background. Switching mailboxes / paging back used to blank the list and
    // show a spinner on every visit even though the data was already known.
    const cached = messagesCacheRef.current.get(cacheKey);
    if (cached) {
      setMessages(cached.messages);
      setAccountErrors(cached.accountErrors);
      setHasNextPage(cached.hasNextPage);
      setMessagesLoading(false);
    } else {
      setMessagesLoading(true);
    }
    setMessagesError("");
    try {
      const response = await fetch(`/api/gmail/messages?${cacheKey}`);
      const payload = await response.json().catch(() => ({}));
      if (requestId !== loadMessagesRequestRef.current) return;
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to load Gmail messages.");
      }
      const nextMessages = Array.isArray(payload?.messages) ? payload.messages : [];
      const nextAccountErrors = Array.isArray(payload?.accountErrors) ? payload.accountErrors : [];
      const nextHasNextPage = Boolean(payload?.hasNextPage);
      storeMessagesCache(cacheKey, nextMessages, nextAccountErrors, nextHasNextPage);
      // Self-heal the mark-read latch: anything Gmail still reports as unread must be markable
      // again, including messages marked unread from another client since this page loaded.
      for (const message of nextMessages as MessageRow[]) {
        if (message.unread) markedReadRef.current.delete(`${message.accountEmail}::${message.id}`);
      }
      setMessages(nextMessages);
      setAccountErrors(nextAccountErrors);
      setHasNextPage(nextHasNextPage);
      setSelectedRows([]);
      const activeSelectedMessageId = selectedMessageIdRef.current;
      if (activeSelectedMessageId && !nextMessages.some((message: MessageRow) => message.id === activeSelectedMessageId)) {
        setSelectedMessageId("");
        setSelectedMessageDetail(null);
        setViewMode("list");
      }
      // Quietly warm the next page in the background so paging forward feels instant — by the
      // time the user clicks "next" the data is usually already sitting in the cache.
      if (nextHasNextPage) {
        const nextPageQuery = new URLSearchParams(query);
        nextPageQuery.set("page", String(currentPage + 1));
        const nextPageCacheKey = nextPageQuery.toString();
        if (!messagesCacheRef.current.has(nextPageCacheKey) && !prefetchInFlightRef.current.has(nextPageCacheKey)) {
          prefetchInFlightRef.current.add(nextPageCacheKey);
          fetch(`/api/gmail/messages?${nextPageCacheKey}`)
            .then((prefetchResponse) => prefetchResponse.json().catch(() => ({})))
            .then((prefetchPayload) => {
              // Don't let a slow prefetch resurrect stale data after the view moved on (mailbox
              // switch, new search, or a mutating action that invalidated the cache).
              if (requestId !== loadMessagesRequestRef.current) return;
              const prefetchMessages = Array.isArray(prefetchPayload?.messages) ? prefetchPayload.messages : [];
              const prefetchAccountErrors = Array.isArray(prefetchPayload?.accountErrors) ? prefetchPayload.accountErrors : [];
              const prefetchHasNextPage = Boolean(prefetchPayload?.hasNextPage);
              storeMessagesCache(nextPageCacheKey, prefetchMessages, prefetchAccountErrors, prefetchHasNextPage);
            })
            .catch(() => {
              /* best-effort: a failed prefetch just means the next click loads normally */
            })
            .finally(() => {
              prefetchInFlightRef.current.delete(nextPageCacheKey);
            });
        }
      }
    } catch (error) {
      if (requestId !== loadMessagesRequestRef.current) return;
      setMessages([]);
      setHasNextPage(false);
      setAccountErrors([]);
      setMessagesError(error instanceof Error ? error.message : "Failed to load Gmail messages.");
    } finally {
      if (requestId !== loadMessagesRequestRef.current) return;
      setMessagesLoading(false);
    }
  }, [activeModule, activeLabelId, canLoadMessages, currentPage, debouncedSearch, pageSize, selectedAccounts, step, storeMessagesCache]);

  useEffect(() => {
    loadMessagesRef.current = () => void loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Scheduled-send queue: our own PENDING/SENDING/FAILED rows (compose "Schedule send").
  const loadScheduled = useCallback(async () => {
    if (step !== "client") return;
    setScheduledLoading(true);
    setScheduledError("");
    try {
      const response = await fetch("/api/gmail/scheduled", { headers: { "Cache-Control": "no-cache" } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || "Failed to load scheduled sends.");
      setScheduledItems(Array.isArray(payload?.items) ? payload.items : []);
    } catch (error) {
      setScheduledError(error instanceof Error ? error.message : "Failed to load scheduled sends.");
      setScheduledItems([]);
    } finally {
      setScheduledLoading(false);
    }
  }, [step]);

  useEffect(() => {
    if (step === "client" && activeModule === "scheduled") {
      loadScheduled();
    }
  }, [activeModule, loadScheduled, step]);

  const cancelScheduled = async (id: string) => {
    setCancelingScheduledId(id);
    try {
      const response = await fetch(`/api/gmail/scheduled?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || "Could not cancel this scheduled send.");
      setScheduledItems((prev) => prev.filter((item) => item.id !== id));
      showSentToast("Scheduled send canceled");
    } catch (error) {
      setScheduledError(error instanceof Error ? error.message : "Could not cancel this scheduled send.");
    } finally {
      setCancelingScheduledId("");
    }
  };

  // Debounce the search box, then let loadMessages re-query the server (Gmail `q`).
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    if (!moveMenuOpen) return;
    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      const targetNode = event.target as Node | null;
      if (!targetNode) return;
      const activeRef = moveMenuOpen === "list" ? moveListMenuRef.current : moveMessageMenuRef.current;
      if (!activeRef) return;
      if (activeRef.contains(targetNode)) return;
      setMoveMenuOpen(null);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [moveMenuOpen]);

  // Snooze behaves like Move To: clicking anywhere outside dismisses it.
  useEffect(() => {
    if (!snoozeMenuOpen) return;
    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      const targetNode = event.target as Node | null;
      if (!targetNode) return;
      if (snoozeMenuRef.current?.contains(targetNode)) return;
      setSnoozeMenuOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [snoozeMenuOpen]);

  // Label menu dismisses on an outside click, exactly as Move To and Snooze do. It had no ref at
  // all, so it stayed open until its own button was clicked again.
  useEffect(() => {
    if (!labelMenuOpen) return;
    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      const targetNode = event.target as Node | null;
      if (!targetNode) return;
      if (labelMenuRef.current?.contains(targetNode)) return;
      setLabelMenuOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [labelMenuOpen]);

  // Any change of context (mailbox, label, opening a message, paging) closes open menus —
  // they used to survive navigation and hang over the new view.
  useEffect(() => {
    setMoveMenuOpen(null);
    setSnoozeMenuOpen(false);
    setLabelMenuOpen(false);
  }, [activeModule, activeLabelId, viewMode, selectedMessageId, currentPage]);

  // Deep link (e.g. from a Discord reply alert): once the inbox has loaded, auto-open the
  // linked conversation and switch to the reader. Matches by threadId and opens whichever
  // message in that thread is loaded — the reader then renders the full chain (threadMessages
  // from message-detail). Runs once when a row from the target thread appears.
  // Clear the avatar-failure flag whenever a different message is opened, so one sender's dead
  // photo URL doesn't suppress every later sender's picture. Keyed on the id so it covers every
  // path that opens a message (list click, deep link, thread navigation).
  useEffect(() => {
    setSenderAvatarIndex(0);
  }, [selectedMessageId]);

  /**
   * Current avatar URL for the open message's sender: the Google Contacts photo when one exists,
   * then Gravatar, then the company favicon. Empty once every candidate has errored, which is the
   * signal to render the initials avatar. Contacts-only lookup meant most senders had no photo at
   * all, which is why pictures appeared not to load.
   */
  const senderAvatar = useMemo(() => {
    const sources = selectedMessageDetail?.senderAvatarSources ?? [];
    if (sources.length === 0) {
      // Older payloads carry only the single contact photo.
      const legacy = selectedMessageDetail?.senderPhotoUrl || "";
      return senderAvatarIndex === 0 && legacy ? { url: legacy, kind: "photo" as const } : null;
    }
    return sources[senderAvatarIndex] ?? null;
  }, [selectedMessageDetail, senderAvatarIndex]);

  useEffect(() => {
    if (deepLinkAppliedRef.current || !initialOpenThreadId) return;
    const row = messages.find((m) => m.threadId === initialOpenThreadId);
    if (row) {
      deepLinkAppliedRef.current = true;
      setSelectedMessageId(row.id);
      setViewMode("message");
      setDetailError("");
    }
  }, [messages, initialOpenThreadId]);

  // Browser back/forward: once the router has resolved the current URL, adopt whatever
  // module/label it names as the starting state (covers a hard refresh or a shared link that
  // isn't just the bare initial-thread deep link above), then let every later module/label/message
  // change push a fresh history entry. Runs once — after the first sync, module/label are driven
  // entirely by state, and this effect exists only to prime that state from the URL on load.
  useEffect(() => {
    if (!router.isReady || navReadyRef.current) return;
    navReadyRef.current = true;
    const query = router.query;
    const moduleParam = Array.isArray(query.module) ? query.module[0] : query.module;
    const labelParam = (Array.isArray(query.label) ? query.label[0] : query.label) || "";
    const threadParam = (Array.isArray(query.thread) ? query.thread[0] : query.thread) || "";
    const moduleValid = moduleParam && MODULES.some((item) => item.key === moduleParam);
    if ((moduleValid && moduleParam !== activeModule) || (labelParam && labelParam !== activeLabelId)) {
      isApplyingNavRef.current = true;
      if (moduleValid) setActiveModule(moduleParam as ModuleKey);
      setActiveLabelId(labelParam);
    }
    // The bare `?thread=` deep link (Discord alert, etc.) is already handled above via
    // initialOpenThreadId; only pick this up when it names a *different* thread than that one.
    if (threadParam && threadParam !== initialOpenThreadId) {
      pendingNavThreadRef.current = threadParam;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  // Resolves a thread id captured from the URL (initial load or a back/forward pop) into the
  // actual message row once that mailbox's messages have loaded — mirrors the initialOpenThreadId
  // deep-link effect above, but re-runs for every later pop instead of firing only once.
  useEffect(() => {
    if (!pendingNavThreadRef.current) return;
    const row = messages.find((m) => m.threadId === pendingNavThreadRef.current);
    if (row) {
      pendingNavThreadRef.current = "";
      isApplyingNavRef.current = true;
      setSelectedMessageId(row.id);
      setViewMode("message");
      setDetailError("");
    }
  }, [messages]);

  // A popped label id arrives with no name attached (the URL only carries the id) — recover it
  // from the loaded labels list, same as clicking the label in the sidebar would set it.
  useEffect(() => {
    if (!activeLabelId || activeLabelName) return;
    const found = labels.find((l) => l.id === activeLabelId);
    if (found) setActiveLabelName(found.name);
  }, [labels, activeLabelId, activeLabelName]);

  // Browser back/forward button handling: Next's router only fires beforePopState for
  // client-side-navigable pops, which is exactly what our own history.pushState entries below are.
  // Apply the popped module/label/thread to state (guarded so the push-effect doesn't re-push it)
  // and let Next update its own query bookkeeping to match (`return true`).
  useEffect(() => {
    router.beforePopState(({ as }) => {
      try {
        const url = new URL(as, window.location.origin);
        const moduleParam = url.searchParams.get("module");
        const labelParam = url.searchParams.get("label") || "";
        const threadParam = url.searchParams.get("thread") || "";
        const moduleValid = moduleParam && MODULES.some((item) => item.key === moduleParam);
        isApplyingNavRef.current = true;
        if (moduleValid) setActiveModule(moduleParam as ModuleKey);
        setActiveLabelId(labelParam);
        if (threadParam) {
          pendingNavThreadRef.current = threadParam;
        } else {
          pendingNavThreadRef.current = "";
          setSelectedMessageId("");
          setViewMode("list");
          setDetailError("");
        }
      } catch {
        /* malformed pop target — ignore, current state stands */
      }
      return true;
    });
    return () => {
      router.beforePopState(() => true);
    };
  }, [router]);

  // Pushes a history entry for every module switch, label switch, and message open/close so the
  // browser's back/forward buttons can step through the email panel the same way they do a
  // multi-page site. Skipped while navReadyRef hasn't primed from the URL yet, and skipped for any
  // change that already came FROM the URL (isApplyingNavRef) — otherwise a back/forward pop would
  // immediately push a duplicate (or, worse, an out-of-order) entry right back onto the stack.
  useEffect(() => {
    if (!navReadyRef.current) return;
    if (isApplyingNavRef.current) {
      isApplyingNavRef.current = false;
      return;
    }
    // Start from whatever's already in the address bar (e.g. `?accounts=` from a deep link) and
    // only touch the three nav keys, so unrelated params survive every module/label/message push.
    const params = new URLSearchParams(window.location.search);
    params.set("module", activeModule);
    if (activeLabelId) params.set("label", activeLabelId);
    else params.delete("label");
    if (viewMode === "message" && selectedMessage?.threadId) params.set("thread", selectedMessage.threadId);
    else params.delete("thread");
    const nextSearch = params.toString();
    const currentSearch = window.location.search.replace(/^\?/, "");
    if (nextSearch === currentSearch) {
      hasWrittenNavUrlRef.current = true;
      return;
    }
    const writeMethod = hasWrittenNavUrlRef.current ? "push" : "replace";
    hasWrittenNavUrlRef.current = true;
    router[writeMethod](
      { pathname: router.pathname, query: Object.fromEntries(params) },
      undefined,
      { shallow: true }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeModule, activeLabelId, viewMode, selectedMessage?.threadId]);

  // Opening an unread email marks it read the moment it opens: locally first (so going back
  // shows it read immediately) and on Gmail in the background. Keyed by id so it fires once.
  /**
   * Messages already marked read this session, so opening one does not POST twice while the
   * optimistic update propagates. Entries must be cleared whenever a message becomes unread again —
   * marking one unread and reopening it used to hit this latch and silently never mark it read.
   */
  const markedReadRef = useRef<Set<string>>(new Set());
  /** accountEmail::id -> detail payload, so reopening a message is instant. */
  const detailCacheRef = useRef<Map<string, MessageDetail>>(new Map());
  const detailInFlightRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!selectedMessage || viewMode !== "message") return;
    if (!selectedMessage.unread || selectedMessage.isComposeDraft) return;
    const key = `${selectedMessage.accountEmail}::${selectedMessage.id}`;
    if (markedReadRef.current.has(key)) return;
    markedReadRef.current.add(key);
    setMessages((prev) =>
      prev.map((m) =>
        m.id === selectedMessage.id && m.accountEmail === selectedMessage.accountEmail
          ? { ...m, unread: false }
          : m
      )
    );
    void fetch("/api/gmail/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "markRead",
        items: [{ accountEmail: selectedMessage.accountEmail, messageId: selectedMessage.id }],
      }),
    })
      .then(() => loadMailboxCounts())
      .catch(() => null);
  }, [selectedMessage, viewMode, loadMailboxCounts]);

  /**
   * Build a MessageDetail from an API payload.
   *
   * Shared by the reader and the hover prefetch, which each had their own copy of this and had
   * already drifted — the prefetch kept no fallbacks, so a payload missing a field cached a blank
   * where the reader would have shown the row's own value.
   */
  const toMessageDetail = useCallback((payload: any, fallback?: MessageRow): MessageDetail => {
    const str = (value: unknown, alternative?: string) =>
      typeof value === "string" ? value : alternative;
    return {
      bodyHtml: str(payload?.bodyHtml, "") as string,
      bodyText: str(payload?.bodyText, "") as string,
      fromRaw: str(payload?.fromRaw, fallback?.fromRaw),
      toRaw: str(payload?.toRaw, fallback?.toRaw),
      subject: str(payload?.subject, fallback?.subject),
      replyTo: str(payload?.replyTo, fallback?.replyTo),
      date: str(payload?.date, fallback?.date),
      timestamp: typeof payload?.timestamp === "number" ? payload.timestamp : fallback?.timestamp,
      messageIdHeader: str(payload?.messageIdHeader, fallback?.messageIdHeader),
      references: str(payload?.references, fallback?.references),
      senderPhotoUrl: str(payload?.senderPhotoUrl, "") as string,
      senderAvatarSources: Array.isArray(payload?.senderAvatarSources) ? payload.senderAvatarSources : [],
      threadMessages: Array.isArray(payload?.threadMessages) ? payload.threadMessages : undefined,
      trackers:
        payload?.trackers && typeof payload.trackers.count === "number"
          ? {
              count: payload.trackers.count,
              vendors: Array.isArray(payload.trackers.vendors) ? payload.trackers.vendors : [],
            }
          : undefined,
      meetingInvite: payload?.meetingInvite ?? null,
    } as MessageDetail;
  }, []);

  /** Fetch a message's detail into the cache. Shared by the reader and hover prefetch. */
  const fetchDetailInto = useCallback(async (accountEmail: string, messageId: string) => {
    const key = `${accountEmail}::${messageId}`;
    if (detailCacheRef.current.has(key) || detailInFlightRef.current.has(key)) return;
    detailInFlightRef.current.add(key);
    try {
      const query = new URLSearchParams({ accountEmail, messageId });
      const response = await fetch(`/api/gmail/message-detail?${query.toString()}`);
      if (!response.ok) return;
      const payload = await response.json().catch(() => null);
      if (!payload) return;
      detailCacheRef.current.set(key, toMessageDetail(payload));
    } catch {
      /* prefetch is best-effort */
    } finally {
      detailInFlightRef.current.delete(key);
    }
  }, [toMessageDetail]);

  useEffect(() => {
    if (!selectedMessage || viewMode !== "message") return;
    // Cached from a previous open or a hover prefetch — render immediately, no spinner.
    const cacheKey = `${selectedMessage.accountEmail}::${selectedMessage.id}`;
    const cached = detailCacheRef.current.get(cacheKey);
    if (cached) {
      setSelectedMessageDetail(cached);
      setDetailLoading(false);
      setDetailError("");
      return;
    }
    // Guards against a slow open losing a race with a newer one: open a heavy message, click a
    // light one before it lands, and the first response used to overwrite the second, leaving the
    // new message's header above the old message's body. The cache write is still allowed — it is
    // keyed by message, so it is correct regardless of which message is on screen now.
    let cancelled = false;
    const loadDetail = async () => {
      setDetailLoading(true);
      setDetailError("");
      try {
        const query = new URLSearchParams({
          accountEmail: selectedMessage.accountEmail,
          messageId: selectedMessage.id,
        });
        const response = await fetch(`/api/gmail/message-detail?${query.toString()}`);
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.message || "Failed to load message detail.");
        }
        const detail = toMessageDetail(payload, selectedMessage);
        detailCacheRef.current.set(`${selectedMessage.accountEmail}::${selectedMessage.id}`, detail as MessageDetail);
        if (cancelled) return;
        setSelectedMessageDetail(detail);
      } catch (error) {
        if (cancelled) return;
        setDetailError(error instanceof Error ? error.message : "Failed to load message detail.");
        setSelectedMessageDetail(null);
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    };
    loadDetail();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMessage?.id, selectedMessage?.accountEmail, viewMode]);

  const loadBlockedSenders = useCallback(async () => {
    try {
      const response = await fetch("/api/gmail/blocked-senders");
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setBlockedSenders([]);
        return;
      }
      setBlockedSenders(Array.isArray(payload?.blocked) ? payload.blocked : []);
    } catch {
      setBlockedSenders([]);
    }
  }, []);

  useEffect(() => {
    loadBlockedSenders();
  }, [loadBlockedSenders, selectedMessage?.accountEmail]);

  usePageLeaveGuard();
  useDraftGuard(compose.hasUnsavedChanges, "Email draft", "email", compose.isSending);

  const toggleRowSelection = (message: MessageRow) => {
    const key = rowKey(message);
    setSelectedRows((prev) => (prev.includes(key) ? prev.filter((entry) => entry !== key) : [...prev, key]));
  };

  const toggleSelectAll = () => {
    const visibleRowKeys = conversationRows.map((message) => rowKey(message));
    if (visibleRowKeys.length === 0) return;
    const allSelected = visibleRowKeys.every((key) => selectedRows.includes(key));
    if (allSelected) {
      setSelectedRows((prev) => prev.filter((key) => !visibleRowKeys.includes(key)));
      return;
    }
    setSelectedRows((prev) => Array.from(new Set([...prev, ...visibleRowKeys])));
  };

  /**
   * Reverses an archive or trash action from the undo toast. Mirrors applyAction's optimistic
   * pattern but works off the exact rows the original action touched (captured before they were
   * removed from the list) instead of the current selection, which is empty by the time the
   * toast's Undo button is clicked.
   */
  const undoMailboxAction = useCallback(
    async (action: "moveToInbox" | "untrash", rows: MessageRow[]) => {
      if (rows.length === 0) return;
      const keys = rows.map((message) => rowKey(message));
      for (const key of keys) actionInFlightRef.current.add(key);
      // Both reverse actions land back in the Inbox — matches the reconcile logic below, which
      // treats "untrash" and "moveToInbox" identically for exactly this reason.
      if (activeModule === "inbox") {
        setMessages((prev) => {
          const existing = new Set(prev.map((message) => rowKey(message)));
          const restored = rows.filter((message) => !existing.has(rowKey(message)));
          return [...restored, ...prev];
        });
      }
      invalidateMessagesCache();
      try {
        const items = rows.map((message) => ({ accountEmail: message.accountEmail, messageId: message.id }));
        const response = await fetch("/api/gmail/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, items }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok && response.status !== 207) {
          throw new Error(payload?.message || "Undo failed.");
        }
        const results = Array.isArray(payload?.results) ? payload.results : [];
        const failures = results.filter((result: any) => result && result.ok === false);
        if (failures.length > 0) {
          throw new Error(String(failures[0]?.error || "Gmail refused the undo."));
        }
        void loadMailboxCounts();
      } catch (error) {
        // The optimistic restore didn't actually happen — pull the rows back out rather than
        // leave the list showing messages Gmail never moved.
        const keySet = new Set(keys);
        setMessages((prev) => prev.filter((message) => !keySet.has(rowKey(message))));
        invalidateMessagesCache();
        setActionError(error instanceof Error ? error.message : "Undo failed.");
      } finally {
        for (const key of keys) actionInFlightRef.current.delete(key);
      }
    },
    [activeModule, invalidateMessagesCache, loadMailboxCounts, rowKey]
  );

  const applyAction = useCallback(
    async (
      action:
        | "trash"
        | "deletePermanently"
        | "untrash"
        | "markRead"
        | "markUnread"
        | "archive"
        | "moveToInbox"
        | "moveToSpam"
        | "moveToTrash"
        | "unspam"
    ) => {
      const composeDraftRows = selectedMessageRows.filter((message) => Boolean(message.isComposeDraft && message.draftKey));
      const selectedComposeDraftKeys = new Set(composeDraftRows.map((message) => rowKey(message)));
      const gmailRows = selectedMessageRows.filter((message) => !message.isComposeDraft);
      const items = gmailRows.map((message) => ({
        accountEmail: message.accountEmail,
        messageId: message.id,
      }));
      if (items.length === 0 && composeDraftRows.length === 0) return;
      const isReadToggle = action === "markRead" || action === "markUnread";
      const inFlightKeys = selectedMessageRows.map((message) => rowKey(message));
      if (!isReadToggle && inFlightKeys.some((key) => actionInFlightRef.current.has(key))) {
        // Only refuse a repeat action on a message already mid-flight; a different message goes
        // through immediately.
        setActionError("Still finishing the last action on that message — one moment.");
        return;
      }
      if (!isReadToggle) {
        for (const key of inFlightKeys) actionInFlightRef.current.add(key);
      }

      setActionError("");
      // Marking unread clears the "already marked read" latch, or reopening the message would hit it
      // and skip the mark-read entirely — the message would stay unread no matter how often it was
      // opened. Cleared before the optimistic pass so it holds even if the Gmail call then fails.
      if (action === "markUnread") {
        for (const message of selectedMessageRows) {
          markedReadRef.current.delete(`${message.accountEmail}::${message.id}`);
        }
      }
      // Optimistic pass: mutate the list immediately so the click lands instantly. The
      // authoritative pass below reconciles once Gmail answers. (Previously every action
      // awaited the round trip AND greyed the toolbar out for its duration.)
      const optimisticKeys = new Set(selectedMessageRows.map((message) => rowKey(message)));
      setMessages((prev) =>
        prev
          .map((message) => {
            const key = rowKey(message);
            if (!optimisticKeys.has(key)) return message;
            if (action === "markRead") return { ...message, unread: false };
            if (action === "markUnread") return { ...message, unread: true };
            if (action === "archive") return activeModule === "archive" ? message : null;
            if (action === "trash" || action === "moveToTrash") return activeModule === "trash" ? message : null;
            if (action === "deletePermanently") return null;
            if (action === "untrash" || action === "moveToInbox") return activeModule === "inbox" ? message : null;
            if (action === "moveToSpam") return activeModule === "spam" ? message : null;
            if (action === "unspam") return activeModule === "spam" ? null : message;
            return message;
          })
          .filter(Boolean) as MessageRow[]
      );
      // Invalidate the per-view message cache for EVERY action, not just ones taken from the
      // reader. Deleting straight from the list left the cached page intact, so the next
      // revalidate repainted the row that had just been removed — the "delete didn't work the
      // first time, worked on the second" symptom. Clearing it up front means no later paint can
      // resurrect a message this action already removed.
      invalidateMessagesCache();
      if (action !== "markRead" && action !== "markUnread") {
        setSelectedRows([]);
        // Leave the reader now, not after Gmail answers. Acting on an open message used to
        // hold the reader open for the whole round trip, so deleting felt like it hung before
        // dropping back to the list — even though the row had already gone from the list
        // underneath. The message is gone either way; the reconcile below only corrects rows.
        setViewMode("list");
        setSelectedMessageId("");
        setSelectedMessageDetail(null);
      } else if (action === "markUnread") {
        // Marking unread from the reader means "I'm not done with this" — staying on the open
        // message contradicts that, and the reader would immediately re-mark it read. Drop back
        // to the list so the row is visibly unread again. markRead stays put: you're reading it.
        setSelectedRows([]);
        setViewMode("list");
        setSelectedMessageId("");
        setSelectedMessageDetail(null);
      }
      try {
        if (
          composeDraftRows.length > 0 &&
          (action === "trash" || action === "moveToTrash" || action === "deletePermanently")
        ) {
          await Promise.all(
            composeDraftRows.map(async (message) => {
              const response = await fetch("/api/gmail/drafts", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ draftKey: message.draftKey }),
              });
              if (!response.ok) {
                const payload = await response.json().catch(() => ({}));
                throw new Error(payload?.message || "Failed to update draft action.");
              }
            })
          );
        }

        let results: any[] = [];
        if (items.length > 0) {
          // Bounded: an unbounded fetch can hang for minutes, and while it hangs the in-flight
          // guard below silently swallows every further click. Failing fast frees the guard and
          // surfaces a real message instead.
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), ACTION_TIMEOUT_MS);
          let response: Response;
          try {
            response = await fetch("/api/gmail/actions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action, items }),
              signal: controller.signal,
            });
          } catch (error) {
            if ((error as Error)?.name === "AbortError") {
              // The optimistic removal is now unverified, so resync rather than leave the list lying.
              invalidateMessagesCache();
              loadMessagesRef.current();
              throw new Error("Gmail is taking too long to respond. Nothing was lost — try again.");
            }
            throw error;
          } finally {
            clearTimeout(timeout);
          }
          const payload = await response.json().catch(() => ({}));
          if (!response.ok && response.status !== 207) {
            throw new Error(payload?.message || "Action failed.");
          }
          results = Array.isArray(payload?.results) ? payload.results : [];
          // Surface per-message refusals. Previously a 207 passed silently while the rows had
          // already been removed optimistically, so a failed action looked like it worked.
          const failures = results.filter((result: any) => result && result.ok === false);
          if (failures.length > 0) {
            const reason = String(failures[0]?.error || "Gmail refused the action.");
            setActionError(
              failures.length === items.length
                ? reason
                : `${failures.length} of ${items.length} messages failed: ${reason}`
            );
            invalidateMessagesCache();
            loadMessagesRef.current();
          }
        }
        const successfulKeys = new Set(
          results
            .filter((result: any) => result?.ok)
            .map((result: any) => `${String(result.accountEmail || "").toLowerCase()}::${String(result.messageId || "")}`)
        );
        const hasResults = successfulKeys.size > 0;

        setMessages((prev) => {
          const next = prev
            .map((message) => {
              const key = `${message.accountEmail.toLowerCase()}::${message.id}`;
              if (message.isComposeDraft) {
                const selectedDraft = selectedComposeDraftKeys.has(key);
                if (!selectedDraft) return message;
                if (action === "markRead") {
                  return { ...message, unread: false };
                }
                if (action === "markUnread") {
                  return { ...message, unread: true };
                }
                if (action === "trash" || action === "moveToTrash" || action === "deletePermanently") {
                  return null;
                }
                return message;
              }
              if (!(hasResults ? successfulKeys.has(key) : selectedRows.includes(key))) {
                return message;
              }

              if (action === "markRead") {
                return { ...message, unread: false };
              }
              if (action === "markUnread") {
                return { ...message, unread: true };
              }
              if (action === "archive") {
                return activeModule === "archive" ? message : null;
              }
              if (action === "trash" || action === "moveToTrash") {
                return activeModule === "trash" ? message : null;
              }
              if (action === "deletePermanently") {
                return null;
              }
              if (action === "untrash" || action === "moveToInbox") {
                return activeModule === "inbox" ? message : null;
              }
              if (action === "moveToSpam") {
                return activeModule === "spam" ? message : null;
              }
              return message;
            })
            .filter(Boolean) as MessageRow[];

          return next;
        });

        setSelectedRows([]);
        // Not awaited: the list is already correct optimistically, so blocking the action's
        // completion on a counts round trip only kept the toolbar spinner up. Badges are
        // Gmail's own totals now, so deriving them from the visible page here would also have
        // re-capped them at one page's worth.
        void loadMailboxCounts();

        // Archive and trash are the two destructive-but-reversible actions (permanent delete
        // already gets its own confirm dialog, so it doesn't need an undo). Only offer it once
        // Gmail has actually confirmed success — undoing an action that never happened would
        // just misfire a no-op moveToInbox/untrash against messages that were never moved.
        if ((action === "archive" || action === "trash" || action === "moveToTrash") && hasResults) {
          const undoneRows = gmailRows.filter((message) =>
            successfulKeys.has(`${message.accountEmail.toLowerCase()}::${message.id}`)
          );
          if (undoneRows.length > 0) {
            const reverseAction = action === "archive" ? "moveToInbox" : "untrash";
            const label =
              action === "archive"
                ? undoneRows.length === 1
                  ? "Archived"
                  : `Archived ${undoneRows.length} messages`
                : undoneRows.length === 1
                  ? "Moved to Trash"
                  : `Moved ${undoneRows.length} messages to Trash`;
            showSentToast(label, () => undoMailboxAction(reverseAction, undoneRows));
          }
        }
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "Action failed.");
      } finally {
        if (!isReadToggle) {
          for (const key of inFlightKeys) actionInFlightRef.current.delete(key);
        }
        setActionLoading(false);
      }
    },
    [activeModule, invalidateMessagesCache, loadMailboxCounts, rowKey, selectedMessageRows, selectedRows, showSentToast, undoMailboxAction]
  );

  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const hasOpenMessage = viewMode === "message" && Boolean(selectedMessage);
  useKeyboardShortcuts(
    {
      hasOpenMessage,
      canActOnSelection: hasOpenMessage || hasSelectedEmails,
      onArchive: () => void applyAction("archive"),
      onTrash: () => void applyAction(deletesPermanently ? "deletePermanently" : "trash"),
      onMarkRead: () => void applyAction("markRead"),
      onMarkUnread: () => void applyAction("markUnread"),
      onToggleStar: () => {
        if (selectedMessage) void toggleStar(selectedMessage);
      },
      onCompose: () => void compose.openNewCompose(),
      onReply: () => void compose.openReplyCompose(),
      onReplyAll: () => void compose.openReplyAllCompose(),
      onForward: () => void compose.openForwardCompose(),
      onClose: () => {
        if (viewMode === "message") {
          setViewMode("list");
          setSelectedMessageId("");
        }
      },
      onShowHelp: () => setShowShortcutsHelp((prev) => !prev),
    },
    // Disabled entirely while a compose window is open — the editable-focus guard alone doesn't
    // cover every element inside compose (its own buttons, toolbars), so a shortcut key pressed
    // right after clicking one of those could still leak through to the mailbox underneath it.
    !compose.isComposeOpen
  );

  // Snooze the selected messages until a preset time; the inbound cron re-surfaces them.
  const snoozeSelected = async (preset: "later" | "tomorrow" | "nextweek") => {
    const rows = selectedMessageRows.filter((message) => !message.isComposeDraft && message.id);
    if (rows.length === 0 || actionLoading) return;
    const until = new Date();
    if (preset === "later") {
      until.setHours(until.getHours() + 3);
    } else if (preset === "tomorrow") {
      until.setDate(until.getDate() + 1);
      until.setHours(8, 0, 0, 0);
    } else {
      until.setDate(until.getDate() + 7);
      until.setHours(8, 0, 0, 0);
    }
    const byAccount = new Map<string, Array<{ messageId: string; threadId?: string }>>();
    for (const message of rows) {
      const list = byAccount.get(message.accountEmail) || [];
      list.push({ messageId: message.id, threadId: message.threadId });
      byAccount.set(message.accountEmail, list);
    }
    setSnoozeMenuOpen(false);
    setActionLoading(true);
    try {
      // Independent per-mailbox requests — a selection spanning several accounts shouldn't
      // wait on each mailbox's round trip in turn.
      await Promise.all(
        Array.from(byAccount, ([accountEmail, items]) =>
          fetch("/api/gmail/snooze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ accountEmail, items, snoozeUntil: until.toISOString() }),
          })
        )
      );
      // Snoozed mail leaves the mailbox — remove it in place and let the authoritative
      // refresh happen in the background rather than blocking the click on it.
      removeRowsLocally(rows);
      showSentToast("Snoozed");
      invalidateMessagesCache();
      void Promise.all([loadMessages(), loadMailboxCounts()]);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to snooze.");
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * Apply a label to every selected message. Used by "Move to → <label>" and by dropping
   * a message onto a label in the sidebar. Returns true when at least one message moved.
   */
  const applyLabelToSelection = useCallback(
    async (labelId: string, rows: MessageRow[]) => {
      const gmailRows = rows.filter((message) => !message.isComposeDraft);
      if (gmailRows.length === 0) return false;
      // Send the NAME as well as the id: label ids are per-account, so for messages in a second
      // mailbox the server resolves (or creates) the same-named label there instead of failing.
      const labelName = labels.find((entry) => entry.id === labelId)?.name || "";
      // One request for the whole selection — the server applies bounded concurrency + 429
      // backoff across all items itself, instead of the client firing N unbounded fetches that
      // trip Gmail's per-user concurrency limit on anything beyond a handful of messages.
      const items = gmailRows.map((message) => ({ accountEmail: message.accountEmail, messageId: message.id }));
      try {
        const response = await fetch("/api/gmail/apply-label", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items, labelId, labelName }),
        });
        const payload = await response.json().catch(() => null);
        const results: Array<{ ok: boolean; error?: string }> = Array.isArray(payload?.results) ? payload.results : [];
        const anySucceeded = results.some((r) => r.ok);
        // Surface WHY rather than doing nothing: a silent no-op here reads as "moving to a
        // label doesn't work" with nothing to act on.
        if (!anySucceeded) {
          const lastError = results.find((r) => !r.ok)?.error || payload?.message || `Label update failed (${response.status})`;
          setActionError(lastError);
        }
        return anySucceeded;
      } catch {
        setActionError("Label update failed — network error.");
        return false;
      }
    },
    [labels]
  );

  /**
   * Archive rows without touching selection state or reloading the list. Items carry their own
   * accountEmail, so a mixed-mailbox selection is handled in ONE request (the actions endpoint
   * resolves a token per account) instead of only acting on the primary inbox.
   */
  const archiveRowsQuietly = useCallback(async (rows: MessageRow[]) => {
    const items = rows
      .filter((message) => !message.isComposeDraft)
      .map((message) => ({ accountEmail: message.accountEmail, messageId: message.id }));
    if (items.length === 0) return;
    await fetch("/api/gmail/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "archive", items }),
    }).catch(() => null);
  }, []);

  /** Drop rows out of the current list immediately — a move shouldn't re-fetch the mailbox. */
  const removeRowsLocally = useCallback(
    (rows: MessageRow[]) => {
      const keys = new Set(rows.map((message) => rowKey(message)));
      setMessages((prev) => prev.filter((message) => !keys.has(rowKey(message))));
      setSelectedRows((prev) => prev.filter((key) => !keys.has(key)));
      // The destination mailbox's cached page predates this move; drop the cache so
      // switching to it fetches a list that actually contains the message.
      invalidateMessagesCache();
    },
    [rowKey, invalidateMessagesCache]
  );

  /* ── Drag & drop ──────────────────────────────────────────────────────────────
     Two gestures share one set of drop targets (the sidebar):
       • drag a nav item onto another nav item  → reorder the sidebar
       • drag message rows onto a mailbox/label → move those messages there
     Native HTML5 DnD, so there's no extra dependency and keyboard/arrow controls in
     Settings remain the accessible path to the same reordering. */
  const [draggingModuleKey, setDraggingModuleKey] = useState<string | null>(null);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);
  const [isDraggingMessages, setIsDraggingMessages] = useState(false);
  const draggedMessagesRef = useRef<MessageRow[]>([]);

  /** Persist a sidebar order. Always the FULL module list so hidden items keep their slot. */
  const persistModuleOrder = useCallback(async (nextOrder: string[]) => {
    setModuleOrder(nextOrder);
    try {
      await fetch("/api/gmail/nav-layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleOrder: nextOrder }),
      });
    } catch {
      /* keep the optimistic order — it re-syncs on the next load */
    }
  }, []);

  /** Reorder by dropping one nav item onto another (insert-before semantics). */
  const reorderModuleByDrop = useCallback(
    (sourceKey: string, targetKey: string) => {
      if (!sourceKey || sourceKey === targetKey) return;
      const full = orderModules(MODULES, moduleOrder).map((item) => item.key as string);
      const from = full.indexOf(sourceKey);
      const to = full.indexOf(targetKey);
      if (from < 0 || to < 0) return;
      const next = [...full];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      void persistModuleOrder(next);
    },
    [moduleOrder, persistModuleOrder]
  );

  /** Send a module to the very top of the sidebar (the top landing strip). */
  const moveModuleToTop = useCallback(
    (sourceKey: string) => {
      const full = orderModules(MODULES, moduleOrder).map((item) => item.key as string);
      const from = full.indexOf(sourceKey);
      if (from <= 0) return;
      const next = [...full];
      const [moved] = next.splice(from, 1);
      next.unshift(moved);
      void persistModuleOrder(next);
    },
    [moduleOrder, persistModuleOrder]
  );

  /** Drop the dragged messages onto a mailbox module or a label. */
  const dropMessagesOn = useCallback(
    // react-hooks/preserve-manual-memoization: the compiler can no longer prove this useCallback's
    // memoization is safe to preserve after the contacts module was extracted out of this component
    // (unrelated code, upstream) — the body and its deps are unchanged and correct; the compiler
    // just skips its own optimization pass here and falls back to this manual memoization as-is.
    // eslint-disable-next-line react-hooks/preserve-manual-memoization
    async (destination: string) => {
      const rows = draggedMessagesRef.current.filter((message) => !message.isComposeDraft);
      draggedMessagesRef.current = [];
      if (rows.length === 0) return;
      const items = rows.map((message) => ({ accountEmail: message.accountEmail, messageId: message.id }));
      const runAction = (action: string) =>
        fetch("/api/gmail/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, items }),
        });
      try {
        if (destination.startsWith("label:")) {
          const labelId = destination.slice("label:".length);
          const applied = await applyLabelToSelection(labelId, rows);
          if (!applied) return;
          // Same as "Move to → label": tag it, then take it out of the Inbox.
          if (activeModule === "inbox") await runAction("archive");
        } else {
          const action = MESSAGE_DROP_ACTIONS[destination];
          if (!action) return;
          const response = await runAction(action);
          if (!response.ok) return;
        }
        // Update in place — the moved rows just leave the list. No mailbox re-fetch.
        removeRowsLocally(rows);
        void loadMailboxCounts();
      } catch {
        /* transient — the list refresh below/next poll reconciles */
      }
    },
    [
      activeModule,
      applyLabelToSelection,
      loadMailboxCounts,
      // eslint-disable-next-line react-hooks/preserve-manual-memoization -- see note above dropMessagesOn
      removeRowsLocally,
    ]
  );

  /** Start dragging a row: drag the whole selection when the row is part of it. */
  const startMessageDrag = useCallback(
    (event: React.DragEvent, message: MessageRow) => {
      const key = rowKey(message);
      const dragging = selectedRows.includes(key) ? selectedMessageRows : [message];
      draggedMessagesRef.current = dragging;
      setIsDraggingMessages(true);
      event.dataTransfer.effectAllowed = "move";
      // Firefox requires data to be set for the drag to start at all.
      event.dataTransfer.setData("text/plain", dragging.map((m) => m.id).join(","));
    },
    [rowKey, selectedMessageRows, selectedRows]
  );

  const endMessageDrag = useCallback(() => {
    setIsDraggingMessages(false);
    setDropTargetKey(null);
    draggedMessagesRef.current = [];
  }, []);

  const handleMoveToChange = async (value: string) => {
    if (!value) return;
    if (value.startsWith("label:")) {
      // Gmail semantics for "move to a label": apply the label, then take it out of the
      // Inbox so it actually leaves the current view instead of just being tagged.
      const labelId = value.slice("label:".length);
      const rows = [...selectedMessageRows];
      setMoveMenuOpen(null);
      setActionError("");
      if (rows.length === 0) {
        // Nothing is checked and no message is open — say so instead of no-opping.
        setActionError("Select a message first, then choose where to move it.");
        return;
      }
      const moved = await applyLabelToSelection(labelId, rows);
      if (moved) {
        // Filing under a label means leaving the Inbox; archive quietly, then drop the rows
        // from the list in place rather than re-fetching the whole mailbox.
        if (activeModule === "inbox") await archiveRowsQuietly(rows);
        removeRowsLocally(rows);
        if (viewMode === "message") setViewMode("list");
        void loadMailboxCounts();
      }
      return;
    }
    // Mailbox destinations: close the menu, drop the rows from the list right away, and let
    // Gmail catch up in the background. Waiting on the round trip is what made this feel slow.
    const action =
      value === "inbox" ? "moveToInbox" : value === "spam" ? "moveToSpam" : value === "trash" ? "moveToTrash" : "archive";
    const rows = [...selectedMessageRows];
    setMoveMenuOpen(null);
    if (rows.length === 0) return;
    const items = rows
      .filter((message) => !message.isComposeDraft)
      .map((message) => ({ accountEmail: message.accountEmail, messageId: message.id }));
    removeRowsLocally(rows);
    if (viewMode === "message") setViewMode("list");
    if (items.length === 0) return;
    void fetch("/api/gmail/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, items }),
    })
      .then(() => loadMailboxCounts())
      .catch(() => setActionError("Failed to move the message."));
  };

  const blockSelectedSender = async () => {
    if (!selectedMessage) return;
    const identity = parseMailboxAddress(selectedMessageDetail?.fromRaw || selectedMessage.fromRaw || selectedMessage.replyTo || selectedMessage.from);
    if (!identity.email) {
      setActionError("Sender email could not be parsed.");
      return;
    }
    try {
      const existingEntry = selectedBlockedEntry;
      const response = existingEntry
        ? await fetch("/api/gmail/blocked-senders", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: existingEntry.id }),
          })
        : await fetch("/api/gmail/blocked-senders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              accountEmail: null,
              email: identity.email,
              name: identity.name || null,
            }),
          });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || (existingEntry ? "Failed to unblock sender." : "Failed to block sender."));
      }
      await loadBlockedSenders();
      setBlockSuccessModal({
        open: true,
        title: existingEntry ? "Sender Unblocked" : "Sender Blocked",
        message: existingEntry
          ? `${identity.email} was removed from your blocked list.`
          : `${identity.email} was added to your blocked list.`,
      });
      setActionError("");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to update blocked sender.");
    }
  };

  const loadLabels = useCallback(async () => {
    const primary = selectedAccounts[0];
    if (step !== "client" || !primary) {
      setLabels([]);
      return;
    }
    try {
      const response = await fetch(`/api/gmail/labels?accountEmail=${encodeURIComponent(primary)}`);
      const payload = await response.json().catch(() => ({}));
      setLabels(Array.isArray(payload?.labels) ? payload.labels : []);
    } catch {
      setLabels([]);
    }
  }, [selectedAccounts, step]);

  useEffect(() => {
    loadLabels();
  }, [loadLabels]);

  const openLabel = (label: { id: string; name: string }) => {
    setActiveLabelId(label.id);
    setActiveLabelName(label.name);
    setViewMode("list");
    setSearchTerm("");
    setSelectedRows([]);
    setCurrentPage(1);
  };

  const applyLabelToMessage = async (labelId: string) => {
    setLabelMenuOpen(false);
    if (!selectedMessage) return;
    try {
      const response = await fetch("/api/gmail/apply-label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountEmail: selectedMessage.accountEmail, messageId: selectedMessage.id, labelId }),
      });
      // A partial-failure bulk response still comes back as HTTP 207 (in the 2xx range, so
      // response.ok alone doesn't distinguish it) — check the payload's own ok flag too.
      const payload = await response.json().catch(() => null);
      if (response.ok && payload?.ok) {
        const label = labels.find((entry) => entry.id === labelId);
        showSentToast(`Labeled${label ? ` "${label.name}"` : ""}`);
      }
    } catch {
      /* ignore */
    }
  };

  const createLabel = () => {
    if (!selectedAccounts[0]) return;
    setNewLabelName("");
    setNewLabelModalOpen(true);
  };

  /** `rawName` comes straight from the dialog — state hasn't flushed yet when it submits. */
  const submitNewLabel = async (rawName?: string) => {
    const primary = selectedAccounts[0];
    const name = (rawName ?? newLabelName).trim();
    if (!primary || !name || creatingLabel) return;
    setCreatingLabel(true);
    try {
      const response = await fetch("/api/gmail/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountEmail: primary, name }),
      });
      if (response.ok) await loadLabels();
      setNewLabelModalOpen(false);
      setNewLabelName("");
    } catch {
      /* ignore */
    } finally {
      setCreatingLabel(false);
    }
  };

  /** Rename a label — PATCHes Gmail so the change is real, not just local. */
  const renameLabel = async (labelId: string, nextName: string) => {
    const primary = selectedAccounts[0];
    const trimmed = nextName.trim();
    if (!primary || !trimmed || renamingLabel) return;
    setRenamingLabel(true);
    setActionError("");
    try {
      const response = await fetch("/api/gmail/labels", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountEmail: primary, id: labelId, name: trimmed }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setActionError(payload?.message || "Failed to rename the label in Gmail.");
      } else {
        if (activeLabelId === labelId) setActiveLabelName(trimmed);
        await loadLabels();
      }
    } catch {
      setActionError("Failed to rename the label in Gmail.");
    } finally {
      setRenamingLabel(false);
      setLabelToRename(null);
    }
  };

  const deleteLabel = (label: { id: string; name: string }) => {
    if (!selectedAccounts[0]) return;
    setLabelToDelete(label);
  };

  const confirmDeleteLabel = async () => {
    const primary = selectedAccounts[0];
    if (!primary || !labelToDelete || deletingLabel) return;
    setDeletingLabel(true);
    try {
      // Query params, not a DELETE body — and check the result, so a Gmail-side failure
      // surfaces instead of the label silently reappearing on the next load.
      const response = await fetch(
        `/api/gmail/labels?accountEmail=${encodeURIComponent(primary)}&id=${encodeURIComponent(labelToDelete.id)}`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setActionError(payload?.message || "Failed to delete the label in Gmail.");
      } else if (activeLabelId === labelToDelete.id) {
        setActiveLabelId("");
        setActiveLabelName("");
      }
      await loadLabels();
    } catch {
      setActionError("Failed to delete the label in Gmail.");
    } finally {
      setDeletingLabel(false);
      setLabelToDelete(null);
    }
  };


  const messagesCountLabel = `${filteredMessages.length} Emails`;
  const activeModuleLabel = activeLabelId
    ? activeLabelName
    : MODULES.find((item) => item.key === activeModule)?.label || "Mailbox";
  const pageLabel = hasNextPage ? `Page ${currentPage}` : `Page ${currentPage} / ${currentPage}`;

  const moduleCount = (moduleKey: ModuleKey) => {
    if (moduleKey === "drafts") {
      const draftCount = Number(mailboxCounts.drafts || 0);
      return Number.isFinite(draftCount) && draftCount > 0 ? draftCount : 0;
    }
    if (!BADGE_MODULES.has(moduleKey)) return 0;
    // Starred isn't a mailbox we page through, so its unread count comes from the label totals
    // rather than from the currently-loaded page of rows.
    if (moduleKey === "starred") {
      const starredUnread = Number(mailboxCounts.starred || 0);
      return Number.isFinite(starredUnread) && starredUnread > 0 ? starredUnread : 0;
    }
    const countMap: Record<string, number> = moduleUnreadBadges as unknown as Record<string, number>;
    const count = countMap[moduleKey];
    return Number.isFinite(count) && count > 0 ? count : 0;
  };

  const spamActionTitle = activeModule === "spam" ? "Report As Not Spam" : "Report As Spam";
  const spamActionType = activeModule === "spam" ? "moveToInbox" : "moveToSpam";

  const moveToOptions = useMemo(() => {
    const allOptions: Array<{ value: string; label: string }> = [
      { value: "inbox", label: "Inbox" },
      { value: "archive", label: "Archive" },
      { value: "spam", label: "Spam" },
      { value: "trash", label: "Trash" },
    ];
    const activeAsDestination: Partial<Record<ModuleKey, "inbox" | "archive" | "spam" | "trash">> = {
      inbox: "inbox",
      archive: "archive",
      spam: "spam",
      trash: "trash",
    };
    const excluded = activeAsDestination[activeModule];
    const mailboxes = excluded ? allOptions.filter((option) => option.value !== excluded) : allOptions;
    // The user's own labels are valid move destinations too — prefixed so the handler can
    // tell them apart from the built-in mailboxes, and the label you're already viewing is
    // dropped since "move here" would be a no-op.
    const labelOptions = labels
      .filter((label) => label.id !== activeLabelId)
      .map((label) => ({ value: `label:${label.id}`, label: label.name }));
    return [...mailboxes, ...labelOptions];
  }, [activeModule, labels, activeLabelId]);

  // Empty-list chrome: with nothing to act on, bulk-select and paging are dead controls, so hide
  // them. Search is the exception — when a query is what emptied the list, hiding the box would
  // trap the user with no way to clear it, so it stays whenever a term is active.
  // Tracker dots. The list itself is fetched without bodies (metadata only) so it paints fast,
  // so the beacon scan runs right after in one batched request per account and fills the dots in.
  // Verdicts are cached by message id, so paging back and forth doesn't re-scan.
  useEffect(() => {
    if (messagesLoading) return;
    // De-dupe against a ref, not state: keying off `messageTrackers` meant every batch of
    // results re-ran this effect for every other row on screen.
    const pending = conversationRows.filter(
      (message) => !message.isComposeDraft && message.id && !scannedIdsRef.current.has(message.id)
    );
    pending.forEach((message) => scannedIdsRef.current.add(message.id));
    if (pending.length === 0) return;
    const byAccount = new Map<string, string[]>();
    for (const message of pending) {
      if (!message.accountEmail) continue;
      const list = byAccount.get(message.accountEmail) || [];
      list.push(message.id);
      byAccount.set(message.accountEmail, list);
    }
    let cancelled = false;
    // Hold the scan back briefly. It pulls full bodies for the page, so firing it the moment
    // the list paints put ~60 requests in flight against the same connection the mailbox and
    // reader are using — the list felt slow because the scan was competing with it.
    const startDelay = setTimeout(() => {
      void (async () => {
      for (const [accountEmail, messageIds] of byAccount) {
        try {
          const response = await fetch("/api/gmail/tracker-scan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ accountEmail, messageIds }),
          });
          if (!response.ok || cancelled) continue;
          const payload = await response.json().catch(() => null);
          const trackers = payload?.trackers;
          if (!trackers || cancelled) continue;
          setMessageTrackers((prev) => ({ ...prev, ...trackers }));
        } catch {
          /* a failed scan just leaves those rows dot-less */
        }
      }
      })();
    }, 700);
    return () => {
      cancelled = true;
      clearTimeout(startDelay);
    };
  }, [conversationRows, messagesLoading]);

  /** The rail's mailbox rows: visible modules in the user's saved order. */
  const navItems = useMemo(
    () =>
      orderModules(
        MODULES.filter((item) => item.key === "inbox" || !hiddenModules.includes(item.key)),
        moduleOrder
      ),
    [hiddenModules, moduleOrder]
  );

  // The toolbar stays fully populated on an empty mailbox — an empty Inbox should still show
  // its count, refresh, search and paging, exactly like a full one. Only select-all is
  // disabled, since there is genuinely nothing to select.
  /**
   * Whether this view may move messages between mailboxes (Move To, Archive).
   *
   * One predicate rather than the module name repeated at each control: this rule was missed at some
   * of them twice, leaving Archive live in a view it had already been removed from.
   *
   * Starred is a label, not a mailbox, so moving out of it (Archive included) is disorienting. Sent
   * is a record of what was sent — filing those into other mailboxes has no meaning.
   */
  const allowsMailboxMoves = activeModule !== "starred" && activeModule !== "sent";

  const mailboxListIsEmpty = !messagesLoading && conversationRows.length === 0;
  const showListSearch = true;
  const showListPaging = true;

  return (
    <div className={`email-shell relative w-full h-full text-[#1E1B2E] flex flex-col overflow-hidden ${panelFont.className}`}>
      <style jsx global>{`
        /* App shell — a flat, modern dark canvas (no animated starfield). One soft
           brand glow off the top edge keeps it from reading as a plain black box,
           and it costs nothing to paint since it never moves. */
        .email-shell {
          background:
            radial-gradient(115% 70% at 50% -12%, rgba(112, 28, 192, 0.28) 0%, rgba(112, 28, 192, 0.06) 45%, transparent 72%),
            #0C0715;
        }
        /* Empty-mailbox envelope: a slow vertical drift so the state reads as idle, not broken. */
        @keyframes mailboxFloat {
          0%, 100% { transform: translateY(-2px); }
          50% { transform: translateY(2px); }
        }
        /* Compose shares Ask Artemis's drifting radial wash — defined in globals.css so the
           containment (position/overflow) and the ::before layer live together. */
      `}</style>
      {step === "gate" ? (
        gmailLoading ? (
          /* While accounts resolve, render the SHARED loading screen verbatim — same component
             as the login page and the panel's bundle loader, so the logo, sizing and motion are
             identical all the way through sign-in → panel. */
          <BrandLoadingScreen />
        ) : (
          <div className="relative z-10 h-full flex items-center justify-center px-6 py-12">
            <div className="w-full max-w-md text-center">
              <Image
                src="/assets/vierra-logo-black-3.png"
                alt="Vierra"
                width={220}
                height={64}
                className="pointer-events-none mx-auto mb-8 h-10 w-auto select-none opacity-95 brightness-0 invert"
                draggable={false}
                priority
              />
              <h1 className="text-xl font-semibold tracking-tight text-white">No Google accounts connected</h1>
              <p className="mt-2 text-sm text-white/70">Connect Gmail from your account settings, then come back here.</p>
            </div>
          </div>
        )
      ) : (
        <div className="relative z-10 flex-1 w-full min-h-0 overflow-hidden">
          <div className="w-full h-full min-h-0 overflow-hidden">
            {(
              /* One continuous surface: no gap, no card ridges — the rail and the content are
                 divided by a single hairline, the way a mail client reads as one system.
                 `minmax(0,1fr)` (never a 720px floor) lets the content column actually shrink
                 instead of pushing the grid off-screen; the rail collapses to icons below `md`. */
              <div className="grid h-full min-h-0 grid-cols-[64px_minmax(0,1fr)] overflow-hidden md:grid-cols-[236px_minmax(0,1fr)] xl:grid-cols-[268px_minmax(0,1fr)]">
                <div className="email-rail flex h-full min-h-0 flex-col overflow-hidden px-2 py-3 md:px-3">
                  {/* Brand — centered in the rail, white wordmark on the dark glass. */}
                  <div className="flex items-center justify-center px-1 pb-5 pt-2 md:pb-6 md:pt-3">
                    {/* `wordmarkLight` is byte-identical to the dark asset, so it never rendered
                        white. Force it the same way the shared loading screen does. */}
                    <Image
                      src={BRAND_LOGO.wordmarkLoader}
                      alt="Vierra"
                      width={200}
                      height={50}
                      className="hidden h-11 w-auto brightness-0 invert md:block"
                      priority
                    />
                    <Image src={BRAND_LOGO.mark} alt="Vierra" width={36} height={36} className="h-8 w-auto md:hidden" priority />
                  </div>
                  {/* Compose CTA. Hover only brightens — no lift and no shadow swap, which read as
                      a jumpy drop-shadow. Transitioning `filter` alone also leaves the gradient
                      keyframes untouched (the old `transition-all` fought them and stuttered). */}
                  <button
                    type="button"
                    onClick={() => {
                      void compose.openNewCompose();
                    }}
                    className="compose-cta mb-4 inline-flex w-full items-center justify-center gap-2 rounded-md px-2 py-3 text-sm font-medium text-white shadow-[0_6px_20px_-8px_rgba(94,23,168,0.9)] transition-[filter] duration-200 ease-out hover:brightness-[1.08] active:brightness-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 md:px-3.5"
                  >
                    <FiEdit3 className="w-4 h-4 shrink-0" />
                    <span className="hidden md:inline">Compose</span>
                  </button>

                  <div className="space-y-0.5 flex-1 min-h-0 overflow-y-auto -mx-1 px-1">
                    {/* Landing strip for the very top of the list. Only live while a nav item is
                        being dragged; without it the topmost slot is unreachable, because the
                        pointer sits in the gap ABOVE the first row rather than on it. */}
                    {draggingModuleKey ? (
                      <div
                        onDragOver={(event) => {
                          event.preventDefault();
                          event.dataTransfer.dropEffect = "move";
                          setDropTargetKey("__top__");
                        }}
                        onDragLeave={() => setDropTargetKey((key) => (key === "__top__" ? null : key))}
                        onDrop={(event) => {
                          event.preventDefault();
                          setDropTargetKey(null);
                          if (draggingModuleKey) moveModuleToTop(draggingModuleKey);
                          setDraggingModuleKey(null);
                        }}
                        className={`relative -mt-1 h-3 rounded ${
                          dropTargetKey === "__top__"
                            ? "after:pointer-events-none after:absolute after:inset-x-0 after:top-1/2 after:h-[2px] after:-translate-y-1/2 after:rounded-full after:bg-[#8F42FF] after:content-['']"
                            : ""
                        }`}
                      />
                    ) : null}
                    {navItems.map((item) => (
                      (() => {
                        const count = moduleCount(item.key);
                        const isActive = activeModule === item.key && !activeLabelId;
                        const isLastNavItem = navItems[navItems.length - 1]?.key === item.key;
                        return (
                      <button
                        key={item.key}
                        type="button"
                        title={item.label}
                        /* Drag the item itself to reorder; drop messages on it to move them. */
                        draggable={!isDraggingMessages}
                        onDragStart={(event) => {
                          setDraggingModuleKey(item.key);
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", item.key);
                        }}
                        onDragEnd={() => {
                          setDraggingModuleKey(null);
                          setDropTargetKey(null);
                        }}
                        onDragOver={(event) => {
                          const canDrop = isDraggingMessages
                            ? Boolean(MESSAGE_DROP_ACTIONS[item.key])
                            : Boolean(draggingModuleKey);
                          if (!canDrop) return;
                          event.preventDefault();
                          event.dataTransfer.dropEffect = "move";
                          setDropTargetKey(item.key);
                        }}
                        onDragLeave={() => setDropTargetKey((key) => (key === item.key ? null : key))}
                        onDrop={(event) => {
                          event.preventDefault();
                          setDropTargetKey(null);
                          if (isDraggingMessages) {
                            void dropMessagesOn(item.key);
                            endMessageDrag();
                            return;
                          }
                          if (draggingModuleKey) reorderModuleByDrop(draggingModuleKey, item.key);
                          setDraggingModuleKey(null);
                        }}
                        onClick={() => {
                          setActiveModule(item.key);
                          setActiveLabelId("");
                          setViewMode("list");
                          setSearchTerm("");
                          setSelectedRows([]);
                        }}
                        className={`group relative w-full rounded-xl py-2 text-[13px] text-left flex items-center gap-2 transition-colors justify-center md:justify-between px-2 md:pl-3 md:pr-2 ${
                          draggingModuleKey === item.key ? "email-nav-dragging" : ""
                        } ${
                          /* Reordering shows an insertion LINE at the edge the item will land on.
                             Dropping on the LAST row shows the line BELOW it, so the bottom slot
                             (after Trash) is reachable; every other row shows it above. */
                          dropTargetKey === item.key && draggingModuleKey
                            ? isLastNavItem
                              ? "after:pointer-events-none after:absolute after:inset-x-0 after:-bottom-[3px] after:h-[2px] after:rounded-full after:bg-[#8F42FF] after:content-['']"
                              : "after:pointer-events-none after:absolute after:inset-x-0 after:-top-[3px] after:h-[2px] after:rounded-full after:bg-[#8F42FF] after:content-['']"
                            : ""
                        } ${
                          dropTargetKey === item.key && isDraggingMessages
                            ? "bg-[#701CC0]/15 text-[#EDEBF5]"
                            : ""
                        } ${
                          /* Active row: soft brand wash + a short, fully-rounded tick on the left. */
                          isActive
                            ? "email-nav-active font-semibold"
                            : "font-medium hover:bg-[#F6F5F8]"
                        }`}
                      >
                        <span className="inline-flex items-center gap-2.5 min-w-0">
                          <span className={isActive ? "text-[#701CC0]" : ""}>{item.icon}</span>
                          <span className="hidden truncate md:inline">{item.label}</span>
                        </span>
                        {count > 0 ? (
                          <span
                            className={`hidden shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums md:inline ${
                              isActive ? "bg-[#701CC0]/12 text-[#5B21B6]" : "text-[#9A94AD]"
                            }`}
                          >
                            {count}
                          </span>
                        ) : null}
                      </button>
                        );
                      })()
                    ))}
                    <Link
                      href="/panel/email/settings"
                      title="Settings"
                      className="mt-0.5 flex w-full items-center justify-center gap-2.5 rounded-lg px-2 py-2 text-[13px] font-medium transition-colors hover:bg-[#F6F5F8] md:justify-start md:px-3"
                    >
                      <FiSettings className="w-4 h-4 shrink-0 text-[#847FA0]" />
                      <span className="hidden md:inline">Settings</span>
                    </Link>
                    {labels.length > 0 ? (
                      <>
                        {/* Clear break from the mailbox list above (Trash), then the header sits
                            tight to its own labels so the group reads as one block.
                            NOTE: this must be PADDING, not margin — the parent's `space-y-0.5`
                            sets margin-top on every child with higher specificity, which silently
                            ate the margin here before. */}
                        <div className="flex items-center justify-center gap-1 px-2 pb-1 pt-4 md:justify-between md:px-3">
                          <span className="hidden text-[10.5px] font-semibold uppercase tracking-wide text-[#847FA0] md:inline">Labels</span>
                          <button type="button" onClick={createLabel} title="New Label" aria-label="New Label" className="text-[#847FA0] hover:text-[#701CC0]">
                            <FiPlus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {labels.map((label) => (
                          <div
                            key={label.id}
                            onClick={() => openLabel(label)}
                            /* Drop messages here to file them under this label. */
                            onDragOver={(event) => {
                              if (!isDraggingMessages) return;
                              event.preventDefault();
                              event.dataTransfer.dropEffect = "move";
                              setDropTargetKey(`label:${label.id}`);
                            }}
                            onDragLeave={() =>
                              setDropTargetKey((key) => (key === `label:${label.id}` ? null : key))
                            }
                            onDrop={(event) => {
                              if (!isDraggingMessages) return;
                              event.preventDefault();
                              setDropTargetKey(null);
                              void dropMessagesOn(`label:${label.id}`);
                              endMessageDrag();
                            }}
                            className={`group/label relative w-full cursor-pointer rounded-lg px-3 py-2 text-[13px] flex items-center gap-2.5 transition-colors ${
                              dropTargetKey === `label:${label.id}` ? "bg-[#701CC0]/15 text-[#EDEBF5]" : ""
                            } ${
                              activeLabelId === label.id
                                ? "bg-[#F4F1FA] text-[#241245] font-semibold before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-4 before:w-[3px] before:rounded-r-full before:bg-[#701CC0] before:content-['']"
                                : "text-[#5B5670] font-medium hover:bg-[#F6F5F8] hover:text-[#2A2540]"
                            }`}
                          >
                            <FiTag className="w-4 h-4 shrink-0" style={{ color: activeLabelId === label.id ? "#701CC0" : "#847FA0" }} />
                            <span className="hidden flex-1 truncate md:inline">{label.name}</span>
                            <button
                              type="button"
                              onClick={(event) => { event.stopPropagation(); setLabelToRename(label); }}
                              title="Rename label"
                              aria-label={`Rename label ${label.name}`}
                              className="hidden text-[#B9B3CC] opacity-0 transition-opacity hover:text-[#B98CFF] group-hover/label:opacity-100 md:block"
                            >
                              <FiEdit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(event) => { event.stopPropagation(); void deleteLabel(label); }}
                              title="Delete label"
                              aria-label={`Delete label ${label.name}`}
                              className="hidden text-[#B9B3CC] opacity-0 transition-opacity hover:text-[#DC2626] group-hover/label:opacity-100 md:block"
                            >
                              <FiX className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={createLabel}
                        title="New Label"
                        /* Padding, not margin — see the note on the Labels header above. */
                        className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] font-medium text-[#847FA0] transition-colors hover:bg-[#F6F5F8] hover:text-[#2A2540] md:justify-start md:px-3"
                      >
                        <FiPlus className="h-4 w-4 shrink-0" />
                        <span className="hidden md:inline">New Label</span>
                      </button>
                    )}
                  </div>
                  {/* Ask Artemis sits at the foot of the rail behind a divider; Settings lives
                      with the mailbox rows (directly under Trash) rather than down here. */}
                  <div className="mt-2 shrink-0 border-t border-white/[0.07] pt-3">
                    <div
                      aria-hidden
                      className="email-artemis flex w-full flex-col items-center justify-center gap-1.5 rounded-xl px-2 py-4 text-[13px] font-medium md:items-start md:px-3.5"
                    >
                      <span className="relative z-10 flex items-center gap-2">
                        <svg
                          className="email-artemis-bolt h-4 w-4 shrink-0"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                        >
                          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                        </svg>
                        <span className="hidden md:inline">Ask Artemis</span>
                      </span>
                      <span className="relative z-10 hidden text-[11px] font-normal leading-4 text-[#8F88A8] md:block">
                        Draft, summarize or reply with AI.
                      </span>
                    </div>
                  </div>
                </div>

                {/* Flush with the rail — no card, no ridge. One continuous mail surface. */}
                <div className="email-content flex h-full min-h-0 flex-col overflow-hidden">
                  {activeModule === "campaigns" ? (
                    <div className="h-full overflow-y-auto">
                      <CampaignsView />
                    </div>
                  ) : activeModule === "cartography" ? (
                    <div className="h-full overflow-y-auto">
                      <CartographyView />
                    </div>
                  ) : activeModule === "scheduled" ? (
                    <div className="flex h-full flex-col">
                      <div className="flex items-center justify-between gap-3 border-b border-white/30 px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FiClock className="h-4 w-4 text-[#701CC0]" aria-hidden />
                          <span className="text-xs font-medium text-[#6B7280]">
                            Scheduled · {scheduledItems.length} {scheduledItems.length === 1 ? "message" : "messages"}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={loadScheduled}
                          disabled={scheduledLoading}
                          className="rounded-lg border border-[#E5E7EB] bg-white p-2 text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-50"
                          aria-label="Refresh scheduled"
                          title="Refresh"
                        >
                          <FiRefreshCw className={`h-4 w-4 ${scheduledLoading ? "motion-safe:animate-spin" : ""}`} />
                        </button>
                      </div>
                      <div className="modal-scroll-area flex-1 overflow-y-auto">
                        {scheduledError ? (
                          <div className="m-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                            {scheduledError}
                          </div>
                        ) : null}
                        {scheduledLoading && scheduledItems.length === 0 ? (
                          <div className="flex h-40 items-center justify-center">
                            <div className="h-8 w-8 rounded-full border-4 border-[#E9D4FB] border-t-[#701CC0] motion-safe:animate-spin" />
                          </div>
                        ) : scheduledItems.length === 0 ? (
                          <div className="flex h-48 flex-col items-center justify-center gap-2 text-center text-[#6B7280]">
                            <FiClock className="h-8 w-8 text-[#C4B5DA]" aria-hidden />
                            <p className="text-sm font-medium text-[#4A465C]">No scheduled sends</p>
                            <p className="text-xs">Use “Schedule” in the compose window to send a message later.</p>
                          </div>
                        ) : (
                          <ul className="divide-y divide-[#EEF0F4]">
                            {scheduledItems.map((item) => {
                              const when = new Date(item.scheduledAt);
                              const badge =
                                item.status === "FAILED"
                                  ? "bg-red-50 text-red-700"
                                  : item.status === "SENDING"
                                    ? "bg-blue-50 text-blue-700"
                                    : "bg-[#F5EFFF] text-[#701CC0]";
                              return (
                                <li key={item.id} className="flex items-start justify-between gap-3 px-4 py-3">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge}`}>
                                        {item.status}
                                      </span>
                                      <span className="truncate text-sm font-medium text-[#1E1B2E]">
                                        {item.subject}
                                      </span>
                                    </div>
                                    <p className="mt-1 truncate text-xs text-[#6B7280]">
                                      To {item.to || "—"} · from {item.accountEmail}
                                    </p>
                                    <p className="mt-0.5 text-xs text-[#847FA0]">
                                      {when.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                                    </p>
                                    {item.status === "FAILED" && item.lastError ? (
                                      <p className="mt-1 text-xs text-red-600">{item.lastError}</p>
                                    ) : null}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => cancelScheduled(item.id)}
                                    disabled={cancelingScheduledId === item.id || item.status === "SENDING"}
                                    className="shrink-0 rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-medium text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-50"
                                    title={item.status === "SENDING" ? "Already sending" : "Cancel"}
                                  >
                                    {cancelingScheduledId === item.id ? "Canceling…" : "Cancel"}
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    </div>
                  ) : activeModule === "analytics" ? (
                    <EmailAnalyticsView accounts={selectedAccounts} />
                  ) : viewMode === "list" ? (
                    <>
                      {/* The toolbar is always present for a mailbox — an empty result must not
                          make the count/refresh/search/paging vanish. (Clearing the last search
                          character used to unmount the whole bar mid-type.) */}
                      {activeModule !== "contacts" ? (
                        <>
                          <div className="email-toolbar flex items-center justify-between gap-3 px-4 py-2.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              {showListPaging ? (
                                <input
                                  type="checkbox"
                                  checked={
                                    filteredMessages.length > 0 &&
                                    conversationRows.every((message) => selectedRows.includes(rowKey(message)))
                                  }
                                  onChange={toggleSelectAll}
                                  disabled={mailboxListIsEmpty}
                                  className="email-check h-4 w-4 shrink-0 disabled:opacity-40"
                                />
                              ) : null}
                              {showListPaging ? (
                                <>
                                  <div className="text-xs font-medium text-[#6B7280] mr-1">{activeModuleLabel} · {messagesCountLabel}</div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      invalidateMessagesCache();
                                      void Promise.all([loadMessages(), loadMailboxCounts()]);
                                    }}
                                    disabled={messagesLoading}
                                    className={`${ICON_BUTTON} email-tip`}
                                    aria-label="Refresh"
                                    data-tip="Refresh"
                                  >
                                    <MdRefresh className={`h-[18px] w-[18px] ${messagesLoading ? "motion-safe:animate-spin" : ""}`} />
                                  </button>
                                  {/* Starred-only: the useful action here is removing the star. Placed
                                      between Refresh and Trash, replacing Move To / Archive — moving a
                                      starred message out of the view it lives in was disorienting, and
                                      Starred is a label view rather than a mailbox. */}
                                  {activeModule === "starred" && hasSelectedEmails ? (
                                    <button
                                      type="button"
                                      onClick={() => void unstarSelected()}
                                      disabled={actionLoading}
                                      className={`${ICON_BUTTON} email-tip`}
                                      aria-label="Unstar"
                                      data-tip="Unstar"
                                    >
                                      <FiStar className="h-4 w-4 fill-[#F5A623]" />
                                    </button>
                                  ) : null}
                                  {/* Spam-only: restore to the inbox and tell Gmail it isn't spam. */}
                                  {activeModule === "spam" && hasSelectedEmails ? (
                                    <button
                                      type="button"
                                      onClick={() => applyAction("unspam")}
                                      className={`${ICON_BUTTON} email-tip`}
                                      aria-label="Mark As Not Spam"
                                      data-tip="Mark As Not Spam"
                                    >
                                      <FiShield className="h-4 w-4" />
                                    </button>
                                  ) : null}
                                </>
                              ) : null}
                              {hasSelectedEmails ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => (deletesPermanently ? setConfirmHardDelete(true) : applyAction("trash"))}
                                    className={`${ICON_BUTTON} email-tip`}
                                    data-tip={deletesPermanently ? "Delete Permanently" : "Move To Trash"}
                                  >
                                    <FiTrash2 className="w-4 h-4" />
                                  </button>
                                  {activeModule !== "drafts" ? (
                                    <>
                                      {/* One adaptive control: offer "Mark As Read" only when every
                                          selected email is unread; otherwise (all read, or a mix)
                                          offer "Mark As Unread". */}
                                      <button
                                        type="button"
                                        onClick={() => applyAction(selectionHasUnread ? "markRead" : "markUnread")}
                                        className={`${ICON_BUTTON} email-tip`}
                                        aria-label={selectionHasUnread ? "Mark As Read" : "Mark As Unread"}
                                        data-tip={selectionHasUnread ? "Mark As Read" : "Mark As Unread"}
                                      >
                                        {selectionHasUnread ? (
                                          <FiCheckSquare className="w-4 h-4" />
                                        ) : (
                                          <FiMail className="w-4 h-4" />
                                        )}
                                      </button>
                                    </>
                                  ) : null}
                                  {activeModule !== "drafts" && allowsMailboxMoves ? (
                                    <div ref={moveListMenuRef} className="relative">
                                      <button
                                        type="button"
                                        onClick={() => setMoveMenuOpen((prev) => (prev === "list" ? null : "list"))}
                                        className={`${ICON_BUTTON} email-tip`}
                                        aria-label="Move To"
                                        data-tip="Move To"
                                      >
                                        <FiMove className="w-4 h-4" />
                                      </button>
                                      {moveMenuOpen === "list" ? (
                                        <MoveToMenu options={moveToOptions} onSelect={handleMoveToChange} keyPrefix="list-move" />
                                      ) : null}
                                    </div>
                                  ) : null}
                                  {/* Archive is hidden in Starred for the same reason as Move To:
                                      Starred is a label view, so archiving from it just makes the
                                      message vanish from where you were working. Unstar is the
                                      meaningful action and sits by Refresh. */}
                                  {activeModule !== "drafts" ? (
                                    <>
                                      {allowsMailboxMoves ? (
                                        <button
                                          type="button"
                                          onClick={() => applyAction(activeModule === "archive" ? "moveToInbox" : "archive")}
                                          className={`${ICON_BUTTON} email-tip`}
                                          data-tip={activeModule === "archive" ? "Unarchive" : "Archive"}
                                        >
                                          <FiArchive className="w-4 h-4" />
                                        </button>
                                      ) : null}
                                      <div ref={snoozeMenuRef} className="relative">
                                        <button
                                          type="button"
                                          onClick={() => setSnoozeMenuOpen((open) => !open)}
                                          className={`${ICON_BUTTON} email-tip`}
                                          data-tip="Snooze"
                                          aria-label="Snooze"
                                        >
                                          <FiClock className="w-4 h-4" />
                                        </button>
                                        {snoozeMenuOpen ? (
                                          <div className="email-menu absolute z-[130] mt-1.5 w-44">
                                            {(
                                              [
                                                ["later", "Later today"],
                                                ["tomorrow", "Tomorrow"],
                                                ["nextweek", "Next week"],
                                              ] as const
                                            ).map(([preset, label]) => (
                                              <button
                                                key={preset}
                                                type="button"
                                                onClick={() => snoozeSelected(preset)}
                                                className="email-menu-item block w-full px-2.5 py-[7px] text-left text-[12.5px] font-medium"
                                              >
                                                {label}
                                              </button>
                                            ))}
                                          </div>
                                        ) : null}
                                      </div>
                                    </>
                                  ) : null}
                                </>
                              ) : null}
                              {showListSearch ? (
                                <div className="email-search flex w-96 max-w-full items-center gap-2 rounded-lg px-3 py-1.5 transition">
                                  <FiSearch className="w-4 h-4 text-[#6B7280]" />
                                  <input
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Search"
                                    className="w-full border-0 bg-transparent text-sm text-[#D6D1E6] placeholder:text-[#857F9B] shadow-none outline-none focus:ring-0"
                                  />
                                  {searchTerm.trim() ? (
                                    <button
                                      type="button"
                                      onClick={() => setSearchTerm("")}
                                      className="inline-flex items-center justify-center rounded p-0.5 text-[#9CA3AF] hover:text-[#6B7280] hover:bg-[#F3F4F6]"
                                      aria-label="Clear Search"
                                      title="Clear Search"
                                    >
                                      <FiX className="w-3.5 h-3.5" />
                                    </button>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                            {showListPaging ? (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                                  disabled={currentPage <= 1 || messagesLoading}
                                  className="email-pager"
                                  aria-label="Previous page"
                                  title="Previous page"
                                >
                                  <FiChevronLeft className="h-4 w-4" />
                                </button>
                                <span className="min-w-[70px] px-1 text-center text-[11px] tabular-nums text-[#8F88A8]">
                                  {pageLabel}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setCurrentPage((prev) => prev + 1)}
                                  disabled={!hasNextPage || messagesLoading}
                                  className="email-pager"
                                  aria-label="Next page"
                                  title="Next page"
                                >
                                  <FiChevronRight className="h-4 w-4" />
                                </button>
                              </div>
                            ) : null}
                          </div>

                        </>
                      ) : null}

                      {/* No bottom padding at all: any padding here shows up as dead space below
                          the final row once a mailbox is scrolled to the end. */}
                      <div className="flex-1 overflow-y-auto overflow-x-hidden">
                        {messagesError ? (
                          <div className={`m-3 ${ALERT.error}`}>{messagesError}</div>
                        ) : null}
                        {actionError ? (
                          <div className={`m-3 ${ALERT.error}`}>{actionError}</div>
                        ) : null}
                        {accountErrors.length > 0 ? (
                          <div className="m-3 space-y-1 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
                            {accountErrors.map((entry) => {
                              // Token errors ("Reconnect required", refresh failure, token not found) get a
                              // one-click reconnect that starts the Gmail OAuth flow for that account.
                              const needsReconnect = /reconnect|refresh|token/i.test(entry.message);
                              return (
                                <div key={entry.accountEmail} className="flex flex-wrap items-center justify-between gap-2">
                                  <span>
                                    <span className="font-medium">{entry.accountEmail}</span>{" "}
                                    {needsReconnect ? "needs to be reconnected." : "could not be loaded."}
                                  </span>
                                  {needsReconnect ? (
                                    <a
                                      href={`/api/gmail/initiate?from=email&account=${encodeURIComponent(entry.accountEmail)}`}
                                      className="shrink-0 rounded-md bg-yellow-800 px-2.5 py-1 text-xs font-medium text-white hover:bg-yellow-900"
                                    >
                                      Reconnect
                                    </a>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        ) : null}

                        {activeModule === "contacts" ? (
                          <ContactsPanel contacts={contacts} />
                        ) : !canLoadMessages ? (
                          <div className="h-full min-h-[320px] flex items-center justify-center text-sm text-[#7C829A]">
                            {activeModule} section placeholder.
                          </div>
                        ) : messagesLoading ? (
                          <MailboxLoader label={`Loading ${activeModuleLabel}...`} />
                        ) : conversationRows.length === 0 ? (
                          <MailboxEmpty />
                        ) : (
                          <div>
                            {conversationRows.map((message) => {
                              const key = rowKey(message);
                              const senderOrTo = activeModule === "sent" ? message.to || "-" : message.from || "-";
                              const senderOrToTrimmed = senderOrTo.trim();
                              const showSenderForDraft =
                                senderOrToTrimmed.length > 0 &&
                                senderOrToTrimmed !== "-" &&
                                senderOrToTrimmed.toLowerCase() !== "(draft)";
                              const draftSenderLabel = showSenderForDraft
                                ? senderOrTo
                                : (message.accountEmail || "").trim();
                              const openCount = Number(message.trackingOpenCount || 0);
                              const clickCount = Number(message.trackingClickCount || 0);
                              const trackingAge = formatTrackingAge(message.trackingLastOpenedAt);
                              const totalOpenWindow = formatDuration(Number(message.trackingTotalOpenWindowMs || 0));
                              const isSelected = selectedRows.includes(key);
                              const incomingTracker = messageTrackers[message.id];
                              const outboundTip =
                                openCount > 0
                                  ? `Opened by recipient · ${openCount} open${openCount === 1 ? "" : "s"} · last ${trackingAge} · tracked ${totalOpenWindow} · ${clickCount} click${clickCount === 1 ? "" : "s"}`
                                  : `Tracked — not yet opened · ${clickCount} click${clickCount === 1 ? "" : "s"}`;
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  /* Drag onto a sidebar mailbox or label to move it there.
                                     Compose drafts live only locally, so they aren't draggable. */
                                  /* Dragging a row onto a sidebar mailbox moves it there, so it is
                                     off wherever moving between mailboxes is not allowed — otherwise
                                     it would be a way around the hidden Move To and Archive. */
                                  draggable={!message.isComposeDraft && allowsMailboxMoves}
                                  onDragStart={(event) => startMessageDrag(event, message)}
                                  onDragEnd={endMessageDrag}
                                  /* Warm the reader while the pointer is on the row, so opening
                                     it is usually a cache hit rather than a fresh round trip. */
                                  onMouseEnter={() => {
                                    if (!message.isComposeDraft) void fetchDetailInto(message.accountEmail, message.id);
                                  }}
                                  onFocus={() => {
                                    if (!message.isComposeDraft) void fetchDetailInto(message.accountEmail, message.id);
                                  }}
                                  onClick={() => {
                                    if (message.isComposeDraft) {
                                      compose.openComposeDraftFromRow(message);
                                      return;
                                    }
                                    setSelectedMessageId(message.id);
                                    setViewMode("message");
                                    setDetailError("");
                                  }}
                                  /* Row = fixed gutter · sender · subject+snippet · time.
                                     Colors are explicit here (not inherited from a global remap)
                                     so read/unread hierarchy is legible on the dark surface. */
                                  className={`email-row group grid w-full grid-cols-[auto_minmax(0,13rem)_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-2.5 text-left transition-colors ${
                                    isSelected ? "is-selected" : ""
                                  } ${message.unread ? "is-unread" : ""}`}
                                >
                                  {/* Gutter — always-visible controls, fixed width so every row
                                      starts its sender text on the same x. */}
                                  <span className="flex shrink-0 items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={selectedRows.includes(key)}
                                      onClick={(event) => event.stopPropagation()}
                                      onChange={() => toggleRowSelection(message)}
                                      className="email-check h-4 w-4 shrink-0"
                                    />
                                    <span
                                      role="button"
                                      tabIndex={0}
                                      onClick={(e) => { e.stopPropagation(); void toggleStar(message); }}
                                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); void toggleStar(message); } }}
                                      aria-label={message.starred ? "Unstar" : "Star"}
                                      title={message.starred ? "Starred" : "Star"}
                                      className={`shrink-0 cursor-pointer transition-colors ${message.starred ? "text-[#F5A623]" : "text-[#5E5877] hover:text-[#B98CFF]"}`}
                                    >
                                      <FiStar className={`h-4 w-4 ${message.starred ? "fill-[#F5A623]" : ""}`} aria-hidden />
                                    </span>
                                    {/* Tracking status. Outbound (mail we sent, with our tracker)
                                        shows a green CHECK; incoming mail carrying someone else's
                                        beacon shows a DOT. Same 16px box as the checkbox and star
                                        so the gutter keeps a uniform pitch. */}
                                    <span
                                      className={`flex w-4 shrink-0 items-center justify-center ${
                                        message.tracked || incomingTracker?.tracked ? "email-tip" : ""
                                      }`}
                                      data-tip={
                                        message.tracked
                                          ? outboundTip
                                          : incomingTracker?.tracked
                                            ? `Incoming Tracker · ${
                                                incomingTracker.vendors.length
                                                  ? incomingTracker.vendors.join(", ")
                                                  : `${incomingTracker.count} Beacon${incomingTracker.count === 1 ? "" : "s"}`
                                              }`
                                            : undefined
                                      }
                                      aria-label={
                                        message.tracked
                                          ? openCount > 0
                                            ? "Tracked, opened by recipient"
                                            : "Tracked, not yet opened"
                                          : incomingTracker?.tracked
                                            ? "Contains a tracking pixel"
                                            : undefined
                                      }
                                    >
                                      {message.tracked ? (
                                        <FiCheck
                                          className={`h-3.5 w-3.5 ${openCount > 0 ? "text-[#22C55E]" : "text-[#6F6889]"}`}
                                          aria-hidden
                                        />
                                      ) : incomingTracker?.tracked ? (
                                        <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E]" />
                                      ) : null}
                                    </span>
                                  </span>

                                  {/* Sender */}
                                  <span
                                    className={`min-w-0 truncate text-[13px] ${
                                      message.unread ? "font-semibold text-white" : "font-normal text-[#A8A2C0]"
                                    }`}
                                  >
                                    {message.isComposeDraft ? (
                                      <>
                                        <span className="mr-1 font-medium text-[#F87171]">(Draft)</span>
                                        {draftSenderLabel ? <span>{draftSenderLabel}</span> : null}
                                      </>
                                    ) : (
                                      senderOrTo
                                    )}
                                  </span>

                                  {/* Subject leads, snippet trails in a quieter tone. */}
                                  <span className="flex min-w-0 items-center gap-2">
                                    <span className="min-w-0 truncate text-[13px]">
                                      <span className={message.unread ? "font-semibold text-white" : "font-normal text-[#CFC9E0]"}>
                                        {message.subject || "(No Subject)"}
                                      </span>
                                      <span className="font-normal text-[#7E7897]">
                                        {"  "}
                                        {message.snippet || "No preview available."}
                                      </span>
                                    </span>
                                  </span>

                                  {/* Attachment marker + time */}
                                  <span className="flex shrink-0 items-center justify-end gap-1.5">
                                    {incomingTracker?.hasMeetingInvite ? (
                                      <span className="email-tip flex items-center text-[#8F88A8]" data-tip="Meeting invite" aria-label="Meeting invite">
                                        <FiCalendar className="h-3.5 w-3.5" aria-hidden />
                                      </span>
                                    ) : null}
                                    {incomingTracker?.hasAttachment ? (
                                      <span className="email-tip flex items-center text-[#8F88A8]" data-tip="Has attachment" aria-label="Has attachment">
                                        <FiPaperclip className="h-3.5 w-3.5" aria-hidden />
                                      </span>
                                    ) : null}
                                  <span
                                    className={`shrink-0 pl-2 text-right text-[11px] tabular-nums ${
                                      message.unread ? "font-medium text-[#C6C0DA]" : "font-normal text-[#7E7897]"
                                    }`}
                                  >
                                    {formatDate(message.timestamp, message.date)}
                                  </span>
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                    </>
                  ) : (
                    <div className="h-full flex flex-col">
                      <div className="px-5 py-3 border-b border-white/30 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => setViewMode("list")}
                          className="inline-flex items-center gap-2 text-sm font-medium text-[#4A465C] hover:text-[#701CC0]"
                          title="Back"
                        >
                          <FiChevronsRight className="w-4 h-4 rotate-180" />
                          Back
                        </button>
                        <div className="flex flex-wrap items-center gap-2">
                          {/* The same three actions as at the foot of the message. Both places are
                              wanted: the toolbar is where they are reached for out of habit, the
                              foot is where they belong while reading. */}
                          <button
                            type="button"
                            onClick={() => {
                              void compose.openReplyCompose();
                            }}
                            className={`${ICON_BUTTON} email-tip`}
                            aria-label="Reply"
                            data-tip="Reply"
                          >
                            <FiCornerUpLeft className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void compose.openReplyAllCompose();
                            }}
                            className={`${ICON_BUTTON} email-tip`}
                            aria-label="Reply All"
                            data-tip="Reply All"
                          >
                            <MdReplyAll className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void compose.openForwardCompose();
                            }}
                            className={`${ICON_BUTTON} email-tip`}
                            aria-label="Forward"
                            data-tip="Forward"
                          >
                            <FiSend className="w-4 h-4" />
                          </button>


                          {/* Every shared action in the same order as the
                              list toolbar (star, spam, trash, read, move, archive, snooze), so the
                              two toolbars are not two different sequences of the same icons.
                              Reader-only actions (label, block) come last. */}
                          <button
                            type="button"
                            onClick={() => (deletesPermanently ? setConfirmHardDelete(true) : applyAction("trash"))}
                            className={`${ICON_BUTTON} email-tip`}
                            aria-label={deletesPermanently ? "Delete Permanently" : "Move To Trash"}
                            data-tip={deletesPermanently ? "Delete Permanently" : "Move To Trash"}
                          >
                            <FiTrash2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => applyAction("markUnread")}
                            className={`${ICON_BUTTON} email-tip`}
                            aria-label="Mark As Unread"
                            data-tip="Mark As Unread"
                          >
                            <FiMail className="w-4 h-4" />
                          </button>
                          {/* Hidden wherever moving between mailboxes is meaningless — see
                              allowsMailboxMoves. */}
                          <div ref={moveMessageMenuRef} className={`relative ${allowsMailboxMoves ? "" : "hidden"}`}>
                            <button
                              type="button"
                              onClick={() => setMoveMenuOpen((prev) => (prev === "message" ? null : "message"))}
                              className={`${ICON_BUTTON} email-tip`}
                              aria-label="Move To"
                              data-tip="Move To"
                            >
                              <FiMove className="w-4 h-4" />
                            </button>
                            {moveMenuOpen === "message" ? (
                              <MoveToMenu options={moveToOptions} onSelect={handleMoveToChange} keyPrefix="message-move" />
                            ) : null}
                          </div>
                          {allowsMailboxMoves ? (
                            <button
                              type="button"
                              onClick={() => applyAction(activeModule === "archive" ? "moveToInbox" : "archive")}
                              className={`${ICON_BUTTON} email-tip`}
                              aria-label={activeModule === "archive" ? "Unarchive" : "Archive"}
                              data-tip={activeModule === "archive" ? "Unarchive" : "Archive"}
                            >
                              <FiArchive className="w-4 h-4" />
                            </button>
                          ) : null}
                          {/* After Archive, before Snooze — matching the list toolbar's order.
                              These must stay DIRECT children of the row: nested inside snooze's
                              `relative` dropdown anchor (display:block, no gap) they rendered
                              flush against each other while every other joint had 6px, which is
                              what the uneven spacing was. */}
                          {selectedMessage ? (
                            <button
                              type="button"
                              onClick={() => void toggleStar(selectedMessage)}
                              className={`${ICON_BUTTON} email-tip`}
                              aria-label={selectedMessage.starred ? "Unstar" : "Star"}
                              data-tip={selectedMessage.starred ? "Unstar" : "Star"}
                            >
                              <FiStar className={`w-4 h-4 ${selectedMessage.starred ? "fill-[#F5A623] text-[#F5A623]" : ""}`} />
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => applyAction(spamActionType)}
                            className={`${ICON_BUTTON} email-tip`}
                            aria-label={spamActionTitle}
                            data-tip={spamActionTitle}
                          >
                            <FiAlertCircle className="w-4 h-4" />
                          </button>
                          {/* Snooze existed only on the list, so an open message had to be closed to
                              snooze it. Same presets, same menu, same dismissal. */}
                          <div ref={snoozeMenuRef} className="relative">
                            <button
                              type="button"
                              onClick={() => setSnoozeMenuOpen((open) => !open)}
                              className={`${ICON_BUTTON} email-tip`}
                              aria-label="Snooze"
                              data-tip="Snooze"
                            >
                              <FiClock className="w-4 h-4" />
                            </button>
                            {snoozeMenuOpen ? (
                              <div className="email-menu absolute right-0 top-[calc(100%+6px)] z-20 w-44">
                                {(
                                  [
                                    ["later", "Later today"],
                                    ["tomorrow", "Tomorrow"],
                                    ["nextweek", "Next week"],
                                  ] as const
                                ).map(([preset, label]) => (
                                  <button
                                    key={preset}
                                    type="button"
                                    onClick={() => snoozeSelected(preset)}
                                    className="email-menu-item block w-full px-2.5 py-[7px] text-left text-[12.5px] font-medium"
                                  >
                                    {label}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>


                          {/* Label: ref-scoped like every other menu here. It previously had no ref,
                              so clicking outside it or changing view left it hanging open, and it was
                              styled by hand instead of with the shared menu classes. */}
                          <div ref={labelMenuRef} className="relative">
                            <button
                              type="button"
                              onClick={() => setLabelMenuOpen((open) => !open)}
                              className={`${ICON_BUTTON} email-tip`}
                              aria-label="Label"
                              data-tip="Label"
                            >
                              <FiTag className="w-4 h-4" />
                            </button>
                            {labelMenuOpen ? (
                              <div className="email-menu absolute right-0 top-[calc(100%+6px)] z-20 max-h-64 min-w-[180px] overflow-y-auto">
                                {labels.length === 0 ? (
                                  <div className="px-2.5 py-[7px] text-[12.5px] text-[#847FA0]">No labels yet.</div>
                                ) : (
                                  labels.map((label) => (
                                    <button
                                      key={`apply-${label.id}`}
                                      type="button"
                                      onClick={() => applyLabelToMessage(label.id)}
                                      className="email-menu-item flex w-full items-center gap-2.5 px-2.5 py-[7px] text-left text-[12.5px] font-medium"
                                    >
                                      <FiTag className="h-3.5 w-3.5 shrink-0" />
                                      <span className="truncate">{label.name}</span>
                                    </button>
                                  ))
                                )}
                              </div>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={blockSelectedSender}
                            className={`${ICON_BUTTON} email-tip`}
                            aria-label={selectedBlockedEntry ? "Unblock Sender" : "Block Sender"}
                            data-tip={selectedBlockedEntry ? "Unblock Sender" : "Block Sender"}
                          >
                            <FiX className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {selectedMessage ? (
                        <div className="flex-1 overflow-y-auto px-6 pt-5 pb-10">
                          <h2 className="text-[22px] font-semibold tracking-tight text-[#1E1B2E]">{selectedMessage.subject || "(No Subject)"}</h2>
                          <div className="mt-4 flex items-start gap-3">
                            {senderAvatar ? (
                              // Deliberately a plain <img>, not next/image: the optimizer rejects any
                              // host absent from images.remotePatterns (Google serves contact photos
                              // from lh3.googleusercontent.com), and those URLs 403 when a referrer
                              // is sent. onError advances to the next candidate — contact photo,
                              // Gravatar, then company favicon — and initials show once they run out.
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                key={senderAvatar.url}
                                src={senderAvatar.url}
                                alt=""
                                width={40}
                                height={40}
                                referrerPolicy="no-referrer"
                                loading="eager"
                                decoding="async"
                                onError={() => setSenderAvatarIndex((i) => i + 1)}
                                /* Fills the circle. Padding a logo inside it left a small mark
                                   floating in a white ring, which read as a half-loaded image;
                                   sources here are square, so cover crops nothing meaningful. */
                                className="h-10 w-10 shrink-0 rounded-full border border-[#E5E7EB] bg-white object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-[#ECE3FF] text-[#5B21B6] border border-[#E5E7EB] flex items-center justify-center text-sm font-semibold">
                                {getInitials(selectedMessageDetail?.fromRaw || selectedMessage.fromRaw || selectedMessage.from)}
                              </div>
                            )}
                            <div className="text-xs text-[#6B7280] space-y-1">
                              <p>From: {formatIdentity(selectedMessageDetail?.fromRaw || selectedMessage.fromRaw || selectedMessage.from || "-")}</p>
                              <p>To: {formatIdentity(selectedMessageDetail?.toRaw || selectedMessage.toRaw || selectedMessage.to || "-")}</p>
                              <p className="flex items-center gap-1">
                                {selectedMessageDetail?.meetingInvite ? (
                                  <FiCalendar
                                    className="h-3 w-3 text-[#701CC0]"
                                    aria-label="This email carries a meeting invite"
                                    title="This email carries a meeting invite"
                                  />
                                ) : null}
                                {formatDetailedDate(selectedMessageDetail?.timestamp || selectedMessage.timestamp, selectedMessageDetail?.date || selectedMessage.date)}
                              </p>
                              {(() => {
                                const { count: trackers, vendors } =
                                  selectedMessageDetail?.trackers ?? detectTrackers(selectedMessageDetail?.bodyHtml || "");
                                if (trackers === 0) return null;
                                const label = vendors.length
                                  ? `${vendors.slice(0, 2).join(", ")}${vendors.length > 2 ? ` +${vendors.length - 2}` : ""} Tracker${trackers === 1 ? "" : "s"} Blocked`
                                  : `${trackers} Tracker${trackers === 1 ? "" : "s"} Blocked`;
                                return (
                                  <p>
                                    <span
                                      className="-ml-2 inline-flex items-center gap-1.5 rounded-md bg-[#F5EFFF] px-2 py-0.5 text-[11px] font-semibold text-[#701CC0]"
                                      title={
                                        vendors.length
                                          ? `Detected ${vendors.join(", ")} tracking. Remote pixels were blocked, so the sender can't tell you opened this.`
                                          : "Remote tracking pixels were blocked, so the sender can't tell you opened this."
                                      }
                                    >
                                      <FiShield className="w-3 h-3" aria-hidden /> {label}
                                    </span>
                                  </p>
                                );
                              })()}
                            </div>
                          </div>
                          <div className="mt-5 border-t border-[#EFEFEF] pt-5">
                            {detailLoading ? (
                              <MailboxLoader label="Loading Message..." />
                            ) : detailError ? (
                              <p className="text-sm text-red-600">{detailError}</p>
                            ) : (
                              <div className="space-y-4">
                                {selectedMessageDetail?.meetingInvite ? (
                                  <MeetingInviteCard
                                    invite={selectedMessageDetail.meetingInvite}
                                    accountEmail={selectedMessage.accountEmail}
                                    messageId={selectedMessage.id}
                                    onResponded={(response) =>
                                      setSelectedMessageDetail((prev) =>
                                        prev?.meetingInvite ? { ...prev, meetingInvite: { ...prev.meetingInvite, myResponse: response } } : prev
                                      )
                                    }
                                  />
                                ) : null}
                                {/* `email-body-card` keeps the sender's own HTML on a light surface —
                                    that markup is authored for white backgrounds, so the panel's
                                    dark theme deliberately stops at this boundary. */}
                                {threadMessages.map((threadMessage, index) => (
                                  <div key={`${threadMessage.id || index}`} className="email-body-card rounded-2xl border border-white/70 bg-white/70 p-5">
                                    {threadMessage.bodyHtml ? (
                                      <div
                                        className="email-body text-[14px] leading-[1.65]"
                                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(threadMessage.bodyHtml) }}
                                      />
                                    ) : (
                                      <div className="email-body whitespace-pre-wrap text-[14px] leading-[1.65]">
                                        {threadMessage.bodyText || threadMessage.snippet || "No message content available."}
                                      </div>
                                    )}
                                  </div>
                                ))}

                                {/* Reply / Reply all / Forward sit with the message, the way Gmail
                                    puts them at the foot of the conversation rather than in the
                                    window chrome — the reply you are about to write belongs to this
                                    message, so the control for it belongs next to it. Hidden while a
                                    composer is open, since the composer already is that action. */}
                                <InlineReply compose={compose} />
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center text-sm text-[#6B7280]">No email selected.</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}


      <ComposeWindow compose={compose} />
      <ContactsModals contacts={contacts} />
      {showShortcutsHelp && <KeyboardShortcutsModal onClose={() => setShowShortcutsHelp(false)} />}

      <SuccessStatusModal
        isOpen={blockSuccessModal.open}
        title={blockSuccessModal.title}
        message={blockSuccessModal.message}
        onClose={() => setBlockSuccessModal({ open: false, title: "", message: "" })}
        buttonLabel="Done"
      />
      <ConfirmActionModal
        isOpen={confirmHardDelete}
        title="Delete Permanently"
        message={
          <>
            {selectedRows.length > 1 ? (
              <>
                Permanently delete <span className="font-semibold text-white">{selectedRows.length} emails</span>?
              </>
            ) : (
              <>Permanently delete this email?</>
            )}{" "}
            They will not go to Trash and this cannot be undone.
          </>
        }
        confirmLabel="Delete Permanently"
        danger
        dark
        onCancel={() => setConfirmHardDelete(false)}
        onConfirm={() => {
          setConfirmHardDelete(false);
          void applyAction("deletePermanently");
        }}
      />
      <ConfirmActionModal
        isOpen={Boolean(labelToDelete)}
        title="Delete Label"
        message={
          <>
            Are you sure you want to delete{" "}
            <span className="font-semibold text-white">{labelToDelete?.name || "this label"}</span>? Messages keep their
            content.
          </>
        }
        confirmLabel={deletingLabel ? "Deleting..." : "Delete Label"}
        dark
        onCancel={() => {
          if (deletingLabel) return;
          setLabelToDelete(null);
        }}
        onConfirm={() => void confirmDeleteLabel()}
      />
      {/* Shares the panel-wide PromptModal so it matches the site's dialog styling. */}
      <PromptModal
        open={Boolean(labelToRename)}
        title="Rename Label"
        fields={[{ name: "name", placeholder: "Label Name", required: true, maxLength: 100, defaultValue: labelToRename?.name || "" }]}
        confirmLabel="Save"
        busyLabel="Saving..."
        dark
        busy={renamingLabel}
        onCancel={() => {
          if (!renamingLabel) setLabelToRename(null);
        }}
        onSubmit={(values) => {
          if (labelToRename) void renameLabel(labelToRename.id, values.name);
        }}
      />
      <PromptModal
        open={newLabelModalOpen}
        title="New Label"
        fields={[{ name: "name", placeholder: "Label Name", required: true, maxLength: 100 }]}
        confirmLabel="Create Label"
        busyLabel="Creating..."
        dark
        busy={creatingLabel}
        onCancel={() => {
          if (!creatingLabel) setNewLabelModalOpen(false);
        }}
        onSubmit={(values) => {
          setNewLabelName(values.name);
          void submitNewLabel(values.name);
        }}
      />
      {sentToast ? (
        <div
          className="fixed bottom-6 left-6 z-[220] flex max-w-sm items-center gap-3 rounded-lg border border-[#701CC0]/40 bg-[#701CC0] px-4 py-3 text-sm font-medium text-white shadow-lg shadow-[#701CC0]/30"
          role="status"
          aria-live="polite"
        >
          <FiCheck className="h-5 w-5 shrink-0 text-white" aria-hidden />
          <span>{sentToast.message}</span>
          {sentToast.undo ? (
            <button
              type="button"
              className="ml-1 shrink-0 rounded-md border border-white/40 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-white/10"
              onClick={() => {
                sentToast.undo?.();
                if (sentToastTimerRef.current) clearTimeout(sentToastTimerRef.current);
                setSentToast(null);
              }}
            >
              Undo
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default EmailingPlatformSection;
