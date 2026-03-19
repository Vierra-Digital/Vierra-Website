import React, { useCallback, useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";

type GmailAccount = {
  email: string;
  connected: boolean;
};

type SignatureRow = {
  id: string;
  name: string;
  signatureText: string | null;
  isDefault: boolean;
};

type TemplateRow = {
  id: string;
  name: string;
  subject: string | null;
  bodyText: string | null;
  isDefault: boolean;
};

type ContactTag = {
  id: string;
  name: string;
  color: string;
};

type ContactVisibility = {
  showPhone: boolean;
  showBusiness: boolean;
  showWebsite: boolean;
};

type EmailProviderAccount = {
  id: string;
  accountEmail: string;
  providerLabel: string | null;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUsername: string;
  imapHost: string | null;
  imapPort: number | null;
  imapSecure: boolean | null;
  popHost: string | null;
  popPort: number | null;
  popSecure: boolean | null;
  isDefaultSender: boolean;
  hasPassword: boolean;
};

type BlockedSender = {
  id: string;
  accountEmail: string | null;
  email: string;
  name: string | null;
  createdAt: string;
};

type Settings = {
  trackingEnabled: boolean;
  openTrackingEnabled: boolean;
  clickTrackingEnabled: boolean;
  vacationResponderEnabled: boolean;
  vacationSubject: string;
  vacationBodyText: string;
  vacationStartAt: string;
  vacationEndAt: string;
};

const defaultSettings: Settings = {
  trackingEnabled: false,
  openTrackingEnabled: true,
  clickTrackingEnabled: true,
  vacationResponderEnabled: false,
  vacationSubject: "",
  vacationBodyText: "",
  vacationStartAt: "",
  vacationEndAt: "",
};

const EmailSettingsPage: React.FC = () => {
  const [accounts, setAccounts] = useState<GmailAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [signatures, setSignatures] = useState<SignatureRow[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [contactTags, setContactTags] = useState<ContactTag[]>([]);
  const [contactVisibility, setContactVisibility] = useState<ContactVisibility>({
    showPhone: true,
    showBusiness: true,
    showWebsite: true,
  });
  const [providerAccounts, setProviderAccounts] = useState<EmailProviderAccount[]>([]);
  const [blockedSenders, setBlockedSenders] = useState<BlockedSender[]>([]);
  const [testingProviderId, setTestingProviderId] = useState("");
  const [newProvider, setNewProvider] = useState({
    accountEmail: "",
    providerLabel: "",
    smtpHost: "",
    smtpPort: "465",
    smtpSecure: true,
    smtpUsername: "",
    smtpPassword: "",
    imapHost: "",
    imapPort: "993",
    imapSecure: true,
    popHost: "",
    popPort: "995",
    popSecure: true,
  });

  const connectedAccounts = useMemo(() => accounts.filter((account) => account.connected), [accounts]);
  const backToEmailHref = useMemo(() => {
    const connected = connectedAccounts.map((account) => account.email).filter(Boolean);
    if (connected.length > 0) {
      return `/panel/email?accounts=${encodeURIComponent(connected.join(","))}`;
    }
    const selected = selectedAccount.trim().toLowerCase();
    if (selected) {
      return `/panel/email?accounts=${encodeURIComponent(selected)}`;
    }
    return "/panel/email";
  }, [connectedAccounts, selectedAccount]);

  const loadAccounts = useCallback(async () => {
    const response = await fetch("/api/gmail/status");
    const payload = await response.json().catch(() => ({}));
    const rows = Array.isArray(payload?.accounts) ? payload.accounts : [];
    const normalized = rows
      .map((row: any) => ({
        email: typeof row?.email === "string" ? row.email.toLowerCase() : "",
        connected: Boolean(row?.connected),
      }))
      .filter((row: GmailAccount) => row.email);
    setAccounts(normalized);
    if (normalized.length > 0 && !selectedAccount) {
      setSelectedAccount(normalized[0].email);
    }
  }, [selectedAccount]);

  const loadAccountData = async (accountEmail: string) => {
    if (!accountEmail) return;
    setLoading(true);
    try {
      const [settingsRes, signaturesRes, templatesRes, tagsRes, visibilityRes, providersRes, blockedRes] = await Promise.all([
        fetch(`/api/gmail/settings?accountEmail=${encodeURIComponent(accountEmail)}`),
        fetch(`/api/gmail/signatures?accountEmail=${encodeURIComponent(accountEmail)}`),
        fetch(`/api/gmail/templates?accountEmail=${encodeURIComponent(accountEmail)}`),
        fetch("/api/contacts/tags"),
        fetch(`/api/contacts/visibility?accountEmail=${encodeURIComponent(accountEmail)}`),
        fetch("/api/email/accounts"),
        fetch("/api/gmail/blocked-senders"),
      ]);
      const settingsPayload = await settingsRes.json().catch(() => ({}));
      const signaturesPayload = await signaturesRes.json().catch(() => ({}));
      const templatesPayload = await templatesRes.json().catch(() => ({}));
      const tagsPayload = await tagsRes.json().catch(() => ({}));
      const visibilityPayload = await visibilityRes.json().catch(() => ({}));
      const providersPayload = await providersRes.json().catch(() => ({}));
      const blockedPayload = await blockedRes.json().catch(() => ({}));

      const rawSettings = settingsPayload?.settings || {};
      setSettings({
        trackingEnabled: Boolean(rawSettings.trackingEnabled),
        openTrackingEnabled: Boolean(rawSettings.openTrackingEnabled ?? true),
        clickTrackingEnabled: Boolean(rawSettings.clickTrackingEnabled ?? true),
        vacationResponderEnabled: Boolean(rawSettings.vacationResponderEnabled),
        vacationSubject: String(rawSettings.vacationSubject || ""),
        vacationBodyText: String(rawSettings.vacationBodyText || ""),
        vacationStartAt: rawSettings.vacationStartAt ? String(rawSettings.vacationStartAt).slice(0, 16) : "",
        vacationEndAt: rawSettings.vacationEndAt ? String(rawSettings.vacationEndAt).slice(0, 16) : "",
      });
      setSignatures(Array.isArray(signaturesPayload?.signatures) ? signaturesPayload.signatures : []);
      setTemplates(Array.isArray(templatesPayload?.templates) ? templatesPayload.templates : []);
      setContactTags(Array.isArray(tagsPayload?.tags) ? tagsPayload.tags : []);
      const visibility = visibilityPayload?.visibility || {};
      setContactVisibility({
        showPhone: Boolean(visibility.showPhone ?? true),
        showBusiness: Boolean(visibility.showBusiness ?? true),
        showWebsite: Boolean(visibility.showWebsite ?? true),
      });
      setProviderAccounts(Array.isArray(providersPayload?.accounts) ? providersPayload.accounts : []);
      setBlockedSenders(Array.isArray(blockedPayload?.blocked) ? blockedPayload.blocked : []);
    } finally {
      setLoading(false);
    }
  };

  const removeBlockedSender = async (id: string) => {
    await fetch("/api/gmail/blocked-senders", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await loadAccountData(selectedAccount);
  };

  const createProviderAccount = async () => {
    try {
      const response = await fetch("/api/email/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountEmail: newProvider.accountEmail || selectedAccount,
          providerLabel: newProvider.providerLabel,
          smtpHost: newProvider.smtpHost,
          smtpPort: Number(newProvider.smtpPort || 465),
          smtpSecure: newProvider.smtpSecure,
          smtpUsername: newProvider.smtpUsername,
          smtpPassword: newProvider.smtpPassword,
          imapHost: newProvider.imapHost || null,
          imapPort: newProvider.imapHost ? Number(newProvider.imapPort || 993) : null,
          imapSecure: newProvider.imapHost ? newProvider.imapSecure : null,
          popHost: newProvider.popHost || null,
          popPort: newProvider.popHost ? Number(newProvider.popPort || 995) : null,
          popSecure: newProvider.popHost ? newProvider.popSecure : null,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || "Failed to create provider account");
      setStatus("Provider account saved.");
      setNewProvider({
        accountEmail: "",
        providerLabel: "",
        smtpHost: "",
        smtpPort: "465",
        smtpSecure: true,
        smtpUsername: "",
        smtpPassword: "",
        imapHost: "",
        imapPort: "993",
        imapSecure: true,
        popHost: "",
        popPort: "995",
        popSecure: true,
      });
      await loadAccountData(selectedAccount);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to create provider account");
    }
  };

  const deleteProviderAccount = async (id: string) => {
    await fetch("/api/email/accounts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await loadAccountData(selectedAccount);
  };

  const testProviderAccount = async (id: string) => {
    setTestingProviderId(id);
    try {
      const response = await fetch("/api/email/accounts/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || "SMTP test failed");
      setStatus("SMTP test successful.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "SMTP test failed");
    } finally {
      setTestingProviderId("");
    }
  };

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    if (selectedAccount) {
      loadAccountData(selectedAccount);
    }
  }, [selectedAccount]);

  const saveSettings = async () => {
    if (!selectedAccount || saving) return;
    setSaving(true);
    setStatus("");
    try {
      const [settingsRes, visibilityRes] = await Promise.all([
        fetch(`/api/gmail/settings?accountEmail=${encodeURIComponent(selectedAccount)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trackingEnabled: settings.trackingEnabled,
            openTrackingEnabled: settings.openTrackingEnabled,
            clickTrackingEnabled: settings.clickTrackingEnabled,
            vacationResponderEnabled: settings.vacationResponderEnabled,
            vacationSubject: settings.vacationSubject,
            vacationBodyText: settings.vacationBodyText,
            vacationStartAt: settings.vacationStartAt || null,
            vacationEndAt: settings.vacationEndAt || null,
          }),
        }),
        fetch(`/api/contacts/visibility?accountEmail=${encodeURIComponent(selectedAccount)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(contactVisibility),
        }),
      ]);
      if (!settingsRes.ok || !visibilityRes.ok) throw new Error("Failed to save settings");
      setStatus("Settings saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const createSignature = async () => {
    const name = window.prompt("Signature name");
    if (!name || !selectedAccount) return;
    await fetch("/api/gmail/signatures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountEmail: selectedAccount, name, signatureText: "" }),
    });
    await loadAccountData(selectedAccount);
  };

  const deleteSignature = async (id: string) => {
    await fetch("/api/gmail/signatures", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await loadAccountData(selectedAccount);
  };

  const createTemplate = async () => {
    const name = window.prompt("Template name");
    if (!name || !selectedAccount) return;
    await fetch("/api/gmail/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountEmail: selectedAccount, name, subject: "", bodyText: "" }),
    });
    await loadAccountData(selectedAccount);
  };

  const deleteTemplate = async (id: string) => {
    await fetch("/api/gmail/templates", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await loadAccountData(selectedAccount);
  };

  const createTag = async () => {
    const name = window.prompt("Tag name");
    if (!name) return;
    const color = window.prompt("Tag color hex", "#701CC0") || "#701CC0";
    await fetch("/api/contacts/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color }),
    });
    await loadAccountData(selectedAccount);
  };

  const editTag = async (tag: ContactTag) => {
    const name = window.prompt("Tag name", tag.name) || tag.name;
    const color = window.prompt("Tag color hex", tag.color || "#701CC0") || tag.color || "#701CC0";
    await fetch("/api/contacts/tags", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: tag.id, name, color }),
    });
    await loadAccountData(selectedAccount);
  };

  const deleteTag = async (tag: ContactTag) => {
    const ok = window.confirm(`Delete tag "${tag.name}"?`);
    if (!ok) return;
    await fetch("/api/contacts/tags", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: tag.id }),
    });
    await loadAccountData(selectedAccount);
  };

  return (
    <>
      <Head>
        <title>Vierra | Email Settings</title>
      </Head>
      <div className="min-h-screen bg-[#F7F8FC]">
        <header className="h-16 border-b border-[#E5E7EB] bg-white px-5 flex items-center justify-between">
          <Link href="/panel/email" className="inline-flex items-center gap-2">
            <Image src="/assets/vierra-logo-black-3.png" alt="Vierra" width={110} height={32} className="w-[110px] h-auto" priority />
          </Link>
          <Link
            href={backToEmailHref}
            className="inline-flex items-center rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-sm font-medium text-[#4B5563] hover:bg-[#F9FAFB] hover:text-[#701CC0]"
          >
            Back
          </Link>
        </header>

        <main className="max-w-5xl mx-auto px-6 py-6">
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h1 className="text-xl font-semibold text-[#111827]">Email Settings</h1>
              <select
                value={selectedAccount}
                onChange={(event) => setSelectedAccount(event.target.value)}
                className="rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm"
              >
                {connectedAccounts.map((account) => (
                  <option key={account.email} value={account.email}>
                    {account.email}
                  </option>
                ))}
              </select>
            </div>

            {loading ? (
              <div className="mt-4 text-sm text-[#6B7280]">Loading settings...</div>
            ) : (
              <div className="mt-5 space-y-6">
                <section className="rounded-xl border border-[#E5E7EB] p-4">
                  <h2 className="font-semibold text-[#111827] mb-3">Email Tracking</h2>
                  <label className="flex items-center gap-2 text-sm text-[#374151]">
                    <input
                      type="checkbox"
                      checked={settings.trackingEnabled}
                      onChange={(event) => setSettings((prev) => ({ ...prev, trackingEnabled: event.target.checked }))}
                    />
                    Enable email tracking
                  </label>
                  <label className="mt-2 flex items-center gap-2 text-sm text-[#374151]">
                    <input
                      type="checkbox"
                      checked={settings.openTrackingEnabled}
                      onChange={(event) => setSettings((prev) => ({ ...prev, openTrackingEnabled: event.target.checked }))}
                    />
                    Track opens
                  </label>
                  <label className="mt-2 flex items-center gap-2 text-sm text-[#374151]">
                    <input
                      type="checkbox"
                      checked={settings.clickTrackingEnabled}
                      onChange={(event) => setSettings((prev) => ({ ...prev, clickTrackingEnabled: event.target.checked }))}
                    />
                    Track link clicks
                  </label>
                </section>

                <section className="rounded-xl border border-[#E5E7EB] p-4">
                  <h2 className="font-semibold text-[#111827] mb-3">Vacation Responder</h2>
                  <label className="flex items-center gap-2 text-sm text-[#374151]">
                    <input
                      type="checkbox"
                      checked={settings.vacationResponderEnabled}
                      onChange={(event) => setSettings((prev) => ({ ...prev, vacationResponderEnabled: event.target.checked }))}
                    />
                    Enable vacation responder
                  </label>
                  <input
                    value={settings.vacationSubject}
                    onChange={(event) => setSettings((prev) => ({ ...prev, vacationSubject: event.target.value }))}
                    placeholder="Vacation subject"
                    className="mt-3 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm"
                  />
                  <textarea
                    value={settings.vacationBodyText}
                    onChange={(event) => setSettings((prev) => ({ ...prev, vacationBodyText: event.target.value }))}
                    rows={4}
                    placeholder="Vacation responder body"
                    className="mt-3 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm"
                  />
                </section>

                <section className="rounded-xl border border-[#E5E7EB] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-semibold text-[#111827]">Signatures</h2>
                    <button onClick={createSignature} className="rounded-lg bg-[#701CC0] text-white px-3 py-1.5 text-sm">
                      Add Signature
                    </button>
                  </div>
                  <div className="space-y-2">
                    {signatures.map((row) => (
                      <div key={row.id} className="flex items-center justify-between rounded-lg border border-[#E5E7EB] px-3 py-2">
                        <div>
                          <p className="text-sm font-medium text-[#111827]">{row.name}</p>
                          {row.isDefault ? <p className="text-xs text-[#701CC0]">Default</p> : null}
                        </div>
                        <button onClick={() => deleteSignature(row.id)} className="text-sm text-red-600">
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-xl border border-[#E5E7EB] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-semibold text-[#111827]">Templates</h2>
                    <button onClick={createTemplate} className="rounded-lg bg-[#701CC0] text-white px-3 py-1.5 text-sm">
                      Add Template
                    </button>
                  </div>
                  <div className="space-y-2">
                    {templates.map((row) => (
                      <div key={row.id} className="flex items-center justify-between rounded-lg border border-[#E5E7EB] px-3 py-2">
                        <div>
                          <p className="text-sm font-medium text-[#111827]">{row.name}</p>
                          {row.isDefault ? <p className="text-xs text-[#701CC0]">Default</p> : null}
                        </div>
                        <button onClick={() => deleteTemplate(row.id)} className="text-sm text-red-600">
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-xl border border-[#E5E7EB] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-semibold text-[#111827]">Contact Tags</h2>
                    <button onClick={createTag} className="rounded-lg bg-[#701CC0] text-white px-3 py-1.5 text-sm">
                      Add Tag
                    </button>
                  </div>
                  <div className="space-y-2">
                    {contactTags.length === 0 ? (
                      <p className="text-sm text-[#6B7280]">No tags yet.</p>
                    ) : (
                      contactTags.map((tag) => (
                        <div key={tag.id} className="flex items-center justify-between rounded-lg border border-[#E5E7EB] px-3 py-2">
                          <div className="inline-flex items-center gap-2">
                            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tag.color || "#701CC0" }} />
                            <p className="text-sm font-medium text-[#111827]">{tag.name}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <button onClick={() => editTag(tag)} className="text-sm text-[#374151]">
                              Edit
                            </button>
                            <button onClick={() => deleteTag(tag)} className="text-sm text-red-600">
                              Remove
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section className="rounded-xl border border-[#E5E7EB] p-4">
                  <h2 className="font-semibold text-[#111827] mb-3">Contact Field Visibility</h2>
                  <label className="flex items-center gap-2 text-sm text-[#374151]">
                    <input
                      type="checkbox"
                      checked={contactVisibility.showPhone}
                      onChange={(event) =>
                        setContactVisibility((prev) => ({
                          ...prev,
                          showPhone: event.target.checked,
                        }))
                      }
                    />
                    Show phone field
                  </label>
                  <label className="mt-2 flex items-center gap-2 text-sm text-[#374151]">
                    <input
                      type="checkbox"
                      checked={contactVisibility.showBusiness}
                      onChange={(event) =>
                        setContactVisibility((prev) => ({
                          ...prev,
                          showBusiness: event.target.checked,
                        }))
                      }
                    />
                    Show business field
                  </label>
                  <label className="mt-2 flex items-center gap-2 text-sm text-[#374151]">
                    <input
                      type="checkbox"
                      checked={contactVisibility.showWebsite}
                      onChange={(event) =>
                        setContactVisibility((prev) => ({
                          ...prev,
                          showWebsite: event.target.checked,
                        }))
                      }
                    />
                    Show website field
                  </label>
                </section>

                <section className="rounded-xl border border-[#E5E7EB] p-4">
                  <h2 className="font-semibold text-[#111827] mb-3">Blocked Senders</h2>
                  <div className="space-y-2">
                    {blockedSenders.length === 0 ? (
                      <p className="text-sm text-[#6B7280]">No blocked senders.</p>
                    ) : (
                      blockedSenders.map((sender) => (
                        <div key={sender.id} className="rounded-lg border border-[#E5E7EB] px-3 py-2 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-[#111827]">{sender.name || sender.email}</p>
                            <p className="text-xs text-[#6B7280]">{sender.email}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeBlockedSender(sender.id)}
                            className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600"
                          >
                            Unblock
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section className="rounded-xl border border-[#E5E7EB] p-4">
                  <h2 className="font-semibold text-[#111827] mb-3">Domain Mail Accounts (SMTP + POP/IMAP)</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      value={newProvider.accountEmail}
                      onChange={(event) => setNewProvider((prev) => ({ ...prev, accountEmail: event.target.value }))}
                      placeholder="From email (domain mailbox)"
                      className="rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm"
                    />
                    <input
                      value={newProvider.providerLabel}
                      onChange={(event) => setNewProvider((prev) => ({ ...prev, providerLabel: event.target.value }))}
                      placeholder="Label (optional)"
                      className="rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm"
                    />
                    <input
                      value={newProvider.smtpHost}
                      onChange={(event) => setNewProvider((prev) => ({ ...prev, smtpHost: event.target.value }))}
                      placeholder="SMTP host"
                      className="rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm"
                    />
                    <input
                      value={newProvider.smtpPort}
                      onChange={(event) => setNewProvider((prev) => ({ ...prev, smtpPort: event.target.value }))}
                      placeholder="SMTP port"
                      className="rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm"
                    />
                    <input
                      value={newProvider.smtpUsername}
                      onChange={(event) => setNewProvider((prev) => ({ ...prev, smtpUsername: event.target.value }))}
                      placeholder="SMTP username"
                      className="rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm"
                    />
                    <input
                      type="password"
                      value={newProvider.smtpPassword}
                      onChange={(event) => setNewProvider((prev) => ({ ...prev, smtpPassword: event.target.value }))}
                      placeholder="SMTP password"
                      className="rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm"
                    />
                    <input
                      value={newProvider.imapHost}
                      onChange={(event) => setNewProvider((prev) => ({ ...prev, imapHost: event.target.value }))}
                      placeholder="IMAP host (optional)"
                      className="rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm"
                    />
                    <input
                      value={newProvider.popHost}
                      onChange={(event) => setNewProvider((prev) => ({ ...prev, popHost: event.target.value }))}
                      placeholder="POP host (optional)"
                      className="rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={createProviderAccount}
                    className="mt-3 rounded-lg bg-[#701CC0] text-white px-4 py-2 text-sm"
                  >
                    Save Mail Account
                  </button>
                  <div className="mt-4 space-y-2">
                    {providerAccounts.length === 0 ? (
                      <p className="text-sm text-[#6B7280]">No domain mail accounts configured.</p>
                    ) : (
                      providerAccounts.map((account) => (
                        <div key={account.id} className="rounded-lg border border-[#E5E7EB] px-3 py-2 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-[#111827]">{account.accountEmail}</p>
                            <p className="text-xs text-[#6B7280]">
                              SMTP {account.smtpHost}:{account.smtpPort}
                              {account.imapHost ? ` · IMAP ${account.imapHost}` : ""}
                              {account.popHost ? ` · POP ${account.popHost}` : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => testProviderAccount(account.id)}
                              className="rounded-md border border-[#D1D5DB] px-2 py-1 text-xs text-[#374151]"
                            >
                              {testingProviderId === account.id ? "Testing..." : "Test"}
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteProviderAccount(account.id)}
                              className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <div className="flex items-center gap-3">
                  <button
                    onClick={saveSettings}
                    disabled={saving}
                    className="rounded-lg bg-[#701CC0] text-white px-4 py-2 text-sm disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save Settings"}
                  </button>
                  {status ? <span className="text-sm text-[#4B5563]">{status}</span> : null}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
};

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session) {
    return { redirect: { destination: "/login", permanent: false } };
  }
  const role = (session.user as any).role;
  if (role !== "admin" && role !== "staff") {
    return { redirect: { destination: "/client", permanent: false } };
  }
  return { props: {} };
};

export default EmailSettingsPage;
