import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Inter } from "next/font/google";
import { FaGoogle } from "react-icons/fa";
import {
  FiAlertCircle,
  FiArchive,
  FiChevronDown,
  FiCheckSquare,
  FiChevronsRight,
  FiCornerUpLeft,
  FiDownload,
  FiEdit3,
  FiFilter,
  FiInbox,
  FiKey,
  FiMail,
  FiMove,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiSend,
  FiUpload,
  FiUserPlus,
  FiTrash2,
  FiUsers,
  FiX,
} from "react-icons/fi";
import RowActionMenu, { RowActionMenuItem } from "@/components/ui/RowActionMenu";
import SuccessStatusModal from "@/components/ui/SuccessStatusModal";

const inter = Inter({ subsets: ["latin"] });
const PAGE_SIZE = 50;

type ModuleKey =
  | "inbox"
  | "sent"
  | "drafts"
  | "campaigns"
  | "cryptography"
  | "contacts"
  | "archive"
  | "spam"
  | "trash";

type GmailAccountConnection = {
  email: string;
  connected: boolean;
  expiresAt: string | null;
  reconnectReason?: string | null;
};

type MessageRow = {
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

type MessageDetail = {
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

type ThreadMessage = {
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

type MailboxCounts = {
  inbox: number;
  sent: number;
  drafts: number;
  archive: number;
  spam: number;
  trash: number;
};

type ModuleUnreadBadgeCounts = {
  inbox: number;
  sent: number;
  drafts: number;
  archive: number;
  spam: number;
  trash: number;
};

type ContactTag = {
  id: string;
  name: string;
  color: string;
};

type ContactRow = {
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

type ContactVisibility = {
  showPhone: boolean;
  showBusiness: boolean;
  showWebsite: boolean;
};

type ProviderAccount = {
  id: string;
  accountEmail: string;
  providerLabel?: string | null;
};

type BlockedSenderRow = {
  id: string;
  email: string;
  accountEmail: string | null;
  name: string | null;
};

type LocalEmailDraft = {
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

const EMPTY_COUNTS: MailboxCounts = {
  inbox: 0,
  sent: 0,
  drafts: 0,
  archive: 0,
  spam: 0,
  trash: 0,
};

const MODULES: Array<{ key: ModuleKey; label: string; icon: React.ReactNode }> = [
  { key: "inbox", label: "Inbox", icon: <FiInbox className="w-4 h-4" /> },
  { key: "drafts", label: "Drafts", icon: <FiMail className="w-4 h-4" /> },
  { key: "sent", label: "Sent", icon: <FiSend className="w-4 h-4" /> },
  { key: "cryptography", label: "Cryptography", icon: <FiKey className="w-4 h-4" /> },
  { key: "campaigns", label: "Campaigns", icon: <FiCheckSquare className="w-4 h-4" /> },
  { key: "contacts", label: "Contacts", icon: <FiUsers className="w-4 h-4" /> },
  { key: "archive", label: "Archive", icon: <FiArchive className="w-4 h-4" /> },
  { key: "spam", label: "Spam", icon: <FiMail className="w-4 h-4" /> },
  { key: "trash", label: "Trash", icon: <FiTrash2 className="w-4 h-4" /> },
];

const BADGE_MODULES = new Set<ModuleKey>(["inbox", "sent", "drafts", "archive", "spam"]);
const BADGE_MAILBOXES: Array<"inbox" | "sent" | "drafts" | "archive" | "spam" | "trash"> = [
  "inbox",
  "sent",
  "drafts",
  "archive",
  "spam",
  "trash",
];

type EmailingPlatformSectionProps = {
  standalone?: boolean;
  launchStandaloneOnContinue?: boolean;
  initialSelectedAccounts?: string[];
};

const MailboxLoader: React.FC<{ label?: string }> = ({ label = "Loading messages..." }) => (
  <div className="h-full min-h-[320px] flex items-center justify-center px-6">
    <div className="text-center">
      <div className="mx-auto w-12 h-12 rounded-full border-4 border-[#E9D4FB] border-t-[#701CC0] animate-spin" />
      <p className="mt-4 text-sm font-medium text-[#5B5E73]">{label}</p>
    </div>
  </div>
);

const MailboxEmpty: React.FC = () => (
  <div className="h-full min-h-[320px] flex items-center justify-center px-6">
    <div className="text-center rounded-2xl border border-[#E7E9F2] bg-[#FBFCFF] px-8 py-10">
      <FiInbox className="w-8 h-8 mx-auto text-[#701CC0] animate-bounce" />
      <p className="mt-3 text-sm font-semibold text-[#2A2D3B]">No Messages Found</p>
      <p className="text-xs text-[#7C829A] mt-1">Try another mailbox or refresh this view.</p>
    </div>
  </div>
);

const EmailingPlatformSection: React.FC<EmailingPlatformSectionProps> = ({
  standalone = false,
  launchStandaloneOnContinue = false,
  initialSelectedAccounts = [],
}) => {
  const initialAccountsRef = useRef(initialSelectedAccounts);
  const [step, setStep] = useState<"gate" | "client">(initialSelectedAccounts.length > 0 ? "client" : "gate");
  const [activeModule, setActiveModule] = useState<ModuleKey>("inbox");
  const [gmailAccounts, setGmailAccounts] = useState<GmailAccountConnection[]>([]);
  const [gmailLoading, setGmailLoading] = useState(false);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>(initialSelectedAccounts);

  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState("");
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [accountErrors, setAccountErrors] = useState<Array<{ accountEmail: string; message: string }>>([]);
  const [selectedMessageId, setSelectedMessageId] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [selectedMessageDetail, setSelectedMessageDetail] = useState<MessageDetail | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "message">("list");

  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);

  const [mailboxCounts, setMailboxCounts] = useState<MailboxCounts>(EMPTY_COUNTS);
  const [countsLoading, setCountsLoading] = useState(false);
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

  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeCc, setComposeCc] = useState("");
  const [composeBcc, setComposeBcc] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeAccountEmail, setComposeAccountEmail] = useState("");
  const [composeThreadId, setComposeThreadId] = useState("");
  const [composeInReplyTo, setComposeInReplyTo] = useState("");
  const [composeReferences, setComposeReferences] = useState("");
  const [sendingCompose, setSendingCompose] = useState(false);
  const [composeError, setComposeError] = useState("");
  const [composeSuccess, setComposeSuccess] = useState("");
  const [composeExpanded, setComposeExpanded] = useState(false);
  const [composeActiveDraftKey, setComposeActiveDraftKey] = useState("");
  const [inlineComposeMode, setInlineComposeMode] = useState<null | "reply" | "replyAll" | "forward">(null);
  const [inlineComposeTo, setInlineComposeTo] = useState("");
  const [inlineComposeSubject, setInlineComposeSubject] = useState("");
  const [inlineComposeIntroText, setInlineComposeIntroText] = useState("");
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
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsError, setContactsError] = useState("");
  const [contactsTags, setContactsTags] = useState<ContactTag[]>([]);
  const [contactSearch, setContactSearch] = useState("");
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
  const [contactsVisibility, setContactsVisibility] = useState<ContactVisibility>({
    showPhone: true,
    showBusiness: true,
    showWebsite: true,
  });
  const [providerAccounts, setProviderAccounts] = useState<ProviderAccount[]>([]);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const loadMessagesRequestRef = useRef(0);
  const selectedMessageIdRef = useRef("");
  const moveListMenuRef = useRef<HTMLDivElement | null>(null);
  const moveMessageMenuRef = useRef<HTMLDivElement | null>(null);
  const inlineComposeRef = useRef<HTMLDivElement | null>(null);

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
  const canContinue = connectedAccounts.length > 0 && selectedAccounts.length > 0;
  const canLoadMessages =
    activeModule === "inbox" ||
    activeModule === "sent" ||
    activeModule === "drafts" ||
    activeModule === "spam" ||
    activeModule === "trash" ||
    activeModule === "archive";
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

  useEffect(() => {
    selectedMessageIdRef.current = selectedMessageId;
  }, [selectedMessageId]);

  const openStandaloneViewer = (accounts: string[]) => {
    const query = new URLSearchParams();
    if (accounts.length > 0) {
      query.set("accounts", accounts.join(","));
    }
    const url = `/panel/email${query.toString() ? `?${query.toString()}` : ""}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const loadContactTags = useCallback(async () => {
    try {
      const response = await fetch("/api/contacts/tags");
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return;
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
      const response = await fetch(`/api/contacts/visibility?${query.toString()}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return;
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
    setContactsLoading(true);
    setContactsError("");
    try {
      const query = new URLSearchParams({ limit: "200" });
      if (contactSearch.trim()) query.set("search", contactSearch.trim());
      if (contactTagFilter) query.set("tagIds", contactTagFilter);
      if (contactSourceFilter) query.set("source", contactSourceFilter);
      const response = await fetch(`/api/contacts?${query.toString()}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to load contacts.");
      }
      setContacts(Array.isArray(payload?.contacts) ? payload.contacts : []);
    } catch (error) {
      setContacts([]);
      setContactsError(error instanceof Error ? error.message : "Failed to load contacts.");
    } finally {
      setContactsLoading(false);
    }
  }, [activeModule, contactSearch, contactSourceFilter, contactTagFilter, step]);

  const createContact = async () => {
    if (!addContactForm.email.trim()) {
      setContactsError("Contact email is required.");
      return;
    }
    setAddingContact(true);
    setContactsError("");
    try {
      const response = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
        accountEmail: null,
          email: addContactForm.email.trim(),
          firstName: addContactForm.firstName.trim(),
          lastName: addContactForm.lastName.trim(),
          phone: addContactForm.phone.trim(),
          business: addContactForm.business.trim(),
          website: addContactForm.website.trim(),
          address: addContactForm.address.trim(),
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setContactsError(payload?.message || "Failed to create contact.");
        return;
      }
      setAddContactForm({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        business: "",
        website: "",
        address: "",
      });
      setIsAddContactModalOpen(false);
      await loadContacts();
    } catch (error) {
      setContactsError(error instanceof Error ? error.message : "Failed to create contact.");
    } finally {
      setAddingContact(false);
    }
  };

  const editContact = async (contact: ContactRow) => {
    const firstName = window.prompt("First name", contact.firstName || "") ?? (contact.firstName || "");
    const lastName = window.prompt("Last name", contact.lastName || "") ?? (contact.lastName || "");
    const phone = window.prompt("Phone", contact.phone || "") ?? (contact.phone || "");
    const business = window.prompt("Business", contact.business || "") ?? (contact.business || "");
    const website = window.prompt("Website", contact.website || "") ?? (contact.website || "");
    const address = window.prompt("Address", contact.address || "") ?? (contact.address || "");
    await fetch(`/api/contacts/${encodeURIComponent(contact.id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName,
        lastName,
        phone,
        business,
        website,
        address,
      }),
    });
    await loadContacts();
  };

  const deleteContact = async (contact: ContactRow) => {
    const ok = window.confirm(`Delete ${contact.email}?`);
    if (!ok) return;
    await fetch(`/api/contacts/${encodeURIComponent(contact.id)}`, { method: "DELETE" });
    await loadContacts();
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

  const addTagsFromManageMenu = async (contact: ContactRow) => {
    const availableTags = contactsTags.filter((tag) => !contact.tags.some((assigned) => assigned.id === tag.id));
    if (availableTags.length === 0) {
      setContactsError("No available tags to add for this contact.");
      return;
    }
    const helper = availableTags.map((tag) => tag.name).join(", ");
    const raw = window.prompt(`Add tag(s) to ${contact.email}. Available: ${helper}`);
    if (!raw) return;
    const requestedNames = raw
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    if (requestedNames.length === 0) return;
    const uniqueIds = Array.from(
      new Set(
        requestedNames
          .map((name) => availableTags.find((tag) => tag.name.toLowerCase() === name)?.id || "")
          .filter(Boolean)
      )
    );
    if (uniqueIds.length === 0) {
      setContactsError("No matching tags found from your input.");
      return;
    }
    await Promise.all(uniqueIds.map((tagId) => addTagToContact(contact.id, tagId, false)));
    await loadContacts();
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

  const handleImportCsv = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const csvText = await file.text();
    const response = await fetch("/api/contacts/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountEmail: null,
        csvText,
      }),
    });
    if (!response.ok) {
      setContactsError("Failed to import CSV.");
      return;
    }
    event.target.value = "";
    await Promise.all([loadContacts(), loadContactTags()]);
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

  const toggleAccount = (email: string) => {
    setSelectedAccounts((prev) => (prev.includes(email) ? prev.filter((entry) => entry !== email) : [...prev, email]));
  };

  const formatDate = (timestamp: number, rawDate?: string) => {
    if (timestamp > 0) {
      return new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }
    return rawDate || "";
  };

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

  const inlineDraftStorageKey = useMemo(() => {
    if (!inlineComposeMode || !selectedMessage) return "";
    if (inlineComposeMode === "forward") return "";
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
    if (diffHours < 1) return "less than 1 hour ago";
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

  const sanitizeHtml = (rawHtml: string) => {
    if (!rawHtml) return "";
    if (typeof window === "undefined") return rawHtml;
    const parser = new window.DOMParser();
    const parsed = parser.parseFromString(rawHtml, "text/html");
    parsed.querySelectorAll("script, style, iframe, object, embed").forEach((node) => node.remove());
    parsed.querySelectorAll<HTMLElement>("*").forEach((node) => {
      Array.from(node.attributes).forEach((attribute) => {
        if (/^on/i.test(attribute.name)) node.removeAttribute(attribute.name);
      });
    });
    parsed.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
      img.style.maxWidth = "100%";
      img.style.height = "auto";
      img.loading = "lazy";
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
      const response = await fetch("/api/gmail/status");
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
      const preselected = initialAccountsRef.current.filter((email) => connected.includes(email));

      if (preselected.length > 0) {
        setSelectedAccounts(preselected);
        setStep("client");
      } else if (connected.length === 1) {
        setSelectedAccounts(connected);
        setStep(standalone ? "client" : "gate");
      } else {
        setSelectedAccounts([]);
        setStep("gate");
      }
    } catch {
      setGmailAccounts([]);
      setSelectedAccounts([]);
      setStep("gate");
    } finally {
      setGmailLoading(false);
    }
  }, [standalone]);

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
      setMailboxCounts({
        inbox: Number(counts.inbox || 0),
        sent: Number(counts.sent || 0),
        drafts: Number(counts.drafts || 0),
        archive: Number(counts.archive || 0),
        spam: Number(counts.spam || 0),
        trash: Number(counts.trash || 0),
      });
    } catch {
      setMailboxCounts(EMPTY_COUNTS);
    } finally {
      setCountsLoading(false);
    }
  }, [selectedAccounts, step]);

  useEffect(() => {
    loadMailboxCounts();
  }, [loadMailboxCounts]);

  const loadUnreadBadges = useCallback(async () => {
    if (step !== "client" || selectedAccounts.length === 0) {
      setModuleUnreadBadges({
        inbox: 0,
        sent: 0,
        drafts: 0,
        archive: 0,
        spam: 0,
        trash: 0,
      });
      return;
    }
    try {
      const results = await Promise.all(
        BADGE_MAILBOXES.map(async (mailbox) => {
          const query = new URLSearchParams({
            mailbox,
            accounts: selectedAccounts.join(","),
            limit: String(PAGE_SIZE),
            page: "1",
          });
          const response = await fetch(`/api/gmail/messages?${query.toString()}`);
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) return [mailbox, 0] as const;
          const rows: MessageRow[] = Array.isArray(payload?.messages) ? payload.messages : [];
          return [mailbox, rows.filter((row) => row.unread).length] as const;
        })
      );
      const next: ModuleUnreadBadgeCounts = {
        inbox: 0,
        sent: 0,
        drafts: 0,
        archive: 0,
        spam: 0,
        trash: 0,
      };
      for (const [mailbox, count] of results) {
        next[mailbox] = count;
      }
      setModuleUnreadBadges(next);
    } catch {
      setModuleUnreadBadges({
        inbox: 0,
        sent: 0,
        drafts: 0,
        archive: 0,
        spam: 0,
        trash: 0,
      });
    }
  }, [selectedAccounts, step]);

  const loadMessages = useCallback(async () => {
    const requestId = ++loadMessagesRequestRef.current;
    if (step !== "client" || !canLoadMessages || selectedAccounts.length === 0) {
      if (requestId !== loadMessagesRequestRef.current) return;
      setMessages([]);
      setHasNextPage(false);
      return;
    }

    const mailbox = activeModule as "inbox" | "sent" | "drafts" | "spam" | "trash" | "archive";
    const query = new URLSearchParams({
      mailbox,
      accounts: selectedAccounts.join(","),
      limit: String(PAGE_SIZE),
      page: String(currentPage),
    });

    setMessagesLoading(true);
    setMessagesError("");
    try {
      const response = await fetch(`/api/gmail/messages?${query.toString()}`);
      const payload = await response.json().catch(() => ({}));
      if (requestId !== loadMessagesRequestRef.current) return;
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to load Gmail messages.");
      }
      const nextMessages = Array.isArray(payload?.messages) ? payload.messages : [];
      const unreadCount = nextMessages.filter((message: MessageRow) => message.unread).length;
      setModuleUnreadBadges((prev) => ({ ...prev, [mailbox]: unreadCount }));
      setMessages(nextMessages);
      setAccountErrors(Array.isArray(payload?.accountErrors) ? payload.accountErrors : []);
      setHasNextPage(Boolean(payload?.hasNextPage));
      setSelectedRows([]);
      const activeSelectedMessageId = selectedMessageIdRef.current;
      if (activeSelectedMessageId && !nextMessages.some((message: MessageRow) => message.id === activeSelectedMessageId)) {
        setSelectedMessageId("");
        setSelectedMessageDetail(null);
        setViewMode("list");
      }
    } catch (error) {
      if (requestId !== loadMessagesRequestRef.current) return;
      setMessages([]);
      setHasNextPage(false);
      setModuleUnreadBadges((prev) => ({ ...prev, [mailbox]: 0 }));
      setAccountErrors([]);
      setMessagesError(error instanceof Error ? error.message : "Failed to load Gmail messages.");
    } finally {
      if (requestId !== loadMessagesRequestRef.current) return;
      setMessagesLoading(false);
    }
  }, [activeModule, canLoadMessages, currentPage, selectedAccounts, step]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    loadUnreadBadges();
  }, [loadUnreadBadges]);

  useEffect(() => {
    if (step === "client" && activeModule === "contacts") {
      loadContactTags();
      loadContactVisibility();
    }
  }, [activeModule, loadContactTags, loadContactVisibility, step]);

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

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  useEffect(() => {
    if (!selectedMessage || viewMode !== "message") return;
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
        setSelectedMessageDetail({
          bodyHtml: typeof payload?.bodyHtml === "string" ? payload.bodyHtml : "",
          bodyText: typeof payload?.bodyText === "string" ? payload.bodyText : "",
          fromRaw: typeof payload?.fromRaw === "string" ? payload.fromRaw : selectedMessage.fromRaw,
          toRaw: typeof payload?.toRaw === "string" ? payload.toRaw : selectedMessage.toRaw,
          subject: typeof payload?.subject === "string" ? payload.subject : selectedMessage.subject,
          replyTo: typeof payload?.replyTo === "string" ? payload.replyTo : selectedMessage.replyTo,
          date: typeof payload?.date === "string" ? payload.date : selectedMessage.date,
          timestamp: typeof payload?.timestamp === "number" ? payload.timestamp : selectedMessage.timestamp,
          messageIdHeader:
            typeof payload?.messageIdHeader === "string" ? payload.messageIdHeader : selectedMessage.messageIdHeader,
          references: typeof payload?.references === "string" ? payload.references : selectedMessage.references,
          senderPhotoUrl: typeof payload?.senderPhotoUrl === "string" ? payload.senderPhotoUrl : "",
          threadMessages: Array.isArray(payload?.threadMessages) ? payload.threadMessages : undefined,
        });
      } catch (error) {
        setDetailError(error instanceof Error ? error.message : "Failed to load message detail.");
        setSelectedMessageDetail(null);
      } finally {
        setDetailLoading(false);
      }
    };
    loadDetail();
  }, [selectedMessage, viewMode]);

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
      const hasComposeContent = composeBody.trim();
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
            accountEmail: composeAccountEmail,
            updatedAt: Date.now(),
          },
          { keepalive: true }
        );
      }
    }

    if (!inlineComposeSending && inlineComposeMode && inlineComposeMode !== "forward" && inlineDraftStorageKey) {
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
    clearLocalDraft,
    composeAccountEmail,
    composeBcc,
    composeBody,
    composeCc,
    composeActiveDraftKey,
    composeDraftStorageKey,
    composeSubject,
    composeTo,
    effectiveComposeDraftStorageKey,
    inlineComposeSending,
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
    const hasContent = composeBody.trim();
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
    if (inlineComposeSending || !inlineComposeMode || inlineComposeMode === "forward" || !inlineDraftStorageKey) return;
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
    const visibleRowKeys = filteredMessages.map((message) => rowKey(message));
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
    ) => {
      const composeDraftRows = selectedMessageRows.filter((message) => Boolean(message.isComposeDraft && message.draftKey));
      const selectedComposeDraftKeys = new Set(composeDraftRows.map((message) => rowKey(message)));
      const gmailRows = selectedMessageRows.filter((message) => !message.isComposeDraft);
      const items = gmailRows.map((message) => ({
        accountEmail: message.accountEmail,
        messageId: message.id,
      }));
      if (items.length === 0 && composeDraftRows.length === 0) return;
      if (actionLoading) return;

      setActionLoading(true);
      setActionError("");
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
          const response = await fetch("/api/gmail/actions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action, items }),
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok && response.status !== 207) {
            throw new Error(payload?.message || "Action failed.");
          }
          results = Array.isArray(payload?.results) ? payload.results : [];
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

          const unreadCount = next.filter((message) => message.unread).length;
          setModuleUnreadBadges((prevBadges) =>
            activeModule in prevBadges ? { ...prevBadges, [activeModule]: unreadCount } : prevBadges
          );
          return next;
        });

        setSelectedRows([]);
        setViewMode("list");
        setSelectedMessageId("");
        setSelectedMessageDetail(null);
        await Promise.all([loadMailboxCounts(), loadUnreadBadges()]);
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "Action failed.");
      } finally {
        setActionLoading(false);
      }
    },
    [actionLoading, activeModule, loadMailboxCounts, loadUnreadBadges, rowKey, selectedMessageRows, selectedRows]
  );

  const handleMoveToChange = async (value: string) => {
    if (!value) return;
    if (value === "inbox") await applyAction("moveToInbox");
    if (value === "spam") await applyAction("moveToSpam");
    if (value === "trash") await applyAction("moveToTrash");
    if (value === "archive") await applyAction("archive");
    setMoveMenuOpen(null);
  };

  const openReplyCompose = () => {
    if (!selectedMessage) return;
    const latest = threadMessages[threadMessages.length - 1];
    setInlineComposeMode("reply");
    setInlineComposeTo(parseMailboxAddress(latest?.replyTo || selectedMessage.replyTo || selectedMessage.fromRaw || selectedMessage.from).email);
    setInlineComposeSubject(
      /^re:/i.test(selectedMessage.subject || "") ? selectedMessage.subject : `Re: ${selectedMessage.subject || ""}`
    );
    setInlineComposeIntroText("");
    setInlineComposeBodyText("");
    setInlineComposeBodyHtml("");
    setInlineComposePreviewHtml("");
    setInlineComposeThreadId(selectedMessage.threadId || latest?.threadId || "");
    setInlineComposeInReplyTo(latest?.messageIdHeader || selectedMessage.messageIdHeader || "");
    setInlineComposeReferences(latest?.references || selectedMessage.references || "");
    setInlineComposeError("");
    setInlineComposeSuccess("");
  };

  const openReplyAllCompose = () => {
    if (!selectedMessage) return;
    const latest = threadMessages[threadMessages.length - 1];
    const fromIdentity = parseMailboxAddress(latest?.replyTo || selectedMessage.replyTo || selectedMessage.fromRaw || selectedMessage.from);
    const toList = parseAddressList(latest?.toRaw || selectedMessage.toRaw || selectedMessage.to);
    const uniqueEmails = Array.from(new Set([fromIdentity.email, ...toList.map((entry) => entry.email)].filter(Boolean)));
    setInlineComposeMode("replyAll");
    setInlineComposeTo(uniqueEmails.join(", "));
    setInlineComposeSubject(
      /^re:/i.test(selectedMessage.subject || "") ? selectedMessage.subject : `Re: ${selectedMessage.subject || ""}`
    );
    setInlineComposeIntroText("");
    setInlineComposeBodyText("");
    setInlineComposeBodyHtml("");
    setInlineComposePreviewHtml("");
    setInlineComposeThreadId(selectedMessage.threadId || latest?.threadId || "");
    setInlineComposeInReplyTo(latest?.messageIdHeader || selectedMessage.messageIdHeader || "");
    setInlineComposeReferences(latest?.references || selectedMessage.references || "");
    setInlineComposeError("");
    setInlineComposeSuccess("");
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
    if (!selectedMessage || !inlineComposeTo.trim() || !inlineComposeSubject.trim() || inlineComposeSending) return;
    const intro = inlineComposeIntroText.trim();
    const textBody = intro ? `${intro}\n\n${inlineComposeBodyText}` : inlineComposeBodyText || intro;
    if (!textBody.trim()) return;
    const introHtml = intro ? `<div>${linkifyTextForHtml(intro)}</div><br>` : "";
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
      setInlineComposeSuccess("Sent.");
      setInlineComposeMode(null);
      await Promise.all([loadMessages(), loadMailboxCounts(), loadUnreadBadges()]);
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
    setComposeAccountEmail(defaultAccount);
    setComposeThreadId("");
    setComposeInReplyTo("");
    setComposeReferences("");
    setComposeActiveDraftKey("");
    setComposeError("");
    setComposeSuccess("");
    setComposeExpanded(false);
    setIsComposeOpen(true);
  };

  const handleSendCompose = async () => {
    if (!composeTo.trim() || !composeSubject.trim() || !composeBody.trim() || !composeAccountEmail || sendingCompose) return;
    setSendingCompose(true);
    setComposeError("");
    setComposeSuccess("");
    try {
      const response = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountEmail: composeAccountEmail,
          to: composeTo.trim(),
          cc: composeCc.trim(),
          bcc: composeBcc.trim(),
          subject: composeSubject.trim(),
          body: composeBody.trim(),
          threadId: composeThreadId || undefined,
          inReplyTo: composeInReplyTo || undefined,
          references: composeReferences || undefined,
          draftKey: effectiveComposeDraftStorageKey || undefined,
          providerAccountId:
            providerAccounts.find((entry) => entry.accountEmail === composeAccountEmail.toLowerCase())?.id || undefined,
        }),
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
      setIsComposeOpen(false);
      setComposeSuccess("Email sent.");
      if (activeModule === "sent" || activeModule === "drafts") {
        await Promise.all([loadMessages(), loadMailboxCounts(), loadUnreadBadges()]);
      } else {
        await Promise.all([loadMailboxCounts(), loadUnreadBadges()]);
      }
    } catch (error) {
      setComposeError(error instanceof Error ? error.message : "Failed to send email.");
    } finally {
      setSendingCompose(false);
    }
  };

  const messagesCountLabel = `${filteredMessages.length} Messages`;
  const activeModuleLabel = MODULES.find((item) => item.key === activeModule)?.label || "Mailbox";
  const pageLabel = `Page ${currentPage}`;
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
    const countMap: Record<"inbox" | "sent" | "drafts" | "archive" | "spam" | "trash", number> = moduleUnreadBadges;
    const count = countMap[moduleKey as keyof typeof countMap];
    return Number.isFinite(count) && count > 0 ? count : 0;
  };

  const spamActionTitle = activeModule === "spam" ? "Report As Not Spam" : "Report As Spam";
  const spamActionType = activeModule === "spam" ? "moveToInbox" : "moveToSpam";

  const moveToOptions = useMemo(() => {
    const allOptions: Array<{ value: "inbox" | "archive" | "spam" | "trash"; label: string }> = [
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
    return excluded ? allOptions.filter((option) => option.value !== excluded) : allOptions;
  }, [activeModule]);

  return (
    <div className={`${standalone ? "w-full h-full" : "w-full h-full"} bg-white text-[#111014] flex flex-col overflow-x-hidden ${inter.className}`}>
      {step === "gate" ? (
        <div className={`${standalone ? "h-full flex items-center justify-center px-6" : "flex-1 flex items-center justify-center px-6 py-10 overflow-y-auto"}`}>
          <div className="w-full max-w-2xl rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-semibold text-[#111827]">Email Panel</h1>
            <p className="mt-2 text-sm text-[#6B7280]">Select which connected Google accounts should be used in this email instance.</p>

            <div className="mt-5 flex items-center">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-[#701CC0]/10">
                  <FaGoogle className="w-3.5 h-3.5 text-[#EA4335]" />
                </span>
                <h3 className="text-sm font-semibold text-[#111827]">Google Accounts</h3>
              </div>
            </div>

            {gmailLoading ? (
              <div className="mt-4 rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] p-5 text-sm text-[#6B7280]">Checking connected accounts...</div>
            ) : connectedAccounts.length === 0 ? (
              <div className="mt-4 rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] p-5 text-sm text-[#6B7280]">No connected Google accounts found.</div>
            ) : connectedAccounts.length === 1 ? (
              <div className="mt-4 rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] p-5 text-sm text-[#374151]">
                <div className="text-[#111827] font-medium">{connectedAccounts[0].email}</div>
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAccounts([connectedAccounts[0].email]);
                      if (launchStandaloneOnContinue && !standalone) {
                        openStandaloneViewer([connectedAccounts[0].email]);
                        return;
                      }
                      setStep("client");
                    }}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#701CC0] text-white px-3 py-2 text-sm font-medium hover:bg-[#5f17a5]"
                  >
                    Continue
                    <FiChevronsRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {connectedAccounts.map((account) => (
                    <label key={account.email} className="rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] p-3 flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedAccounts.includes(account.email)}
                        onChange={() => toggleAccount(account.email)}
                        className="h-4 w-4"
                      />
                      <span className="text-sm text-[#111827] truncate">{account.email}</span>
                    </label>
                  ))}
                </div>
                <div className="pt-2">
                  <button
                    type="button"
                    disabled={!canContinue}
                    onClick={() => {
                      if (launchStandaloneOnContinue && !standalone) {
                        openStandaloneViewer(selectedAccounts);
                        return;
                      }
                      setStep("client");
                    }}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#701CC0] text-white px-4 py-2 text-sm font-medium hover:bg-[#5f17a5] disabled:opacity-50"
                  >
                    Continue
                    <FiChevronsRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className={standalone ? "flex-1 w-full overflow-hidden px-4 md:px-6 py-4" : "flex-1 flex justify-center px-6 pt-2 overflow-y-auto"}>
          <div className={standalone ? "w-full max-w-[1700px] mx-auto h-full overflow-hidden" : "w-full max-w-6xl h-full pb-8"}>
            {!standalone ? <h1 className="text-2xl font-semibold text-[#111827] mt-6 mb-6">Email Panel</h1> : null}

            {standalone ? (
              <div className="grid grid-cols-[250px_minmax(740px,1fr)] gap-4 h-[calc(100vh-148px)] min-h-[620px] overflow-hidden">
                <div className="rounded-2xl border border-[#E5E7EB] bg-white p-3 shadow-sm h-full overflow-hidden">
                  <button
                    type="button"
                    onClick={() => {
                      void openNewCompose();
                    }}
                    className="w-full mb-3 rounded-xl bg-[#701CC0] text-white px-3 py-2.5 text-sm font-medium hover:bg-[#5f17a5] inline-flex items-center justify-center gap-2"
                  >
                    <FiEdit3 className="w-4 h-4" />
                    Compose
                  </button>

                  <div className="space-y-1">
                    {MODULES.map((item) => (
                      (() => {
                        const count = moduleCount(item.key);
                        return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => {
                          setActiveModule(item.key);
                          setViewMode("list");
                          setSearchTerm("");
                          setSelectedRows([]);
                        }}
                        className={`w-full rounded-xl px-3 py-2.5 text-sm text-left flex items-center justify-between gap-2 transition ${
                          activeModule === item.key ? "bg-[#701CC0] text-white" : "text-[#374151] hover:bg-[#F3F4F6]"
                        }`}
                      >
                        <span className="inline-flex items-center gap-2 min-w-0">
                          {item.icon}
                          <span className="truncate">
                            {item.label}
                            {count > 0 ? <span className="ml-1">({count})</span> : null}
                          </span>
                        </span>
                      </button>
                        );
                      })()
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-[#E5E7EB] bg-white shadow-sm h-full overflow-hidden flex flex-col">
                  {viewMode === "list" ? (
                    <>
                      {activeModule !== "contacts" ? (
                        <>
                          <div className="px-4 py-3 border-b border-[#E5E7EB] bg-[#FBFCFF] flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <input
                                type="checkbox"
                                checked={
                                  filteredMessages.length > 0 &&
                                  filteredMessages.every((message) => selectedRows.includes(rowKey(message)))
                                }
                                onChange={toggleSelectAll}
                                className="h-4 w-4"
                              />
                              <div className="text-xs font-medium text-[#6B7280] mr-1">{activeModuleLabel} · {messagesCountLabel}</div>
                              <button
                                type="button"
                                onClick={() => Promise.all([loadMessages(), loadMailboxCounts(), loadUnreadBadges()])}
                                disabled={messagesLoading}
                                className="p-2 rounded-lg border border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-50"
                                title="Refresh"
                              >
                                <FiRefreshCw className={`w-4 h-4 ${messagesLoading ? "animate-spin" : ""}`} />
                              </button>
                              {hasSelectedEmails ? (
                                <>
                                  {activeModule !== "drafts" ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => applyAction("markRead")}
                                        disabled={actionLoading}
                                        className="p-2 rounded-lg border border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-50"
                                        title="Mark As Read"
                                      >
                                        <FiCheckSquare className="w-4 h-4" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => applyAction("markUnread")}
                                        disabled={actionLoading}
                                        className="p-2 rounded-lg border border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-50"
                                        title="Mark As Unread"
                                      >
                                        <FiMail className="w-4 h-4" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => applyAction(activeModule === "archive" ? "moveToInbox" : "archive")}
                                        disabled={actionLoading}
                                        className="p-2 rounded-lg border border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-50"
                                        title={activeModule === "archive" ? "Unarchive" : "Archive"}
                                      >
                                        <FiArchive className="w-4 h-4" />
                                      </button>
                                    </>
                                  ) : null}
                                  <button
                                    type="button"
                                    onClick={() => applyAction(activeModule === "trash" ? "deletePermanently" : "trash")}
                                    disabled={actionLoading}
                                    className="p-2 rounded-lg border border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-50"
                                    title={activeModule === "trash" ? "Delete Permanently" : "Move To Trash"}
                                  >
                                    <FiTrash2 className="w-4 h-4" />
                                  </button>
                                  {activeModule !== "drafts" ? (
                                    <div ref={moveListMenuRef} className="relative">
                                      <button
                                        type="button"
                                        onClick={() => setMoveMenuOpen((prev) => (prev === "list" ? null : "list"))}
                                        className="inline-flex items-center justify-center rounded-lg border border-[#E5E7EB] p-2 bg-white text-[#374151] hover:bg-[#F9FAFB]"
                                        title="Move To"
                                      >
                                        <FiMove className="w-4 h-4" />
                                      </button>
                                      {moveMenuOpen === "list" ? (
                                        <div className="absolute right-0 top-[calc(100%+6px)] z-20 min-w-[140px] rounded-lg border border-[#E5E7EB] bg-white shadow-lg py-1">
                                          {moveToOptions.map((option) => (
                                            <button
                                              key={`list-move-${option.value}`}
                                              type="button"
                                              onClick={() => handleMoveToChange(option.value)}
                                              className="w-full px-3 py-1.5 text-left text-sm text-[#374151] hover:bg-[#F3F4F6]"
                                            >
                                              {option.label}
                                            </button>
                                          ))}
                                        </div>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </>
                              ) : null}
                              <div className="rounded-lg border border-transparent bg-white px-3 py-1.5 flex items-center gap-2 w-96 max-w-full shadow-sm focus-within:ring-2 focus-within:ring-[#701CC0] transition">
                                <FiSearch className="w-4 h-4 text-[#6B7280]" />
                                <input
                                  value={searchTerm}
                                  onChange={(e) => setSearchTerm(e.target.value)}
                                  placeholder="Search"
                                  className="w-full bg-transparent text-sm text-[#374151] placeholder:text-[#8E93AA] outline-none"
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
                            </div>
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                                disabled={currentPage <= 1 || messagesLoading}
                                className="rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1 text-xs text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-50"
                              >
                                Prev
                              </button>
                              <div className="text-xs text-[#6B7280] min-w-[60px] text-center">
                                {pageLabel}
                              </div>
                              <button
                                type="button"
                                onClick={() => setCurrentPage((prev) => prev + 1)}
                                disabled={!hasNextPage || messagesLoading}
                                className="rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1 text-xs text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-50"
                              >
                                Next
                              </button>
                            </div>
                          </div>

                        </>
                      ) : null}

                      <div className="flex-1 overflow-y-auto overflow-x-hidden pb-16">
                        {messagesError ? (
                          <div className="m-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{messagesError}</div>
                        ) : null}
                        {actionError ? (
                          <div className="m-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>
                        ) : null}
                        {accountErrors.length > 0 ? (
                          <div className="m-3 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
                            Some accounts could not be loaded: {accountErrors.map((entry) => entry.accountEmail).join(", ")}
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
                            <div className="px-4 py-3 border-b border-[#E5E7EB] bg-[#FBFCFF] overflow-x-auto">
                              <div className="mx-auto inline-flex items-center justify-center gap-2 whitespace-nowrap min-w-max">
                                <button
                                  type="button"
                                  onClick={() => setIsAddContactModalOpen(true)}
                                  className="inline-flex items-center gap-2 rounded-lg bg-[#701CC0] text-white px-3 py-2 text-xs font-medium hover:bg-[#5f17a5]"
                                >
                                  <FiPlus className="w-3.5 h-3.5" />
                                  Add Contact
                                </button>
                                <button
                                  type="button"
                                  onClick={() => importInputRef.current?.click()}
                                  className="inline-flex items-center justify-center rounded-lg border border-[#E5E7EB] bg-white p-2 text-[#374151] hover:bg-[#F9FAFB]"
                                  title="Import"
                                  aria-label="Import"
                                >
                                  <FiUpload className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={exportContactsCsv}
                                  className="inline-flex items-center justify-center rounded-lg border border-[#E5E7EB] bg-white p-2 text-[#374151] hover:bg-[#F9FAFB]"
                                  title="Export"
                                  aria-label="Export"
                                >
                                  <FiDownload className="w-3.5 h-3.5" />
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
                                <div className="relative">
                                  <button
                                    type="button"
                                    onClick={() => setContactFilterOpen((prev) => !prev)}
                                    className="inline-flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-medium text-[#374151] hover:bg-[#F9FAFB]"
                                  >
                                    <FiFilter className="w-3.5 h-3.5" />
                                    Filter
                                    <FiChevronDown className="w-3.5 h-3.5" />
                                  </button>
                                  {contactFilterOpen ? (
                                    <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-[#E5E7EB] bg-white p-3 shadow-lg space-y-2">
                                      <div className="relative">
                                        <FiChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-[#7A8098] pointer-events-none" />
                                        <select
                                          value={contactTagFilter}
                                          onChange={(e) => {
                                            setContactTagFilter(e.target.value);
                                            setContactFilterOpen(false);
                                          }}
                                          className="appearance-none w-full rounded-lg border border-[#E5E7EB] bg-white pl-3 pr-7 py-1.5 text-xs text-[#374151]"
                                        >
                                          <option value="">All Tags</option>
                                          {contactsTags.map((tag) => (
                                            <option key={tag.id} value={tag.id}>
                                              {tag.name}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                      <div className="relative">
                                        <FiChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-[#7A8098] pointer-events-none" />
                                        <select
                                          value={contactSourceFilter}
                                          onChange={(e) => {
                                            setContactSourceFilter((e.target.value || "") as "" | "MANUAL" | "GMAIL" | "CSV");
                                            setContactFilterOpen(false);
                                          }}
                                          className="appearance-none w-full rounded-lg border border-[#E5E7EB] bg-white pl-3 pr-7 py-1.5 text-xs text-[#374151]"
                                        >
                                          <option value="">All Sources</option>
                                          <option value="MANUAL">Manual</option>
                                          <option value="GMAIL">Gmail</option>
                                          <option value="CSV">CSV</option>
                                        </select>
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                            <div className="flex-1 overflow-auto p-2">
                              {contactsError ? (
                                <div className="m-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{contactsError}</div>
                              ) : null}
                              {contactsLoading ? (
                                <MailboxLoader label="Loading Contacts..." />
                              ) : contacts.length === 0 ? (
                                <div className="h-full min-h-[320px] flex items-center justify-center px-6">
                                  <div className="text-center rounded-2xl border border-[#E7E9F2] bg-[#FBFCFF] px-8 py-10">
                                    <FiUsers className="w-8 h-8 mx-auto text-[#701CC0] animate-pulse" />
                                    <p className="mt-3 text-sm font-semibold text-[#2A2D3B]">No contacts found</p>
                                    <p className="text-xs text-[#7C829A] mt-1">Add a contact, import CSV, or sync from Gmail to get started.</p>
                                  </div>
                                </div>
                              ) : (
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
                                              <div className="font-medium text-[#111827]">{displayName}</div>
                                              <div className="mt-0.5 text-[11px] text-[#8A90A6] uppercase tracking-wide">{contact.source}</div>
                                            </td>
                                            <td className="px-4 py-3 text-[#374151]">{contact.email}</td>
                                            {contactsVisibility.showPhone ? <td className="px-4 py-3 text-[#374151]">{contact.phone || "N/A"}</td> : null}
                                            {contactsVisibility.showBusiness ? <td className="px-4 py-3 text-[#374151]">{contact.business || "N/A"}</td> : null}
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
                                                  "N/A"
                                                )}
                                              </td>
                                            ) : null}
                                            <td className="px-4 py-3 text-[#374151] max-w-[220px] truncate">{contact.address || "N/A"}</td>
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
                                                    className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#374151]"
                                                    aria-label="Add Tag"
                                                    title="Add Tag"
                                                  >
                                                    <FiPlus className="w-3.5 h-3.5" />
                                                  </button>
                                                  <select
                                                    value=""
                                                    onChange={(e) => addTagToContact(contact.id, e.target.value)}
                                                    className="absolute inset-0 h-6 w-6 cursor-pointer opacity-0"
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
                                                  <RowActionMenuItem onClick={() => addTagsFromManageMenu(contact)} icon={<FiPlus className="w-4 h-4" />}>
                                                    Add Tags
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
                              )}
                            </div>
                          </div>
                        ) : !canLoadMessages ? (
                          <div className="h-full min-h-[320px] flex items-center justify-center text-sm text-[#7C829A]">
                            {activeModule} section placeholder.
                          </div>
                        ) : messagesLoading ? (
                          <MailboxLoader label={`Loading ${activeModuleLabel}...`} />
                        ) : filteredMessages.length === 0 ? (
                          <MailboxEmpty />
                        ) : (
                          <div className="divide-y divide-[#F0F0F0]">
                            {filteredMessages.map((message) => {
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
                              const trackingReportTooltip = openCount > 0
                                ? `Opened By Recipient: Yes\nOpens: ${openCount}\nLast Opened: ${trackingAge}\nTotal Tracked: ${totalOpenWindow}\nLink Clicks: ${clickCount}`
                                : `Opened By Recipient: No\nOpens: 0\nTotal Tracked: 0s\nLink Clicks: ${clickCount}`;
                              const isSelected = selectedRows.includes(key);
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() => {
                                    if (message.isComposeDraft) {
                                      openComposeDraftFromRow(message);
                                      return;
                                    }
                                    setSelectedMessageId(message.id);
                                    setViewMode("message");
                                    setDetailError("");
                                  }}
                                  className={`w-full text-left px-3 py-2.5 flex items-center gap-2 transition hover:bg-[#F4EDFF] ${
                                    isSelected ? "bg-[#EDE1FF]" : message.unread ? "font-semibold bg-[#FBFBFF]" : ""
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedRows.includes(key)}
                                    onClick={(event) => event.stopPropagation()}
                                    onChange={() => toggleRowSelection(message)}
                                    className="h-4 w-4 shrink-0"
                                  />
                                  {message.tracked ? (
                                    <span className="inline-flex items-center gap-1 shrink-0">
                                      <span className="w-2 h-2 rounded-full bg-[#22C55E]" title="Tracking Enabled" />
                                      <span
                                        className="w-2 h-2 rounded-full bg-[#A855F7]"
                                        title={trackingReportTooltip}
                                      />
                                    </span>
                                  ) : null}
                                  <span className="text-sm text-[#111827] w-52 shrink-0 truncate">
                                    {message.isComposeDraft ? (
                                      <>
                                        <span className="text-[#F87171] font-medium mr-1">(Draft)</span>
                                        {draftSenderLabel ? <span>{draftSenderLabel}</span> : null}
                                      </>
                                    ) : (
                                      senderOrTo
                                    )}
                                  </span>
                                  <span className="text-sm text-[#111827] min-w-0 truncate">
                                    <span className="font-medium">{message.subject || "(No Subject)"}</span>
                                    <span className="text-[#6B7280]"> - {message.snippet || "No preview available."}</span>
                                  </span>
                                  <span className="ml-auto text-xs text-[#6B7280] w-24 text-right shrink-0">
                                    {formatDate(message.timestamp, message.date)}
                                  </span>
                                </button>
                              );
                            })}
                            <div className="h-20" />
                          </div>
                        )}
                      </div>

                    </>
                  ) : (
                    <div className="h-full flex flex-col">
                      <div className="px-5 py-3 border-b border-[#E5E7EB] flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => setViewMode("list")}
                          className="inline-flex items-center gap-2 text-sm text-[#374151] hover:text-[#111827]"
                          title="Back"
                        >
                          <FiChevronsRight className="w-4 h-4 rotate-180" />
                          Back
                        </button>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              void openReplyCompose();
                            }}
                            className="inline-flex items-center justify-center rounded-lg border border-[#E5E7EB] p-2 text-sm hover:bg-[#F9FAFB]"
                            title="Reply"
                          >
                            <FiCornerUpLeft className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void openReplyAllCompose();
                            }}
                            className="inline-flex items-center justify-center rounded-lg border border-[#E5E7EB] p-2 text-sm hover:bg-[#F9FAFB]"
                            title="Reply All"
                          >
                            <FiUsers className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void openForwardCompose();
                            }}
                            className="inline-flex items-center justify-center rounded-lg border border-[#E5E7EB] p-2 text-sm hover:bg-[#F9FAFB]"
                            title="Forward"
                          >
                            <FiSend className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => applyAction("markUnread")}
                            className="inline-flex items-center justify-center rounded-lg border border-[#E5E7EB] p-2 text-sm hover:bg-[#F9FAFB]"
                            title="Mark As Unread"
                          >
                            <FiMail className="w-4 h-4" />
                          </button>
                          <div ref={moveMessageMenuRef} className="relative">
                            <button
                              type="button"
                              onClick={() => setMoveMenuOpen((prev) => (prev === "message" ? null : "message"))}
                              className="inline-flex items-center justify-center rounded-lg border border-[#E5E7EB] p-2 text-sm hover:bg-[#F9FAFB]"
                              title="Move To"
                            >
                              <FiMove className="w-4 h-4" />
                            </button>
                            {moveMenuOpen === "message" ? (
                              <div className="absolute right-0 top-[calc(100%+6px)] z-20 min-w-[140px] rounded-lg border border-[#E5E7EB] bg-white shadow-lg py-1">
                                {moveToOptions.map((option) => (
                                  <button
                                    key={`message-move-${option.value}`}
                                    type="button"
                                    onClick={() => handleMoveToChange(option.value)}
                                    className="w-full px-3 py-1.5 text-left text-sm text-[#374151] hover:bg-[#F3F4F6]"
                                  >
                                    {option.label}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => applyAction(activeModule === "archive" ? "moveToInbox" : "archive")}
                            className="inline-flex items-center justify-center rounded-lg border border-[#E5E7EB] p-2 text-sm hover:bg-[#F9FAFB]"
                            title={activeModule === "archive" ? "Unarchive" : "Archive"}
                          >
                            <FiArchive className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => applyAction(activeModule === "trash" ? "deletePermanently" : "trash")}
                            className="inline-flex items-center justify-center rounded-lg border border-[#E5E7EB] p-2 text-sm hover:bg-[#F9FAFB]"
                            title={activeModule === "trash" ? "Delete Permanently" : "Trash"}
                          >
                            <FiTrash2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => applyAction(spamActionType)}
                            className="inline-flex items-center justify-center rounded-lg border border-[#E5E7EB] p-2 text-sm hover:bg-[#F9FAFB]"
                            title={spamActionTitle}
                          >
                            <FiAlertCircle className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={blockSelectedSender}
                            className="inline-flex items-center justify-center rounded-lg border border-[#E5E7EB] p-2 text-sm hover:bg-[#F9FAFB]"
                            title={selectedBlockedEntry ? "Unblock Sender" : "Block Sender"}
                          >
                            <FiX className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {selectedMessage ? (
                        <div className="flex-1 overflow-y-auto px-6 py-5">
                          <h2 className="text-xl font-semibold text-[#111827]">{selectedMessage.subject || "(No Subject)"}</h2>
                          <div className="mt-4 flex items-start gap-3">
                            {selectedMessageDetail?.senderPhotoUrl ? (
                              <img
                                src={selectedMessageDetail.senderPhotoUrl}
                                alt="Sender"
                                className="w-10 h-10 rounded-full object-cover border border-[#E5E7EB]"
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
                            </div>
                          </div>
                          <div className="mt-5 border-t border-[#EFEFEF] pt-5">
                            {detailLoading ? (
                              <MailboxLoader label="Loading Message..." />
                            ) : detailError ? (
                              <p className="text-sm text-red-600">{detailError}</p>
                            ) : (
                              <div className="space-y-4">
                                {threadMessages.map((threadMessage, index) => (
                                  <div key={`${threadMessage.id || index}`} className="rounded-xl border border-[#E8EBF4] bg-white p-4">
                                    {threadMessage.bodyHtml ? (
                                      <div
                                        className="text-sm text-[#374151] leading-6"
                                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(threadMessage.bodyHtml) }}
                                      />
                                    ) : (
                                      <div className="text-sm text-[#374151] whitespace-pre-wrap leading-6">
                                        {threadMessage.bodyText || threadMessage.snippet || "No message content available."}
                                      </div>
                                    )}
                                  </div>
                                ))}

                                {inlineComposeMode ? (
                                  <div ref={inlineComposeRef} className="pt-2">
                                    <div className="mb-2">
                                      <p className="text-sm font-medium text-[#374151]">
                                        {inlineComposeMode === "forward"
                                          ? "Forward Message"
                                          : inlineComposeMode === "replyAll"
                                            ? "Reply All"
                                            : "Reply"}
                                      </p>
                                    </div>
                                    <div className="space-y-2">
                                      <div className="grid grid-cols-[88px_1fr] items-center gap-2 border-b border-[#E5E7EB] pb-1">
                                        <span className="text-xs text-[#6B7280]">
                                          {inlineComposeMode === "forward" ? "To" : "Replying To"}
                                        </span>
                                        <input
                                          value={inlineComposeTo}
                                          onChange={(event) => setInlineComposeTo(event.target.value)}
                                          className="w-full bg-transparent px-0 py-1.5 text-sm text-[#111827] outline-none"
                                          placeholder="recipient@example.com"
                                        />
                                      </div>
                                      <div className="grid grid-cols-[88px_1fr] items-center gap-2 border-b border-[#E5E7EB] pb-1">
                                        <span className="text-xs text-[#6B7280]">Subject</span>
                                        <input
                                          value={inlineComposeSubject}
                                          onChange={(event) => setInlineComposeSubject(event.target.value)}
                                          className="w-full bg-transparent px-0 py-1.5 text-sm text-[#111827] outline-none"
                                        />
                                      </div>
                                      <div>
                                        <textarea
                                          value={inlineComposeIntroText}
                                          onChange={(event) => setInlineComposeIntroText(event.target.value)}
                                          rows={4}
                                          className="w-full rounded-md border border-[#ECEEF6] bg-white px-3 py-2 text-sm text-[#111827] outline-none resize-y min-h-[110px] focus:border-[#DADDF0] focus:ring-2 focus:ring-[#701CC0]/10"
                                          placeholder="Write your message..."
                                        />
                                      </div>
                                      {inlineComposeMode === "forward" && inlineComposePreviewHtml ? (
                                        <div className="mt-2">
                                          <div
                                            className="text-sm text-[#374151] leading-6"
                                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(inlineComposePreviewHtml) }}
                                          />
                                        </div>
                                      ) : null}
                                      {inlineComposeError ? <p className="text-xs text-red-600">{inlineComposeError}</p> : null}
                                      {inlineComposeSuccess ? <p className="text-xs text-green-600">{inlineComposeSuccess}</p> : null}
                                      <div className="flex items-center justify-end gap-2 pt-1">
                                        <button
                                          type="button"
                                          onClick={() => setInlineComposeMode(null)}
                                          className="rounded px-2 py-1 text-sm text-[#4B5563] hover:bg-[#F3F4F6]"
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          type="button"
                                          onClick={sendInlineCompose}
                                          disabled={
                                            inlineComposeSending ||
                                            !inlineComposeTo.trim() ||
                                            !inlineComposeSubject.trim() ||
                                            (!inlineComposeIntroText.trim() && !inlineComposeBodyText.trim())
                                          }
                                          className="rounded bg-[#701CC0] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#5F17A5] disabled:opacity-50"
                                        >
                                          {inlineComposeSending ? "Sending..." : "Send"}
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
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5">
                <div className="rounded-xl border border-[#E5E7EB] bg-white p-3 shadow-sm h-fit">
                  <div className="space-y-1">
                    {MODULES.map((item) => (
                      (() => {
                        const count = moduleCount(item.key);
                        return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setActiveModule(item.key)}
                        className={`w-full rounded-lg px-3 py-2.5 text-sm text-left flex items-center gap-2 transition ${
                          activeModule === item.key ? "bg-[#701CC0] text-white" : "text-[#374151] hover:bg-[#F3F4F6]"
                        }`}
                      >
                        {item.icon}
                        <span className="truncate">
                          {item.label}
                          {count > 0 ? <span className="ml-1 text-[#6B7280]">({count})</span> : null}
                        </span>
                      </button>
                        );
                      })()
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm min-h-[420px]">
                  <h3 className="text-lg font-semibold text-[#111827]">Email Panel</h3>
                  <p className="mt-2 text-sm text-[#6B7280]">Use the full email page to access all mailbox tools.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {isAddContactModalOpen ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl border border-[#E5E7EB] p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#701CC0]/10 text-[#701CC0] inline-flex items-center justify-center">
                  <FiUserPlus className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-semibold text-[#111827]">Add Contact</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddContactModalOpen(false)}
                className="p-1.5 rounded-md text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#374151]"
                aria-label="Close Add Contact Modal"
              >
                <FiX className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                value={addContactForm.firstName}
                onChange={(event) => setAddContactForm((prev) => ({ ...prev, firstName: event.target.value }))}
                placeholder="First Name"
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#701CC0]"
              />
              <input
                value={addContactForm.lastName}
                onChange={(event) => setAddContactForm((prev) => ({ ...prev, lastName: event.target.value }))}
                placeholder="Last Name"
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#701CC0]"
              />
              <input
                value={addContactForm.email}
                onChange={(event) => setAddContactForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="Email *"
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#701CC0] md:col-span-2"
              />
              <input
                value={addContactForm.phone}
                onChange={(event) => setAddContactForm((prev) => ({ ...prev, phone: event.target.value }))}
                placeholder="Phone"
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#701CC0]"
              />
              <input
                value={addContactForm.business}
                onChange={(event) => setAddContactForm((prev) => ({ ...prev, business: event.target.value }))}
                placeholder="Business"
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#701CC0]"
              />
              <input
                value={addContactForm.website}
                onChange={(event) => setAddContactForm((prev) => ({ ...prev, website: event.target.value }))}
                placeholder="Website"
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#701CC0]"
              />
              <input
                value={addContactForm.address}
                onChange={(event) => setAddContactForm((prev) => ({ ...prev, address: event.target.value }))}
                placeholder="Address"
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#701CC0]"
              />
            </div>
            <div className="flex items-center justify-between mt-5">
              <button
                type="button"
                onClick={() => setIsAddContactModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={createContact}
                disabled={addingContact}
                className="px-4 py-2 rounded-lg bg-[#701CC0] text-white text-sm font-medium hover:bg-[#5f17a5] disabled:opacity-50"
              >
                {addingContact ? "Adding..." : "Add Contact"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isComposeOpen ? (
        <div
          className={`fixed z-[120] border border-[#E5E7EB] bg-white shadow-2xl overflow-hidden ${
            composeExpanded ? "inset-4 rounded-2xl" : "bottom-4 right-4 w-[520px] rounded-2xl"
          }`}
        >
          <div className="bg-[#701CC0] text-white px-4 py-2 flex items-center justify-between">
            <p className="text-sm font-medium">{composeThreadId ? "Reply" : "New Message"}</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setComposeExpanded((prev) => !prev)}
                className="px-2 py-1 text-xs rounded hover:bg-white/20"
              >
                {composeExpanded ? "Compact" : "Expand"}
              </button>
              <button
                type="button"
                onClick={() => setIsComposeOpen(false)}
                className="p-1 rounded hover:bg-white/20"
                aria-label="Close compose"
              >
                <FiX className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className={`p-3 ${composeExpanded ? "h-[calc(100vh-7rem)] overflow-y-auto" : ""}`}>
            <div className="space-y-1.5">
              <div className="grid grid-cols-[56px_1fr] items-center gap-2">
                <span className="text-xs text-[#7C829A]">From</span>
                <select
                  value={composeAccountEmail}
                  onChange={(event) => setComposeAccountEmail(event.target.value)}
                  className="w-full rounded-md border border-[#E7E9F2] px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#701CC0]"
                >
                  {composeFromOptions.map((email) => (
                    <option key={email} value={email}>
                      {email}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-[56px_1fr_auto] items-center gap-2">
                <span className="text-xs text-[#7C829A]">To</span>
                <input
                  value={composeTo}
                  onChange={(event) => setComposeTo(event.target.value)}
                  placeholder="Recipients"
                  className="w-full rounded-md border border-[#E7E9F2] px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#701CC0]"
                />
                <div className="flex items-center gap-2 pr-1">
                  {!showCc ? (
                    <button type="button" onClick={() => setShowCc(true)} className="text-xs text-[#6D7390] hover:text-[#4D536E]">
                      Cc
                    </button>
                  ) : null}
                  {!showBcc ? (
                    <button type="button" onClick={() => setShowBcc(true)} className="text-xs text-[#6D7390] hover:text-[#4D536E]">
                      Bcc
                    </button>
                  ) : null}
                </div>
              </div>

              {showCc ? (
                <div className="grid grid-cols-[56px_1fr] items-center gap-2">
                  <span className="text-xs text-[#7C829A]">Cc</span>
                  <input
                    value={composeCc}
                    onChange={(event) => setComposeCc(event.target.value)}
                    placeholder="Cc recipients"
                    className="w-full rounded-md border border-[#E7E9F2] px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#701CC0]"
                  />
                </div>
              ) : null}

              {showBcc ? (
                <div className="grid grid-cols-[56px_1fr] items-center gap-2">
                  <span className="text-xs text-[#7C829A]">Bcc</span>
                  <input
                    value={composeBcc}
                    onChange={(event) => setComposeBcc(event.target.value)}
                    placeholder="Bcc recipients"
                    className="w-full rounded-md border border-[#E7E9F2] px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#701CC0]"
                  />
                </div>
              ) : null}

              <div className="grid grid-cols-[56px_1fr] items-center gap-2">
                <span className="text-xs text-[#7C829A]">Subject</span>
                <input
                  value={composeSubject}
                  onChange={(event) => setComposeSubject(event.target.value)}
                  placeholder="Subject"
                  className="w-full rounded-md border border-[#E7E9F2] px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#701CC0]"
                />
              </div>

              <textarea
                value={composeBody}
                onChange={(event) => setComposeBody(event.target.value)}
                rows={8}
                placeholder="Write your message..."
                className="w-full rounded-md border border-[#E7E9F2] px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-[#701CC0] resize-none"
              />
            </div>
            {composeError ? <div className="mt-2 text-sm text-red-600">{composeError}</div> : null}
            {composeSuccess ? <div className="mt-2 text-sm text-green-600">{composeSuccess}</div> : null}
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={handleSendCompose}
                disabled={sendingCompose || !composeTo.trim() || !composeSubject.trim() || !composeBody.trim() || !composeAccountEmail}
                className="inline-flex items-center gap-2 rounded-lg bg-[#701CC0] text-white px-4 py-2 text-sm font-medium hover:bg-[#5f17a5] disabled:opacity-50"
              >
                <FiSend className="w-4 h-4" />
                {sendingCompose ? "Sending..." : "Send"}
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
    </div>
  );
};

export default EmailingPlatformSection;
