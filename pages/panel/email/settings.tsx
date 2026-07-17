import React, { useCallback, useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import type { GetServerSideProps } from "next";
import { Geist } from "next/font/google";
import { GLASS_SURFACE } from "@/components/email/emailTheme";
import type { IconType } from "react-icons";
import {
  FiActivity,
  FiArrowLeft,
  FiCalendar,
  FiCoffee,
  FiEdit3,
  FiEye,
  FiFileText,
  FiFilter,
  FiMail,
  FiServer,
  FiSlash,
  FiTag,
  FiZap,
} from "react-icons/fi";
import { requireSession } from "@/lib/auth";

const pageFont = Geist({ subsets: ["latin"] });

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
    <section className={`rounded-2xl ${GLASS_SURFACE} p-6 shadow-[0_2px_12px_-4px_rgba(46,16,80,0.14)] ${pageFont.className}`}>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-[#701CC0]/10 p-1.5">
              <Icon className="h-4 w-4 text-[#701CC0]" />
            </div>
            <h2 className="text-lg font-semibold text-[#1E1B2E]">{title}</h2>
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
  "w-full rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm text-[#1E1B2E] placeholder-[#9CA3AF] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#701CC0]";
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
  const [artemisPrefs, setArtemisPrefs] = useState({ autonomy: "suggest", tone: "professional and friendly" });
  type FilterRow = {
    id: string;
    name: string;
    from_contains: string | null;
    subject_contains: string | null;
    add_label_name: string | null;
    archive: boolean;
    mark_read: boolean;
    star: boolean;
    enabled: boolean;
  };
  const emptyFilter = { name: "", fromContains: "", subjectContains: "", addLabelName: "", archive: false, markRead: false, star: false };
  const [filters, setFilters] = useState<FilterRow[]>([]);
  const [newFilter, setNewFilter] = useState({ ...emptyFilter });
  const [savingFilter, setSavingFilter] = useState(false);
  /** Per-account enabled flags for the panel (email -> enabled). Default enabled. */
  const [accountEnabled, setAccountEnabled] = useState<Record<string, boolean>>({});
  type DeliverabilityResult = {
    domain: string;
    googleManaged: boolean;
    spf: { found: boolean };
    dmarc: { found: boolean; policy: string };
    dkim: { found: boolean };
  };
  const [deliverability, setDeliverability] = useState<Record<string, DeliverabilityResult>>({});
  type BookingLinkRow = { id: string; slug: string; title: string; account_email: string; duration_minutes: number; active: boolean };
  const [bookingLinks, setBookingLinks] = useState<BookingLinkRow[]>([]);
  const [newBooking, setNewBooking] = useState({ title: "", accountEmail: "", durationMinutes: "30" });
  const [savingBooking, setSavingBooking] = useState(false);
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
    // Server-persisted prefs are the source of truth (the auto-draft cron reads them);
    // fall back to the local cache used by the composer's assisted drafting.
    (async () => {
      try {
        const response = await fetch("/api/ai/preferences");
        if (response.ok) {
          const data = await response.json();
          setArtemisPrefs({ autonomy: data.autonomy || "suggest", tone: data.tone || "professional and friendly" });
          window.localStorage.setItem("artemis-prefs", JSON.stringify({ autonomy: data.autonomy, tone: data.tone }));
          return;
        }
      } catch {
        /* fall through to local cache */
      }
      try {
        const raw = window.localStorage.getItem("artemis-prefs");
        if (raw) setArtemisPrefs((prev) => ({ ...prev, ...JSON.parse(raw) }));
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const updateArtemis = (patch: Partial<{ autonomy: string; tone: string }>) => {
    setArtemisPrefs((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem("artemis-prefs", JSON.stringify(next));
      } catch {
        /* ignore */
      }
      // Persist server-side so the autonomous auto-draft cron can honor it.
      fetch("/api/ai/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      }).catch(() => null);
      return next;
    });
  };

  useEffect(() => {
    if (primaryAccountEmail) {
      loadAccountData(primaryAccountEmail);
    }
  }, [primaryAccountEmail]);

  const loadFilters = useCallback(async () => {
    try {
      const response = await fetch("/api/gmail/filters");
      const data = await response.json().catch(() => ({}));
      if (response.ok) setFilters(Array.isArray(data?.filters) ? data.filters : []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadFilters();
  }, [loadFilters]);

  const loadAccountPrefs = useCallback(async () => {
    try {
      const response = await fetch("/api/gmail/account-preferences");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return;
      const map: Record<string, boolean> = {};
      for (const pref of Array.isArray(data?.preferences) ? data.preferences : []) {
        if (typeof pref?.accountEmail === "string") map[pref.accountEmail.toLowerCase()] = pref.enabled !== false;
      }
      setAccountEnabled(map);
    } catch {
      /* default to all enabled */
    }
  }, []);

  useEffect(() => {
    loadAccountPrefs();
  }, [loadAccountPrefs]);

  const loadBookingLinks = useCallback(async () => {
    try {
      const r = await fetch("/api/booking/links");
      const d = await r.json().catch(() => ({}));
      if (r.ok) setBookingLinks(Array.isArray(d?.links) ? d.links : []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadBookingLinks();
  }, [loadBookingLinks]);

  const createBookingLink = async () => {
    if (savingBooking || !newBooking.title.trim() || !newBooking.accountEmail) return;
    setSavingBooking(true);
    try {
      const r = await fetch("/api/booking/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newBooking.title.trim(),
          accountEmail: newBooking.accountEmail,
          durationMinutes: Number(newBooking.durationMinutes) || 30,
        }),
      });
      if (r.ok) {
        setNewBooking({ title: "", accountEmail: "", durationMinutes: "30" });
        await loadBookingLinks();
      }
    } finally {
      setSavingBooking(false);
    }
  };

  // Domain-auth health (SPF/DKIM/DMARC) for each connected account's sending domain.
  useEffect(() => {
    const domains = Array.from(
      new Set(connectedAccounts.map((a) => a.email.split("@")[1]).filter(Boolean))
    );
    domains.forEach(async (domain) => {
      if (deliverability[domain]) return;
      try {
        const res = await fetch(`/api/gmail/deliverability?domain=${encodeURIComponent(domain)}`);
        if (res.ok) {
          const data = await res.json();
          setDeliverability((prev) => ({ ...prev, [domain]: data }));
        }
      } catch {
        /* ignore */
      }
    });
  }, [connectedAccounts, deliverability]);

  const toggleAccountEnabled = async (email: string, enabled: boolean) => {
    const key = email.toLowerCase();
    setAccountEnabled((prev) => ({ ...prev, [key]: enabled }));
    await fetch("/api/gmail/account-preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountEmail: key, enabled }),
    }).catch(() => null);
  };

  const createFilter = async () => {
    if (savingFilter) return;
    if (!newFilter.name.trim() || (!newFilter.fromContains.trim() && !newFilter.subjectContains.trim())) return;
    setSavingFilter(true);
    try {
      const response = await fetch("/api/gmail/filters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newFilter),
      });
      if (response.ok) {
        setNewFilter({ ...emptyFilter });
        await loadFilters();
      }
    } finally {
      setSavingFilter(false);
    }
  };

  const deleteFilter = async (id: string) => {
    await fetch(`/api/gmail/filters/${id}`, { method: "DELETE" }).catch(() => null);
    setFilters((prev) => prev.filter((f) => f.id !== id));
  };

  const toggleFilter = async (id: string, enabled: boolean) => {
    setFilters((prev) => prev.map((f) => (f.id === id ? { ...f, enabled } : f)));
    await fetch(`/api/gmail/filters/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    }).catch(() => null);
  };

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
      <div className={`email-space-bg relative min-h-screen overflow-hidden ${pageFont.className}`}>
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
          <div className="email-stars" aria-hidden />
          <div className="email-stars email-stars--2" aria-hidden />
          <div className="email-vignette" aria-hidden />
        </div>
        <style jsx global>{`
          .email-space-bg { background: #18042a; }
          .email-stars {
            position: absolute; inset: -10%; z-index: 0; pointer-events: none;
            background-image:
              radial-gradient(1.5px 1.5px at 25px 35px, rgba(255,255,255,0.9), transparent),
              radial-gradient(1.5px 1.5px at 120px 80px, rgba(255,255,255,0.7), transparent),
              radial-gradient(1px 1px at 70px 160px, rgba(255,255,255,0.8), transparent),
              radial-gradient(1px 1px at 180px 50px, rgba(255,255,255,0.6), transparent),
              radial-gradient(1.5px 1.5px at 200px 140px, rgba(255,255,255,0.85), transparent),
              radial-gradient(1px 1px at 40px 110px, rgba(255,255,255,0.5), transparent);
            background-repeat: repeat; background-size: 220px 220px; opacity: 0.8;
            animation: email-stars-drift 40s linear infinite;
          }
          .email-stars--2 { background-size: 440px 440px; opacity: 0.5; animation: email-stars-drift-2 70s linear infinite; }
          @keyframes email-stars-drift { to { background-position: 220px 220px; } }
          @keyframes email-stars-drift-2 { to { background-position: 440px 440px; } }
          .email-vignette { position: absolute; inset: 0; z-index: 0; pointer-events: none; background: radial-gradient(120% 120% at 50% 25%, transparent 52%, rgba(8,1,18,0.6) 100%); }
          @media (prefers-reduced-motion: reduce) { .email-stars, .email-stars--2 { animation: none; } }
        `}</style>
        <header className="relative z-10 flex h-16 shrink-0 items-center justify-between border-b border-white/40 bg-white/60 backdrop-blur-xl px-5">
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

        <main className="relative z-10 mx-auto max-w-4xl px-5 py-8 lg:px-8 lg:py-10">
          <div className="mb-8">
            <div className="mb-2 flex items-center gap-2">
              <div className="rounded-lg bg-white/15 p-1.5">
                <FiMail className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-white lg:text-3xl">Email settings</h1>
            </div>
            <p className="text-sm leading-relaxed text-white/70">
              {roleLabel ? (
                <>
                  <span className="font-medium text-white/90">{roleLabel} account.</span>{" "}
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
                title="Accounts"
                description="Choose which connected Google accounts appear in the email panel."
                icon={FiMail}
              >
                {connectedAccounts.length === 0 ? (
                  <p className="text-sm text-[#6B7280]">No connected Google accounts yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {connectedAccounts.map((account) => {
                      const enabled = accountEnabled[account.email.toLowerCase()] !== false;
                      return (
                        <li
                          key={account.email}
                          className="flex items-center justify-between gap-3 rounded-xl border border-[#ECEAF1] bg-white p-3"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F5EFFF] text-sm font-semibold text-[#701CC0]">
                              {account.email.charAt(0).toUpperCase()}
                            </span>
                            <span className="truncate text-sm font-medium text-[#1E1B2E]">{account.email}</span>
                          </div>
                          <Toggle checked={enabled} onChange={(v) => toggleAccountEnabled(account.email, v)} />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </SettingsSection>

              <SettingsSection
                title="Deliverability"
                description="Domain authentication (SPF, DKIM, DMARC) for your sending domains — gaps hurt inbox placement."
                icon={FiActivity}
              >
                {connectedAccounts.length === 0 ? (
                  <p className="text-sm text-[#6B7280]">No connected accounts.</p>
                ) : (
                  <ul className="space-y-2">
                    {connectedAccounts.map((account) => {
                      const domain = account.email.split("@")[1] || "";
                      const d = deliverability[domain];
                      const badge = (label: string, ok: boolean) => (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
                          }`}
                        >
                          {label} {ok ? "✓" : "✗"}
                        </span>
                      );
                      return (
                        <li key={account.email} className="rounded-xl border border-[#ECEAF1] bg-white p-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="truncate text-sm font-medium text-[#1E1B2E]">{account.email}</span>
                            {d?.googleManaged ? (
                              <span className="shrink-0 text-xs text-[#6B7280]">Managed by Google</span>
                            ) : null}
                          </div>
                          {d ? (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {badge("SPF", d.spf.found)}
                              {badge("DKIM", d.dkim.found)}
                              {badge(`DMARC${d.dmarc.policy ? ` (${d.dmarc.policy})` : ""}`, d.dmarc.found)}
                            </div>
                          ) : (
                            <p className="mt-2 text-xs text-[#9A93AE]">Checking {domain}…</p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </SettingsSection>

              <SettingsSection
                title="Meeting booking"
                description="Scheduling links backed by your Google Calendar — share the link or drop it into emails."
                icon={FiCalendar}
              >
                <div className="space-y-3">
                  {bookingLinks.length === 0 ? (
                    <p className="text-sm text-[#6B7280]">No booking links yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {bookingLinks.map((l) => {
                        const url = `${typeof window !== "undefined" ? window.location.origin : ""}/book/${l.slug}`;
                        return (
                          <li key={l.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#ECEAF1] bg-white p-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-[#1E1B2E]">
                                {l.title} <span className="text-xs font-normal text-[#9A93AE]">· {l.duration_minutes}m · {l.account_email}</span>
                              </p>
                              <p className="mt-0.5 truncate text-xs text-[#701CC0]">{url}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                if (typeof window !== "undefined" && navigator.clipboard) navigator.clipboard.writeText(url);
                              }}
                              className={btnSecondary}
                            >
                              Copy link
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  <div className="rounded-xl border border-dashed border-[#D6C7EC] p-3">
                    <p className="mb-2 text-xs font-semibold text-[#4A465C]">New booking link</p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <input
                        className={fieldClass}
                        placeholder="Title (e.g. Intro call)"
                        value={newBooking.title}
                        onChange={(e) => setNewBooking({ ...newBooking, title: e.target.value })}
                      />
                      <select
                        className={fieldClass}
                        value={newBooking.accountEmail}
                        onChange={(e) => setNewBooking({ ...newBooking, accountEmail: e.target.value })}
                      >
                        <option value="">Select account…</option>
                        {connectedAccounts.map((a) => (
                          <option key={a.email} value={a.email}>
                            {a.email}
                          </option>
                        ))}
                      </select>
                      <select
                        className={fieldClass}
                        value={newBooking.durationMinutes}
                        onChange={(e) => setNewBooking({ ...newBooking, durationMinutes: e.target.value })}
                      >
                        <option value="15">15 minutes</option>
                        <option value="30">30 minutes</option>
                        <option value="45">45 minutes</option>
                        <option value="60">60 minutes</option>
                      </select>
                      <button
                        type="button"
                        onClick={createBookingLink}
                        disabled={savingBooking || !newBooking.title.trim() || !newBooking.accountEmail}
                        className={btnPrimary}
                      >
                        {savingBooking ? "Creating…" : "Create link"}
                      </button>
                    </div>
                    <p className="mt-2 text-[11px] text-[#9A93AE]">
                      Availability defaults to weekdays, 14:00–22:00 UTC (≈ 9–5 US Eastern). Invitees see times in their own timezone.
                    </p>
                  </div>
                </div>
              </SettingsSection>

              <SettingsSection
                title="Email tracking"
                description="Control analytics for outbound mail for your user account."
                icon={FiActivity}
              >
                <div className="space-y-5">
                  <div className="flex items-center justify-between gap-4 border-b border-gray-100 pb-4">
                    <div>
                      <p className="font-medium text-[#1E1B2E]">Enable email tracking</p>
                      <p className="text-sm text-[#6B7280]">Master switch for open and click analytics.</p>
                    </div>
                    <Toggle
                      checked={settings.trackingEnabled}
                      onChange={(v) => setSettings((prev) => ({ ...prev, trackingEnabled: v }))}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4 border-b border-gray-100 pb-4">
                    <div>
                      <p className="font-medium text-[#1E1B2E]">Track opens</p>
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
                      <p className="font-medium text-[#1E1B2E]">Track link clicks</p>
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
                    <p className="font-medium text-[#1E1B2E]">Enable vacation responder</p>
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
                title="Artemis AI"
                description="How the Artemis assistant helps with your mail."
                icon={FiZap}
              >
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#6B7280]">Autonomy</label>
                    <select
                      value={artemisPrefs.autonomy}
                      onChange={(event) => updateArtemis({ autonomy: event.target.value })}
                      className={fieldClass}
                    >
                      <option value="off">Off — no AI suggestions</option>
                      <option value="suggest">Suggest — smart replies &amp; on-demand drafting</option>
                      <option value="autodraft">Auto-draft — write reply drafts for you to review</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#6B7280]">Default tone</label>
                    <input
                      value={artemisPrefs.tone}
                      onChange={(event) => updateArtemis({ tone: event.target.value })}
                      placeholder="e.g. professional and friendly"
                      className={fieldClass}
                    />
                    <p className="mt-2 text-xs text-[#6B7280]">Artemis uses this tone when drafting and rewriting.</p>
                  </div>
                  <p className="rounded-lg bg-[#F5EFFF] px-3 py-2 text-xs text-[#4C1D95]">
                    On “Auto-draft”, Artemis writes a reply draft for new mail (grounded in your prior threads and contacts)
                    for you to review — it never sends automatically. Requires the inbound poller and a configured AI provider.
                  </p>
                </div>
              </SettingsSection>

              <SettingsSection
                title="Filters &amp; rules"
                description="Automatically act on incoming mail: add a label, archive, star, or mark as read."
                icon={FiFilter}
              >
                <div className="space-y-3">
                  {filters.length === 0 ? (
                    <p className="text-sm text-[#6B7280]">No filters yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {filters.map((f) => (
                        <li key={f.id} className="flex items-start justify-between gap-3 rounded-xl border border-[#E5E7EB] bg-white p-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[#1E1B2E]">{f.name}</p>
                            <p className="mt-0.5 text-xs text-[#6B7280]">
                              {[
                                f.from_contains ? `From contains “${f.from_contains}”` : "",
                                f.subject_contains ? `Subject contains “${f.subject_contains}”` : "",
                              ]
                                .filter(Boolean)
                                .join(" · ") || "Any message"}
                            </p>
                            <p className="mt-0.5 text-xs text-[#847FA0]">
                              →{" "}
                              {[
                                f.add_label_name ? `Label “${f.add_label_name}”` : "",
                                f.archive ? "Archive" : "",
                                f.mark_read ? "Mark read" : "",
                                f.star ? "Star" : "",
                              ]
                                .filter(Boolean)
                                .join(", ") || "No action"}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <Toggle checked={f.enabled} onChange={(v) => toggleFilter(f.id, v)} />
                            <button type="button" onClick={() => deleteFilter(f.id)} className={btnDangerOutline}>
                              Delete
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="rounded-xl border border-dashed border-[#D6C7EC] p-3">
                    <p className="mb-2 text-xs font-semibold text-[#4A465C]">New filter</p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <input
                        className={fieldClass}
                        placeholder="Filter name"
                        value={newFilter.name}
                        onChange={(e) => setNewFilter({ ...newFilter, name: e.target.value })}
                      />
                      <input
                        className={fieldClass}
                        placeholder="Add label (optional)"
                        value={newFilter.addLabelName}
                        onChange={(e) => setNewFilter({ ...newFilter, addLabelName: e.target.value })}
                      />
                      <input
                        className={fieldClass}
                        placeholder="From contains…"
                        value={newFilter.fromContains}
                        onChange={(e) => setNewFilter({ ...newFilter, fromContains: e.target.value })}
                      />
                      <input
                        className={fieldClass}
                        placeholder="Subject contains…"
                        value={newFilter.subjectContains}
                        onChange={(e) => setNewFilter({ ...newFilter, subjectContains: e.target.value })}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-4">
                      <label className="flex items-center gap-1.5 text-xs text-[#4A465C]">
                        <input type="checkbox" checked={newFilter.archive} onChange={(e) => setNewFilter({ ...newFilter, archive: e.target.checked })} /> Archive
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-[#4A465C]">
                        <input type="checkbox" checked={newFilter.markRead} onChange={(e) => setNewFilter({ ...newFilter, markRead: e.target.checked })} /> Mark read
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-[#4A465C]">
                        <input type="checkbox" checked={newFilter.star} onChange={(e) => setNewFilter({ ...newFilter, star: e.target.checked })} /> Star
                      </label>
                      <button
                        type="button"
                        onClick={createFilter}
                        disabled={savingFilter || !newFilter.name.trim() || (!newFilter.fromContains.trim() && !newFilter.subjectContains.trim())}
                        className={`${btnPrimary} ml-auto`}
                      >
                        {savingFilter ? "Adding…" : "Add filter"}
                      </button>
                    </div>
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
                      className="flex items-center justify-between rounded-xl border border-[#E5E7EB] bg-white/50 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-[#1E1B2E]">{row.name}</p>
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
                      className="flex items-center justify-between rounded-xl border border-[#E5E7EB] bg-white/50 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-[#1E1B2E]">{row.name}</p>
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
                        className="flex items-center justify-between rounded-xl border border-[#E5E7EB] bg-white/50 px-4 py-3"
                      >
                        <div className="inline-flex items-center gap-2">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: tag.color || "#701CC0" }}
                          />
                          <p className="text-sm font-medium text-[#1E1B2E]">{tag.name}</p>
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
                      <p className="font-medium text-[#1E1B2E]">Phone</p>
                      <p className="text-sm text-[#6B7280]">Show phone field on contact records.</p>
                    </div>
                    <Toggle
                      checked={contactVisibility.showPhone}
                      onChange={(v) => setContactVisibility((prev) => ({ ...prev, showPhone: v }))}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4 border-b border-gray-100 pb-4">
                    <div>
                      <p className="font-medium text-[#1E1B2E]">Business</p>
                      <p className="text-sm text-[#6B7280]">Show business name field.</p>
                    </div>
                    <Toggle
                      checked={contactVisibility.showBusiness}
                      onChange={(v) => setContactVisibility((prev) => ({ ...prev, showBusiness: v }))}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-[#1E1B2E]">Website</p>
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
                        className="flex items-center justify-between rounded-xl border border-[#E5E7EB] bg-white/50 px-4 py-3"
                      >
                        <div>
                          <p className="text-sm font-medium text-[#1E1B2E]">{sender.name || sender.email}</p>
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
                        className="flex flex-col gap-3 rounded-xl border border-[#E5E7EB] bg-white/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="text-sm font-medium text-[#1E1B2E]">{account.accountEmail}</p>
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
  const session = await requireSession(ctx.req, ctx.res);
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
