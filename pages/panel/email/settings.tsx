import React, { useCallback, useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import type { GetServerSideProps } from "next";
import { Inter } from "next/font/google";
import type { IconType } from "react-icons";
import {
  FiActivity,
  FiArrowLeft,
  FiCoffee,
  FiEdit3,
  FiEye,
  FiFileText,
  FiMail,
  FiServer,
  FiSlash,
  FiTag,
} from "react-icons/fi";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";

const inter = Inter({ subsets: ["latin"] });

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-[#701CC0]" : "bg-[#E5E7EB]"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function SettingsSection({
  title,
  description,
  icon: Icon,
  right,
  children,
}: {
  title: string;
  description?: string;
  icon: IconType;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-xl border border-gray-100 bg-white p-6 shadow-sm ${inter.className}`}>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-[#701CC0]/10 p-1.5">
              <Icon className="h-4 w-4 text-[#701CC0]" />
            </div>
            <h2 className="text-lg font-semibold text-[#111827]">{title}</h2>
          </div>
          {description ? <p className="mt-2 text-sm leading-relaxed text-[#6B7280]">{description}</p> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      {children}
    </section>
  );
}

const fieldClass =
  "w-full rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm text-[#111827] placeholder-[#9CA3AF] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#701CC0]";
const btnPrimary =
  "inline-flex items-center justify-center rounded-xl bg-[#701CC0] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#5f17a5] disabled:cursor-not-allowed disabled:opacity-50";
const btnSecondary =
  "inline-flex items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-3 py-1.5 text-sm font-medium text-[#374151] transition-colors hover:bg-[#F9FAFB]";
const btnDangerOutline =
  "rounded-xl border border-red-200 px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50";

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

type PageProps = {
  userRole: string;
};

const EmailSettingsPage: React.FC<PageProps> = ({ userRole }) => {
  const [accounts, setAccounts] = useState<GmailAccount[]>([]);
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
  /** Baseline for tracking / vacation / contact visibility — updated after load and successful save. */
  const [savedSettings, setSavedSettings] = useState<Settings | null>(null);
  const [savedContactVisibility, setSavedContactVisibility] = useState<ContactVisibility | null>(null);
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
  /** Primary connected mailbox used for API rows; preferences are user-scoped (see save sync in API). */
  const primaryAccountEmail = useMemo(
    () => (connectedAccounts[0]?.email ? connectedAccounts[0].email : ""),
    [connectedAccounts]
  );

  const roleLabel = useMemo(() => {
    const r = (userRole || "").trim();
    if (!r) return "";
    return r.charAt(0).toUpperCase() + r.slice(1).toLowerCase();
  }, [userRole]);

  const backToEmailHref = useMemo(() => {
    const connected = connectedAccounts.map((account) => account.email).filter(Boolean);
    if (connected.length > 0) {
      return `/panel/email?accounts=${encodeURIComponent(connected.join(","))}`;
    }
    return "/panel/email";
  }, [connectedAccounts]);

  const hasUnsavedSettingsChanges = useMemo(() => {
    if (!primaryAccountEmail || !savedSettings || !savedContactVisibility) return false;
    return (
      JSON.stringify(settings) !== JSON.stringify(savedSettings) ||
      JSON.stringify(contactVisibility) !== JSON.stringify(savedContactVisibility)
    );
  }, [primaryAccountEmail, settings, contactVisibility, savedSettings, savedContactVisibility]);

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
    const connected = normalized.filter((row: GmailAccount) => row.connected);
    if (connected.length === 0) {
      setLoading(false);
    }
  }, []);

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
      const nextSettings: Settings = {
        trackingEnabled: Boolean(rawSettings.trackingEnabled),
        openTrackingEnabled: Boolean(rawSettings.openTrackingEnabled ?? true),
        clickTrackingEnabled: Boolean(rawSettings.clickTrackingEnabled ?? true),
        vacationResponderEnabled: Boolean(rawSettings.vacationResponderEnabled),
        vacationSubject: String(rawSettings.vacationSubject || ""),
        vacationBodyText: String(rawSettings.vacationBodyText || ""),
        vacationStartAt: rawSettings.vacationStartAt ? String(rawSettings.vacationStartAt).slice(0, 16) : "",
        vacationEndAt: rawSettings.vacationEndAt ? String(rawSettings.vacationEndAt).slice(0, 16) : "",
      };
      setSettings(nextSettings);
      setSignatures(Array.isArray(signaturesPayload?.signatures) ? signaturesPayload.signatures : []);
      setTemplates(Array.isArray(templatesPayload?.templates) ? templatesPayload.templates : []);
      setContactTags(Array.isArray(tagsPayload?.tags) ? tagsPayload.tags : []);
      const visibility = visibilityPayload?.visibility || {};
      const nextVisibility: ContactVisibility = {
        showPhone: Boolean(visibility.showPhone ?? true),
        showBusiness: Boolean(visibility.showBusiness ?? true),
        showWebsite: Boolean(visibility.showWebsite ?? true),
      };
      setContactVisibility(nextVisibility);
      setSavedSettings(nextSettings);
      setSavedContactVisibility(nextVisibility);
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
    await loadAccountData(primaryAccountEmail);
  };

  const createProviderAccount = async () => {
    try {
      const response = await fetch("/api/email/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountEmail: newProvider.accountEmail || primaryAccountEmail,
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
      await loadAccountData(primaryAccountEmail);
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
    await loadAccountData(primaryAccountEmail);
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
    if (primaryAccountEmail) {
      loadAccountData(primaryAccountEmail);
    }
  }, [primaryAccountEmail]);

  const saveSettings = async () => {
    if (!primaryAccountEmail || saving) return;
    setSaving(true);
    setStatus("");
    try {
      const [settingsRes, visibilityRes] = await Promise.all([
        fetch(`/api/gmail/settings?accountEmail=${encodeURIComponent(primaryAccountEmail)}`, {
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
        fetch(`/api/contacts/visibility?accountEmail=${encodeURIComponent(primaryAccountEmail)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(contactVisibility),
        }),
      ]);
      if (!settingsRes.ok || !visibilityRes.ok) throw new Error("Failed to save settings");
      setSavedSettings({ ...settings });
      setSavedContactVisibility({ ...contactVisibility });
      setStatus("Settings saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const createSignature = async () => {
    const name = window.prompt("Signature name");
    if (!name || !primaryAccountEmail) return;
    await fetch("/api/gmail/signatures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountEmail: primaryAccountEmail, name, signatureText: "" }),
    });
    await loadAccountData(primaryAccountEmail);
  };

  const deleteSignature = async (id: string) => {
    await fetch("/api/gmail/signatures", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await loadAccountData(primaryAccountEmail);
  };

  const createTemplate = async () => {
    const name = window.prompt("Template name");
    if (!name || !primaryAccountEmail) return;
    await fetch("/api/gmail/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountEmail: primaryAccountEmail, name, subject: "", bodyText: "" }),
    });
    await loadAccountData(primaryAccountEmail);
  };

  const deleteTemplate = async (id: string) => {
    await fetch("/api/gmail/templates", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await loadAccountData(primaryAccountEmail);
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
    await loadAccountData(primaryAccountEmail);
  };

  const editTag = async (tag: ContactTag) => {
    const name = window.prompt("Tag name", tag.name) || tag.name;
    const color = window.prompt("Tag color hex", tag.color || "#701CC0") || tag.color || "#701CC0";
    await fetch("/api/contacts/tags", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: tag.id, name, color }),
    });
    await loadAccountData(primaryAccountEmail);
  };

  const deleteTag = async (tag: ContactTag) => {
    const ok = window.confirm(`Delete tag "${tag.name}"?`);
    if (!ok) return;
    await fetch("/api/contacts/tags", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: tag.id }),
    });
    await loadAccountData(primaryAccountEmail);
  };

  return (
    <>
      <Head>
        <title>Vierra | Email Settings</title>
      </Head>
      <div className={`min-h-screen bg-[#F7F8FC] ${inter.className}`}>
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#E5E7EB] bg-white px-5">
          <div className="flex items-center gap-4">
            <Link href="/panel" className="inline-flex items-center gap-2" aria-label="Admin panel">
              <Image
                src="/assets/vierra-logo-black-3.png"
                alt="Vierra"
                width={110}
                height={32}
                className="h-auto w-[110px]"
                priority
              />
            </Link>
          </div>
          <Link
            href={backToEmailHref}
            className="inline-flex items-center gap-2 text-sm font-medium text-[#374151] transition-colors hover:text-[#701CC0]"
          >
            <FiArrowLeft className="h-4 w-4 shrink-0" />
            Back
          </Link>
        </header>

        <main className="mx-auto max-w-4xl px-5 py-8 lg:px-8 lg:py-10">
          <div className="mb-8">
            <div className="mb-2 flex items-center gap-2">
              <div className="rounded-lg bg-[#701CC0]/10 p-1.5">
                <FiMail className="h-5 w-5 text-[#701CC0]" />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-[#111827] lg:text-3xl">Email settings</h1>
            </div>
            <p className="text-sm leading-relaxed text-[#6B7280]">
              {roleLabel ? (
                <>
                  <span className="font-medium text-[#374151]">{roleLabel} account.</span>{" "}
                </>
              ) : null}
              These preferences apply to your user account (not to individual mailbox logins). When a Gmail account is connected,
              signatures and templates use your primary connection; tracking and visibility sync across your addresses.
            </p>
            {connectedAccounts.length === 0 ? (
              <p className="mt-3 text-sm text-amber-800">
                No connected Gmail accounts. Connect Gmail from the email panel to enable mailbox-specific options.
              </p>
            ) : null}
          </div>

          {loading ? (
            <div className="rounded-xl border border-gray-100 bg-white p-8 text-center text-sm text-[#6B7280] shadow-sm">
              Loading settings…
            </div>
          ) : (
            <div className="space-y-6">
              <SettingsSection
                title="Email tracking"
                description="Control analytics for outbound mail for your user account."
                icon={FiActivity}
              >
                <div className="space-y-5">
                  <div className="flex items-center justify-between gap-4 border-b border-gray-100 pb-4">
                    <div>
                      <p className="font-medium text-[#111827]">Enable email tracking</p>
                      <p className="text-sm text-[#6B7280]">Master switch for open and click analytics.</p>
                    </div>
                    <Toggle
                      checked={settings.trackingEnabled}
                      onChange={(v) => setSettings((prev) => ({ ...prev, trackingEnabled: v }))}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4 border-b border-gray-100 pb-4">
                    <div>
                      <p className="font-medium text-[#111827]">Track opens</p>
                      <p className="text-sm text-[#6B7280]">Pixel-based open detection.</p>
                    </div>
                    <Toggle
                      checked={settings.openTrackingEnabled}
                      onChange={(v) => setSettings((prev) => ({ ...prev, openTrackingEnabled: v }))}
                      disabled={!settings.trackingEnabled}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-[#111827]">Track link clicks</p>
                      <p className="text-sm text-[#6B7280]">Wrapped links for click counts.</p>
                    </div>
                    <Toggle
                      checked={settings.clickTrackingEnabled}
                      onChange={(v) => setSettings((prev) => ({ ...prev, clickTrackingEnabled: v }))}
                      disabled={!settings.trackingEnabled}
                    />
                  </div>
                </div>
              </SettingsSection>

              <SettingsSection
                title="Vacation responder"
                description="Automatic reply while you are away."
                icon={FiCoffee}
              >
                <div className="flex items-center justify-between gap-4 border-b border-gray-100 pb-5">
                  <div>
                    <p className="font-medium text-[#111827]">Enable vacation responder</p>
                    <p className="text-sm text-[#6B7280]">Sends the message below to incoming mail.</p>
                  </div>
                  <Toggle
                    checked={settings.vacationResponderEnabled}
                    onChange={(v) => setSettings((prev) => ({ ...prev, vacationResponderEnabled: v }))}
                  />
                </div>
                <div className="mt-5 space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#6B7280]">Subject</label>
                    <input
                      value={settings.vacationSubject}
                      onChange={(event) => setSettings((prev) => ({ ...prev, vacationSubject: event.target.value }))}
                      placeholder="Vacation subject"
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#6B7280]">Message</label>
                    <textarea
                      value={settings.vacationBodyText}
                      onChange={(event) => setSettings((prev) => ({ ...prev, vacationBodyText: event.target.value }))}
                      rows={4}
                      placeholder="Vacation responder body"
                      className={`${fieldClass} resize-y`}
                    />
                  </div>
                </div>
              </SettingsSection>

              <SettingsSection
                title="Signatures"
                description="Saved signatures for your primary connected mailbox."
                icon={FiEdit3}
                right={
                  <button type="button" onClick={createSignature} className={btnPrimary}>
                    Add signature
                  </button>
                }
              >
                <div className="space-y-2">
                  {signatures.map((row) => (
                    <div
                      key={row.id}
                      className="flex items-center justify-between rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-[#111827]">{row.name}</p>
                        {row.isDefault ? <p className="text-xs font-medium text-[#701CC0]">Default</p> : null}
                      </div>
                      <button type="button" onClick={() => deleteSignature(row.id)} className="text-sm font-medium text-red-600 hover:underline">
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </SettingsSection>

              <SettingsSection
                title="Templates"
                description="Reusable email templates."
                icon={FiFileText}
                right={
                  <button type="button" onClick={createTemplate} className={btnPrimary}>
                    Add template
                  </button>
                }
              >
                <div className="space-y-2">
                  {templates.map((row) => (
                    <div
                      key={row.id}
                      className="flex items-center justify-between rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-[#111827]">{row.name}</p>
                        {row.isDefault ? <p className="text-xs font-medium text-[#701CC0]">Default</p> : null}
                      </div>
                      <button type="button" onClick={() => deleteTemplate(row.id)} className="text-sm font-medium text-red-600 hover:underline">
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </SettingsSection>

              <SettingsSection
                title="Contact tags"
                description="Organize contacts with colored tags."
                icon={FiTag}
                right={
                  <button type="button" onClick={createTag} className={btnPrimary}>
                    Add tag
                  </button>
                }
              >
                <div className="space-y-2">
                  {contactTags.length === 0 ? (
                    <p className="text-sm text-[#6B7280]">No tags yet.</p>
                  ) : (
                    contactTags.map((tag) => (
                      <div
                        key={tag.id}
                        className="flex items-center justify-between rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] px-4 py-3"
                      >
                        <div className="inline-flex items-center gap-2">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: tag.color || "#701CC0" }}
                          />
                          <p className="text-sm font-medium text-[#111827]">{tag.name}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button type="button" onClick={() => editTag(tag)} className="text-sm font-medium text-[#374151] hover:text-[#701CC0]">
                            Edit
                          </button>
                          <button type="button" onClick={() => deleteTag(tag)} className="text-sm font-medium text-red-600 hover:underline">
                            Remove
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </SettingsSection>

              <SettingsSection
                title="Contact field visibility"
                description="Choose which optional fields appear in the contacts UI."
                icon={FiEye}
              >
                <div className="space-y-5">
                  <div className="flex items-center justify-between gap-4 border-b border-gray-100 pb-4">
                    <div>
                      <p className="font-medium text-[#111827]">Phone</p>
                      <p className="text-sm text-[#6B7280]">Show phone field on contact records.</p>
                    </div>
                    <Toggle
                      checked={contactVisibility.showPhone}
                      onChange={(v) => setContactVisibility((prev) => ({ ...prev, showPhone: v }))}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4 border-b border-gray-100 pb-4">
                    <div>
                      <p className="font-medium text-[#111827]">Business</p>
                      <p className="text-sm text-[#6B7280]">Show business name field.</p>
                    </div>
                    <Toggle
                      checked={contactVisibility.showBusiness}
                      onChange={(v) => setContactVisibility((prev) => ({ ...prev, showBusiness: v }))}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-[#111827]">Website</p>
                      <p className="text-sm text-[#6B7280]">Show website field.</p>
                    </div>
                    <Toggle
                      checked={contactVisibility.showWebsite}
                      onChange={(v) => setContactVisibility((prev) => ({ ...prev, showWebsite: v }))}
                    />
                  </div>
                </div>
              </SettingsSection>

              <SettingsSection title="Blocked senders" description="Messages from these addresses are suppressed." icon={FiSlash}>
                <div className="space-y-2">
                  {blockedSenders.length === 0 ? (
                    <p className="text-sm text-[#6B7280]">No blocked senders.</p>
                  ) : (
                    blockedSenders.map((sender) => (
                      <div
                        key={sender.id}
                        className="flex items-center justify-between rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] px-4 py-3"
                      >
                        <div>
                          <p className="text-sm font-medium text-[#111827]">{sender.name || sender.email}</p>
                          <p className="text-xs text-[#6B7280]">{sender.email}</p>
                        </div>
                        <button type="button" onClick={() => removeBlockedSender(sender.id)} className={btnDangerOutline}>
                          Unblock
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </SettingsSection>

              <SettingsSection
                title="Domain mail (SMTP / IMAP / POP)"
                description="Send from domain mailboxes with custom SMTP credentials."
                icon={FiServer}
              >
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <input
                    value={newProvider.accountEmail}
                    onChange={(event) => setNewProvider((prev) => ({ ...prev, accountEmail: event.target.value }))}
                    placeholder="From email (domain mailbox)"
                    className={fieldClass}
                  />
                  <input
                    value={newProvider.providerLabel}
                    onChange={(event) => setNewProvider((prev) => ({ ...prev, providerLabel: event.target.value }))}
                    placeholder="Label (optional)"
                    className={fieldClass}
                  />
                  <input
                    value={newProvider.smtpHost}
                    onChange={(event) => setNewProvider((prev) => ({ ...prev, smtpHost: event.target.value }))}
                    placeholder="SMTP host"
                    className={fieldClass}
                  />
                  <input
                    value={newProvider.smtpPort}
                    onChange={(event) => setNewProvider((prev) => ({ ...prev, smtpPort: event.target.value }))}
                    placeholder="SMTP port"
                    className={fieldClass}
                  />
                  <input
                    value={newProvider.smtpUsername}
                    onChange={(event) => setNewProvider((prev) => ({ ...prev, smtpUsername: event.target.value }))}
                    placeholder="SMTP username"
                    className={fieldClass}
                  />
                  <input
                    type="password"
                    value={newProvider.smtpPassword}
                    onChange={(event) => setNewProvider((prev) => ({ ...prev, smtpPassword: event.target.value }))}
                    placeholder="SMTP password"
                    className={fieldClass}
                  />
                  <input
                    value={newProvider.imapHost}
                    onChange={(event) => setNewProvider((prev) => ({ ...prev, imapHost: event.target.value }))}
                    placeholder="IMAP host (optional)"
                    className={fieldClass}
                  />
                  <input
                    value={newProvider.popHost}
                    onChange={(event) => setNewProvider((prev) => ({ ...prev, popHost: event.target.value }))}
                    placeholder="POP host (optional)"
                    className={fieldClass}
                  />
                </div>
                <button type="button" onClick={createProviderAccount} className={`${btnPrimary} mt-4`}>
                  Save mail account
                </button>
                <div className="mt-6 space-y-2">
                  {providerAccounts.length === 0 ? (
                    <p className="text-sm text-[#6B7280]">No domain mail accounts configured.</p>
                  ) : (
                    providerAccounts.map((account) => (
                      <div
                        key={account.id}
                        className="flex flex-col gap-3 rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="text-sm font-medium text-[#111827]">{account.accountEmail}</p>
                          <p className="text-xs text-[#6B7280]">
                            SMTP {account.smtpHost}:{account.smtpPort}
                            {account.imapHost ? ` · IMAP ${account.imapHost}` : ""}
                            {account.popHost ? ` · POP ${account.popHost}` : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <button type="button" onClick={() => testProviderAccount(account.id)} className={btnSecondary}>
                            {testingProviderId === account.id ? "Testing…" : "Test"}
                          </button>
                          <button type="button" onClick={() => deleteProviderAccount(account.id)} className={btnDangerOutline}>
                            Remove
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </SettingsSection>

              {(hasUnsavedSettingsChanges || status) ? (
                <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-[#701CC0]/20 bg-white/95 p-4 shadow-lg backdrop-blur-sm">
                  {hasUnsavedSettingsChanges ? (
                    <button
                      type="button"
                      onClick={saveSettings}
                      disabled={saving || !primaryAccountEmail}
                      className={btnPrimary}
                    >
                      {saving ? "Saving…" : "Save settings"}
                    </button>
                  ) : null}
                  {status ? (
                    <span className={`text-sm ${status.includes("Failed") || status.includes("failed") ? "text-red-600" : "text-[#6B7280]"}`}>
                      {status}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </main>
      </div>
    </>
  );
};

export const getServerSideProps: GetServerSideProps<PageProps> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session) {
    return { redirect: { destination: "/login", permanent: false } };
  }
  const role = (session.user as any).role;
  if (role !== "admin" && role !== "staff") {
    return { redirect: { destination: "/client", permanent: false } };
  }
  return { props: { userRole: typeof role === "string" ? role : "" } };
};

export default EmailSettingsPage;
