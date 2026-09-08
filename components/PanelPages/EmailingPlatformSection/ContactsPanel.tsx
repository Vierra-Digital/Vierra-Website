import React from "react";
import { FaGoogle } from "react-icons/fa";
import {
  FiAlertCircle,
  FiDownload,
  FiEdit3,
  FiFilter,
  FiPlus,
  FiSearch,
  FiTrash2,
  FiUpload,
  FiUserPlus,
  FiUsers,
  FiX,
} from "react-icons/fi";
import RowActionMenu, { RowActionMenuItem } from "@/components/ui/RowActionMenu";
import SuccessStatusModal from "@/components/ui/SuccessStatusModal";
import ConfirmActionModal from "@/components/ui/ConfirmActionModal";
import { EMAIL_REGEX } from "@/lib/utils";
import { ALERT, FIELD_LABEL } from "@/components/email/emailTheme";
import { CONTACTS_PAGE_SIZE } from "@/components/email/constants";
import { MailboxLoader } from "./mailboxUi";
import { ISSUE_EDITABLE_FIELDS, ISSUE_FIELD_LABELS, type ContactsPanelBundle } from "./hooks/useContactsPanel";

type ContactsPanelProps = {
  contacts: ContactsPanelBundle;
};

/** The Contacts module's list view: search/filter, bulk actions, CSV import/export, Gmail sync. */
export default function ContactsPanel({ contacts: bundle }: ContactsPanelProps) {
  const {
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
    setConfirmBulkDeleteContacts,
    addTagToContact,
    removeTagFromContact,
    editContact,
    deleteContact,
    setAddContactForm,
    setAddContactFirstNameTouched,
    setAddContactError,
    setIsAddContactModalOpen,
    emptyAddContactForm,
  } = bundle;

  return (
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
            {selectedContactIds.length > 0 ? (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#E8DDFB] bg-[#F8F3FF] px-4 py-2.5">
                <span className="text-xs font-medium text-[#4B2E83]">
                  {selectedContactIds.length} selected
                </span>
                {bulkContactActionError ? (
                  <span className="text-xs text-red-600">{bulkContactActionError}</span>
                ) : null}
                <div className="ml-auto flex items-center gap-2">
                  <div className="relative">
                    <select
                      value=""
                      disabled={bulkContactActionLoading}
                      onChange={(e) => bulkAddTagToSelected(e.target.value)}
                      className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs text-[#374151] disabled:opacity-50"
                      aria-label="Add tag to selected contacts"
                    >
                      <option value="">Add tag to selected…</option>
                      {contactsTags.map((tag) => (
                        <option key={tag.id} value={tag.id}>
                          {tag.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    disabled={bulkContactActionLoading}
                    onClick={() => setConfirmBulkDeleteContacts(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    <FiTrash2 className="w-3.5 h-3.5" />
                    Delete selected
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedContactIds([])}
                    className="text-xs text-[#6B7280] hover:text-[#374151]"
                  >
                    Clear
                  </button>
                </div>
              </div>
            ) : null}
            <div className="rounded-xl border border-[#E8EBF4] bg-white overflow-hidden">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-[#F9FAFD] z-10">
                  <tr className="border-b border-[#E8EBF4] text-left text-xs text-[#6B7280] uppercase tracking-wide">
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label="Select all contacts on this page"
                        checked={contacts.length > 0 && contacts.every((c) => selectedContactIds.includes(c.id))}
                        onChange={toggleAllContactsSelected}
                      />
                    </th>
                    <th className="px-4 py-3 font-medium">Name</th>
                    {contacts.some((c) => c.company) ? <th className="px-4 py-3 font-medium">Client</th> : null}
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
                          <input
                            type="checkbox"
                            aria-label={`Select ${displayName}`}
                            checked={selectedContactIds.includes(contact.id)}
                            onChange={() => toggleContactSelected(contact.id)}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-[#1E1B2E]">{displayName}</div>
                          <div className="mt-0.5 text-[11px] text-[#8A90A6] uppercase tracking-wide">{contact.source}</div>
                        </td>
                        {contacts.some((c) => c.company) ? (
                          <td className="px-4 py-3">
                            {contact.company ? (
                              <span
                                className="inline-flex items-center rounded-full bg-[#F3E8FF] px-2 py-0.5 text-[11px] font-medium text-[#701CC0]"
                                title={`This contact belongs to ${contact.company.name}`}
                              >
                                {contact.company.name}
                              </span>
                            ) : (
                              <span className="text-[#374151]">-</span>
                            )}
                          </td>
                        ) : null}
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
                              <RowActionMenuItem onClick={() => editContact(contact)} icon={<FiEdit3 className="w-4 h-4" />}>
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
  );
}

/** The Contacts module's overlays: add/edit/delete modals, CSV import success/issues. */
export function ContactsModals({ contacts: bundle }: ContactsPanelProps) {
  const {
    isAddContactModalOpen,
    closeAddContactModal,
    addContactError,
    addContactForm,
    setAddContactForm,
    addContactFirstNameTouched,
    setAddContactFirstNameTouched,
    formatPhoneInput,
    isPhoneValid,
    isWebsiteValid,
    createContact,
    addingContact,
    isEditContactModalOpen,
    editContactModalRef,
    editContactError,
    editContactForm,
    setEditContactForm,
    editContactTouched,
    setEditContactTouched,
    closeEditContactModal,
    saveEditedContact,
    editingContact,
    contactsImportSuccessOpen,
    setContactsImportSuccessOpen,
    contactsImportIssuesModal,
    setContactsImportIssuesModal,
    retryAllIssueRows,
    retryImportIssueRow,
    updateIssueRowField,
    contactToDelete,
    setContactToDelete,
    deletingContact,
    confirmDeleteContact,
    confirmBulkDeleteContacts,
    setConfirmBulkDeleteContacts,
    selectedContactIds,
    bulkContactActionLoading,
    confirmBulkDeleteContactsAction,
  } = bundle;

  return (
    <>
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
        isOpen={confirmBulkDeleteContacts}
        title="Delete Contacts"
        message={
          <>
            Are you sure you want to delete{" "}
            <span className="font-semibold text-[#1E1B2E]">{selectedContactIds.length} contacts</span>? This action
            cannot be undone.
          </>
        }
        confirmLabel={bulkContactActionLoading ? "Deleting..." : "Delete Contacts"}
        onCancel={() => {
          if (bulkContactActionLoading) return;
          setConfirmBulkDeleteContacts(false);
        }}
        onConfirm={confirmBulkDeleteContactsAction}
      />
    </>
  );
}
