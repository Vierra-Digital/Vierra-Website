import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EMAIL_REGEX } from "@/lib/utils";
import { toContactsCsv, type CsvContactRowWithMeta } from "@/lib/contacts/csv";
import { Geist } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { FaGoogle } from "react-icons/fa";
import {
  FiAlertCircle,
  FiArchive,
  FiCheckSquare,
  FiCheck,
  FiChevronDown,
  FiClock,
  FiLock,
  FiChevronsRight,
  FiCornerUpLeft,
  FiDownload,
  FiCalendar,
  FiEdit3,
  FiFeather,
  FiFilter,
  FiFileText,
  FiImage,
  FiLink,
  FiPaperclip,
  FiPrinter,
  FiMail,
  FiMaximize2,
  FiMinimize2,
  FiMoreVertical,
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
  FiZap,
  FiTag,
  FiUpload,
  FiUserPlus,
  FiTrash2,
  FiType,
  FiUsers,
  FiX,
} from "react-icons/fi";
// Feather has no reply-all glyph; two overlapping arrows read as a smudge at 16px. Material's
// is the same double-arrow Gmail uses.
import { MdReplyAll } from "react-icons/md";
import RowActionMenu, { RowActionMenuItem } from "@/components/ui/RowActionMenu";
import SuccessStatusModal from "@/components/ui/SuccessStatusModal";
import ConfirmActionModal from "@/components/ui/ConfirmActionModal";
import PromptModal from "@/components/ui/PromptModal";
import { MdRefresh } from "react-icons/md";
import { scoreTrackerImage } from "@/lib/email/trackerDetection";

import { isSafeEmailHref, stripRemoteUrlsFromStyle, UNSAFE_EMAIL_TAG_SELECTOR } from "@/lib/email/htmlSafety";
import type { ComposeRichEditorHandle } from "@/components/email/ComposeRichEditor";
import { printComposeContent } from "@/components/email/printCompose";
import { getJson } from "@/lib/email/panelApi";
import BrandLoadingScreen from "@/components/ui/BrandLoadingScreen";
import MoveToMenu from "@/components/email/MoveToMenu";
import { buildReplyReferences } from "@/lib/email/threading";
import {
  BRAND_LOGO,
  ICON_BUTTON, FIELD_LABEL, ALERT, REPLY_ACTION_BUTTON,
} from "@/components/email/emailTheme";
import {
  PAGE_SIZE,
  CONTACTS_PAGE_SIZE,
  COMPOSE_NEUTRAL_SCROLLBAR,
  validateRecipientCsv,
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
  ContactTag,
  ContactRow,
  ContactVisibility,
  ProviderAccount,
  BlockedSenderRow,
  LocalEmailDraft,
} from "@/components/email/types";

// Site brand font (matches vierradev.com); replaces the panel's former Inter.
const panelFont = Geist({ subsets: ["latin"] });

type ContactsImportIssueRow = CsvContactRowWithMeta & {
  reasons: string[];
  saving?: boolean;
};

const ISSUE_EDITABLE_FIELDS = ["firstName", "lastName", "email", "phone", "business", "website", "address", "tags"] as const;
const ISSUE_FIELD_LABELS: Record<(typeof ISSUE_EDITABLE_FIELDS)[number], string> = {
  firstName: "First Name",
  lastName: "Last Name",
  email: "Email",
  phone: "Phone",
  business: "Business",
  website: "Website",
  address: "Address",
  tags: "Tags",
};

/** Format a Date as a `<input type="datetime-local">` value in the viewer's local timezone. */
function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

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

// Lazy-load the compose editor (~13 @tiptap/* packages — a real chunk of the panel's Script
// Evaluation time) so it's fetched/parsed/evaluated only when the user actually opens
// compose/reply, not on every inbox load. printComposeContent is a plain window.print() helper
// with no TipTap dependency, split into its own module (components/email/printCompose.ts) so
// importing it here doesn't drag the editor bundle back in as a side effect.
const ComposeRichEditor = dynamic(() => import("@/components/email/ComposeRichEditor"), {
  ssr: false,
  loading: () => (
    <div className="h-full min-h-[200px] flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-4 border-[#E9D4FB] border-t-[#701CC0] motion-safe:animate-spin" />
    </div>
  ),
});

// Lazy-load the PDF sign modal — only needed for the rare "sign this attachment" action.
const SignPdfModal = dynamic(() => import("@/components/email/SignPdfModal"), { ssr: false });
type EmailingPlatformSectionProps = {
  initialSelectedAccounts?: string[];
  /** Gmail thread id to auto-open (the whole conversation) once the inbox loads — deep link, e.g. from a Discord alert. */
  initialOpenThreadId?: string;
};

const MailboxLoader: React.FC<{ label?: string }> = ({ label = "Loading messages..." }) => (
  <div className="h-full min-h-[320px] flex items-center justify-center px-6">
    <div className="text-center">
      <div className="mx-auto w-12 h-12 rounded-full border-4 border-[#E9D4FB] border-t-[#701CC0] motion-safe:animate-spin" />
      <p className="mt-4 text-sm font-medium text-[#5B5E73]">{label}</p>
    </div>
  </div>
);

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

// Client-side cap on total compose attachment bytes. Kept conservative (below the server/platform
// request-body limit) so oversized sends fail fast with a clear message instead of an opaque 413.
/**
 * Total attachment bytes accepted before sending, measured decoded.
 *
 * The ceiling is the serverless request-body limit, not Gmail: API routes run as functions with a
 * 6 MB payload cap, and base64 inflates a file by a third, so 4 MB of files is about 5.4 MB on the
 * wire with room for the rest of the JSON. This was 20 MB — which encodes to roughly 27 MB — so a
 * large attachment passed this check and then failed at the platform, surfacing as a bare
 * "Failed to send." with nothing pointing at the size.
 */
const MAX_TOTAL_ATTACHMENT_BYTES = 4 * 1024 * 1024;

/**
 * Cap on a mailbox action (trash, archive, move…). Comfortably above a normal Gmail round trip but
 * well under the serverless function limit, so a stalled upstream surfaces as a clear message
 * rather than a spinner that never ends.
 */
const ACTION_TIMEOUT_MS = 15_000;

/** How many mailbox views to keep in the message cache (each is up to PAGE_SIZE rows). */
const MESSAGE_CACHE_LIMIT = 12;

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

/**
 * "Help me write" bolt. The stroke draws itself on a loop rather than pulsing a filled glyph —
 * a filled icon can only fade or scale, which reads as a notification badge, not as writing.
 * Drafting speeds the draw up and brightens it.
 */
const BoltDraw: React.FC<{ className?: string; drafting?: boolean }> = ({ className, drafting }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden focusable="false">
    <path
      d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={drafting ? "bolt-draw is-drafting" : "bolt-draw"}
    />
  </svg>
);

/** Google Drive mark, inline so the button carries the real logo without a remote fetch. */
const DriveMark: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 87.3 78" className={className} aria-hidden focusable="false">
    <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
    <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47" />
    <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335" />
    <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
    <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" />
    <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
  </svg>
);

/**
 * Compose footer icon button. Gmail's composer is one row of quiet, chrome-less icons with a
 * single solid Send — so an "on" toggle (Confidential, Receipt, a set schedule) reads as a soft
 * brand-tinted disc rather than an outlined box, which is what made the old bar look blocky.
 */
const composeIconClass = (active = false) =>
  `inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors duration-150 disabled:pointer-events-none disabled:opacity-35 ${
    active ? "bg-[#701CC0]/18 text-[#C8A6F5]" : "text-[#9C95B8] hover:bg-white/[0.07] hover:text-[#E7E2F5]"
  }`;

