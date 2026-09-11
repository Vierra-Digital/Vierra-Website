import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComposeRichEditorHandle } from "@/components/email/ComposeRichEditor";
import { printComposeContent } from "@/components/email/printCompose";
import { validateRecipientCsv } from "@/components/email/constants";
import type {
  ModuleKey,
  GmailAccountConnection,
  MessageRow,
  MessageDetail,
  ThreadMessage,
  ProviderAccount,
} from "@/components/email/types";
import { isSafeEmailHref, stripRemoteUrlsFromStyle, UNSAFE_EMAIL_TAG_SELECTOR } from "@/lib/email/htmlSafety";
import { scoreTrackerImage } from "@/lib/email/trackerDetection";
import { buildReplyReferences } from "@/lib/email/threading";
import { prepareSendRequest, sendPanelEmail } from "@/lib/email/sendRequest";
import { MAX_TOTAL_ATTACHMENT_BYTES } from "../composeShared";
import { useLocalEmailDrafts } from "./useLocalEmailDrafts";

// --- Pure helpers, duplicated from EmailingPlatformSection.tsx's own copies (which the mailbox
// reader still uses for rendering) rather than imported, since there they're closures over reader
// state. Here they're parameterized instead — same behavior, no shared mutable state. ---

function parseMailboxAddress(value: string) {
  const trimmed = (value || "").trim();
  const angleMatch = trimmed.match(/^(.*?)(?:<([^>]+)>)?$/);
  const email = (angleMatch?.[2] || "").trim();
  const label = (angleMatch?.[1] || "").trim().replace(/^"|"$/g, "");
  if (email && label) return { name: label, email };
  if (email) return { name: email, email };
  if (trimmed.includes("@")) return { name: trimmed, email: trimmed };
  return { name: trimmed || "-", email: "" };
}

function parseAddressList(value: string) {
  return (value || "")
    .split(",")
    .map((item) => parseMailboxAddress(item))
    .filter((item) => item.name || item.email);
}

function formatIdentity(value: string) {
  const identity = parseMailboxAddress(value);
  return identity.email ? `${identity.name} <${identity.email}>` : identity.name;
}

