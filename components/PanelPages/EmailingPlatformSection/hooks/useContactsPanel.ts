import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { EMAIL_REGEX } from "@/lib/utils";
import { toContactsCsv, type CsvContactRowWithMeta } from "@/lib/contacts/csv";
import { getJson } from "@/lib/email/panelApi";
import { panelFetch } from "@/lib/panelFetch";
import { CONTACTS_PAGE_SIZE } from "@/components/email/constants";
import type { ModuleKey, ContactTag, ContactRow, ContactVisibility } from "@/components/email/types";

export type ContactsImportIssueRow = CsvContactRowWithMeta & {
  reasons: string[];
  saving?: boolean;
};

export const ISSUE_EDITABLE_FIELDS = ["firstName", "lastName", "email", "phone", "business", "website", "address", "tags"] as const;
export const ISSUE_FIELD_LABELS: Record<(typeof ISSUE_EDITABLE_FIELDS)[number], string> = {
  firstName: "First Name",
  lastName: "Last Name",
  email: "Email",
  phone: "Phone",
  business: "Business",
  website: "Website",
  address: "Address",
  tags: "Tags",
};

const emptyAddContactForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  business: "",
  website: "",
  address: "",
};

function formatPhoneInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (!digits) return "";
  if (digits.length < 4) return `(${digits}`;
  if (digits.length < 7) return `(${digits.slice(0, 3)})-${digits.slice(3)}`;
  return `(${digits.slice(0, 3)})-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

function isPhoneValid(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return true;
  const digits = trimmed.replace(/\D/g, "");
  return digits.length === 10;
}

function isWebsiteValid(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?(?:\/[^\s]*)?$/i.test(trimmed);
}

function mapImportRowErrors(raw: unknown): ContactsImportIssueRow[] {
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
}

type UseContactsPanelParams = {
  step: "gate" | "client";
  activeModule: ModuleKey;
  selectedAccounts: string[];
};

/**
 * Owns the Contacts module: its list (search/filter/pagination), CSV import/export, Gmail-contacts
 * sync, and the add/edit/delete/import-issues modals. Mirrors useComposeWindow's shape — one hook
 * returning one bundled object, consumed by a single ContactsPanel component.
 */
export function useContactsPanel(params: UseContactsPanelParams) {
  const { step, activeModule, selectedAccounts } = params;

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
  const [addContactForm, setAddContactForm] = useState(emptyAddContactForm);
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
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [confirmBulkDeleteContacts, setConfirmBulkDeleteContacts] = useState(false);
  const [bulkContactActionLoading, setBulkContactActionLoading] = useState(false);
  const [bulkContactActionError, setBulkContactActionError] = useState("");
  const [contactsVisibility, setContactsVisibility] = useState<ContactVisibility>({
    showPhone: true,
    showBusiness: true,
    showWebsite: true,
  });

  const loadContactsRequestRef = useRef(0);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const contactFilterMenuRef = useRef<HTMLDivElement | null>(null);
  const editContactModalRef = useRef<HTMLDivElement | null>(null);

  const activeAccountForContacts = selectedAccounts[0] || "";

  const closeAddContactModal = useCallback(() => {
    setAddContactError("");
    setAddContactFirstNameTouched(false);
    setAddContactForm(emptyAddContactForm);
    setIsAddContactModalOpen(false);
  }, []);

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
    setSelectedContactIds([]);
    try {
      const query = new URLSearchParams({
        limit: String(CONTACTS_PAGE_SIZE),
        page: String(contactCurrentPage),
      });
      if (debouncedContactSearch) query.set("search", debouncedContactSearch);
      if (contactTagFilter) query.set("tagIds", contactTagFilter);
      if (contactSourceFilter) query.set("source", contactSourceFilter);
      // Explicitly empty, not omitted: this list should show every client's contacts merged
      // together regardless of whichever client the panel's picker has active, and an empty
      // string here stops panelFetch from filling it back in with that active client's id (it
      // only injects companyId when the param is entirely absent). A representative's own
      // companyId still applies server-side no matter what this sends — only Vierra staff get
      // the merged view. Writes (add/edit/delete/import/export) still go through panelFetch
      // untouched, since those need one real target company.
      query.set("companyId", "");
      // no-store: this reloads right after create/edit/delete/tag writes, and the
      // server's Cache-Control on this endpoint would otherwise serve the pre-write list.
      const response = await panelFetch(`/api/contacts?${query.toString()}`, { cache: "no-store" });
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
      const response = await panelFetch("/api/contacts", {
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

  const toggleContactSelected = (contactId: string) => {
    setSelectedContactIds((prev) =>
      prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [...prev, contactId]
    );
  };

  const toggleAllContactsSelected = () => {
    const visibleIds = contacts.map((c) => c.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedContactIds.includes(id));
    setSelectedContactIds(allSelected ? [] : visibleIds);
  };

  const confirmBulkDeleteContactsAction = async () => {
    if (selectedContactIds.length === 0 || bulkContactActionLoading) return;
    setBulkContactActionLoading(true);
    setBulkContactActionError("");
    try {
      const response = await fetch("/api/contacts/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedContactIds }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message || "Failed to delete contacts.");
      }
      setSelectedContactIds([]);
      setConfirmBulkDeleteContacts(false);
      await loadContacts();
    } catch (error) {
      setBulkContactActionError(error instanceof Error ? error.message : "Failed to delete contacts.");
    } finally {
      setBulkContactActionLoading(false);
    }
  };

  const bulkAddTagToSelected = async (tagId: string) => {
    if (!tagId || selectedContactIds.length === 0) return;
    setBulkContactActionLoading(true);
    setBulkContactActionError("");
    try {
      const response = await fetch("/api/contacts/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedContactIds, tagId }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message || "Failed to tag contacts.");
      }
      await loadContacts();
    } catch (error) {
      setBulkContactActionError(error instanceof Error ? error.message : "Failed to tag contacts.");
    } finally {
      setBulkContactActionLoading(false);
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
    const response = await panelFetch(`/api/contacts/export?${query.toString()}`);
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

  const handleImportCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const csvText = await file.text();
    setContactsError("");
    setContactsImportSuccessOpen(false);
    try {
      const response = await panelFetch("/api/contacts/import", {
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
      const response = await panelFetch("/api/contacts/import", {
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

  return {
    // list state
    contacts,
    contactsLoading,
    contactsError,
    contactCurrentPage,
    setContactCurrentPage,
    contactsTotalPages,
    contactsTotalCount,
    contactsTags,
    contactSearch,
    setContactSearch,
    contactTagFilter,
    setContactTagFilter,
    contactSourceFilter,
    setContactSourceFilter,
    contactFilterOpen,
    setContactFilterOpen,
    contactFilterMenuRef,
    contactsVisibility,
    importInputRef,
    handleImportCsv,
    exportContactsCsv,
    syncFromGmailContacts,
    selectedContactIds,
    setSelectedContactIds,
    toggleContactSelected,
    toggleAllContactsSelected,
    bulkContactActionError,
    bulkContactActionLoading,
    bulkAddTagToSelected,
    confirmBulkDeleteContacts,
    setConfirmBulkDeleteContacts,
    confirmBulkDeleteContactsAction,
    addTagToContact,
    removeTagFromContact,
    editContact,
    deleteContact,

    // add contact modal
    isAddContactModalOpen,
    setIsAddContactModalOpen,
    addContactForm,
    setAddContactForm,
    addingContact,
    addContactError,
    setAddContactError,
    addContactFirstNameTouched,
    setAddContactFirstNameTouched,
    emptyAddContactForm,
    closeAddContactModal,
    createContact,
    formatPhoneInput,
    isPhoneValid,
    isWebsiteValid,

    // edit contact modal
    isEditContactModalOpen,
    editContactModalRef,
    editContactForm,
    setEditContactForm,
    editingContact,
    editContactError,
    editContactTouched,
    setEditContactTouched,
    closeEditContactModal,
    saveEditedContact,

    // delete contact
    contactToDelete,
    setContactToDelete,
    deletingContact,
    confirmDeleteContact,

    // CSV import issues / success
    contactsImportSuccessOpen,
    setContactsImportSuccessOpen,
    contactsImportIssuesModal,
    setContactsImportIssuesModal,
    updateIssueRowField,
    retryImportIssueRow,
    retryAllIssueRows,
  };
}

export type ContactsPanelBundle = ReturnType<typeof useContactsPanel>;