/** Row in the compose "More options" menu. */
const composeMenuItemClass =
  "flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] font-medium text-[#D8D3EA] transition-colors duration-150 hover:bg-white/[0.06] disabled:pointer-events-none disabled:opacity-40";

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
    Record<string, { tracked: boolean; count: number; vendors: string[]; hasAttachment?: boolean }>
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

  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeCc, setComposeCc] = useState("");
  const [composeBcc, setComposeBcc] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeBodyHtml, setComposeBodyHtml] = useState("");
  const [composeAttachments, setComposeAttachments] = useState<
    Array<{ id: string; filename: string; contentType: string; contentBase64: string }>
  >([]);
  const [signModalOpen, setSignModalOpen] = useState(false);
  const [composeBookingLinks, setComposeBookingLinks] = useState<Array<{ id: string; slug: string; title: string }>>([]);
  const [bookingMenuOpen, setBookingMenuOpen] = useState(false);
  const [composeTemplates, setComposeTemplates] = useState<
    Array<{ id: string; name: string; subject: string | null; bodyHtml: string | null; bodyText: string | null }>
  >([]);
  // Set when a brand-new compose opens (openNewCompose) so the signatures effect appends the
  // account's default signature once — never on replies/drafts (their body is pre-filled).
  const composeInsertDefaultSigRef = useRef(false);
  const [composeSignatures, setComposeSignatures] = useState<
    Array<{ id: string; name: string; signatureHtml: string | null; signatureText: string | null; isDefault: boolean }>
  >([]);
  const [saveTemplateModalOpen, setSaveTemplateModalOpen] = useState(false);
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
  const [artemisPromptOpen, setArtemisPromptOpen] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState("");
  const [saveTemplateSaving, setSaveTemplateSaving] = useState(false);
  const composeEditorRef = useRef<ComposeRichEditorHandle | null>(null);
  const composeAttachInputRef = useRef<HTMLInputElement | null>(null);
  const [composeFormattingToolbarOpen, setComposeFormattingToolbarOpen] = useState(false);
  const [composeAccountEmail, setComposeAccountEmail] = useState("");
  const [composeFrom, setComposeFrom] = useState("");
  const [composeAliases, setComposeAliases] = useState<
    Array<{ email: string; displayName: string; isPrimary: boolean; accountEmail: string }>
  >([]);
  const [composeThreadId, setComposeThreadId] = useState("");
  const [composeInReplyTo, setComposeInReplyTo] = useState("");
  const [composeReferences, setComposeReferences] = useState("");
  const [sendingCompose, setSendingCompose] = useState(false);
  const [undoCountdown, setUndoCountdown] = useState<number | null>(null);
  /** Scheduled send: ISO-ish `datetime-local` value; empty = send now. */
  const [scheduleAt, setScheduleAt] = useState("");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  /** Compose overflow menu (Gmail's "⋮ More options") — holds the insert/print actions. */
  const [composeMoreOpen, setComposeMoreOpen] = useState(false);
  /** Confidential mode: send an access-controlled link instead of the raw body. */
  const [confidentialOn, setConfidentialOn] = useState(false);
  const [confidentialExpiry, setConfidentialExpiry] = useState<"1d" | "1w" | "1m" | "never">("1w");
  const [confidentialPasscode, setConfidentialPasscode] = useState("");
  const [confidentialOpen, setConfidentialOpen] = useState(false);
  /** Request a read receipt (Disposition-Notification-To) on send. */
  const [requestReceipt, setRequestReceipt] = useState(false);
  // Set on a brand-new compose so the settings effect can apply this inbox's read-receipt default
  // once — never on replies/drafts, and the user can still toggle it off.
  const composeReadReceiptDefaultRef = useRef(false);
  const undoSendTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /**
   * The message waiting out its undo window, as a request body.
   *
   * Undo used to live entirely in a setTimeout, and the unmount cleanup cleared it — so closing the
   * tab or navigating away within the undo window (up to 30s) silently threw the email away. It was
   * not queued anywhere and no draft survived it. Held here so it can be flushed on the way out.
   */
  const pendingSendBodyRef = useRef<string | null>(null);
  const [artemisDrafting, setArtemisDrafting] = useState(false);
  const [artemisRewriteOpen, setArtemisRewriteOpen] = useState(false);
  const [composeError, setComposeError] = useState("");
  const [composeSuccess, setComposeSuccess] = useState("");
  const [sentToastMessage, setSentToastMessage] = useState<string | null>(null);
  const sentToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [composeExpanded, setComposeExpanded] = useState(false);
  const [composeActiveDraftKey, setComposeActiveDraftKey] = useState("");
  const [inlineComposeMode, setInlineComposeMode] = useState<null | "reply" | "replyAll" | "forward">(null);
  const [inlineComposeTo, setInlineComposeTo] = useState("");
  /** Cc/Bcc on the inline reply. Gmail keeps them one click from the recipient line. */
  const [inlineComposeCc, setInlineComposeCc] = useState("");
  const [inlineComposeBcc, setInlineComposeBcc] = useState("");
  const [inlineShowCc, setInlineShowCc] = useState(false);
  /** Gmail shows the recipient as text; it only becomes a field once you click it. */
  const [inlineToEditing, setInlineToEditing] = useState(false);
  /** Formatting bar is opt-in, as in Gmail — the "Aa" toggle in the send row reveals it. */
  const [inlineShowFormatting, setInlineShowFormatting] = useState(false);
  const [inlineShowBcc, setInlineShowBcc] = useState(false);
  /** Inline reply overflow menu — switches reply mode, as Gmail's does. */
  const [inlineMoreOpen, setInlineMoreOpen] = useState(false);
  const [inlineComposeSubject, setInlineComposeSubject] = useState("");
  const [inlineComposeIntroText, setInlineComposeIntroText] = useState("");
  /** Rich-text form of the reply body. Plain text stays in sync for the text/plain part. */
  const [inlineComposeIntroHtml, setInlineComposeIntroHtml] = useState("");
  const inlineEditorRef = useRef<ComposeRichEditorHandle | null>(null);
  const [inlineComposeBodyText, setInlineComposeBodyText] = useState("");
  const [inlineComposeBodyHtml, setInlineComposeBodyHtml] = useState("");
  const [inlineComposePreviewHtml, setInlineComposePreviewHtml] = useState("");
  const [inlineComposeThreadId, setInlineComposeThreadId] = useState("");
  const [inlineComposeInReplyTo, setInlineComposeInReplyTo] = useState("");
  const [inlineComposeReferences, setInlineComposeReferences] = useState("");
  const [inlineComposeSending, setInlineComposeSending] = useState(false);
  const [inlineComposeError, setInlineComposeError] = useState("");
  const [inlineComposeSuccess, setInlineComposeSuccess] = useState("");
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
  const [contactsImportSuccessOpen, setContactsImportSuccessOpen] = useState(false);
  const [contactsImportIssuesModal, setContactsImportIssuesModal] = useState<{
    open: boolean;
    imported: number;
    skipped: number;
    headerErrors: string[];
    rowErrors: ContactsImportIssueRow[];
  }>({
    open: false,
    imported: 0,
    skipped: 0,
    headerErrors: [],
    rowErrors: [],
  });
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsError, setContactsError] = useState("");
  const [contactCurrentPage, setContactCurrentPage] = useState(1);
  const [contactsTotalPages, setContactsTotalPages] = useState(1);
  const [contactsTotalCount, setContactsTotalCount] = useState(0);
  const [contactsTags, setContactsTags] = useState<ContactTag[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [debouncedContactSearch, setDebouncedContactSearch] = useState("");
  const [contactTagFilter, setContactTagFilter] = useState("");
  const [contactSourceFilter, setContactSourceFilter] = useState<"" | "MANUAL" | "GMAIL" | "CSV">("");
  const [contactFilterOpen, setContactFilterOpen] = useState(false);
  const [isAddContactModalOpen, setIsAddContactModalOpen] = useState(false);
  const [addContactForm, setAddContactForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    business: "",
    website: "",
    address: "",
  });
  const [addingContact, setAddingContact] = useState(false);
  const [addContactError, setAddContactError] = useState("");
  const [addContactFirstNameTouched, setAddContactFirstNameTouched] = useState(false);
  const [isEditContactModalOpen, setIsEditContactModalOpen] = useState(false);
  const [editingContactId, setEditingContactId] = useState("");
  const [editContactForm, setEditContactForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    business: "",
    website: "",
    address: "",
  });
  const [editingContact, setEditingContact] = useState(false);
  const [editContactError, setEditContactError] = useState("");
  const [editContactTouched, setEditContactTouched] = useState({
    firstName: false,
    email: false,
    phone: false,
    website: false,
  });
  const [contactToDelete, setContactToDelete] = useState<ContactRow | null>(null);
  const [deletingContact, setDeletingContact] = useState(false);
  const [contactsVisibility, setContactsVisibility] = useState<ContactVisibility>({
    showPhone: true,
    showBusiness: true,
    showWebsite: true,
  });
  const [providerAccounts, setProviderAccounts] = useState<ProviderAccount[]>([]);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const loadMessagesRequestRef = useRef(0);
  const loadContactsRequestRef = useRef(0);
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
  const contactFilterMenuRef = useRef<HTMLDivElement | null>(null);
  const inlineComposeRef = useRef<HTMLDivElement | null>(null);
  const editContactModalRef = useRef<HTMLDivElement | null>(null);

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
  const activeAccountForContacts = selectedAccounts[0] || "";

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

  // Lightweight pre-send deliverability lint — proactive warnings shown in the composer.
  // Deliverability guardrail (#2): check the sending domain's SPF/DMARC when compose opens.
  const [composeDeliverability, setComposeDeliverability] = useState<{ spfOk: boolean; dmarcOk: boolean } | null>(null);
  /**
   * Recipients that failed verification (bad syntax, or a domain with no MX records).
   *
   * /api/gmail/verify-email has existed for a while with nothing calling it, so a typo in a
   * recipient was only discovered by the bounce. Checked while composing, reported as a warning
   * rather than a block — a valid address can still look unverifiable to a DNS lookup.
   */
  const [composeBadRecipients, setComposeBadRecipients] = useState<string[]>([]);
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


  // Verify recipients as they are typed. Debounced, because this runs a DNS lookup per address,
  // and skipped entirely while the field is empty or the composer is shut.
  useEffect(() => {
    if (!isComposeOpen) {
      setComposeBadRecipients([]);
      return;
    }
    const addresses = composeTo
      .split(/[,;]/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.includes("@"));
    if (addresses.length === 0) {
      setComposeBadRecipients([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      fetch("/api/gmail/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: addresses.slice(0, 25) }),
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((payload) => {
          if (cancelled || !payload) return;
          const results = Array.isArray(payload?.results) ? payload.results : [];
          setComposeBadRecipients(
            results
              // "error" means the lookup itself failed (timeout, resolver trouble), which says
              // nothing about the address — only report addresses actually judged bad.
              .filter((entry: { valid?: boolean; reason?: string }) => entry?.valid === false && entry?.reason !== "error")
              .map((entry: { email?: string }) => String(entry?.email || ""))
              .filter(Boolean)
          );
        })
        .catch(() => {
          /* verification is advisory; never block composing on it */
        });
    }, 600);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [composeTo, isComposeOpen]);

  useEffect(() => {
    if (!isComposeOpen || !composeAccountEmail) {
      setComposeDeliverability(null);
      return;
    }
    const domain = composeAccountEmail.split("@")[1];
    if (!domain) return;
    let cancelled = false;
    fetch(`/api/gmail/deliverability?domain=${encodeURIComponent(domain)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) setComposeDeliverability({ spfOk: Boolean(d?.spf?.found), dmarcOk: Boolean(d?.dmarc?.found) });
      })
      .catch(() => {
        /* non-blocking */
      });
    return () => {
      cancelled = true;
    };
  }, [isComposeOpen, composeAccountEmail]);

  const composeLintWarnings = useMemo(() => {
    const warnings: string[] = [];
    const subject = composeSubject || "";
    const body = (composeBody || "").toLowerCase();
    const letters = subject.replace(/[^a-zA-Z]/g, "");
    const caps = subject.replace(/[^A-Z]/g, "");
    if (letters.length >= 6 && caps.length / letters.length > 0.7) {
      warnings.push("Subject is mostly capitals — can trip spam filters.");
    }
    if ((subject.match(/!/g) || []).length >= 2 || /\$\$\$|100% free|act now|risk-free/i.test(subject)) {
      warnings.push("Subject uses spammy punctuation or phrasing.");
    }
    const triggers = ["click here", "buy now", "act now", "limited time", "winner", "100% free", "no obligation", "risk-free", "guaranteed"];
    const hits = triggers.filter((t) => body.includes(t));
    if (hits.length) {
      warnings.push(`Spam-trigger phrase${hits.length > 1 ? "s" : ""}: "${hits.slice(0, 3).join('", "')}".`);
    }
    if (composeBadRecipients.length > 0) {
      const shown = composeBadRecipients.slice(0, 3).join(", ");
      warnings.push(
        `Can't verify ${composeBadRecipients.length === 1 ? "recipient" : "recipients"}: ${shown}${
          composeBadRecipients.length > 3 ? "…" : ""
        } — the address or its domain looks wrong.`
      );
    }
    if (composeDeliverability && (!composeDeliverability.spfOk || !composeDeliverability.dmarcOk)) {
      const gaps = [!composeDeliverability.spfOk && "SPF", !composeDeliverability.dmarcOk && "DMARC"].filter(Boolean).join(" & ");
      warnings.push(`Sending domain is missing ${gaps} — this can hurt inbox placement (see Settings → Deliverability).`);
    }
    return warnings;
  }, [composeSubject, composeBody, composeDeliverability, composeBadRecipients]);

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
  const emptyAddContactForm = {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    business: "",
    website: "",
    address: "",
  };

  const formatPhoneInput = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 10);
    if (!digits) return "";
    if (digits.length < 4) return `(${digits}`;
    if (digits.length < 7) return `(${digits.slice(0, 3)})-${digits.slice(3)}`;
    return `(${digits.slice(0, 3)})-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  const isPhoneValid = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return true;
    const digits = trimmed.replace(/\D/g, "");
    return digits.length === 10;
  };

  const isWebsiteValid = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return true;
    return /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?(?:\/[^\s]*)?$/i.test(trimmed);
  };

  const closeAddContactModal = () => {
    setAddContactError("");
    setAddContactFirstNameTouched(false);
    setAddContactForm(emptyAddContactForm);
    setIsAddContactModalOpen(false);
  };

  const closeEditContactModal = useCallback(() => {
    if (editingContact) return;
    setEditContactError("");
    setEditingContactId("");
    setEditContactTouched({
      firstName: false,
      email: false,
      phone: false,
      website: false,
    });
    setIsEditContactModalOpen(false);
  }, [editingContact]);

  const showSentToast = useCallback((message: string) => {
    setSentToastMessage(message);
    if (sentToastTimerRef.current) clearTimeout(sentToastTimerRef.current);
    sentToastTimerRef.current = setTimeout(() => {
      setSentToastMessage(null);
      sentToastTimerRef.current = null;
    }, 4500);
  }, []);

  useEffect(() => {
    return () => {
      if (sentToastTimerRef.current) clearTimeout(sentToastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    selectedMessageIdRef.current = selectedMessageId;
  }, [selectedMessageId]);

  useEffect(() => {
    if (!isEditContactModalOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (editContactModalRef.current && !editContactModalRef.current.contains(event.target as Node)) {
        closeEditContactModal();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [closeEditContactModal, isEditContactModalOpen]);

  const loadContactTags = useCallback(async () => {
    try {
      const result = await getJson("/api/contacts/tags");
      if (!result.ok) return;
      const payload = result.data as Record<string, unknown>;
      setContactsTags(Array.isArray(payload?.tags) ? payload.tags : []);
    } catch {
      setContactsTags([]);
    }
  }, []);

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

  const loadContactVisibility = useCallback(async () => {
    try {
      const query = new URLSearchParams();
      if (activeAccountForContacts) query.set("accountEmail", activeAccountForContacts);
      const result = await getJson(`/api/contacts/visibility?${query.toString()}`);
      if (!result.ok) return;
      const payload = result.data as { visibility?: Record<string, unknown> };
      const visibility = payload?.visibility || {};
      setContactsVisibility({
        showPhone: Boolean(visibility.showPhone ?? true),
        showBusiness: Boolean(visibility.showBusiness ?? true),
        showWebsite: Boolean(visibility.showWebsite ?? true),
      });
    } catch {
      setContactsVisibility({
        showPhone: true,
        showBusiness: true,
        showWebsite: true,
      });
    }
  }, [activeAccountForContacts]);

  const loadContacts = useCallback(async () => {
    if (step !== "client" || activeModule !== "contacts") return;
    // Reloads on every keystroke in the search box, so responses can land out of order and a stale
    // one would leave the table showing results for a query the user has already moved past.
    const requestId = ++loadContactsRequestRef.current;
    const isStale = () => requestId !== loadContactsRequestRef.current;
    setContactsLoading(true);
    setContactsError("");
    try {
      const query = new URLSearchParams({
        limit: String(CONTACTS_PAGE_SIZE),
        page: String(contactCurrentPage),
      });
      if (debouncedContactSearch) query.set("search", debouncedContactSearch);
      if (contactTagFilter) query.set("tagIds", contactTagFilter);
      if (contactSourceFilter) query.set("source", contactSourceFilter);
      // no-store: this reloads right after create/edit/delete/tag writes, and the
      // server's Cache-Control on this endpoint would otherwise serve the pre-write list.
      const response = await fetch(`/api/contacts?${query.toString()}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to load contacts.");
      }
      if (isStale()) return;
      setContacts(Array.isArray(payload?.contacts) ? payload.contacts : []);
      const pagination = payload?.pagination || {};
      const total = Number(pagination.total || 0);
      const totalPages = Number.isFinite(Number(pagination.totalPages))
        ? Math.max(1, Number(pagination.totalPages))
        : Math.max(1, Math.ceil(total / CONTACTS_PAGE_SIZE));
      setContactsTotalCount(total);
      setContactsTotalPages(totalPages);
    } catch (error) {
      if (isStale()) return;
      setContacts([]);
      setContactsTotalCount(0);
      setContactsTotalPages(1);
      setContactsError(error instanceof Error ? error.message : "Failed to load contacts.");
    } finally {
      if (!isStale()) setContactsLoading(false);
    }
  }, [activeModule, contactCurrentPage, debouncedContactSearch, contactSourceFilter, contactTagFilter, step]);

  const createContact = async () => {
    const firstName = addContactForm.firstName.trim();
    const email = addContactForm.email.trim();
    const emailValid = EMAIL_REGEX.test(email);
    const phoneValid = isPhoneValid(addContactForm.phone);
    const websiteValid = isWebsiteValid(addContactForm.website);
    if (!firstName) {
      setAddContactFirstNameTouched(true);
      setAddContactError("First name is required.");
      return;
    }
    if (!email) {
      setAddContactError("Contact email is required.");
      return;
    }
    if (!emailValid) {
      setAddContactError("Please enter a valid email address.");
      return;
    }
    if (!phoneValid) {
      setAddContactError("Please enter a valid phone number in the format (123)-456-7890.");
      return;
    }
    if (!websiteValid) {
      setAddContactError("Please enter a valid website URL (e.g., example.com or https://example.com).");
      return;
    }
    setAddingContact(true);
    setAddContactError("");
    setContactsError("");
    try {
      const response = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountEmail: null,
          email,
          firstName,
          lastName: addContactForm.lastName.trim(),
          phone: addContactForm.phone.trim(),
          business: addContactForm.business.trim(),
          website: addContactForm.website.trim(),
          address: addContactForm.address.trim(),
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setAddContactError(payload?.message || "Failed to create contact.");
        return;
      }
      closeAddContactModal();
      await loadContacts();
    } catch (error) {
      setAddContactError(error instanceof Error ? error.message : "Failed to create contact.");
    } finally {
      setAddingContact(false);
    }
  };

  const editContact = async (contact: ContactRow) => {
    setEditingContactId(contact.id);
    setEditContactForm({
      firstName: contact.firstName || "",
      lastName: contact.lastName || "",
      email: contact.email || "",
      phone: formatPhoneInput(contact.phone || ""),
      business: contact.business || "",
      website: contact.website || "",
      address: contact.address || "",
    });
    setEditContactTouched({
      firstName: false,
      email: false,
      phone: false,
      website: false,
    });
    setEditContactError("");
    setIsEditContactModalOpen(true);
  };

  const deleteContact = async (contact: ContactRow) => {
    setContactToDelete(contact);
  };

  const confirmDeleteContact = async () => {
    if (!contactToDelete || deletingContact) return;
    setDeletingContact(true);
    setContactsError("");
    try {
      const response = await fetch(`/api/contacts/${encodeURIComponent(contactToDelete.id)}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message || "Failed to delete contact.");
      }
      setContactToDelete(null);
      await loadContacts();
    } catch (error) {
      setContactsError(error instanceof Error ? error.message : "Failed to delete contact.");
    } finally {
      setDeletingContact(false);
    }
  };

  const addTagToContact = async (contactId: string, tagId: string, reload = true) => {
    if (!tagId) return;
    await fetch(`/api/contacts/${encodeURIComponent(contactId)}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagId }),
    });
    if (reload) {
      await loadContacts();
    }
  };

  const removeTagFromContact = async (contactId: string, tagId: string) => {
    await fetch(`/api/contacts/${encodeURIComponent(contactId)}/tags`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagId }),
    });
    await loadContacts();
  };

  const saveEditedContact = async () => {
    const firstName = editContactForm.firstName.trim();
    const email = editContactForm.email.trim();
    const emailValid = EMAIL_REGEX.test(email);
    const phoneValid = isPhoneValid(editContactForm.phone);
    const websiteValid = isWebsiteValid(editContactForm.website);
    if (!editingContactId) return;
    if (!firstName) {
      setEditContactTouched((prev) => ({ ...prev, firstName: true }));
      setEditContactError("First name is required.");
      return;
    }
    if (!email) {
      setEditContactTouched((prev) => ({ ...prev, email: true }));
      setEditContactError("Contact email is required.");
      return;
    }
    if (!emailValid) {
      setEditContactTouched((prev) => ({ ...prev, email: true }));
      setEditContactError("Please enter a valid email address.");
      return;
    }
    if (!phoneValid) {
      setEditContactTouched((prev) => ({ ...prev, phone: true }));
      setEditContactError("Please enter a valid phone number in the format (123)-456-7890.");
      return;
    }
    if (!websiteValid) {
      setEditContactTouched((prev) => ({ ...prev, website: true }));
      setEditContactError("Please enter a valid website URL (e.g., example.com or https://example.com).");
      return;
    }
    setEditingContact(true);
    setEditContactError("");
    try {
      const response = await fetch(`/api/contacts/${encodeURIComponent(editingContactId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName: editContactForm.lastName.trim(),
          email,
          phone: editContactForm.phone.trim(),
          business: editContactForm.business.trim(),
          website: editContactForm.website.trim(),
          address: editContactForm.address.trim(),
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message || "Failed to update contact.");
      }
      closeEditContactModal();
      await loadContacts();
    } catch (error) {
      setEditContactError(error instanceof Error ? error.message : "Failed to update contact.");
    } finally {
      setEditingContact(false);
    }
  };

  const exportContactsCsv = async () => {
    const query = new URLSearchParams();
    if (contactSearch.trim()) query.set("search", contactSearch.trim());
    if (contactTagFilter) query.set("tagIds", contactTagFilter);
    if (contactSourceFilter) query.set("source", contactSourceFilter);
    const response = await fetch(`/api/contacts/export?${query.toString()}`);
    if (!response.ok) {
      setContactsError("Failed to export contacts.");
      return;
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "contacts.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  };

  const mapImportRowErrors = (raw: unknown): ContactsImportIssueRow[] => {
    if (!Array.isArray(raw)) return [];
    return raw.map((row) => ({
      lineNumber: Number((row as { lineNumber?: unknown })?.lineNumber) || 0,
      firstName: String((row as { firstName?: unknown })?.firstName || ""),
      lastName: String((row as { lastName?: unknown })?.lastName || ""),
      email: String((row as { email?: unknown })?.email || ""),
      phone: String((row as { phone?: unknown })?.phone || ""),
      business: String((row as { business?: unknown })?.business || ""),
      website: String((row as { website?: unknown })?.website || ""),
      address: String((row as { address?: unknown })?.address || ""),
      tags: String((row as { tags?: unknown })?.tags || ""),
      reasons: Array.isArray((row as { reasons?: unknown })?.reasons) ? (row as { reasons: string[] }).reasons : [],
    }));
  };

  const handleImportCsv = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const csvText = await file.text();
    setContactsError("");
    setContactsImportSuccessOpen(false);
    try {
      const response = await fetch("/api/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountEmail: null,
          csvText,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const headerErrors = Array.isArray(payload?.headerErrors) ? payload.headerErrors : [];
        const rowErrors = mapImportRowErrors(payload?.errors);
        if (headerErrors.length > 0 || rowErrors.length > 0) {
          setContactsImportIssuesModal({
            open: true,
            imported: Number(payload?.imported || 0),
            skipped: Number(payload?.skipped || 0),
            headerErrors,
            rowErrors,
          });
          setContactsError("");
        } else {
          setContactsError(payload?.message || "Failed to import CSV.");
        }
        return;
      }

      const imported = Number(payload?.imported || 0);
      const skipped = Number(payload?.skipped || 0);
      const headerErrors = Array.isArray(payload?.headerErrors) ? payload.headerErrors : [];
      const rowErrors = mapImportRowErrors(payload?.errors);

      event.target.value = "";
      await Promise.all([loadContacts(), loadContactTags()]);

      if (headerErrors.length > 0 || rowErrors.length > 0 || skipped > 0) {
        setContactsImportIssuesModal({
          open: true,
          imported,
          skipped,
          headerErrors,
          rowErrors,
        });
      } else {
        setContactsImportSuccessOpen(true);
      }
    } catch (error) {
      setContactsError(error instanceof Error ? error.message : "Failed to import CSV.");
    } finally {
      event.target.value = "";
    }
  };

  const updateIssueRowField = (lineNumber: number, field: keyof CsvContactRowWithMeta, value: string) => {
    setContactsImportIssuesModal((prev) => ({
      ...prev,
      rowErrors: prev.rowErrors.map((row) => (row.lineNumber === lineNumber ? { ...row, [field]: value } : row)),
    }));
  };

  const retryImportIssueRow = async (lineNumber: number) => {
    const target = contactsImportIssuesModal.rowErrors.find((row) => row.lineNumber === lineNumber);
    if (!target) return;
    setContactsImportIssuesModal((prev) => ({
      ...prev,
      rowErrors: prev.rowErrors.map((row) => (row.lineNumber === lineNumber ? { ...row, saving: true } : row)),
    }));
    try {
      const csvText = toContactsCsv([
        {
          firstName: target.firstName,
          lastName: target.lastName,
          email: target.email,
          phone: target.phone,
          business: target.business,
          website: target.website,
          address: target.address,
          tags: target.tags,
        },
      ]);
      const response = await fetch("/api/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountEmail: null, csvText }),
      });
      const payload = await response.json().catch(() => ({}));
      const stillFailing = mapImportRowErrors(payload?.errors);
      const succeeded = response.ok && Number(payload?.imported || 0) > 0 && stillFailing.length === 0;

      if (succeeded) {
        let closedIssuesModal = false;
        setContactsImportIssuesModal((prev) => {
          const nextRowErrors = prev.rowErrors.filter((row) => row.lineNumber !== lineNumber);
          const stillOpen = nextRowErrors.length > 0 || prev.headerErrors.length > 0;
          closedIssuesModal = !stillOpen;
          return {
            ...prev,
            imported: prev.imported + 1,
            skipped: Math.max(0, prev.skipped - 1),
            rowErrors: nextRowErrors,
            open: stillOpen,
          };
        });
        await Promise.all([loadContacts(), loadContactTags()]);
        if (closedIssuesModal) {
          setContactsImportSuccessOpen(true);
        }
      } else {
        const reasons = stillFailing[0]?.reasons?.length ? stillFailing[0].reasons : ["Failed to import row."];
        setContactsImportIssuesModal((prev) => ({
          ...prev,
          rowErrors: prev.rowErrors.map((row) =>
            row.lineNumber === lineNumber ? { ...target, reasons, saving: false } : row
          ),
        }));
      }
    } catch (error) {
      setContactsImportIssuesModal((prev) => ({
        ...prev,
        rowErrors: prev.rowErrors.map((row) =>
          row.lineNumber === lineNumber
            ? { ...row, saving: false, reasons: [error instanceof Error ? error.message : "Failed to import row."] }
            : row
        ),
      }));
    }
  };

  const retryAllIssueRows = async () => {
    const lineNumbers = contactsImportIssuesModal.rowErrors.map((row) => row.lineNumber);
    for (const lineNumber of lineNumbers) {
      await retryImportIssueRow(lineNumber);
    }
  };

  const syncFromGmailContacts = async () => {
    if (selectedAccounts.length === 0) return;
    setContactsError("");
    setContactsLoading(true);
    try {
      for (const accountEmail of selectedAccounts) {
        const response = await fetch("/api/gmail/contacts/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountEmail }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.message || `Sync failed for ${accountEmail}`);
        }
      }
      await Promise.all([loadContacts(), loadContactTags()]);
    } catch (error) {
      setContactsError(error instanceof Error ? error.message : "Gmail contacts sync failed.");
    } finally {
      setContactsLoading(false);
    }
  };

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

  const parseAddressList = (value: string) => {
    return (value || "")
      .split(",")
      .map((item) => parseMailboxAddress(item))
      .filter((item) => item.name || item.email);
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

  const composeDraftStorageKey = useMemo(() => {
    const account = (composeAccountEmail || selectedAccounts[0] || connectedAccounts[0]?.email || "default").toLowerCase();
    return `popup:new:${account}`;
  }, [composeAccountEmail, connectedAccounts, selectedAccounts]);
  const effectiveComposeDraftStorageKey = composeActiveDraftKey || composeDraftStorageKey;

  useEffect(() => {
    if (!isComposeOpen || !composeAccountEmail) return;
    let cancelled = false;
    void fetch(`/api/gmail/templates?accountEmail=${encodeURIComponent(composeAccountEmail)}`)
      .then((r) => r.json())
      .then((payload) => {
        if (cancelled) return;
        const list = Array.isArray(payload?.templates) ? payload.templates : [];
        setComposeTemplates(list);
      })
      .catch(() => null);
    void fetch(`/api/gmail/signatures?accountEmail=${encodeURIComponent(composeAccountEmail)}`)
      .then((r) => r.json())
      .then((payload) => {
        if (cancelled) return;
        const list = Array.isArray(payload?.signatures) ? payload.signatures : [];
        setComposeSignatures(list);
        // Auto-insert the default signature into a brand-new compose only (flag set by
        // openNewCompose). Guard on an empty body via the functional updater so we never clobber
        // a reply/draft or text the user has already started typing while the fetch was in flight.
        if (!composeInsertDefaultSigRef.current) return;
        composeInsertDefaultSigRef.current = false;
        const def = list.find((s: { isDefault?: boolean }) => s?.isDefault);
        if (!def || (!def.signatureHtml && !def.signatureText)) return;
        const escSig = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const sigHtml =
          def.signatureHtml && def.signatureHtml.trim()
            ? def.signatureHtml
            : `<p>${escSig(def.signatureText || "").replace(/\n/g, "<br />")}</p>`;
        setComposeBodyHtml((prev) => (prev && prev.trim() ? prev : `<p><br /></p><p><br /></p>${sigHtml}`));
        setComposeBody((prev) => (prev && prev.trim() ? prev : `\n\n${def.signatureText || ""}`));
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [isComposeOpen, composeAccountEmail]);

  // Apply this inbox's read-receipt default once on a brand-new compose (flag set by
  // openNewCompose); never on replies/drafts, and the user can still toggle it off after.
  useEffect(() => {
    if (!isComposeOpen || !composeAccountEmail || !composeReadReceiptDefaultRef.current) return;
    composeReadReceiptDefaultRef.current = false;
    let cancelled = false;
    void fetch(`/api/gmail/settings?accountEmail=${encodeURIComponent(composeAccountEmail)}`)
      .then((r) => r.json())
      .then((payload) => {
        if (!cancelled && payload?.settings?.defaultReadReceipt) setRequestReceipt(true);
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [isComposeOpen, composeAccountEmail]);

  const inlineDraftStorageKey = useMemo(() => {
    if (!inlineComposeMode || !selectedMessage) return "";
    return `inline:${inlineComposeMode}:${selectedMessage.accountEmail.toLowerCase()}:${selectedMessage.id}`;
  }, [inlineComposeMode, selectedMessage]);

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

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const linkifyTextForHtml = (value: string) =>
    escapeHtml(value)
      .replace(
        /(https?:\/\/[^\s<>"']+)/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer" style="color:#5B21B6;text-decoration:underline;">$1</a>'
      )
      .replace(/\n/g, "<br>");

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
    if (step === "client" && activeModule === "contacts") {
      loadContactTags();
      loadContactVisibility();
    }
  }, [activeModule, loadContactTags, loadContactVisibility, step]);

  // Debounce the contacts search box so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedContactSearch(contactSearch.trim()), 400);
    return () => clearTimeout(t);
  }, [contactSearch]);

  useEffect(() => {
    if (step !== "client" || activeModule !== "contacts") return;
    setContactCurrentPage(1);
  }, [activeModule, debouncedContactSearch, contactSourceFilter, contactTagFilter, step]);

  useEffect(() => {
    if (contactCurrentPage <= contactsTotalPages) return;
    setContactCurrentPage(Math.max(1, contactsTotalPages));
  }, [contactCurrentPage, contactsTotalPages]);

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

  useEffect(() => {
    if (!contactFilterOpen) return;
    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      const targetNode = event.target as Node | null;
      if (!targetNode) return;
      if (contactFilterMenuRef.current?.contains(targetNode)) return;
      setContactFilterOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [contactFilterOpen]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

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

  useEffect(() => {
    setInlineComposeMode(null);
    setInlineComposeTo("");
    setInlineComposeSubject("");
    setInlineComposeIntroText("");
    setInlineComposeBodyText("");
    setInlineComposeBodyHtml("");
    setInlineComposePreviewHtml("");
    setInlineComposeThreadId("");
    setInlineComposeInReplyTo("");
    setInlineComposeReferences("");
    setInlineComposeError("");
    setInlineComposeSuccess("");
  }, [selectedMessageId]);

  useEffect(() => {
    if (!inlineComposeMode) return;
    const timeout = window.setTimeout(() => {
      inlineComposeRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 80);
    return () => window.clearTimeout(timeout);
  }, [inlineComposeMode]);

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

  const saveLocalDraft = useCallback(async (key: string, draft: LocalEmailDraft, options?: { keepalive?: boolean }) => {
    if (!key) return;
    await fetch("/api/gmail/drafts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      keepalive: Boolean(options?.keepalive),
      body: JSON.stringify({
        draftKey: key,
        accountEmail: draft.accountEmail || null,
        to: draft.to,
        cc: draft.cc || "",
        bcc: draft.bcc || "",
        showCc: Boolean(draft.showCc),
        showBcc: Boolean(draft.showBcc),
        subject: draft.subject || "",
        bodyText: draft.bodyText || "",
        bodyHtml: draft.bodyHtml || "",
        previewHtml: draft.previewHtml || "",
        threadId: draft.threadId || "",
        inReplyTo: draft.inReplyTo || "",
        references: draft.references || "",
      }),
    }).catch(() => null);
  }, []);

  const clearLocalDraft = useCallback(async (key: string, options?: { keepalive?: boolean }) => {
    if (!key) return;
    const response = await fetch("/api/gmail/drafts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      keepalive: Boolean(options?.keepalive),
      body: JSON.stringify({ draftKey: key }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload?.message || "Failed to clear draft.");
    }
  }, []);

  const flushDraftsNow = useCallback(() => {
    if (!sendingCompose && isComposeOpen && effectiveComposeDraftStorageKey) {
      // Recipients or a subject with no body still count — closing after typing only a
      // "To" used to discard it, which reads as the composer losing your work.
      const hasComposeContent =
        composeBody.trim() ||
        composeBodyHtml.replace(/<[^>]+>/g, "").replace(/&nbsp;/gi, " ").trim() ||
        composeTo.trim() ||
        composeSubject.trim();
      if (hasComposeContent) {
        void saveLocalDraft(
          effectiveComposeDraftStorageKey,
          {
            to: composeTo,
            cc: composeCc,
            bcc: composeBcc,
            showCc,
            showBcc,
            subject: composeSubject,
            bodyText: composeBody,
            bodyHtml: composeBodyHtml,
            accountEmail: composeAccountEmail,
            updatedAt: Date.now(),
          },
          { keepalive: true }
        );
      }
    }

    if (!inlineComposeSending && inlineComposeMode && inlineDraftStorageKey) {
      const hasInlineContent = inlineComposeIntroText.trim();
      if (hasInlineContent) {
        void saveLocalDraft(
          inlineDraftStorageKey,
          {
            to: inlineComposeTo,
            subject: inlineComposeSubject,
            bodyText: inlineComposeIntroText,
            bodyHtml: inlineComposeBodyHtml,
            previewHtml: inlineComposePreviewHtml,
            accountEmail: selectedMessage?.accountEmail,
            threadId: inlineComposeThreadId,
            inReplyTo: inlineComposeInReplyTo,
            references: inlineComposeReferences,
            updatedAt: Date.now(),
          },
          { keepalive: true }
        );
      }
    }
  }, [
    composeAccountEmail,
    composeBcc,
    composeBody,
    composeBodyHtml,
    composeCc,
    composeSubject,
    composeTo,
    effectiveComposeDraftStorageKey,
    inlineComposeSending,
    inlineComposeBodyHtml,
    inlineComposeInReplyTo,
    inlineComposeIntroText,
    inlineComposeMode,
    inlineComposePreviewHtml,
    inlineComposeReferences,
    inlineComposeSubject,
    inlineComposeThreadId,
    inlineComposeTo,
    inlineDraftStorageKey,
    isComposeOpen,
    sendingCompose,
    saveLocalDraft,
    selectedMessage?.accountEmail,
    showBcc,
    showCc,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handlePageLeave = () => {
      flushDraftsNow();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushDraftsNow();
      }
    };
    window.addEventListener("beforeunload", handlePageLeave);
    window.addEventListener("pagehide", handlePageLeave);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      flushDraftsNow();
      window.removeEventListener("beforeunload", handlePageLeave);
      window.removeEventListener("pagehide", handlePageLeave);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [flushDraftsNow]);

  useEffect(() => {
    if (sendingCompose || !isComposeOpen || !effectiveComposeDraftStorageKey) return;
    const hasContent =
      composeBody.trim() ||
      composeBodyHtml.replace(/<[^>]+>/g, "").replace(/&nbsp;/gi, " ").trim();
    const timeout = window.setTimeout(() => {
      if (!hasContent) return;
      void saveLocalDraft(effectiveComposeDraftStorageKey, {
        to: composeTo,
        cc: composeCc,
        bcc: composeBcc,
        showCc,
        showBcc,
        subject: composeSubject,
        bodyText: composeBody,
        bodyHtml: composeBodyHtml,
        accountEmail: composeAccountEmail,
        updatedAt: Date.now(),
      });
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [
    clearLocalDraft,
    composeAccountEmail,
    composeBcc,
    composeBody,
    composeBodyHtml,
    composeCc,
    composeActiveDraftKey,
    composeDraftStorageKey,
    composeSubject,
    composeTo,
    effectiveComposeDraftStorageKey,
    isComposeOpen,
    sendingCompose,
    saveLocalDraft,
    showBcc,
    showCc,
  ]);

  useEffect(() => {
    if (inlineComposeSending || !inlineComposeMode || !inlineDraftStorageKey) return;
    const hasContent = inlineComposeIntroText.trim();
    const timeout = window.setTimeout(() => {
      if (!hasContent) return;
      void saveLocalDraft(inlineDraftStorageKey, {
        to: inlineComposeTo,
        subject: inlineComposeSubject,
        bodyText: inlineComposeIntroText,
        bodyHtml: inlineComposeBodyHtml,
        previewHtml: inlineComposePreviewHtml,
        accountEmail: selectedMessage?.accountEmail,
        threadId: inlineComposeThreadId,
        inReplyTo: inlineComposeInReplyTo,
        references: inlineComposeReferences,
        updatedAt: Date.now(),
      });
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [
    clearLocalDraft,
    inlineComposeBodyHtml,
    inlineComposeBodyText,
    inlineComposeInReplyTo,
    inlineComposeIntroText,
    inlineComposeMode,
    inlineComposePreviewHtml,
    inlineComposeReferences,
    inlineComposeSubject,
    inlineComposeThreadId,
    inlineComposeTo,
    inlineDraftStorageKey,
    inlineComposeSending,
    saveLocalDraft,
    selectedMessage?.accountEmail,
  ]);

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

  const openComposeDraftFromRow = (draftMessage: MessageRow) => {
    const accountEmail =
      draftMessage.accountEmail || selectedAccounts[0] || connectedAccounts[0]?.email || providerAccounts[0]?.accountEmail || "";
    setComposeTo(draftMessage.toRaw || draftMessage.to || "");
    setComposeCc(draftMessage.composeCc || "");
    setComposeBcc(draftMessage.composeBcc || "");
    setShowCc(Boolean(draftMessage.composeShowCc));
    setShowBcc(Boolean(draftMessage.composeShowBcc));
    setComposeSubject(draftMessage.subject || "");
    setComposeBody(draftMessage.composeBodyText || "");
    setComposeBodyHtml(draftMessage.composeBodyHtml || "");
    setComposeAttachments([]);
    setComposeFormattingToolbarOpen(false);
    setComposeAccountEmail(accountEmail);
    setComposeThreadId(draftMessage.threadId || "");
    setComposeInReplyTo(draftMessage.messageIdHeader || "");
    setComposeReferences(draftMessage.references || "");
    setComposeActiveDraftKey(draftMessage.draftKey || "");
    setComposeError("");
    setComposeSuccess("");
    setComposeExpanded(false);
    setIsComposeOpen(true);
  };

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
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "Action failed.");
      } finally {
        if (!isReadToggle) {
          for (const key of inFlightKeys) actionInFlightRef.current.delete(key);
        }
        setActionLoading(false);
      }
    },
    [activeModule, invalidateMessagesCache, loadMailboxCounts, rowKey, selectedMessageRows, selectedRows]
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

  /** Mailbox destinations a message can be dropped onto. */
  const MESSAGE_DROP_ACTIONS: Record<string, "moveToInbox" | "moveToSpam" | "moveToTrash" | "archive"> = useMemo(
    () => ({ inbox: "moveToInbox", spam: "moveToSpam", trash: "moveToTrash", archive: "archive" }),
    []
  );

  /** Drop the dragged messages onto a mailbox module or a label. */
  const dropMessagesOn = useCallback(
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
      MESSAGE_DROP_ACTIONS,
      activeModule,
      applyLabelToSelection,
      loadMailboxCounts,
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

  /**
   * Open the inline composer as a reply, with everything a reply shares: the Re: subject, the
   * threading headers, and a cleared body.
   *
   * Reply and Reply all differ only in the recipient list. They were two copies of this, which is
   * why the References fix — the parent Message-ID that was missing from the chain — had to be
   * applied twice and could have been applied to only one.
   */
  const beginInlineReply = (mode: "reply" | "replyAll", to: string) => {
    if (!selectedMessage) return;
    const latest = threadMessages[threadMessages.length - 1];
    setInlineComposeMode(mode);
    setInlineComposeIntroHtml("");
    setInlineComposeCc("");
    setInlineComposeBcc("");
    setInlineShowCc(false);
    setInlineShowBcc(false);
    setInlineToEditing(false);
    setInlineShowFormatting(false);
    setInlineMoreOpen(false);
    setInlineComposeTo(to);
    setInlineComposeSubject(
      /^re:/i.test(selectedMessage.subject || "") ? selectedMessage.subject : `Re: ${selectedMessage.subject || ""}`
    );
    setInlineComposeIntroText("");
    // Quote the message being replied to, as Gmail does. This used to be cleared, so a reply
    // carried none of the original AND the "⋯" that reveals it had nothing to show, which is
    // why the control looked missing — it was rendering conditionally on an always-empty value.
    {
      const sourceHtml = latest?.bodyHtml || selectedMessageDetail?.bodyHtml || "";
      const sourceText = latest?.bodyText || selectedMessageDetail?.bodyText || selectedMessage.snippet || "";
      const quotedFrom = formatIdentity(latest?.fromRaw || selectedMessage.fromRaw || selectedMessage.from);
      const quotedDate = formatDetailedDate(latest?.timestamp || selectedMessage.timestamp, latest?.date || selectedMessage.date);
      const safeHtml = sourceHtml
        ? sanitizeHtml(sourceHtml)
        : `<div style="white-space:pre-wrap;">${escapeHtml(sourceText)}</div>`;
      const quotedHtml = `<div style="border-left:2px solid #D1D5DB;padding-left:12px;margin-top:8px;color:#4B5563;">
      <p style="font-size:12px;margin:0 0 10px;">On ${escapeHtml(quotedDate)}, ${escapeHtml(quotedFrom)} wrote:</p>
      <div>${safeHtml}</div>
    </div>`;
      setInlineComposeBodyText(`\n\nOn ${quotedDate}, ${quotedFrom} wrote:\n${sourceText}`);
      setInlineComposeBodyHtml(quotedHtml);
      setInlineComposePreviewHtml(quotedHtml);
    }
    setInlineComposeThreadId(selectedMessage.threadId || latest?.threadId || "");
    setInlineComposeInReplyTo(latest?.messageIdHeader || selectedMessage.messageIdHeader || "");
    setInlineComposeReferences(
      buildReplyReferences(
        latest?.references || selectedMessage.references,
        latest?.messageIdHeader || selectedMessage.messageIdHeader
      )
    );
    setInlineComposeError("");
    setInlineComposeSuccess("");
  };

  /** The address a reply goes to: Reply-To when the sender set one, otherwise who it came from. */
  const replyRecipient = () => {
    if (!selectedMessage) return "";
    const latest = threadMessages[threadMessages.length - 1];
    return parseMailboxAddress(
      latest?.replyTo || selectedMessage.replyTo || selectedMessage.fromRaw || selectedMessage.from
    ).email;
  };

  const openReplyCompose = () => {
    if (!selectedMessage) return;
    beginInlineReply("reply", replyRecipient());
  };

  const openReplyAllCompose = () => {
    if (!selectedMessage) return;
    const latest = threadMessages[threadMessages.length - 1];
    const toList = parseAddressList(latest?.toRaw || selectedMessage.toRaw || selectedMessage.to);
    // Everyone on the original, deduped, with the sender first.
    const uniqueEmails = Array.from(
      new Set([replyRecipient(), ...toList.map((entry) => entry.email)].filter(Boolean))
    );
    beginInlineReply("replyAll", uniqueEmails.join(", "));
  };

  const openForwardCompose = () => {
    if (!selectedMessage) return;
    const latest = threadMessages[threadMessages.length - 1];
    void clearLocalDraft(`inline:forward:${selectedMessage.accountEmail.toLowerCase()}:${selectedMessage.id}`).catch(() => null);
    const sourceHtml = latest?.bodyHtml || selectedMessageDetail?.bodyHtml || "";
    const sourceText = latest?.bodyText || selectedMessageDetail?.bodyText || selectedMessage.snippet || "";
    const prefixed = /^fwd:/i.test(selectedMessage.subject || "") ? selectedMessage.subject : `Fwd: ${selectedMessage.subject || ""}`;
    const originalFrom = formatIdentity(latest?.fromRaw || selectedMessage.fromRaw || selectedMessage.from);
    const originalTo = formatIdentity(latest?.toRaw || selectedMessage.toRaw || selectedMessage.to);
    const originalDate = formatDetailedDate(latest?.timestamp || selectedMessage.timestamp, latest?.date || selectedMessage.date);
    const sourceHtmlSafe = sourceHtml ? sanitizeHtml(sourceHtml) : `<div style="white-space:pre-wrap;">${escapeHtml(sourceText)}</div>`;
    const previewHtml = `<div style="border-left:2px solid #D1D5DB;padding-left:12px;margin-top:8px;color:#4B5563;">
      <p style="font-size:12px;margin:0 0 4px;"><strong>From:</strong> ${escapeHtml(originalFrom)}</p>
      <p style="font-size:12px;margin:0 0 4px;"><strong>To:</strong> ${escapeHtml(originalTo)}</p>
      <p style="font-size:12px;margin:0 0 4px;"><strong>Date:</strong> ${escapeHtml(originalDate)}</p>
      <p style="font-size:12px;margin:0 0 10px;"><strong>Subject:</strong> ${escapeHtml(selectedMessage.subject || "(No Subject)")}</p>
      <div>${sourceHtmlSafe}</div>
    </div>`;
    const forwardedText = `---------- Forwarded message ----------
From: ${originalFrom}
To: ${originalTo}
Date: ${originalDate}
Subject: ${selectedMessage.subject || "(No Subject)"}

${sourceText}`;
    setInlineComposeMode("forward");
    setInlineComposeTo("");
    setInlineComposeSubject(prefixed);
    setInlineComposeIntroText("");
    setInlineComposeBodyText(forwardedText);
    setInlineComposeBodyHtml(previewHtml);
    setInlineComposePreviewHtml(previewHtml);
    setInlineComposeThreadId("");
    setInlineComposeInReplyTo("");
    setInlineComposeReferences("");
    setInlineComposeError("");
    setInlineComposeSuccess("");
  };

  const sendInlineCompose = async () => {
    if (!selectedMessage || !inlineComposeTo.trim() || inlineComposeSending) return;
    const intro = inlineComposeIntroText.trim();
    const textBody = intro ? `${intro}\n\n${inlineComposeBodyText}` : inlineComposeBodyText || intro;
    if (!textBody.trim()) return;
    const inlineCcError = validateRecipientCsv("Cc", inlineComposeCc);
    const inlineBccError = validateRecipientCsv("Bcc", inlineComposeBcc);
    if (inlineCcError || inlineBccError) {
      setInlineComposeError(inlineCcError || inlineBccError || "");
      return;
    }
    // The editor's own markup wins when it has any; linkified plain text is the fallback for a
    // draft restored before the rich editor mounted.
    const introRich = inlineComposeIntroHtml.replace(/<[^>]+>/g, "").replace(/&nbsp;/gi, " ").trim()
      ? inlineComposeIntroHtml
      : "";
    const introHtml = introRich ? `${introRich}<br>` : intro ? `<div>${linkifyTextForHtml(intro)}</div><br>` : "";
    const htmlBody = inlineComposeBodyHtml ? `${introHtml}${inlineComposeBodyHtml}` : introHtml || linkifyTextForHtml(textBody);

    setInlineComposeSending(true);
    setInlineComposeError("");
    setInlineComposeSuccess("");
    try {
      const response = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountEmail: selectedMessage.accountEmail,
          to: inlineComposeTo.trim(),
          cc: inlineComposeCc.trim() || undefined,
          bcc: inlineComposeBcc.trim() || undefined,
          subject: inlineComposeSubject.trim(),
          body: textBody,
          bodyHtml: htmlBody,
          threadId: inlineComposeThreadId || undefined,
          inReplyTo: inlineComposeInReplyTo || undefined,
          references: inlineComposeReferences || undefined,
          draftKey: inlineDraftStorageKey || undefined,
          providerAccountId:
            providerAccounts.find((entry) => entry.accountEmail === selectedMessage.accountEmail.toLowerCase())?.id || undefined,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to send email.");
      }
      if (selectedMessage && inlineComposeMode) {
        await clearLocalDraft(`inline:${inlineComposeMode}:${selectedMessage.accountEmail.toLowerCase()}:${selectedMessage.id}`).catch(
          () => null
        );
      }
      showSentToast("Message Sent");
      setInlineComposeMode(null);
      invalidateMessagesCache();
      void Promise.all([loadMessages(), loadMailboxCounts()]);
      setDetailError("");
      setSelectedMessageDetail(null);
    } catch (error) {
      setInlineComposeError(error instanceof Error ? error.message : "Failed to send email.");
    } finally {
      setInlineComposeSending(false);
    }
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

  const openNewCompose = () => {
    const defaultAccount =
      selectedAccounts[0] || connectedAccounts[0]?.email || providerAccounts[0]?.accountEmail || "";
    setComposeTo("");
    setComposeCc("");
    setComposeBcc("");
    setShowCc(false);
    setShowBcc(false);
    setComposeSubject("");
    setComposeBody("");
    setComposeBodyHtml("");
    setComposeAttachments([]);
    setComposeMoreOpen(false);
    setArtemisRewriteOpen(false);
    setComposeFormattingToolbarOpen(false);
    setScheduleAt("");
    setScheduleOpen(false);
    setConfidentialOn(false);
    setConfidentialPasscode("");
    setConfidentialOpen(false);
    setRequestReceipt(false);
    composeReadReceiptDefaultRef.current = true;
    setComposeAccountEmail(defaultAccount);
    setComposeThreadId("");
    setComposeInReplyTo("");
    setComposeReferences("");
    setComposeActiveDraftKey("");
    setComposeError("");
    setComposeSuccess("");
    setComposeExpanded(false);
    // Ask the signatures effect to drop in this account's default signature once it loads.
    composeInsertDefaultSigRef.current = true;
    setIsComposeOpen(true);
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

  /**
   * Load send-as identities for every connected mailbox, not just the active one.
   *
   * These used to be fetched for composeAccountEmail alone, which made aliases undiscoverable:
   * opening compose on a mailbox with no aliases showed none, and the only way to reach an
   * alias on another mailbox was to already know it was there and switch accounts first. Now
   * every address the user can legitimately send from is in the list up front, each tagged with
   * the mailbox that owns it (Gmail rejects sending as an alias through a mailbox that doesn't).
   */
  const composeAliasAccountsKey = useMemo(
    () => (selectedAccounts.length > 0 ? selectedAccounts : connectedAccounts.map((a) => a.email)).join(","),
    [selectedAccounts, connectedAccounts]
  );
  useEffect(() => {
    if (!isComposeOpen) return;
    const accounts = composeAliasAccountsKey.split(",").filter(Boolean);
    if (accounts.length === 0) return;
    let cancelled = false;
    Promise.all(
      accounts.map(async (accountEmail) => {
        const response = await fetch(`/api/gmail/send-as?accountEmail=${encodeURIComponent(accountEmail)}`);
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(`${accountEmail}: ${payload?.message || "failed to load send-as addresses"}`);
        }
        const aliases: Array<{ email: string; displayName: string; isPrimary: boolean }> = Array.isArray(
          payload?.aliases
        )
          ? payload.aliases
          : [];
        return aliases.map((alias) => ({ ...alias, accountEmail }));
      })
    )
      .then((perAccount) => {
        if (!cancelled) setComposeAliases(perAccount.flat());
      })
      // A failure used to be indistinguishable from "this account has no aliases" — both ended
      // as an empty list — so a broken fetch looked like the feature not existing.
      .catch((error: unknown) => {
        if (cancelled) return;
        setComposeAliases([]);
        setComposeError(
          `Couldn't load your send-as addresses: ${error instanceof Error ? error.message : "unknown error"}`
        );
      });
    return () => {
      cancelled = true;
    };
  }, [isComposeOpen, composeAliasAccountsKey]);

  useEffect(() => {
    if (isComposeOpen && composeAccountEmail) setComposeFrom(composeAccountEmail);
  }, [isComposeOpen, composeAccountEmail]);

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

  const getArtemisTone = () => {
    try {
      const raw = window.localStorage.getItem("artemis-prefs");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.tone) return String(parsed.tone);
      }
    } catch {
      /* ignore */
    }
    return "professional and friendly";
  };

  const handleArtemisDraft = () => {
    if (artemisDrafting) return;
    setArtemisPromptOpen(true);
  };

  /**
   * Ask Artemis for body text and put the result in the composer.
   *
   * Drafting and rewriting were the same twenty lines twice over, differing only in the endpoint,
   * the request body and the error wording — including their own private copies of the
   * plain-text-to-HTML conversion, which is the part that would quietly diverge.
   */
  const runArtemis = async (endpoint: string, body: Record<string, unknown>, failureMessage: string) => {
    setArtemisDrafting(true);
    setComposeError("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || failureMessage);
      const text = String(payload?.text || "").trim();
      if (!text) return;
      setComposeBody(text);
      setComposeBodyHtml(`<p>${escapeHtml(text).replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br />")}</p>`);
    } catch (error) {
      setComposeError(error instanceof Error ? error.message : "Artemis error.");
    } finally {
      setArtemisDrafting(false);
    }
  };

  const runArtemisDraft = async (intent: string) => {
    if (!intent.trim() || artemisDrafting) return;
    setArtemisPromptOpen(false);
    await runArtemis("/api/ai/compose", { intent: intent.trim(), tone: getArtemisTone() }, "Artemis couldn't draft that.");
  };

  const handleArtemisRewrite = async (mode: string) => {
    setArtemisRewriteOpen(false);
    const current = (composeBody || "").trim();
    if (!current || artemisDrafting) return;
    await runArtemis("/api/ai/rewrite", { text: current, mode }, "Artemis couldn't rewrite that.");
  };

  /**
   * The send request body. Extracted so the undo window can hold the exact same payload and flush
   * it if the page goes away mid-countdown.
   */
  const buildSendPayload = () => ({
          accountEmail: composeAccountEmail,
          from: composeFrom && composeFrom !== composeAccountEmail ? composeFrom : undefined,
          to: composeTo.trim(),
          cc: composeCc.trim(),
          bcc: composeBcc.trim(),
          subject: composeSubject.trim(),
          body: composeBody.trim(),
          bodyHtml: composeBodyHtml.trim(),
          threadId: composeThreadId || undefined,
          inReplyTo: composeInReplyTo || undefined,
          references: composeReferences || undefined,
          scheduledAt: scheduleAt ? new Date(scheduleAt).toISOString() : undefined,
          confidential: confidentialOn
            ? { expiry: confidentialExpiry, passcode: confidentialPasscode.trim() || undefined }
            : undefined,
          requestReceipt: requestReceipt || undefined,
          draftKey: effectiveComposeDraftStorageKey || undefined,
          providerAccountId:
            providerAccounts.find((entry) => entry.accountEmail === composeAccountEmail.toLowerCase())?.id || undefined,
          attachments: composeAttachments.map((a) => ({
            filename: a.filename,
            contentType: a.contentType,
            contentBase64: a.contentBase64,
          })),
  });

  const performSendCompose = async () => {
    // Being sent now, so there is nothing left for the unload path to flush.
    pendingSendBodyRef.current = null;
    setSendingCompose(true);
    setComposeError("");
    setComposeSuccess("");
    try {
      const response = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildSendPayload()),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to send email.");
      }
      if (composeActiveDraftKey && composeActiveDraftKey !== composeDraftStorageKey) {
        await clearLocalDraft(composeActiveDraftKey).catch(() => null);
      }
      await clearLocalDraft(composeDraftStorageKey).catch(() => null);
      setComposeActiveDraftKey("");
      setComposeTo("");
      setComposeCc("");
      setComposeBcc("");
      setShowCc(false);
      setShowBcc(false);
      setComposeSubject("");
      setComposeBody("");
      setComposeBodyHtml("");
      setComposeAttachments([]);
      setIsComposeOpen(false);
      if (payload?.scheduled) {
        const when = payload?.scheduledAt ? new Date(payload.scheduledAt) : null;
        showSentToast(
          when
            ? `Send scheduled for ${when.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`
            : "Send scheduled"
        );
      } else {
        showSentToast("Message Sent");
      }
      setScheduleAt("");
      setScheduleOpen(false);
      setConfidentialOn(false);
      setConfidentialPasscode("");
      setConfidentialOpen(false);
      setRequestReceipt(false);
      if (activeModule === "sent" || activeModule === "drafts") {
        invalidateMessagesCache();
        void Promise.all([loadMessages(), loadMailboxCounts()]);
      } else {
        void loadMailboxCounts();
      }
    } catch (error) {
      setComposeError(error instanceof Error ? error.message : "Failed to send email.");
    } finally {
      setSendingCompose(false);
    }
  };

  const cancelUndoSend = () => {
    // Undo is the one path that genuinely discards the pending send.
    pendingSendBodyRef.current = null;
    if (undoSendTimeoutRef.current) {
      clearTimeout(undoSendTimeoutRef.current);
      undoSendTimeoutRef.current = null;
    }
    if (undoCountdownRef.current) {
      clearInterval(undoCountdownRef.current);
      undoCountdownRef.current = null;
    }
    setUndoCountdown(null);
  };

  // Closing/discarding the composer must abort any in-flight undo-send window. The Undo banner
  // lives inside this modal, so once it's closed there's no way to cancel — leaving the timer
  // running would send a message the user just tried to abort (and could clobber a fresh draft).
  const closeCompose = () => {
    cancelUndoSend();
    // The autosave is debounced 450ms and its cleanup cancels the pending write, so closing
    // right after a keystroke dropped those edits. Flush synchronously first, then resync the
    // Drafts badge so the count reflects a draft created by this close.
    flushDraftsNow();
    setIsComposeOpen(false);
    void loadMailboxCounts();
    // Closing a compose can create, update or empty a draft, so the cached Drafts page is now
    // stale. Only the badge was refreshed before, which left the Drafts LIST showing the old
    // contents until a manual refresh. Drop the cache and, if that list is on screen, refetch it.
    invalidateMessagesCache();
    if (activeModule === "drafts") void loadMessages();
  };

  // Undo-send: hold the message for a short window with an Undo affordance, then actually send.
  const handleSendCompose = () => {
    const strippedHtml = composeBodyHtml.replace(/<[^>]+>/g, "").replace(/&nbsp;/gi, " ").trim();
    const hasBody = Boolean(composeBody.trim() || strippedHtml);
    if (!composeTo.trim() || !hasBody || !composeAccountEmail || sendingCompose || undoCountdown !== null) return;
    const ccErr = validateRecipientCsv("Cc", composeCc);
    const bccErr = validateRecipientCsv("Bcc", composeBcc);
    if (ccErr || bccErr) {
      setComposeError(ccErr || bccErr || "");
      return;
    }
    // Scheduling replaces the undo-send window — queue it server-side directly.
    if (scheduleAt) {
      setComposeError("");
      void performSendCompose();
      return;
    }
    let delay = 5;
    try {
      const raw = window.localStorage.getItem("email-undo-delay");
      if (raw != null) {
        const parsed = Number(raw);
        if (Number.isFinite(parsed)) delay = Math.max(0, Math.min(30, parsed));
      }
    } catch {
      /* ignore */
    }
    if (delay === 0) {
      void performSendCompose();
      return;
    }
    setComposeError("");
    setUndoCountdown(delay);
    pendingSendBodyRef.current = JSON.stringify(buildSendPayload());
    undoSendTimeoutRef.current = setTimeout(() => {
      cancelUndoSend();
      void performSendCompose();
    }, delay * 1000);
    undoCountdownRef.current = setInterval(() => {
      setUndoCountdown((prev) => (prev && prev > 1 ? prev - 1 : prev));
    }, 1000);
  };

  /**
   * Send anything still inside its undo window when the page goes away.
   *
   * sendBeacon is built for exactly this and survives unload, where a normal fetch is cancelled. It
   * caps the payload at roughly 64KB, so a message with attachments can be too big to flush — in
   * that case beforeunload asks the user to stay rather than losing it silently. The user pressed
   * Send, so completing the send is the expected outcome of leaving; only undo cancels it.
   */
  useEffect(() => {
    const flushPendingSend = () => {
      const body = pendingSendBodyRef.current;
      if (!body) return true;
      try {
        const sent = navigator.sendBeacon?.(
          "/api/gmail/send",
          new Blob([body], { type: "application/json" })
        );
        if (sent) {
          pendingSendBodyRef.current = null;
          return true;
        }
      } catch {
        /* fall through to reporting that it could not be flushed */
      }
      return false;
    };

    const handlePageHide = () => {
      flushPendingSend();
    };
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!pendingSendBodyRef.current) return;
      if (flushPendingSend()) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      // Unmounting mid-countdown is a navigation away, not an undo: flush rather than drop.
      flushPendingSend();
      if (undoSendTimeoutRef.current) clearTimeout(undoSendTimeoutRef.current);
      if (undoCountdownRef.current) clearInterval(undoCountdownRef.current);
    };
  }, []);

  const composeHasMeaningfulBody = useMemo(() => {
    const stripped = composeBodyHtml.replace(/<[^>]+>/g, "").replace(/&nbsp;/gi, " ").trim();
    return Boolean(composeBody.trim() || stripped);
  }, [composeBody, composeBodyHtml]);

  const addComposeAttachmentsFromFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    const additions: Array<{ id: string; filename: string; contentType: string; contentBase64: string }> = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList.item(i);
      if (!file) continue;
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const comma = dataUrl.indexOf(",");
      const contentBase64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
      additions.push({
        id: `${Date.now()}-${i}-${file.name}`,
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        contentBase64,
      });
    }
    // Reject up-front with a clear message rather than letting an oversized JSON body hit the API's
    // size limit and come back as an opaque "Failed to send." (NOTE: keep this at or below the real
    // platform request-body limit — Netlify functions cap well under the 24 MB app-level cap.)
    const decodedBytes = (b64: string) => Math.floor((b64.length * 3) / 4);
    const currentBytes = composeAttachments.reduce((sum, a) => sum + decodedBytes(a.contentBase64), 0);
    const additionBytes = additions.reduce((sum, a) => sum + decodedBytes(a.contentBase64), 0);
    if (currentBytes + additionBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
      setComposeError(
        `Attachments exceed the ${Math.round(MAX_TOTAL_ATTACHMENT_BYTES / (1024 * 1024))} MB limit — ` +
          `send a link instead, or split them across messages.`
      );
      return;
    }
    setComposeAttachments((prev) => [...prev, ...additions]);
  }, [composeAttachments]);

  const toggleBookingMenu = useCallback(async () => {
    setBookingMenuOpen((prev) => !prev);
    try {
      const r = await fetch("/api/booking/links");
      const d = await r.json().catch(() => ({}));
      const rows = Array.isArray(d?.links) ? d.links : [];
      setComposeBookingLinks(
        rows
          .filter((l: { active?: boolean }) => l.active !== false)
          .map((l: { id: string; slug: string; title: string }) => ({ id: l.id, slug: l.slug, title: l.title }))
      );
    } catch {
      /* keep whatever we had */
    }
  }, []);

  const insertBookingLink = useCallback((slug: string, title: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    composeEditorRef.current?.insertLink(`${origin}/book/${slug}`, title || "Book a time");
    setBookingMenuOpen(false);
  }, []);

  const handleSaveComposeTemplate = async () => {
    const name = saveTemplateName.trim();
    if (!name || !composeAccountEmail || saveTemplateSaving) return;
    setSaveTemplateSaving(true);
    setComposeError("");
    try {
      const response = await fetch("/api/gmail/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountEmail: composeAccountEmail,
          name,
          subject: composeSubject.trim() || "",
          bodyHtml: composeBodyHtml,
          bodyText: composeBody,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || "Failed to save template.");
      setSaveTemplateModalOpen(false);
      setSaveTemplateName("");
      const listRes = await fetch(
        `/api/gmail/templates?accountEmail=${encodeURIComponent(composeAccountEmail)}`
      );
      const listPayload = await listRes.json().catch(() => ({}));
      setComposeTemplates(Array.isArray(listPayload?.templates) ? listPayload.templates : []);
    } catch (error) {
      setComposeError(error instanceof Error ? error.message : "Failed to save template.");
    } finally {
      setSaveTemplateSaving(false);
    }
  };

  const applyComposeTemplate = (templateId: string) => {
    const template = composeTemplates.find((entry) => entry.id === templateId);
    if (!template) return;
    if (template.subject) setComposeSubject(template.subject);
    if (template.bodyHtml && template.bodyHtml.trim()) {
      setComposeBodyHtml(template.bodyHtml);
      setComposeBody(template.bodyText || "");
    } else if (template.bodyText && template.bodyText.trim()) {
      const raw = template.bodyText;
      setComposeBody(raw);
      const esc = (value: string) =>
        value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      setComposeBodyHtml(`<p>${esc(raw).replace(/\n/g, "<br />")}</p>`);
    }
    setComposeMoreOpen(false);
  };

  // Append a chosen signature to the end of the current body (unlike templates, which replace it).
  const applyComposeSignature = (signatureId: string) => {
    const sig = composeSignatures.find((s) => s.id === signatureId);
    if (!sig) return;
    const escSig = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const sigHtml =
      sig.signatureHtml && sig.signatureHtml.trim()
        ? sig.signatureHtml
        : `<p>${escSig(sig.signatureText || "").replace(/\n/g, "<br />")}</p>`;
    setComposeBodyHtml((prev) => `${prev || ""}<p><br /></p>${sigHtml}`);
    setComposeBody((prev) => `${(prev || "").replace(/\s+$/, "")}\n\n${sig.signatureText || ""}`.trim());
    setComposeMoreOpen(false);
  };

  const handlePrintCompose = () => {
    const html =
      composeBodyHtml.trim() ||
      `<p>${composeBody
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br />")}</p>`;
    printComposeContent(composeSubject || "(No Subject)", html);
  };

  const messagesCountLabel = `${filteredMessages.length} Emails`;
  const activeModuleLabel = activeLabelId
    ? activeLabelName
    : MODULES.find((item) => item.key === activeModule)?.label || "Mailbox";
  const pageLabel = hasNextPage ? `Page ${currentPage}` : `Page ${currentPage} / ${currentPage}`;
  const composeFromOptions = Array.from(
    new Set([
      ...(selectedAccounts.length > 0 ? selectedAccounts : connectedAccounts.map((entry) => entry.email)),
      ...providerAccounts.map((entry) => entry.accountEmail),
    ])
  );

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
                      void openNewCompose();
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
                          <div className="h-full flex flex-col">
                            <input
                              ref={importInputRef}
                              type="file"
                              accept=".csv,text/csv"
                              onChange={handleImportCsv}
                              className="hidden"
                            />
                            <div className="px-4 py-3 border-b border-white/30 overflow-visible relative z-20">
                              <div className="mx-auto inline-flex items-center justify-center gap-2 whitespace-nowrap min-w-max">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAddContactForm(emptyAddContactForm);
                                    setAddContactFirstNameTouched(false);
                                    setAddContactError("");
                                    setIsAddContactModalOpen(true);
                                  }}
                                  className="inline-flex items-center gap-2 rounded-lg bg-[#701CC0] text-white px-3 py-2 text-xs font-medium hover:bg-[#5f17a5]"
                                >
                                  <FiPlus className="w-3.5 h-3.5" />
                                  Add Contact
                                </button>
                                <button
                                  type="button"
                                  onClick={() => importInputRef.current?.click()}
                                  className="inline-flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-medium text-[#374151] hover:bg-[#F9FAFB]"
                                  title="Import CSV"
                                  aria-label="Import CSV"
                                >
                                  <FiUpload className="w-3.5 h-3.5" />
                                  Import CSV
                                </button>
                                <button
                                  type="button"
                                  onClick={exportContactsCsv}
                                  className="inline-flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-medium text-[#374151] hover:bg-[#F9FAFB]"
                                  title="Export As CSV"
                                  aria-label="Export As CSV"
                                >
                                  <FiDownload className="w-3.5 h-3.5" />
                                  Export As CSV
                                </button>
                                <button
                                  type="button"
                                  onClick={syncFromGmailContacts}
                                  className="inline-flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-medium text-[#374151] hover:bg-[#F9FAFB]"
                                >
                                  <FaGoogle className="w-3.5 h-3.5 text-[#EA4335]" />
                                  Sync Gmail
                                </button>
                                <div className="rounded-lg border border-transparent bg-white px-3 py-1.5 flex items-center gap-2 w-80 shadow-sm focus-within:ring-2 focus-within:ring-[#701CC0] transition">
                                  <FiSearch className="w-4 h-4 text-[#6B7280]" />
                                  <input
                                    value={contactSearch}
                                    onChange={(e) => setContactSearch(e.target.value)}
                                    placeholder="Search Contacts"
                                    className="w-full text-sm bg-transparent outline-none"
                                  />
                                  {contactSearch.trim() ? (
                                    <button
                                      type="button"
                                      onClick={() => setContactSearch("")}
                                      className="inline-flex items-center justify-center rounded p-0.5 text-[#9CA3AF] hover:text-[#6B7280] hover:bg-[#F3F4F6]"
                                      aria-label="Clear Contact Search"
                                      title="Clear Contact Search"
                                    >
                                      <FiX className="w-3.5 h-3.5" />
                                    </button>
                                  ) : null}
                                </div>
                                <div className="relative" ref={contactFilterMenuRef}>
                                  <button
                                    type="button"
                                    onClick={() => setContactFilterOpen((prev) => !prev)}
                                    className="inline-flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-4 py-2 text-sm text-[#374151] shadow-sm transition-colors duration-200 hover:border-[#701CC0] hover:bg-gray-50"
                                  >
                                    <FiFilter className="h-4 w-4" />
                                    <span className="text-sm font-medium">Filter</span>
                                    <svg
                                      className={`h-4 w-4 transition-transform duration-200 ${contactFilterOpen ? "rotate-180" : ""}`}
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                      aria-hidden
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </button>
                                  {contactFilterOpen ? (
                                    <div className="absolute right-0 z-[160] mt-2 w-72 rounded-xl border border-[#E5E7EB] bg-white py-4 shadow-xl">
                                      <div className="px-5">
                                        <h3 className="mb-4 text-sm font-semibold text-[#1E1B2E]">{"Sort & Filter"}</h3>

                                        <div className="mb-5">
                                          <label className="mb-2 block text-xs font-medium text-[#6B7280]">Tag</label>
                                          <div className="relative">
                                            <select
                                              value={contactTagFilter}
                                              onChange={(e) => {
                                                setContactTagFilter(e.target.value);
                                              }}
                                              className="w-full appearance-none rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 pr-10 text-sm text-[#1E1B2E] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#701CC0]"
                                            >
                                              <option value="">All tags</option>
                                              {contactsTags.map((tag) => (
                                                <option key={tag.id} value={tag.id}>
                                                  {tag.name}
                                                </option>
                                              ))}
                                            </select>
                                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                                              <svg className="h-4 w-4 text-[#6B7280]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                              </svg>
                                            </div>
                                          </div>
                                        </div>

                                        <div className="mb-5">
                                          <label className="mb-2 block text-xs font-medium text-[#6B7280]">Source</label>
                                          <div className="relative">
                                            <select
                                              value={contactSourceFilter}
                                              onChange={(e) => {
                                                setContactSourceFilter((e.target.value || "") as "" | "MANUAL" | "GMAIL" | "CSV");
                                              }}
                                              className="w-full appearance-none rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 pr-10 text-sm text-[#1E1B2E] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#701CC0]"
                                            >
                                              <option value="">All sources</option>
                                              <option value="MANUAL">Manual</option>
                                              <option value="GMAIL">Gmail</option>
                                              <option value="CSV">CSV</option>
                                            </select>
                                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                                              <svg className="h-4 w-4 text-[#6B7280]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                              </svg>
                                            </div>
                                          </div>
                                        </div>

                                        <div className="border-t border-[#E5E7EB] pt-3">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setContactTagFilter("");
                                              setContactSourceFilter("");
                                              setContactFilterOpen(false);
                                            }}
                                            className="w-full rounded-lg bg-gray-50 px-3 py-2 text-xs font-medium text-[#6B7280] transition-colors duration-200 hover:bg-gray-100 hover:text-[#374151]"
                                          >
                                            Clear All Filters
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                            <div className="flex-1 overflow-auto p-2">
                              {contactsError ? (
                                <div className={`m-3 ${ALERT.error}`}>{contactsError}</div>
                              ) : null}
                              {contactsLoading ? (
                                <MailboxLoader label="Loading Contacts..." />
                              ) : contacts.length === 0 ? (
                                <div className="h-full min-h-[320px] flex items-center justify-center px-6">
                                  <div className="text-center rounded-2xl border border-[#E7E9F2] bg-white/50 backdrop-blur-md px-8 py-10">
                                    <FiUsers className="w-8 h-8 mx-auto text-[#701CC0] animate-pulse" />
                                    <p className="mt-3 text-sm font-semibold text-[#2A2D3B]">No Contacts Found</p>
                                    <p className="text-xs text-[#7C829A] mt-1">Add a contact, import CSV, or sync from Gmail to get started.</p>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  <div className="rounded-xl border border-[#E8EBF4] bg-white overflow-hidden">
                                    <table className="min-w-full text-sm">
                                      <thead className="sticky top-0 bg-[#F9FAFD] z-10">
                                        <tr className="border-b border-[#E8EBF4] text-left text-xs text-[#6B7280] uppercase tracking-wide">
                                          <th className="px-4 py-3 font-medium">Name</th>
                                          <th className="px-4 py-3 font-medium">Email</th>
                                          {contactsVisibility.showPhone ? <th className="px-4 py-3 font-medium">Phone</th> : null}
                                          {contactsVisibility.showBusiness ? <th className="px-4 py-3 font-medium">Business</th> : null}
                                          {contactsVisibility.showWebsite ? <th className="px-4 py-3 font-medium">Website</th> : null}
                                          <th className="px-4 py-3 font-medium">Address</th>
                                          <th className="px-4 py-3 font-medium">Tags</th>
                                          <th className="px-4 py-3 font-medium text-right">Manage</th>
                                        </tr>
                                      </thead>
                                      <tbody className="bg-white divide-y divide-[#EEF1F7]">
                                        {contacts.map((contact) => {
                                          const existingTagIds = new Set(contact.tags.map((tag) => tag.id));
                                          const availableTags = contactsTags.filter((tag) => !existingTagIds.has(tag.id));
                                          const displayName =
                                            `${contact.firstName || ""} ${contact.lastName || ""}`.trim() || "(No Name)";
                                          return (
                                            <tr key={contact.id} className="hover:bg-[#F8F3FF] transition-colors">
                                              <td className="px-4 py-3">
                                                <div className="font-medium text-[#1E1B2E]">{displayName}</div>
                                                <div className="mt-0.5 text-[11px] text-[#8A90A6] uppercase tracking-wide">{contact.source}</div>
                                              </td>
                                              <td className="px-4 py-3 text-[#374151]">{contact.email}</td>
                                              {contactsVisibility.showPhone ? <td className="px-4 py-3 text-[#374151]">{contact.phone || "-"}</td> : null}
                                              {contactsVisibility.showBusiness ? <td className="px-4 py-3 text-[#374151]">{contact.business || "-"}</td> : null}
                                              {contactsVisibility.showWebsite ? (
                                                <td className="px-4 py-3 text-[#374151]">
                                                  {contact.website ? (
                                                    <a
                                                      href={/^https?:\/\//i.test(contact.website) ? contact.website : `https://${contact.website}`}
                                                      target="_blank"
                                                      rel="noopener noreferrer"
                                                      className="text-[#701CC0] hover:underline"
                                                    >
                                                      Click
                                                    </a>
                                                  ) : (
                                                    "-"
                                                  )}
                                                </td>
                                              ) : null}
                                              <td className="px-4 py-3 text-[#374151] max-w-[220px] truncate">{contact.address || "-"}</td>
                                              <td className="px-4 py-3">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                  {contact.tags.map((tag) => (
                                                    <span
                                                      key={tag.id}
                                                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] text-white"
                                                      style={{ backgroundColor: tag.color || "#701CC0" }}
                                                    >
                                                      {tag.name}
                                                      <button
                                                        type="button"
                                                        onClick={() => removeTagFromContact(contact.id, tag.id)}
                                                        className="text-white/90 hover:text-white"
                                                      >
                                                        <FiX className="w-3 h-3" />
                                                      </button>
                                                    </span>
                                                  ))}
                                                  <div className="relative">
                                                    <button
                                                      type="button"
                                                      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#374151]"
                                                      aria-label="Add Tag"
                                                      title="Add Tag"
                                                    >
                                                      <FiPlus className="w-3 h-3" />
                                                    </button>
                                                    <select
                                                      value=""
                                                      onChange={(e) => addTagToContact(contact.id, e.target.value)}
                                                      className="absolute inset-0 h-5 w-5 cursor-pointer opacity-0"
                                                      aria-label="Select tag to add"
                                                    >
                                                      <option value="">Select tag</option>
                                                      {availableTags.map((tag) => (
                                                        <option key={tag.id} value={tag.id}>
                                                          {tag.name}
                                                        </option>
                                                      ))}
                                                    </select>
                                                  </div>
                                                </div>
                                              </td>
                                              <td className="px-4 py-3 text-right">
                                                <div className="inline-flex justify-end">
                                                  <RowActionMenu label={`Manage ${displayName}`} menuWidthClassName="w-44">
                                                    <RowActionMenuItem onClick={() => editContact(contact)} icon={<FiEdit3 className="w-4 h-4" />} tone="accent">
                                                      Edit Contact
                                                    </RowActionMenuItem>
                                                    <RowActionMenuItem onClick={() => deleteContact(contact)} icon={<FiTrash2 className="w-4 h-4" />} tone="danger">
                                                      Delete Contact
                                                    </RowActionMenuItem>
                                                  </RowActionMenu>
                                                </div>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                  {contactsTotalCount > CONTACTS_PAGE_SIZE ? (
                                    <div className="px-1 pb-1 flex items-center justify-between text-xs text-[#6B7280]">
                                      <span>
                                        Showing page {contactCurrentPage} of {contactsTotalPages} ({contactsTotalCount} contacts)
                                      </span>
                                      <div className="inline-flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => setContactCurrentPage((prev) => Math.max(1, prev - 1))}
                                          disabled={contactsLoading || contactCurrentPage <= 1}
                                          className="px-2 py-1 rounded border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                          Previous
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setContactCurrentPage((prev) => Math.min(contactsTotalPages, prev + 1))}
                                          disabled={contactsLoading || contactCurrentPage >= contactsTotalPages}
                                          className="px-2 py-1 rounded border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                          Next
                                        </button>
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              )}
                            </div>
                          </div>
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
                                      openComposeDraftFromRow(message);
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
                              void openReplyCompose();
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
                              void openReplyAllCompose();
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
                              void openForwardCompose();
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
                              <p>{formatDetailedDate(selectedMessageDetail?.timestamp || selectedMessage.timestamp, selectedMessageDetail?.date || selectedMessage.date)}</p>
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
                                {!inlineComposeMode ? (
                                  <div className="flex flex-wrap items-center gap-2 pt-3">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        void openReplyCompose();
                                      }}
                                      className={REPLY_ACTION_BUTTON}
                                    >
                                      <FiCornerUpLeft className="h-4 w-4" aria-hidden />
                                      Reply
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        void openReplyAllCompose();
                                      }}
                                      className={REPLY_ACTION_BUTTON}
                                    >
                                      <MdReplyAll className="h-[18px] w-[18px]" aria-hidden />
                                      Reply all
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        void openForwardCompose();
                                      }}
                                      className={REPLY_ACTION_BUTTON}
                                    >
                                      <FiSend className="h-4 w-4" aria-hidden />
                                      Forward
                                    </button>
                                  </div>
                                ) : null}

                                {inlineComposeMode ? (
                                  /* Inline reply, shaped the way Gmail's is: one recipient line, the
                                     message, then Send. No uppercase field labels and no stacked
                                     boxes — a reply already has its recipient and its subject, so
                                     presenting them as a form to fill in is noise.

                                     Authored light-first (bg-white, text-[#1E1B2E]) like the rest of
                                     the panel, because the dark theme remaps those classes. The
                                     previous version set its background with a gradient utility,
                                     which the dark layer does not remap — so the card stayed white
                                     while its text was remapped to near-white and became illegible. */
                                  <div ref={inlineComposeRef} className="pt-3">
                                    <div className="inline-reply-card rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
                                      {/* Recipient line. Gmail shows the address as plain text with
                                          Cc/Bcc one click away, rather than a labelled form row and a
                                          mode caption repeating what the button you just pressed said. */}
                                      <div className="flex items-center gap-2 border-b border-[#E5E7EB] px-4 py-2.5">
                                        <span className="shrink-0 text-[13px] text-[#6B7280]">To</span>
                                        {inlineToEditing ? (
                                          <input
                                            value={inlineComposeTo}
                                            onChange={(event) => setInlineComposeTo(event.target.value)}
                                            onBlur={() => setInlineToEditing(false)}
                                            autoFocus
                                            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[13px] text-[#1E1B2E] outline-none placeholder:text-[#9CA3AF]"
                                            placeholder="name@email.com, second@email.com"
                                            aria-label="To (comma separated)"
                                          />
                                        ) : (
                                          /* Each address is its own chip so several are countable at
                                             a glance; the whole row is still one comma-separated
                                             value, so clicking it edits the list as text. */
                                          <button
                                            type="button"
                                            onClick={() => setInlineToEditing(true)}
                                            className="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-left"
                                            title="Click to edit recipients (comma separated)"
                                          >
                                            {inlineComposeTo
                                              .split(",")
                                              .map((entry) => entry.trim())
                                              .filter(Boolean).length === 0 ? (
                                              <span className="text-[13px] text-[#9CA3AF]">Add recipients</span>
                                            ) : (
                                              inlineComposeTo
                                                .split(",")
                                                .map((entry) => entry.trim())
                                                .filter(Boolean)
                                                .map((addr, index, all) => {
                                                  const bare = addr.includes("<")
                                                    ? (addr.match(/<([^>]+)>/)?.[1] || addr).trim()
                                                    : addr;
                                                  const valid = EMAIL_REGEX.test(bare);
                                                  return (
                                                    <span
                                                      key={`${addr}-${index}`}
                                                      className={`recipient-chip ${valid ? "" : "is-invalid"}`}
                                                      title={valid ? addr : `${addr} — not a valid address`}
                                                    >
                                                      <span className="truncate">{addr}</span>
                                                      <span
                                                        role="button"
                                                        tabIndex={0}
                                                        aria-label={`Remove ${addr}`}
                                                        className="recipient-chip-x"
                                                        onClick={(event) => {
                                                          event.stopPropagation();
                                                          setInlineComposeTo(all.filter((_, i) => i !== index).join(", "));
                                                        }}
                                                        onKeyDown={(event) => {
                                                          if (event.key !== "Enter" && event.key !== " ") return;
                                                          event.stopPropagation();
                                                          event.preventDefault();
                                                          setInlineComposeTo(all.filter((_, i) => i !== index).join(", "));
                                                        }}
                                                      >
                                                        <FiX className="h-3 w-3" aria-hidden />
                                                      </span>
                                                    </span>
                                                  );
                                                })
                                            )}
                                          </button>
                                        )}
                                        <div className="flex shrink-0 items-center gap-2">
                                          <button
                                            type="button"
                                            onClick={() => setInlineShowCc((open) => !open)}
                                            aria-pressed={inlineShowCc}
                                            className="text-[12px] font-medium text-[#701CC0] hover:underline"
                                          >
                                            Cc
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setInlineShowBcc((open) => !open)}
                                            aria-pressed={inlineShowBcc}
                                            className="text-[12px] font-medium text-[#701CC0] hover:underline"
                                          >
                                            Bcc
                                          </button>
                                        </div>
                                      </div>

                                      {inlineShowCc ? (
                                        <div className="flex items-center gap-2 border-b border-[#E5E7EB] px-4 py-2.5">
                                          <span className="shrink-0 text-[13px] text-[#6B7280]">Cc</span>
                                          <input
                                            value={inlineComposeCc}
                                            onChange={(event) => setInlineComposeCc(event.target.value)}
                                            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[13px] text-[#1E1B2E] outline-none"
                                            aria-label="Cc"
                                          />
                                        </div>
                                      ) : null}
                                      {inlineShowBcc ? (
                                        <div className="flex items-center gap-2 border-b border-[#E5E7EB] px-4 py-2.5">
                                          <span className="shrink-0 text-[13px] text-[#6B7280]">Bcc</span>
                                          <input
                                            value={inlineComposeBcc}
                                            onChange={(event) => setInlineComposeBcc(event.target.value)}
                                            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[13px] text-[#1E1B2E] outline-none"
                                            aria-label="Bcc"
                                          />
                                        </div>
                                      ) : null}

                                      {/* Subject only when forwarding. A reply inherits the thread's
                                          subject, as in Gmail; offering it as a field here invites
                                          breaking the thread. */}
                                      {inlineComposeMode === "forward" ? (
                                        <div className="flex items-center gap-2 border-b border-[#E5E7EB] px-4 py-2.5">
                                          <span className="shrink-0 text-[13px] text-[#6B7280]">Subject</span>
                                          <input
                                            value={inlineComposeSubject}
                                            onChange={(event) => setInlineComposeSubject(event.target.value)}
                                            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[13px] text-[#1E1B2E] outline-none"
                                            aria-label="Subject"
                                          />
                                        </div>
                                      ) : null}

                                      {/* Same rich editor the main composer uses, with its formatting
                                          toolbar pinned open — Gmail's reply always shows one, and a
                                          plain textarea meant a reply could not carry bold, a list or
                                          a link at all. */}
                                      {/* The reply body. Removing the trimmed-content block took
                                          this with it, leaving the composer with no input at all —
                                          the recipient row and the send bar rendered, but there was
                                          nowhere to type. */}
                                      <div className="px-2 pb-1 pt-2">
                                        <ComposeRichEditor
                                          ref={inlineEditorRef}
                                          valueHtml={inlineComposeIntroHtml}
                                          onChange={({ html, text }) => {
                                            setInlineComposeIntroHtml(html);
                                            setInlineComposeIntroText(text);
                                          }}
                                          minHeightClass="min-h-[150px]"
                                          showToolbar={inlineShowFormatting}
                                        />
                                      </div>

                                      {inlineComposeMode === "forward" && inlineComposePreviewHtml ? (
                                        <div className="mx-4 mb-3 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-3">
                                          <p className="mb-2 text-[11px] uppercase tracking-wide text-[#6B7280]">
                                            Forwarded message
                                          </p>
                                          <div
                                            className="max-h-48 overflow-y-auto text-sm leading-6 text-[#374151]"
                                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(inlineComposePreviewHtml) }}
                                          />
                                        </div>
                                      ) : null}

                                      {inlineComposeError ? (
                                        <p className="mx-4 mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                                          {inlineComposeError}
                                        </p>
                                      ) : null}
                                      {inlineComposeSuccess ? (
                                        <p className="mx-4 mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                                          {inlineComposeSuccess}
                                        </p>
                                      ) : null}

                                      {/* One control strip, per Gmail: a compact Send, then the insert/mode controls
                                          as quiet icons, then discard at the far edge. The formatting
                                          toolbar is rendered into this same row by the editor above
                                          (toolbarSlot), so there is no second bar competing with it. */}
                                      <div className="inline-reply-bar flex flex-wrap items-center gap-1 px-3 pb-2.5 pt-1.5">
                                        <button
                                          type="button"
                                          onClick={sendInlineCompose}
                                          disabled={
                                            inlineComposeSending ||
                                            !inlineComposeTo.trim() ||
                                            !inlineComposeTo
                                              .split(",")
                                              .map((entry) => entry.trim())
                                              .filter(Boolean)
                                              .every((entry) =>
                                                EMAIL_REGEX.test(entry.includes("<") ? (entry.match(/<([^>]+)>/)?.[1] || entry).trim() : entry)
                                              ) ||
                                            (!inlineComposeIntroText.trim() && !inlineComposeBodyText.trim())
                                          }
                                          className="compose-cta inline-flex shrink-0 items-center justify-center gap-2 rounded-md px-4 py-2 text-[13px] font-medium text-white shadow-[0_6px_20px_-8px_rgba(94,23,168,0.9)] transition-[filter] duration-200 ease-out hover:brightness-[1.08] active:brightness-[0.96] disabled:pointer-events-none disabled:opacity-40"
                                        >
                                          <FiSend className="h-4 w-4 shrink-0" aria-hidden />
                                          {inlineComposeSending ? "Sending…" : "Send"}
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => void handleArtemisDraft()}
                                          disabled={artemisDrafting}
                                          className="inline-reply-icon email-tip"
                                          data-tip={artemisDrafting ? "Writing…" : "Help me write"}
                                          aria-label="Help me write"
                                        >
                                          <BoltDraw className="h-4 w-4" drafting={artemisDrafting} />
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => setInlineShowFormatting((open) => !open)}
                                          aria-pressed={inlineShowFormatting}
                                          className={`inline-reply-icon email-tip ${inlineShowFormatting ? "is-on" : ""}`}
                                          data-tip="Formatting options"
                                          aria-label="Formatting options"
                                        >
                                          <FiType className="h-4 w-4" aria-hidden />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => composeAttachInputRef.current?.click()}
                                          className="inline-reply-icon email-tip"
                                          data-tip="Attach files"
                                          aria-label="Attach files"
                                        >
                                          <FiPaperclip className="h-4 w-4" aria-hidden />
                                        </button>
                                        <button
                                          type="button"
                                          disabled
                                          className="inline-reply-icon email-tip"
                                          data-tip="Insert from Drive (coming soon)"
                                          aria-label="Insert from Drive"
                                        >
                                          <DriveMark className="h-4 w-4" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => inlineEditorRef.current?.promptInsertLink()}
                                          className="inline-reply-icon email-tip"
                                          data-tip="Insert link"
                                          aria-label="Insert link"
                                        >
                                          <FiLink className="h-4 w-4" aria-hidden />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => inlineEditorRef.current?.promptInsertImage()}
                                          className="inline-reply-icon email-tip"
                                          data-tip="Insert image"
                                          aria-label="Insert image"
                                        >
                                          <FiImage className="h-4 w-4" aria-hidden />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setConfidentialOpen((open) => !open)}
                                          aria-pressed={confidentialOn}
                                          className={`inline-reply-icon email-tip ${confidentialOn ? "is-on" : ""}`}
                                          data-tip="Confidential mode"
                                          aria-label="Confidential mode"
                                        >
                                          <FiLock className="h-4 w-4" aria-hidden />
                                        </button>
                                        <div className="relative shrink-0">
                                          <button
                                            type="button"
                                            onClick={() => setInlineMoreOpen((open) => !open)}
                                            className="inline-reply-icon email-tip"
                                            data-tip="Insert signature"
                                            aria-label="Insert signature"
                                            aria-expanded={inlineMoreOpen}
                                          >
                                            <FiEdit3 className="h-4 w-4" aria-hidden />
                                          </button>
                                          {inlineMoreOpen ? (
                                            <div className="compose-menu absolute bottom-full left-0 z-[60] mb-2 w-52">
                                              {composeSignatures.length === 0 ? (
                                                <p className="px-3 py-2 text-xs text-[#8C86A6]">No signatures yet</p>
                                              ) : (
                                                composeSignatures.map((sig) => (
                                                  <button
                                                    key={sig.id}
                                                    type="button"
                                                    className={`${composeMenuItemClass} truncate`}
                                                    onClick={() => {
                                                      setInlineMoreOpen(false);
                                                      applyComposeSignature(sig.id);
                                                    }}
                                                  >
                                                    <FiEdit3 className="h-4 w-4 shrink-0" aria-hidden />
                                                    <span className="truncate">
                                                      {sig.name}
                                                      {sig.isDefault ? " (default)" : ""}
                                                    </span>
                                                  </button>
                                                ))
                                              )}
                                            </div>
                                          ) : null}
                                        </div>

                                        <span className="flex-1" aria-hidden />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            // Discard means gone: drop the autosaved draft rather
                                            // than flushing it, or every abandoned reply would
                                            // accumulate in Drafts.
                                            if (inlineDraftStorageKey) {
                                              void clearLocalDraft(inlineDraftStorageKey).catch(() => null);
                                            }
                                            setInlineComposeMode(null);
                                            void loadMailboxCounts();
                                          }}
                                          className="inline-reply-icon email-tip"
                                          data-tip="Discard Reply"
                                          aria-label="Discard Reply"
                                        >
                                          <FiTrash2 className="h-4 w-4" aria-hidden />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ) : null}
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

      {isAddContactModalOpen ? (
        <div
          className="fixed inset-0 z-[140] flex items-center justify-center bg-[#2E1050]/30 backdrop-blur-md p-4"
          onClick={closeAddContactModal}
        >
          <div
            className="w-full max-w-2xl rounded-2xl bg-white/90 backdrop-blur-xl border border-white/70 shadow-[0_30px_70px_-20px_rgba(46,16,80,0.55)] p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#701CC0]/10 text-[#701CC0] inline-flex items-center justify-center">
                  <FiUserPlus className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-semibold text-[#1E1B2E]">Add Contact</h3>
              </div>
              <button
                type="button"
                onClick={closeAddContactModal}
                className="p-1.5 rounded-md text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#374151]"
                aria-label="Close Add Contact Modal"
              >
                <FiX className="w-4 h-4" />
              </button>
            </div>
            {addContactError ? (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{addContactError}</div>
            ) : null}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className={FIELD_LABEL}>
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  value={addContactForm.firstName}
                  onChange={(event) => setAddContactForm((prev) => ({ ...prev, firstName: event.target.value }))}
                  onBlur={() => setAddContactFirstNameTouched(true)}
                  placeholder="Enter First Name"
                  className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#701CC0] ${
                    addContactFirstNameTouched && !addContactForm.firstName.trim()
                      ? "border-red-500 bg-red-50"
                      : "border-[#E5E7EB]"
                  }`}
                />
              </div>
              <div>
                <label className={FIELD_LABEL}>Last Name</label>
                <input
                  value={addContactForm.lastName}
                  onChange={(event) => setAddContactForm((prev) => ({ ...prev, lastName: event.target.value }))}
                  placeholder="Enter Last Name"
                  className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#701CC0]"
                />
              </div>
              <div className="md:col-span-2">
                <label className={FIELD_LABEL}>
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  value={addContactForm.email}
                  onChange={(event) => setAddContactForm((prev) => ({ ...prev, email: event.target.value }))}
                  placeholder="Enter Email"
                  className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#701CC0] ${
                    addContactForm.email.trim() && !EMAIL_REGEX.test(addContactForm.email.trim())
                      ? "border-red-500 bg-red-50"
                      : "border-[#E5E7EB]"
                  }`}
                />
              </div>
              {addContactForm.email.trim() && !EMAIL_REGEX.test(addContactForm.email.trim()) ? (
                <p className="md:col-span-2 -mt-1 text-xs text-red-600">Please enter a valid email address.</p>
              ) : null}
              <div>
                <label className={FIELD_LABEL}>Phone</label>
                <input
                  value={addContactForm.phone}
                  onChange={(event) => setAddContactForm((prev) => ({ ...prev, phone: formatPhoneInput(event.target.value) }))}
                  placeholder="(123)-456-7890"
                  className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#701CC0] ${
                    addContactForm.phone.trim() && !isPhoneValid(addContactForm.phone)
                      ? "border-red-500 bg-red-50"
                      : "border-[#E5E7EB]"
                  }`}
                />
              </div>
              {addContactForm.phone.trim() && !isPhoneValid(addContactForm.phone) ? (
                <p className="md:col-span-2 -mt-1 text-xs text-red-600">Phone format: (123)-456-7890</p>
              ) : null}
              <div>
                <label className={FIELD_LABEL}>Business</label>
                <input
                  value={addContactForm.business}
                  onChange={(event) => setAddContactForm((prev) => ({ ...prev, business: event.target.value }))}
                  placeholder="Enter Business"
                  className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#701CC0]"
                />
              </div>
              <div>
                <label className={FIELD_LABEL}>Website</label>
                <input
                  value={addContactForm.website}
                  onChange={(event) => setAddContactForm((prev) => ({ ...prev, website: event.target.value }))}
                  placeholder="Enter Website"
                  className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#701CC0] ${
                    addContactForm.website.trim() && !isWebsiteValid(addContactForm.website)
                      ? "border-red-500 bg-red-50"
                      : "border-[#E5E7EB]"
                  }`}
                />
              </div>
              {addContactForm.website.trim() && !isWebsiteValid(addContactForm.website) ? (
                <p className="md:col-span-2 -mt-1 text-xs text-red-600">Please enter a valid website URL.</p>
              ) : null}
              <div className="md:col-span-2">
                <label className={FIELD_LABEL}>Address</label>
                <input
                  value={addContactForm.address}
                  onChange={(event) => setAddContactForm((prev) => ({ ...prev, address: event.target.value }))}
                  placeholder="Enter Address"
                  className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#701CC0]"
                />
              </div>
            </div>
            <div className="flex items-center justify-between mt-5">
              <button
                type="button"
                onClick={closeAddContactModal}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={createContact}
                disabled={
                  addingContact ||
                  !addContactForm.firstName.trim() ||
                  !addContactForm.email.trim() ||
                  !EMAIL_REGEX.test(addContactForm.email.trim()) ||
                  !isPhoneValid(addContactForm.phone) ||
                  !isWebsiteValid(addContactForm.website)
                }
                className="px-4 py-2 rounded-lg bg-[#701CC0] text-white text-sm font-medium hover:bg-[#5f17a5] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addingContact ? "Adding..." : "Add Contact"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isEditContactModalOpen ? (
        <div className="fixed inset-0 bg-[#2E1050]/30 backdrop-blur-md flex items-center justify-center z-[150] p-4">
          <div
            className="bg-white/90 backdrop-blur-xl border border-white/70 shadow-[0_30px_70px_-20px_rgba(46,16,80,0.55)] rounded-2xl p-6 w-full max-w-2xl mx-4"
            ref={editContactModalRef}
            role="dialog"
            aria-modal="true"
            aria-label="Edit Contact"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-[#701CC0]/10 flex items-center justify-center">
                <FiEdit3 className="w-6 h-6 text-[#701CC0]" />
              </div>
              <h3 className="text-xl font-semibold text-[#1E1B2E]">Edit Contact</h3>
            </div>

            {editContactError ? (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{editContactError}</div>
            ) : null}

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className={FIELD_LABEL}>
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editContactForm.firstName}
                  onChange={(event) => setEditContactForm((prev) => ({ ...prev, firstName: event.target.value }))}
                  onBlur={() => setEditContactTouched((prev) => ({ ...prev, firstName: true }))}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#701CC0] text-sm ${
                    editContactTouched.firstName && !editContactForm.firstName.trim()
                      ? "border-red-500 bg-red-50"
                      : "border-[#D1D5DB]"
                  }`}
                />
              </div>
              <div>
                <label className={FIELD_LABEL}>Last Name</label>
                <input
                  type="text"
                  value={editContactForm.lastName}
                  onChange={(event) => setEditContactForm((prev) => ({ ...prev, lastName: event.target.value }))}
                  className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:outline-none focus:ring-2 focus:ring-[#701CC0] text-sm"
                />
              </div>
              <div>
                <label className={FIELD_LABEL}>
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={editContactForm.email}
                  onChange={(event) => setEditContactForm((prev) => ({ ...prev, email: event.target.value }))}
                  onBlur={() => setEditContactTouched((prev) => ({ ...prev, email: true }))}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#701CC0] text-sm ${
                    editContactTouched.email &&
                    editContactForm.email.trim() &&
                    !EMAIL_REGEX.test(editContactForm.email.trim())
                      ? "border-red-500 bg-red-50"
                      : "border-[#D1D5DB]"
                  }`}
                />
              </div>
              <div>
                <label className={FIELD_LABEL}>Phone</label>
                <input
                  type="text"
                  value={editContactForm.phone}
                  onChange={(event) =>
                    setEditContactForm((prev) => ({ ...prev, phone: formatPhoneInput(event.target.value) }))
                  }
                  onBlur={() => setEditContactTouched((prev) => ({ ...prev, phone: true }))}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#701CC0] text-sm ${
                    editContactTouched.phone && editContactForm.phone.trim() && !isPhoneValid(editContactForm.phone)
                      ? "border-red-500 bg-red-50"
                      : "border-[#D1D5DB]"
                  }`}
                />
              </div>
              <div>
                <label className={FIELD_LABEL}>Business</label>
                <input
                  type="text"
                  value={editContactForm.business}
                  onChange={(event) => setEditContactForm((prev) => ({ ...prev, business: event.target.value }))}
                  className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:outline-none focus:ring-2 focus:ring-[#701CC0] text-sm"
                />
              </div>
              <div>
                <label className={FIELD_LABEL}>Website</label>
                <input
                  type="text"
                  value={editContactForm.website}
                  onChange={(event) => setEditContactForm((prev) => ({ ...prev, website: event.target.value }))}
                  onBlur={() => setEditContactTouched((prev) => ({ ...prev, website: true }))}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#701CC0] text-sm ${
                    editContactTouched.website && editContactForm.website.trim() && !isWebsiteValid(editContactForm.website)
                      ? "border-red-500 bg-red-50"
                      : "border-[#D1D5DB]"
                  }`}
                />
              </div>
              <div className="col-span-2">
                <label className={FIELD_LABEL}>Address</label>
                <input
                  type="text"
                  value={editContactForm.address}
                  onChange={(event) => setEditContactForm((prev) => ({ ...prev, address: event.target.value }))}
                  className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:outline-none focus:ring-2 focus:ring-[#701CC0] text-sm"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={closeEditContactModal}
                className="px-4 py-2 rounded-lg border border-[#E5E7EB] text-[#374151] hover:bg-gray-50 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEditedContact}
                disabled={
                  editingContact ||
                  !editContactForm.firstName.trim() ||
                  !editContactForm.email.trim() ||
                  !EMAIL_REGEX.test(editContactForm.email.trim()) ||
                  !isPhoneValid(editContactForm.phone) ||
                  !isWebsiteValid(editContactForm.website)
                }
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  editingContact ||
                  !editContactForm.firstName.trim() ||
                  !editContactForm.email.trim() ||
                  !EMAIL_REGEX.test(editContactForm.email.trim()) ||
                  !isPhoneValid(editContactForm.phone) ||
                  !isWebsiteValid(editContactForm.website)
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-[#701CC0] text-white hover:bg-[#5f17a5]"
                }`}
              >
                {editingContact ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isComposeOpen ? (
        <div
          className={
            composeExpanded
              ? "fixed inset-0 z-[120] flex items-center justify-center bg-black/45 backdrop-blur-sm p-4"
              : "contents"
          }
          onClick={composeExpanded ? () => setComposeExpanded(false) : undefined}
          role="presentation"
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className={`compose-hud flex flex-col overflow-hidden bg-white shadow-[0_24px_60px_-18px_rgba(46,16,80,0.5)] ${
              composeExpanded
                ? "h-[75vh] w-[75vw] max-h-[75vh] max-w-[75vw] rounded-2xl"
                : "fixed bottom-6 right-6 z-[120] w-[min(100vw-1.5rem,572px)] max-h-[min(92vh,760px)] rounded-2xl"
            }`}
            role="dialog"
            aria-label={composeThreadId ? "Reply composer" : "New message composer"}
          >
            <div className="compose-hud-header flex shrink-0 cursor-default items-center justify-between gap-2 px-4 py-2.5">
              <p className="min-w-0 flex-1 truncate pr-2 text-sm font-semibold text-white">
                {composeThreadId ? "Reply" : "New Message"}
              </p>
              <div className="flex shrink-0 items-center">
                <button
                  type="button"
                  onClick={() => setComposeExpanded((prev) => !prev)}
                  className="rounded-full p-2 text-white/90 hover:bg-white/15"
                  title={composeExpanded ? "Resize" : "Expand"}
                  aria-label={composeExpanded ? "Shrink composer" : "Expand composer"}
                >
                  {composeExpanded ? <FiMinimize2 className="h-5 w-5" /> : <FiMaximize2 className="h-5 w-5" />}
                </button>
                <button
                  type="button"
                  onClick={closeCompose}
                  className="rounded-full p-2 text-white/90 hover:bg-white/15"
                  title="Close"
                  aria-label="Close compose"
                >
                  <FiX className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className={`flex min-h-0 flex-1 flex-col bg-white ${composeExpanded ? "overflow-hidden" : ""}`}>
              <div
                className={`flex min-h-0 flex-1 flex-col px-0 ${
                  composeExpanded
                    ? "overflow-hidden"
                    : `max-h-[min(66vh,580px)] overflow-y-auto ${COMPOSE_NEUTRAL_SCROLLBAR}`
                }`}
              >
                <div className="shrink-0 px-3">
                  <div className="grid grid-cols-[4.25rem_minmax(0,1fr)] items-center gap-x-2 border-b border-[#EAE5F4] py-1">
                    <span className="min-w-0 text-left text-sm leading-none text-[#5f6368]">From</span>
                    <div className="relative min-w-0">
                      <select
                        value={composeFrom || composeAccountEmail}
                        onChange={(event) => {
                          const value = event.target.value;
                          setComposeFrom(value);
                          if (composeFromOptions.includes(value)) {
                            setComposeAccountEmail(value);
                            return;
                          }
                          // An alias only sends through the mailbox that owns it — picking one
                          // has to move the sending account too, or Gmail rejects the send.
                          const owner = composeAliases.find((alias) => alias.email === value)?.accountEmail;
                          if (owner) setComposeAccountEmail(owner);
                        }}
                        className="min-w-0 w-full cursor-pointer appearance-none border-0 bg-transparent py-1.5 pl-0 pr-7 text-sm text-[#1E1B2E] outline-none focus:ring-0"
                      >
                        {composeFromOptions.map((email) => (
                          <option key={email} value={email}>
                            {email}
                          </option>
                        ))}
                        {composeAliases
                          // Drop the primaries — they're already listed above as accounts.
                          .filter((alias) => !composeFromOptions.includes(alias.email))
                          .map((alias) => (
                            <option key={`${alias.accountEmail}::${alias.email}`} value={alias.email}>
                              {alias.displayName ? `${alias.displayName} <${alias.email}>` : alias.email}
                            </option>
                          ))}
                      </select>
                      <FiChevronDown
                        className="pointer-events-none absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5f6368]"
                        aria-hidden
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-[4.25rem_minmax(0,1fr)] items-center gap-x-2 border-b border-[#EAE5F4] py-1">
                    <span className="min-w-0 text-left text-sm leading-none text-[#5f6368]">To</span>
                    <div className="flex min-w-0 items-center gap-2">
                      <input
                        value={composeTo}
                        onChange={(event) => setComposeTo(event.target.value)}
                        placeholder=""
                        className="min-w-0 flex-1 border-0 bg-transparent py-1.5 pl-0 text-sm text-[#1E1B2E] outline-none placeholder:text-[#70757a]"
                      />
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowCc((prev) => !prev)}
                          className={`whitespace-nowrap text-sm font-medium hover:underline ${
                            showCc ? "text-[#701CC0]" : "text-[#701CC0]"
                          }`}
                          aria-pressed={showCc}
                          title={showCc ? "Hide Cc field" : "Show Cc field"}
                        >
                          Cc
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowBcc((prev) => !prev)}
                          className={`whitespace-nowrap text-sm font-medium hover:underline ${
                            showBcc ? "text-[#701CC0]" : "text-[#701CC0]"
                          }`}
                          aria-pressed={showBcc}
                          title={showBcc ? "Hide Bcc field" : "Show Bcc field"}
                        >
                          Bcc
                        </button>
                      </div>
                    </div>
                  </div>

                  {showCc ? (
                    <div className="grid grid-cols-[4.25rem_minmax(0,1fr)] items-center gap-x-2 border-b border-[#EAE5F4] py-1">
                      <span className="min-w-0 text-left text-sm leading-none text-[#5f6368]">Cc</span>
                      <input
                        value={composeCc}
                        onChange={(event) => setComposeCc(event.target.value)}
                        placeholder=""
                        className="min-w-0 border-0 bg-transparent py-1.5 pl-0 text-sm text-[#1E1B2E] outline-none"
                      />
                    </div>
                  ) : null}

                  {showBcc ? (
                    <div className="grid grid-cols-[4.25rem_minmax(0,1fr)] items-center gap-x-2 border-b border-[#EAE5F4] py-1">
                      <span className="min-w-0 text-left text-sm leading-none text-[#5f6368]">Bcc</span>
                      <input
                        value={composeBcc}
                        onChange={(event) => setComposeBcc(event.target.value)}
                        placeholder=""
                        className="min-w-0 border-0 bg-transparent py-1.5 pl-0 text-sm text-[#1E1B2E] outline-none"
                      />
                    </div>
                  ) : null}

                  <div className="grid grid-cols-[4.25rem_minmax(0,1fr)] items-center gap-x-2 border-b border-[#EAE5F4] py-1">
                    <span className="min-w-0 text-left text-sm leading-none text-[#5f6368]">Subject</span>
                    <input
                      value={composeSubject}
                      onChange={(event) => setComposeSubject(event.target.value)}
                      placeholder=""
                      className="min-w-0 border-0 bg-transparent py-1.5 pl-0 text-sm text-[#1E1B2E] outline-none"
                    />
                  </div>
                </div>

                <div
                  className={
                    composeExpanded
                      ? "flex min-h-0 flex-1 flex-col px-3 pb-1 pt-3"
                      : "px-3 pt-3"
                  }
                >
                  <ComposeRichEditor
                    ref={composeEditorRef}
                    valueHtml={composeBodyHtml}
                    onChange={({ html, text }) => {
                      setComposeBodyHtml(html);
                      setComposeBody(text);
                    }}
                    minHeightClass={composeExpanded ? "min-h-0 flex-1" : "min-h-[280px]"}
                    className={composeExpanded ? "min-h-0 flex-1 flex flex-col overflow-hidden" : ""}
                    showToolbar={composeFormattingToolbarOpen}
                  />
                  {composeAttachments.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {composeAttachments.map((attachment) => (
                        <span
                          key={attachment.id}
                          className="inline-flex max-w-full items-center gap-1 rounded-full border border-[#EAE5F4] bg-[#f8f9fa] px-2 py-0.5 text-xs text-[#1E1B2E]"
                        >
                          <span className="min-w-0 truncate">{attachment.filename}</span>
                          <button
                            type="button"
                            className="shrink-0 rounded-full p-0.5 text-[#5f6368] hover:bg-[#e8eaed]"
                            onClick={() =>
                              setComposeAttachments((prev) => prev.filter((a) => a.id !== attachment.id))
                            }
                            aria-label={`Remove ${attachment.filename}`}
                          >
                            <FiX className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <input
                    ref={composeAttachInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={async (event) => {
                      await addComposeAttachmentsFromFiles(event.target.files);
                      event.target.value = "";
                    }}
                  />
                </div>
              </div>

              <div className="shrink-0 border-t border-[#EAE5F4] bg-white px-3 py-2">
                {composeError ? (
                  <div className="mb-2 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-800">{composeError}</div>
                ) : null}
                {undoCountdown !== null ? (
                  <div className="mb-2 flex items-center justify-between rounded-lg bg-[#1E1B2E] px-3 py-2 text-xs font-medium text-white">
                    <span>Sending in {undoCountdown}s…</span>
                    <button type="button" onClick={cancelUndoSend} className="font-semibold underline underline-offset-2">
                      Undo
                    </button>
                  </div>
                ) : null}
                {composeLintWarnings.length > 0 ? (
                  <div className="mb-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
                    <FiAlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    <div>
                      <span className="font-semibold">Deliverability check:</span>
                      <ul className="mt-0.5 list-disc pl-4">
                        {composeLintWarnings.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : null}
                {composeSuccess ? (
                  <div className="mb-2 rounded border border-green-200 bg-green-50 px-2 py-1.5 text-xs text-green-800">
                    {composeSuccess}
                  </div>
                ) : null}
                <div className="compose-actions flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={handleSendCompose}
                      disabled={
                        sendingCompose ||
                        undoCountdown !== null ||
                        !composeTo.trim() ||
                        !composeHasMeaningfulBody ||
                        !composeAccountEmail
                      }
                      className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md bg-[#701CC0] px-6 text-sm font-semibold text-white hover:bg-[#5F17A5] disabled:pointer-events-none disabled:opacity-40"
                    >
                      {sendingCompose ? "Sending…" : scheduleAt ? "Schedule send" : "Send"}
                    </button>
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={() => setScheduleOpen((open) => !open)}
                        title="Schedule send"
                        aria-label="Schedule send"
                        aria-pressed={scheduleOpen || Boolean(scheduleAt)}
                        className={composeIconClass(Boolean(scheduleAt) || scheduleOpen)}
                      >
                        <FiClock className="h-[18px] w-[18px]" aria-hidden />
                      </button>
                      {scheduleOpen ? (
                        <div className="absolute bottom-full left-0 z-[130] mb-1 w-72 rounded-lg border border-[#EAE5F4] bg-white p-3 shadow-lg">
                          <label htmlFor="compose-schedule-at" className="mb-1.5 block text-xs font-semibold text-[#1E1B2E]">
                            Send at
                          </label>
                          <input
                            id="compose-schedule-at"
                            type="datetime-local"
                            value={scheduleAt}
                            min={toDatetimeLocalValue(new Date(Date.now() + 60_000))}
                            onChange={(event) => setScheduleAt(event.target.value)}
                            className="w-full rounded border border-[#E5E7EB] px-2.5 py-1.5 text-sm text-[#1E1B2E] focus:border-[#701CC0] focus:outline-none focus:ring-1 focus:ring-[#701CC0]"
                          />
                          <div className="mt-2 flex items-center justify-between gap-2">
                            {scheduleAt ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setScheduleAt("");
                                  setScheduleOpen(false);
                                }}
                                className="text-xs font-medium text-[#6B7280] hover:text-[#1E1B2E]"
                              >
                                Clear
                              </button>
                            ) : (
                              <span />
                            )}
                            <button
                              type="button"
                              disabled={!scheduleAt}
                              onClick={() => {
                                setScheduleOpen(false);
                                handleSendCompose();
                              }}
                              className="inline-flex items-center gap-1 rounded bg-[#701CC0] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#5F17A5] disabled:opacity-40"
                            >
                              <FiClock className="h-3.5 w-3.5" aria-hidden /> Schedule send
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={() => setConfidentialOpen((open) => !open)}
                        title="Confidential mode"
                        aria-label="Confidential mode"
                        aria-pressed={confidentialOn}
                        className={composeIconClass(confidentialOn || confidentialOpen)}
                      >
                        <FiLock className="h-[18px] w-[18px]" aria-hidden />
                      </button>
                      {confidentialOpen ? (
                        <div className="absolute bottom-full left-0 z-[130] mb-1 w-72 rounded-lg border border-[#EAE5F4] bg-white p-3 shadow-lg">
                          <label className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-[#1E1B2E]">Confidential mode</span>
                            <input
                              type="checkbox"
                              checked={confidentialOn}
                              onChange={(event) => setConfidentialOn(event.target.checked)}
                              className="h-4 w-4"
                            />
                          </label>
                          <p className="mt-1 text-[11px] leading-relaxed text-[#6B7280]">
                            Sends a secure link instead of the body. Recipients can’t forward, copy, or print, and access can expire or be revoked.
                          </p>
                          {confidentialOn ? (
                            <div className="mt-3 space-y-2">
                              <div>
                                <label htmlFor="conf-expiry" className="mb-1 block text-[11px] font-medium text-[#6B7280]">
                                  Expires
                                </label>
                                <select
                                  id="conf-expiry"
                                  value={confidentialExpiry}
                                  onChange={(event) => setConfidentialExpiry(event.target.value as typeof confidentialExpiry)}
                                  className="w-full rounded border border-[#E5E7EB] px-2 py-1.5 text-sm text-[#1E1B2E] focus:border-[#701CC0] focus:outline-none focus:ring-1 focus:ring-[#701CC0]"
                                >
                                  <option value="1d">1 day</option>
                                  <option value="1w">1 week</option>
                                  <option value="1m">1 month</option>
                                  <option value="never">No expiry</option>
                                </select>
                              </div>
                              <div>
                                <label htmlFor="conf-passcode" className="mb-1 block text-[11px] font-medium text-[#6B7280]">
                                  Passcode (optional — share separately)
                                </label>
                                <input
                                  id="conf-passcode"
                                  type="text"
                                  value={confidentialPasscode}
                                  onChange={(event) => setConfidentialPasscode(event.target.value)}
                                  placeholder="e.g. 4821"
                                  className="w-full rounded border border-[#E5E7EB] px-2.5 py-1.5 text-sm text-[#1E1B2E] focus:border-[#701CC0] focus:outline-none focus:ring-1 focus:ring-[#701CC0]"
                                />
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => setRequestReceipt((on) => !on)}
                      title="Request read receipt"
                      aria-label="Request read receipt"
                      aria-pressed={requestReceipt}
                      className={composeIconClass(requestReceipt)}
                    >
                      <FiCheckSquare className="h-[18px] w-[18px]" aria-hidden />
                    </button>
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={() => setArtemisRewriteOpen((open) => !open)}
                        disabled={artemisDrafting}
                        title="Artemis AI"
                        aria-label="Artemis AI"
                        aria-expanded={artemisRewriteOpen}
                        className={composeIconClass(artemisRewriteOpen || artemisDrafting)}
                      >
                        <FiZap className={`h-[18px] w-[18px] ${artemisDrafting ? "animate-pulse" : ""}`} aria-hidden />
                      </button>
                      {artemisRewriteOpen ? (
                        <div className="compose-menu absolute bottom-full left-0 z-[130] mb-2 w-52">
                          <button
                            type="button"
                            onClick={() => {
                              setArtemisRewriteOpen(false);
                              void handleArtemisDraft();
                            }}
                            disabled={artemisDrafting}
                            className={composeMenuItemClass}
                          >
                            <FiZap className="h-4 w-4 shrink-0" aria-hidden />
                            {artemisDrafting ? "Drafting…" : "Draft for me"}
                          </button>
                          <div className="my-1 h-px bg-white/[0.07]" />
                          <p className="px-3 pb-1 pt-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-[#7C7695]">
                            Rewrite
                          </p>
                          {([
                            ["shorten", "Make shorter"],
                            ["expand", "Expand"],
                            ["formal", "More formal"],
                            ["casual", "More casual"],
                            ["grammar", "Fix grammar"],
                          ] as const).map(([mode, label]) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => handleArtemisRewrite(mode)}
                              disabled={artemisDrafting || !composeBody.trim()}
                              className={composeMenuItemClass}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="relative flex min-w-0 items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => setComposeFormattingToolbarOpen((open) => !open)}
                        className={composeIconClass(composeFormattingToolbarOpen)}
                        title="Formatting options"
                        aria-label="Formatting options"
                        aria-pressed={composeFormattingToolbarOpen}
                      >
                        <FiType className="h-[18px] w-[18px]" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => composeAttachInputRef.current?.click()}
                        className={composeIconClass()}
                        title="Attach files"
                        aria-label="Attach files"
                      >
                        <FiPaperclip className="h-[18px] w-[18px]" aria-hidden />
                      </button>
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={toggleBookingMenu}
                          className={composeIconClass(bookingMenuOpen)}
                          title="Insert booking link"
                          aria-label="Insert booking link"
                          aria-expanded={bookingMenuOpen}
                        >
                          <FiCalendar className="h-[18px] w-[18px]" aria-hidden />
                        </button>
                        {bookingMenuOpen ? (
                          <div className="compose-menu absolute bottom-full left-0 z-[130] mb-2 w-64">
                            {composeBookingLinks.length === 0 ? (
                              <p className="px-3 py-2 text-xs leading-relaxed text-[#8C86A6]">
                                No active booking links. Create one in Settings → Meeting booking.
                              </p>
                            ) : (
                              composeBookingLinks.map((l) => (
                                <button
                                  key={l.id}
                                  type="button"
                                  onClick={() => insertBookingLink(l.slug, l.title)}
                                  className={`${composeMenuItemClass} truncate`}
                                >
                                  {l.title}
                                </button>
                              ))
                            )}
                          </div>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => composeEditorRef.current?.promptInsertLink()}
                        className={composeIconClass()}
                        title="Insert link"
                        aria-label="Insert link"
                      >
                        <FiLink className="h-[18px] w-[18px]" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => composeEditorRef.current?.promptInsertImage()}
                        className={composeIconClass()}
                        title="Insert image"
                        aria-label="Insert image"
                      >
                        <FiImage className="h-[18px] w-[18px]" aria-hidden />
                      </button>
                      {/* Gmail keeps its second-tier actions behind one "More options" button rather
                          than a second row of controls — templates, signatures, print and the
                          signature request live here so the bar stays a single line. */}
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={() => setComposeMoreOpen((open) => !open)}
                          className={composeIconClass(composeMoreOpen)}
                          title="More options"
                          aria-label="More options"
                          aria-expanded={composeMoreOpen}
                        >
                          <FiMoreVertical className="h-[18px] w-[18px]" aria-hidden />
                        </button>
                        {composeMoreOpen ? (
                          <div className="compose-menu absolute bottom-full left-0 z-[130] mb-2 max-h-[min(60vh,22rem)] w-60 overflow-y-auto">
                            <p className="px-3 pb-1 pt-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-[#7C7695]">
                              Templates
                            </p>
                            {composeTemplates.length === 0 ? (
                              <p className="px-3 pb-1.5 text-xs text-[#8C86A6]">No templates yet</p>
                            ) : (
                              composeTemplates.map((template) => (
                                <button
                                  key={template.id}
                                  type="button"
                                  className={`${composeMenuItemClass} truncate`}
                                  onClick={() => {
                                    setComposeMoreOpen(false);
                                    applyComposeTemplate(template.id);
                                  }}
                                >
                                  <FiFileText className="h-4 w-4 shrink-0" aria-hidden />
                                  <span className="truncate">{template.name}</span>
                                </button>
                              ))
                            )}
                            <button
                              type="button"
                              className={`${composeMenuItemClass} text-[#C8A6F5]`}
                              onClick={() => {
                                setComposeMoreOpen(false);
                                setSaveTemplateName("");
                                setSaveTemplateModalOpen(true);
                              }}
                            >
                              <FiPlus className="h-4 w-4 shrink-0" aria-hidden />
                              Save as template…
                            </button>

                            <div className="my-1 h-px bg-white/[0.07]" />
                            <p className="px-3 pb-1 pt-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-[#7C7695]">
                              Signatures
                            </p>
                            {composeSignatures.length === 0 ? (
                              <p className="px-3 pb-1.5 text-xs text-[#8C86A6]">No signatures yet</p>
                            ) : (
                              composeSignatures.map((sig) => (
                                <button
                                  key={sig.id}
                                  type="button"
                                  className={`${composeMenuItemClass} truncate`}
                                  onClick={() => {
                                    setComposeMoreOpen(false);
                                    applyComposeSignature(sig.id);
                                  }}
                                >
                                  <FiEdit3 className="h-4 w-4 shrink-0" aria-hidden />
                                  <span className="truncate">
                                    {sig.name}
                                    {sig.isDefault ? " (default)" : ""}
                                  </span>
                                </button>
                              ))
                            )}

                            <div className="my-1 h-px bg-white/[0.07]" />
                            <button
                              type="button"
                              className={composeMenuItemClass}
                              onClick={() => {
                                setComposeMoreOpen(false);
                                setSignModalOpen(true);
                              }}
                            >
                              <FiFeather className="h-4 w-4 shrink-0" aria-hidden />
                              Request signature
                            </button>
                            <button
                              type="button"
                              className={composeMenuItemClass}
                              onClick={() => {
                                setComposeMoreOpen(false);
                                handlePrintCompose();
                              }}
                            >
                              <FiPrinter className="h-4 w-4 shrink-0" aria-hidden />
                              Print
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={closeCompose}
                    className={composeIconClass()}
                    title="Discard draft"
                    aria-label="Discard draft"
                  >
                    <FiTrash2 className="h-[18px] w-[18px]" aria-hidden />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <SignPdfModal
        open={signModalOpen}
        onClose={() => setSignModalOpen(false)}
        defaultSignerEmail={composeTo.split(",")[0]?.trim() || ""}
        pdfCandidates={composeAttachments
          .filter((a) => a.contentType === "application/pdf" || a.filename.toLowerCase().endsWith(".pdf"))
          .map((a) => ({ id: a.id, filename: a.filename, contentBase64: a.contentBase64 }))}
        onLinkReady={(url: string, filename: string) =>
          composeEditorRef.current?.insertLink(url, `Sign “${filename}”`)
        }
      />

      {saveTemplateModalOpen ? (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-[#2E1050]/45 backdrop-blur-sm p-4"
          onClick={() => !saveTemplateSaving && setSaveTemplateModalOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white/90 backdrop-blur-xl border border-white/70 p-5 shadow-[0_30px_70px_-20px_rgba(46,16,80,0.55)]"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-label="Save template"
          >
            <p className="text-sm font-semibold text-[#1E1B2E]">Save template</p>
            <label className="mt-3 block text-xs font-medium text-[#5f6368]" htmlFor="compose-template-name">
              Name
            </label>
            <input
              id="compose-template-name"
              type="text"
              value={saveTemplateName}
              onChange={(event) => setSaveTemplateName(event.target.value)}
              className="mt-1 w-full rounded-md border border-[#EAE5F4] px-3 py-2 text-sm text-[#1E1B2E] outline-none focus:ring-2 focus:ring-[#701CC0]"
              placeholder="Template name"
              disabled={saveTemplateSaving}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={saveTemplateSaving}
                onClick={() => setSaveTemplateModalOpen(false)}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-[#5f6368] hover:bg-[#f1f3f4] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saveTemplateSaving || !saveTemplateName.trim()}
                onClick={() => void handleSaveComposeTemplate()}
                className="rounded-md bg-[#701CC0] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#5f17a5] disabled:opacity-50"
              >
                {saveTemplateSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <SuccessStatusModal
        isOpen={blockSuccessModal.open}
        title={blockSuccessModal.title}
        message={blockSuccessModal.message}
        onClose={() => setBlockSuccessModal({ open: false, title: "", message: "" })}
        buttonLabel="Done"
      />
      <SuccessStatusModal
        isOpen={contactsImportSuccessOpen}
        title="CSV Uploaded Successfully"
        message="Your CSV data has been imported and contacts are now updated."
        onClose={() => setContactsImportSuccessOpen(false)}
        buttonLabel="Done"
      />
      {contactsImportIssuesModal.open ? (
        <div
          className="fixed inset-0 z-[170] flex items-center justify-center bg-[#2E1050]/30 backdrop-blur-md p-4"
          onClick={() =>
            setContactsImportIssuesModal({
              open: false,
              imported: 0,
              skipped: 0,
              headerErrors: [],
              rowErrors: [],
            })
          }
        >
          <div
            className="w-full max-w-4xl rounded-2xl bg-white/90 backdrop-blur-xl border border-white/70 shadow-[0_30px_70px_-20px_rgba(46,16,80,0.55)] p-6 max-h-[90vh] overflow-y-auto"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="CSV Import Issues"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                <FiAlertCircle className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-[#1E1B2E]">CSV Import Validation</h3>
                <p className="text-sm text-[#6B7280]">
                  Imported {contactsImportIssuesModal.imported} valid contact
                  {contactsImportIssuesModal.imported === 1 ? "" : "s"} and skipped {contactsImportIssuesModal.skipped} invalid line
                  {contactsImportIssuesModal.skipped === 1 ? "" : "s"}.
                </p>
              </div>
            </div>

            {contactsImportIssuesModal.headerErrors.length > 0 ? (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm font-semibold text-red-700">Header Errors</p>
                <ul className="mt-2 space-y-1.5 text-xs text-red-700">
                  {contactsImportIssuesModal.headerErrors.map((error, index) => (
                    <li key={`${error}-${index}`}>- {error}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {contactsImportIssuesModal.rowErrors.length > 0 ? (
              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-amber-800">
                    Correct the {contactsImportIssuesModal.rowErrors.length} skipped row
                    {contactsImportIssuesModal.rowErrors.length === 1 ? "" : "s"} below and save them individually, or fix
                    everything then Save All.
                  </p>
                  <button
                    type="button"
                    onClick={retryAllIssueRows}
                    disabled={contactsImportIssuesModal.rowErrors.some((row) => row.saving)}
                    className="shrink-0 rounded-lg bg-[#701CC0] text-white text-xs font-medium px-3 py-1.5 hover:bg-[#5f17a5] disabled:opacity-60"
                  >
                    Save All
                  </button>
                </div>
                <div className="mt-2 max-h-[50vh] overflow-y-auto space-y-3 pr-1">
                  {contactsImportIssuesModal.rowErrors.map((row) => (
                    <div key={row.lineNumber} className="rounded-lg border border-amber-200 bg-white px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold text-amber-900">Line {row.lineNumber}</p>
                        <button
                          type="button"
                          onClick={() => retryImportIssueRow(row.lineNumber)}
                          disabled={row.saving}
                          className="shrink-0 rounded-md bg-[#701CC0] text-white text-xs font-medium px-3 py-1 hover:bg-[#5f17a5] disabled:opacity-60"
                        >
                          {row.saving ? "Saving..." : "Save Row"}
                        </button>
                      </div>
                      <ul className="mt-1 space-y-0.5 text-xs text-red-600">
                        {row.reasons.map((reason, reasonIndex) => (
                          <li key={`${reason}-${reasonIndex}`}>- {reason}</li>
                        ))}
                      </ul>
                      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {ISSUE_EDITABLE_FIELDS.map((field) => (
                          <label key={field} className="text-[11px] font-medium text-[#6B7280] flex flex-col gap-0.5">
                            {ISSUE_FIELD_LABELS[field]}
                            <input
                              value={row[field]}
                              onChange={(event) => updateIssueRowField(row.lineNumber, field, event.target.value)}
                              disabled={row.saving}
                              className="rounded-md border border-[#E5E7EB] px-2 py-1 text-xs text-[#1E1B2E] focus:outline-none focus:ring-2 focus:ring-[#701CC0]/40 disabled:opacity-60"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() =>
                  setContactsImportIssuesModal({
                    open: false,
                    imported: 0,
                    skipped: 0,
                    headerErrors: [],
                    rowErrors: [],
                  })
                }
                className="px-4 py-2 rounded-lg bg-[#701CC0] text-white text-sm font-medium hover:bg-[#5f17a5]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <ConfirmActionModal
        isOpen={Boolean(contactToDelete)}
        title="Delete Contact"
        message={
          <>
            Are you sure you want to delete{" "}
            <span className="font-semibold text-[#1E1B2E]">{contactToDelete?.email || "this contact"}</span>?
            This action cannot be undone.
          </>
        }
        confirmLabel={deletingContact ? "Deleting..." : "Delete Contact"}
        onCancel={() => {
          if (deletingContact) return;
          setContactToDelete(null);
        }}
        onConfirm={confirmDeleteContact}
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
      <PromptModal
        open={artemisPromptOpen}
        title="Draft with Artemis"
        description="Describe what this email should say. Artemis writes a first draft you can edit before sending."
        fields={[{ name: "intent", type: "textarea", placeholder: "e.g. Follow up on our call and propose next week for a quick demo", required: true, maxLength: 2000 }]}
        confirmLabel="Draft it"
        busy={artemisDrafting}
        onCancel={() => setArtemisPromptOpen(false)}
        onSubmit={(values) => void runArtemisDraft(values.intent)}
      />
      {sentToastMessage ? (
        <div
          className="fixed bottom-6 left-6 z-[220] flex max-w-sm items-center gap-3 rounded-lg border border-[#701CC0]/40 bg-[#701CC0] px-4 py-3 text-sm font-medium text-white shadow-lg shadow-[#701CC0]/30"
          role="status"
          aria-live="polite"
        >
          <FiCheck className="h-5 w-5 shrink-0 text-white" aria-hidden />
          <span>{sentToastMessage}</span>
        </div>
      ) : null}
    </div>
  );
};

export default EmailingPlatformSection;