function formatRelativeAge(timestamp: number) {
  if (!timestamp) return "";
  const diffMs = Math.max(0, Date.now() - timestamp);
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return "Less than 1 hour ago";
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

function formatDetailedDate(timestamp: number, rawDate?: string) {
  const source = timestamp > 0 ? new Date(timestamp) : rawDate ? new Date(rawDate) : null;
  if (!source || Number.isNaN(source.getTime())) return rawDate || "-";
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thur", "Fri", "Sat"];
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const day = source.getDate();
  const suffix = day % 10 === 1 && day % 100 !== 11 ? "st" : day % 10 === 2 && day % 100 !== 12 ? "nd" : day % 10 === 3 && day % 100 !== 13 ? "rd" : "th";
  const rawHours = source.getHours();
  const hh = String(rawHours % 12 || 12).padStart(2, "0");
  const mm = String(source.getMinutes()).padStart(2, "0");
  const meridiem = rawHours >= 12 ? "PM" : "AM";
  const relative = formatRelativeAge(timestamp || source.getTime());
  return `${weekdays[source.getDay()]}, ${months[source.getMonth()]} ${day}${suffix} ${source.getFullYear()} ${hh}:${mm} ${meridiem}${relative ? ` (${relative})` : ""}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function linkifyTextForHtml(value: string) {
  return escapeHtml(value)
    .replace(
      /(https?:\/\/[^\s<>"']+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer" style="color:#5B21B6;text-decoration:underline;">$1</a>'
    )
    .replace(/\n/g, "<br>");
}

function isTrackerPixel(img: HTMLImageElement, srcValue: string, senderDomain: string) {
  return scoreTrackerImage({
    src: srcValue,
    width: img.getAttribute("width"),
    height: img.getAttribute("height"),
    style: img.getAttribute("style"),
    alt: img.getAttribute("alt"),
    senderDomain,
  }).tracked;
}

/** Quoted-message sanitizer for the inline reply/forward preview (mirrors the reader's own copy). */
function sanitizeHtml(rawHtml: string, senderDomain: string) {
  if (!rawHtml) return "";
  if (typeof window === "undefined") return rawHtml;
  const parser = new window.DOMParser();
  const parsed = parser.parseFromString(rawHtml, "text/html");
  parsed.querySelectorAll(UNSAFE_EMAIL_TAG_SELECTOR).forEach((node) => node.remove());
  parsed.querySelectorAll<HTMLElement>("*").forEach((node) => {
    Array.from(node.attributes).forEach((attribute) => {
      if (/^on/i.test(attribute.name)) node.removeAttribute(attribute.name);
    });
    for (const attr of ["href", "xlink:href", "action", "formaction", "src"]) {
      const value = node.getAttribute(attr);
      if (value !== null && !isSafeEmailHref(value)) node.removeAttribute(attr);
    }
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
    if (isInternalOpenTrackingPixel(src) || isTrackerPixel(img, src, senderDomain)) {
      img.remove();
      return;
    }
    img.style.maxWidth = "100%";
    img.style.height = "auto";
    img.loading = "lazy";
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
  });
  parsed.querySelectorAll<HTMLAnchorElement>("a").forEach((link) => {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  });
  return parsed.body.innerHTML;
}

type UseComposeWindowParams = {
  selectedMessage: MessageRow | null;
  selectedMessageId: string;
  threadMessages: ThreadMessage[];
  selectedMessageDetail: MessageDetail | null;
  selectedAccounts: string[];
  connectedAccounts: GmailAccountConnection[];
  providerAccounts: ProviderAccount[];
  activeModule: ModuleKey;
  /** Ref pattern (loadMessagesRef) reused from the parent to avoid a cyclic effect dependency. */
  loadMessagesRef: React.RefObject<() => void>;
  loadMailboxCounts: () => void;
  invalidateMessagesCache: () => void;
  showSentToast: (message: string) => void;
  setDetailError: (value: string) => void;
  setSelectedMessageDetail: (value: MessageDetail | null) => void;
};

/**
 * Owns everything about composing an email: the full "New Message" modal AND the inline
 * reply/reply-all/forward panel embedded in the reader.
 *
 * These were extracted as one hook, not two, because the underlying code treats them as one
 * feature with two UI surfaces rather than two independent ones: inline reply's toolbar reuses the
 * full compose modal's Artemis draft flow, attachment input, signature list and confidential-mode
 * state verbatim (see the "Help me write" / attach / confidential buttons in the inline reply bar),
 * and both share one `flushDraftsNow` that flushes whichever of them has unsaved content. Splitting
 * them into independent hooks would have meant threading a dozen cross-references between two
 * hooks for state that was never actually independent.
 */
export function useComposeWindow(params: UseComposeWindowParams) {
  const {
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
  } = params;

  const { saveLocalDraft, clearLocalDraft, draftSaveState } = useLocalEmailDrafts();

  // --- Full compose modal state ---
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
  const composeClosePending = useRef(false);
  /**
   * Set while discardCompose's DELETE is in flight. The 450ms debounced-autosave effect below
   * schedules its PUT via a plain setTimeout, so it isn't cancelled just because isComposeOpen
   * flips to false mid-flight — without this guard, a debounce timer already pending when the
   * trash icon is clicked fires its PUT after the DELETE completes and silently recreates the
   * draft being discarded.
   */
  const discardingComposeRef = useRef(false);
  const composeEditVersion = useRef(0);
  const [composeError, setComposeError] = useState("");
  const [composeSuccess, setComposeSuccess] = useState("");
  const [composeExpanded, setComposeExpanded] = useState(false);
  /** Collapsed to just its header bar, Gmail-style — clicking the header toggles this. */
  const [composeMinimized, setComposeMinimized] = useState(false);
  const [composeActiveDraftKey, setComposeActiveDraftKey] = useState("");

  // --- Inline reply/reply-all/forward state (embedded in the reader) ---
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
  const inlineComposeRef = useRef<HTMLDivElement | null>(null);

  const connectedAccountsList = connectedAccounts;

  // --- Recipient verification / deliverability / lint (full compose only) ---
  const [composeBadRecipients, setComposeBadRecipients] = useState<string[]>([]);
  const [composeDeliverability, setComposeDeliverability] = useState<{ spfOk: boolean; dmarcOk: boolean } | null>(null);

  useEffect(() => {
    if (!isComposeOpen) {
      // Straight extraction from EmailingPlatformSection.tsx (unchanged behavior) — resets
      // verification state whenever compose closes or the recipient list changes.
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
      // Straight extraction, unchanged behavior — see the recipient-verification effect above.
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const composeDraftStorageKey = useMemo(() => {
    const account = (composeAccountEmail || selectedAccounts[0] || connectedAccountsList[0]?.email || "default").toLowerCase();
    return `popup:new:${account}`;
  }, [composeAccountEmail, connectedAccountsList, selectedAccounts]);
  const effectiveComposeDraftStorageKey = composeActiveDraftKey || composeDraftStorageKey;

  const inlineDraftStorageKey = useMemo(() => {
    if (!inlineComposeMode || !selectedMessage) return "";
    return `inline:${inlineComposeMode}:${selectedMessage.accountEmail.toLowerCase()}:${selectedMessage.id}`;
  }, [inlineComposeMode, selectedMessage]);

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

  // Reset any in-progress inline reply when the viewed message changes. Straight extraction,
  // unchanged behavior — see the recipient-verification effect above for why this is suppressed
  // rather than restructured.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  // --- Combined draft-guard boolean, for the parent's usePageLeaveGuard/useDraftGuard ---
  const hasUnsavedChanges =
    (isComposeOpen && Boolean(composeTo || composeSubject || composeBody || composeBodyHtml)) ||
    Boolean(inlineComposeMode && inlineComposeIntroText);
  const isSending = sendingCompose || inlineComposeSending;

  const flushDraftsNow = useCallback(async () => {
    const writes: Promise<boolean>[] = [];
    // Effects that call this (beforeunload/pagehide/visibilitychange, and their own cleanup) can
    // hold a stale closure from before discardCompose flipped isComposeOpen to false, so checking
    // isComposeOpen alone isn't enough to keep a discarded draft from being silently recreated —
    // see discardingComposeRef's definition above.
    if (!sendingCompose && isComposeOpen && effectiveComposeDraftStorageKey && !discardingComposeRef.current) {
      // Recipients or a subject with no body still count — closing after typing only a
      // "To" used to discard it, which reads as the composer losing your work.
      const hasComposeContent =
        composeBody.trim() ||
        composeBodyHtml.replace(/<[^>]+>/g, "").replace(/&nbsp;/gi, " ").trim() ||
        composeTo.trim() ||
        composeSubject.trim();
      if (hasComposeContent) {
        writes.push(saveLocalDraft(
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
        ));
      }
    }

    if (!inlineComposeSending && inlineComposeMode && inlineDraftStorageKey) {
      const hasInlineContent = inlineComposeIntroText.trim();
      if (hasInlineContent) {
        writes.push(saveLocalDraft(
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
        ));
      }
    }
    return (await Promise.all(writes)).every(Boolean);
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
      if (!hasContent || discardingComposeRef.current) return;
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

  const openNewCompose = useCallback(() => {
    const defaultAccount =
      selectedAccounts[0] || connectedAccountsList[0]?.email || providerAccounts[0]?.accountEmail || "";
    discardingComposeRef.current = false;
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
    setComposeMinimized(false);
    // Ask the signatures effect to drop in this account's default signature once it loads.
    composeInsertDefaultSigRef.current = true;
    setIsComposeOpen(true);
  }, [selectedAccounts, connectedAccountsList, providerAccounts]);

  const openComposeDraftFromRow = useCallback((draftMessage: MessageRow) => {
    const accountEmail =
      draftMessage.accountEmail || selectedAccounts[0] || connectedAccountsList[0]?.email || providerAccounts[0]?.accountEmail || "";
    discardingComposeRef.current = false;
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
    setComposeMinimized(false);
    setIsComposeOpen(true);
  }, [selectedAccounts, connectedAccountsList, providerAccounts]);

  /** Domain of the message being read, used to score quoted images as third-party or not. */
  const readerSenderDomain = useMemo(() => {
    const fromRaw = selectedMessageDetail?.fromRaw || selectedMessage?.fromRaw || selectedMessage?.from || "";
    const email = parseMailboxAddress(fromRaw).email;
    return (email.split("@")[1] || "").trim().toLowerCase();
  }, [selectedMessageDetail, selectedMessage]);

  /** Bound for the forward preview's render-time re-sanitize (JSX applies it a second time, same as before). */
  const sanitizeInlinePreviewHtml = useCallback(
    (html: string) => sanitizeHtml(html, readerSenderDomain),
    [readerSenderDomain]
  );

  const beginInlineReply = useCallback((mode: "reply" | "replyAll", to: string) => {
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
    // Quote the message being replied to, as Gmail does.
    {
      const sourceHtml = latest?.bodyHtml || selectedMessageDetail?.bodyHtml || "";
      const sourceText = latest?.bodyText || selectedMessageDetail?.bodyText || selectedMessage.snippet || "";
      const quotedFrom = formatIdentity(latest?.fromRaw || selectedMessage.fromRaw || selectedMessage.from);
      const quotedDate = formatDetailedDate(latest?.timestamp || selectedMessage.timestamp, latest?.date || selectedMessage.date);
      const safeHtml = sourceHtml
        ? sanitizeHtml(sourceHtml, readerSenderDomain)
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
  }, [selectedMessage, threadMessages, selectedMessageDetail, readerSenderDomain]);

  /** The address a reply goes to: Reply-To when the sender set one, otherwise who it came from. */
  const replyRecipient = useCallback(() => {
    if (!selectedMessage) return "";
    const latest = threadMessages[threadMessages.length - 1];
    return parseMailboxAddress(
      latest?.replyTo || selectedMessage.replyTo || selectedMessage.fromRaw || selectedMessage.from
    ).email;
  }, [selectedMessage, threadMessages]);

  const openReplyCompose = useCallback(() => {
    if (!selectedMessage) return;
    beginInlineReply("reply", replyRecipient());
  }, [selectedMessage, beginInlineReply, replyRecipient]);

  const openReplyAllCompose = useCallback(() => {
    if (!selectedMessage) return;
    const latest = threadMessages[threadMessages.length - 1];
    const toList = parseAddressList(latest?.toRaw || selectedMessage.toRaw || selectedMessage.to);
    // Everyone on the original, deduped, with the sender first.
    const uniqueEmails = Array.from(
      new Set([replyRecipient(), ...toList.map((entry) => entry.email)].filter(Boolean))
    );
    beginInlineReply("replyAll", uniqueEmails.join(", "));
  }, [selectedMessage, threadMessages, beginInlineReply, replyRecipient]);

  const openForwardCompose = useCallback(() => {
    if (!selectedMessage) return;
    const latest = threadMessages[threadMessages.length - 1];
    void clearLocalDraft(`inline:forward:${selectedMessage.accountEmail.toLowerCase()}:${selectedMessage.id}`).catch(() => null);
    const sourceHtml = latest?.bodyHtml || selectedMessageDetail?.bodyHtml || "";
    const sourceText = latest?.bodyText || selectedMessageDetail?.bodyText || selectedMessage.snippet || "";
    const prefixed = /^fwd:/i.test(selectedMessage.subject || "") ? selectedMessage.subject : `Fwd: ${selectedMessage.subject || ""}`;
    const originalFrom = formatIdentity(latest?.fromRaw || selectedMessage.fromRaw || selectedMessage.from);
    const originalTo = formatIdentity(latest?.toRaw || selectedMessage.toRaw || selectedMessage.to);
    const originalDate = formatDetailedDate(latest?.timestamp || selectedMessage.timestamp, latest?.date || selectedMessage.date);
    const sourceHtmlSafe = sourceHtml ? sanitizeHtml(sourceHtml, readerSenderDomain) : `<div style="white-space:pre-wrap;">${escapeHtml(sourceText)}</div>`;
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
  }, [selectedMessage, threadMessages, selectedMessageDetail, readerSenderDomain, clearLocalDraft]);

  const sendInlineCompose = useCallback(async () => {
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
      const response = await sendPanelEmail({
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
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok !== true) {
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
      void Promise.all([loadMessagesRef.current(), loadMailboxCounts()]);
      setDetailError("");
      setSelectedMessageDetail(null);
    } catch (error) {
      setInlineComposeError(error instanceof Error ? error.message : "Failed to send email.");
    } finally {
      setInlineComposeSending(false);
    }
  }, [
    selectedMessage,
    inlineComposeTo,
    inlineComposeSending,
    inlineComposeIntroText,
    inlineComposeBodyText,
    inlineComposeCc,
    inlineComposeBcc,
    inlineComposeIntroHtml,
    inlineComposeBodyHtml,
    inlineComposeSubject,
    inlineComposeThreadId,
    inlineComposeInReplyTo,
    inlineComposeReferences,
    inlineDraftStorageKey,
    inlineComposeMode,
    providerAccounts,
    clearLocalDraft,
    showSentToast,
    invalidateMessagesCache,
    loadMessagesRef,
    loadMailboxCounts,
    setDetailError,
    setSelectedMessageDetail,
  ]);

  const composeAliasAccountsKey = useMemo(
    () => (selectedAccounts.length > 0 ? selectedAccounts : connectedAccountsList.map((a) => a.email)).join(","),
    [selectedAccounts, connectedAccountsList]
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
    // Straight extraction, unchanged behavior — see the recipient-verification effect above.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isComposeOpen && composeAccountEmail) setComposeFrom(composeAccountEmail);
  }, [isComposeOpen, composeAccountEmail]);

  const getArtemisTone = useCallback(() => {
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
  }, []);

  const handleArtemisDraft = useCallback(() => {
    if (artemisDrafting) return;
    setArtemisPromptOpen(true);
  }, [artemisDrafting]);

  /**
   * Ask Artemis for body text and put the result in the composer.
   *
   * Drafting and rewriting were the same twenty lines twice over, differing only in the endpoint,
   * the request body and the error wording — including their own private copies of the
   * plain-text-to-HTML conversion, which is the part that would quietly diverge.
   */
  const runArtemis = useCallback(async (endpoint: string, body: Record<string, unknown>, failureMessage: string) => {
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
  }, []);

  const runArtemisDraft = useCallback(async (intent: string) => {
    if (!intent.trim() || artemisDrafting) return;
    setArtemisPromptOpen(false);
    await runArtemis("/api/ai/compose", { intent: intent.trim(), tone: getArtemisTone() }, "Artemis couldn't draft that.");
  }, [artemisDrafting, runArtemis, getArtemisTone]);

  const handleArtemisRewrite = useCallback(async (mode: string) => {
    setArtemisRewriteOpen(false);
    const current = (composeBody || "").trim();
    if (!current || artemisDrafting) return;
    await runArtemis("/api/ai/rewrite", { text: current, mode }, "Artemis couldn't rewrite that.");
  }, [composeBody, artemisDrafting, runArtemis]);

  /**
   * The send request body. Extracted so the undo window can hold the exact same payload and flush
   * it if the page goes away mid-countdown.
   */
  const buildSendPayload = useCallback(() => ({
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
  }), [
    composeAccountEmail, composeFrom, composeTo, composeCc, composeBcc, composeSubject, composeBody,
    composeBodyHtml, composeThreadId, composeInReplyTo, composeReferences, scheduleAt, confidentialOn,
    confidentialExpiry, confidentialPasscode, requestReceipt, effectiveComposeDraftStorageKey,
    providerAccounts, composeAttachments,
  ]);

  const performSendCompose = useCallback(async () => {
    // Being sent now, so there is nothing left for the unload path to flush.
    pendingSendBodyRef.current = null;
    setSendingCompose(true);
    setComposeError("");
    setComposeSuccess("");
    try {
      const response = await sendPanelEmail(buildSendPayload());
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok !== true) {
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
        void Promise.all([loadMessagesRef.current(), loadMailboxCounts()]);
      } else {
        void loadMailboxCounts();
      }
    } catch (error) {
      setComposeError(error instanceof Error ? error.message : "Failed to send email.");
    } finally {
      setSendingCompose(false);
    }
  }, [buildSendPayload, composeActiveDraftKey, composeDraftStorageKey, clearLocalDraft, showSentToast, activeModule, invalidateMessagesCache, loadMessagesRef, loadMailboxCounts]);

  const cancelUndoSend = useCallback(() => {
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
  }, []);

  // Closing/discarding the composer must abort any in-flight undo-send window. The Undo banner
  // lives inside this modal, so once it's closed there's no way to cancel — leaving the timer
  // running would send a message the user just tried to abort (and could clobber a fresh draft).
  const closeCompose = useCallback(async () => {
    if (sendingCompose || composeClosePending.current) return;
    composeClosePending.current = true;
    const version = composeEditVersion.current;
    cancelUndoSend();
    // The autosave is debounced 450ms and its cleanup cancels the pending write, so closing
    // right after a keystroke dropped those edits. Flush synchronously first, then resync the
    // Drafts badge so the count reflects a draft created by this close.
    const saved = await flushDraftsNow();
    composeClosePending.current = false;
    if (!saved || version !== composeEditVersion.current) return;
    setIsComposeOpen(false);
    void loadMailboxCounts();
    // Closing a compose can create, update or empty a draft, so the cached Drafts page is now
    // stale. Only the badge was refreshed before, which left the Drafts LIST showing the old
    // contents until a manual refresh. Drop the cache and, if that list is on screen, refetch it.
    invalidateMessagesCache();
    if (activeModule === "drafts") void loadMessagesRef.current();
  }, [sendingCompose, cancelUndoSend, flushDraftsNow, loadMailboxCounts, invalidateMessagesCache, activeModule, loadMessagesRef]);

  /**
   * The trash icon in the compose footer is labeled "Discard draft" but was wired to
   * `closeCompose` (save-and-close) — so "discarding" a draft actually saved it. This deletes
   * whatever draft this compose session has written (both the active key it was opened from, if
   * any, and the fresh-compose key, mirroring the cleanup in performSendCompose) instead of
   * flushing one more save.
   */
  const discardCompose = useCallback(async () => {
    if (sendingCompose || composeClosePending.current) return;
    composeClosePending.current = true;
    // Block the debounced-autosave effect's pending PUT (if any) from firing while — or after —
    // this DELETE is in flight and recreating the draft we're about to remove.
    discardingComposeRef.current = true;
    cancelUndoSend();
    if (composeActiveDraftKey && composeActiveDraftKey !== composeDraftStorageKey) {
      await clearLocalDraft(composeActiveDraftKey).catch(() => null);
    }
    await clearLocalDraft(composeDraftStorageKey).catch(() => null);
    composeClosePending.current = false;
    setComposeActiveDraftKey("");
    setIsComposeOpen(false);
    void loadMailboxCounts();
    invalidateMessagesCache();
    if (activeModule === "drafts") void loadMessagesRef.current();
  }, [
    sendingCompose,
    cancelUndoSend,
    composeActiveDraftKey,
    composeDraftStorageKey,
    clearLocalDraft,
    loadMailboxCounts,
    invalidateMessagesCache,
    activeModule,
    loadMessagesRef,
  ]);

  useEffect(() => {
    composeEditVersion.current += 1;
  }, [composeTo, composeCc, composeBcc, composeSubject, composeBody, composeBodyHtml, composeAccountEmail]);

  // Undo-send: hold the message for a short window with an Undo affordance, then actually send.
  const handleSendCompose = useCallback(() => {
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
    try { pendingSendBodyRef.current = JSON.stringify(prepareSendRequest(buildSendPayload())); } catch (error) { cancelUndoSend(); setComposeError(error instanceof Error ? error.message : "Could not prepare send"); return; }
    undoSendTimeoutRef.current = setTimeout(() => {
      cancelUndoSend();
      void performSendCompose();
    }, delay * 1000);
    undoCountdownRef.current = setInterval(() => {
      setUndoCountdown((prev) => (prev && prev > 1 ? prev - 1 : prev));
    }, 1000);
  }, [composeBodyHtml, composeBody, composeTo, composeAccountEmail, sendingCompose, undoCountdown, composeCc, composeBcc, scheduleAt, performSendCompose, buildSendPayload, cancelUndoSend]);

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

  const handleSaveComposeTemplate = useCallback(async () => {
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
  }, [saveTemplateName, composeAccountEmail, saveTemplateSaving, composeSubject, composeBodyHtml, composeBody]);

  const applyComposeTemplate = useCallback((templateId: string) => {
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
  }, [composeTemplates]);

  // Append a chosen signature to the end of the current body (unlike templates, which replace it).
  const applyComposeSignature = useCallback((signatureId: string) => {
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
  }, [composeSignatures]);

  const handlePrintCompose = useCallback(() => {
    const html =
      composeBodyHtml.trim() ||
      `<p>${composeBody
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br />")}</p>`;
    printComposeContent(composeSubject || "(No Subject)", html);
  }, [composeBodyHtml, composeBody, composeSubject]);

  const composeFromOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...(selectedAccounts.length > 0 ? selectedAccounts : connectedAccountsList.map((entry) => entry.email)),
          ...providerAccounts.map((entry) => entry.accountEmail),
        ])
      ),
    [selectedAccounts, connectedAccountsList, providerAccounts]
  );

  return {
    // Guard inputs for the parent
    hasUnsavedChanges,
    isSending,
    draftSaveState,

    // Full compose modal
    isComposeOpen,
    composeTo, setComposeTo,
    composeCc, setComposeCc,
    composeBcc, setComposeBcc,
    showCc, setShowCc,
    showBcc, setShowBcc,
    composeSubject, setComposeSubject,
    composeBody, setComposeBody,
    composeBodyHtml, setComposeBodyHtml,
    composeAttachments, setComposeAttachments,
    signModalOpen, setSignModalOpen,
    composeBookingLinks,
    bookingMenuOpen,
    composeTemplates,
    composeSignatures,
    saveTemplateModalOpen, setSaveTemplateModalOpen,
    artemisPromptOpen, setArtemisPromptOpen,
    saveTemplateName, setSaveTemplateName,
    saveTemplateSaving,
    composeEditorRef,
    composeAttachInputRef,
    composeFormattingToolbarOpen, setComposeFormattingToolbarOpen,
    composeAccountEmail, setComposeAccountEmail,
    composeFrom, setComposeFrom,
    composeAliases,
    composeThreadId,
    sendingCompose,
    undoCountdown,
    scheduleAt, setScheduleAt,
    scheduleOpen, setScheduleOpen,
    composeMoreOpen, setComposeMoreOpen,
    confidentialOn, setConfidentialOn,
    confidentialExpiry, setConfidentialExpiry,
    confidentialPasscode, setConfidentialPasscode,
    confidentialOpen, setConfidentialOpen,
    requestReceipt, setRequestReceipt,
    artemisDrafting,
    artemisRewriteOpen, setArtemisRewriteOpen,
    composeError,
    composeSuccess,
    composeExpanded, setComposeExpanded,
    composeMinimized, setComposeMinimized,
    composeLintWarnings,
    composeHasMeaningfulBody,
    composeFromOptions,

    openNewCompose,
    openComposeDraftFromRow,
    closeCompose,
    discardCompose,
    handleSendCompose,
    cancelUndoSend,
    addComposeAttachmentsFromFiles,
    toggleBookingMenu,
    insertBookingLink,
    handleSaveComposeTemplate,
    applyComposeTemplate,
    applyComposeSignature,
    handlePrintCompose,
    handleArtemisDraft,
    runArtemisDraft,
    handleArtemisRewrite,

    // Inline reply/forward
    inlineComposeMode, setInlineComposeMode,
    inlineComposeTo, setInlineComposeTo,
    inlineComposeCc, setInlineComposeCc,
    inlineComposeBcc, setInlineComposeBcc,
    inlineShowCc, setInlineShowCc,
    inlineToEditing, setInlineToEditing,
    inlineShowFormatting, setInlineShowFormatting,
    inlineShowBcc, setInlineShowBcc,
    inlineMoreOpen, setInlineMoreOpen,
    inlineComposeSubject, setInlineComposeSubject,
    inlineComposeIntroText, setInlineComposeIntroText,
    inlineComposeIntroHtml, setInlineComposeIntroHtml,
    inlineEditorRef,
    inlineComposeBodyText,
    inlineComposeBodyHtml,
    inlineComposePreviewHtml,
    inlineComposeSending,
    inlineComposeError,
    inlineComposeSuccess,
    inlineComposeRef,
    inlineDraftStorageKey,

    openReplyCompose,
    openReplyAllCompose,
    openForwardCompose,
    sendInlineCompose,
    sanitizeInlinePreviewHtml,

    clearLocalDraft,
    // Pass-through of an input, for the "Discard Reply" button in InlineReply.tsx.
    loadMailboxCounts,
  };
}

export type ComposeWindowBundle = ReturnType<typeof useComposeWindow>;
