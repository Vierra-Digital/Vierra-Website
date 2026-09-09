import React, { useState, useEffect, useRef } from "react";
import { signOut } from "@/lib/session-client";
import ProfileImage from "./ProfileImage";
import Modal from "@/components/ui/Modal";
import {
  PANEL_FIELD,
  PANEL_FIELD_INVALID,
  PanelFieldLabel,
  PanelModalFooter,
  PanelModalHeader,
} from "@/components/ui/PanelForm";
import ImageCropModal from "./ImageCropModal";
import ConfirmActionModal from "@/components/ui/ConfirmActionModal";
import { FiChevronDown, FiLogOut, FiEdit3, FiUpload, FiRotateCcw, FiLock, FiUser, FiMail, FiShield, FiSettings, FiCheck, FiRefreshCw, FiPlus, FiTrash2, FiCalendar, FiCreditCard } from "react-icons/fi";
import { FaFacebookF, FaLinkedinIn, FaGoogle } from "react-icons/fa";
import { X } from "lucide-react";

interface UserSettingsPageProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  onNameUpdate?: (newName: string | null) => void;
  onImageUpdate?: () => void | Promise<void>;
  onClose?: () => void;
  variant?: "panel" | "dark";
  userRole?: string | null;
  /**
   * Renders someone else's settings for staff to look at: every control that would change the
   * account is hidden, because a staff member must not rename a client, replace their picture or
   * set their password from here. Read-only by construction rather than by asking nicely.
   */
  readOnly?: boolean;
  /** Whose billing to read when this is somebody else's page. */
  billingCompanyId?: string | null;
  /**
   * Fired after any change that the rest of the panel renders from — a saved setting, a new
   * picture, a reset picture. The panel re-reads its own server data on this, so the sidebar
   * matches what was just saved instead of showing the previous value until a manual reload.
   */
  onSettingsUpdate?: () => void;
  /**
   * Staff viewing a client may change that client's settings — theme, language, notifications,
   * two-factor — which is what the client view is for. It does NOT unlock identity: their name,
   * picture and password stay theirs, and `readOnly` still governs those.
   */
  canManageClient?: boolean;
}

type GmailAccountConnection = {
  email: string;
  connected: boolean;
  expiresAt: string | null;
};

type DetectedCalendar = {
  primary?: boolean;
  id: string;
  summary: string;
  timeZone: string;
  enabled: boolean;
};

type DetectedCalendarAccount = {
  email: string;
  connected: boolean;
  calendars: DetectedCalendar[];
};

/**
 * What a client has connected, as /api/client/settings reports it. Separate from the types above
 * because those describe the signed-in user's own connections, which is a different person on a
 * read-only page.
 */
type ClientConnections = {
  google: { email: string; expiresAt: string | null; needsReconnect: boolean }[];
  linkedin: boolean;
  facebook: boolean;
  googleads: boolean;
  mailboxes: { email: string; label: string | null }[];
};

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
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

/**
 * The shell every settings card shares: heading row, optional action cluster, optional
 * description. Each card used to re-declare its own icon chip, heading and spacing, which is how
 * they drifted into slightly different paddings and type sizes.
 */
const SettingsCard: React.FC<{
  title: string;
  icon: React.ReactNode;
  description?: string;
  action?: React.ReactNode;
  cardClass: string;
  titleClass: string;
  descriptionClass: string;
  children: React.ReactNode;
}> = ({ title, icon, description, action, cardClass, titleClass, descriptionClass, children }) => (
  <div className={cardClass}>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#701CC0]/10">{icon}</span>
        <h3 className={`text-[15px] font-semibold ${titleClass}`}>{title}</h3>
      </div>
      {action}
    </div>
    {description ? <p className={`mb-4 text-[13px] ${descriptionClass}`}>{description}</p> : null}
    {children}
  </div>
);

/** Only what this card shows; the billing page reads the rest from the same endpoint. */
type BillingSummary = {
  connected: boolean;
  paymentMethods: Array<{
    id: string;
    type: string;
    brand: string | null;
    last4: string | null;
    bankName: string | null;
    expMonth: number | null;
    expYear: number | null;
    isDefault: boolean;
  }>;
  subscription: { cancelAtPeriodEnd: boolean; currentPeriodEnd: string | null } | null;
};

const UserSettingsPage: React.FC<UserSettingsPageProps> = ({ user, onNameUpdate, onImageUpdate, onClose, variant = "panel", userRole: userRoleProp = null, readOnly = false, billingCompanyId = null, canManageClient = false, onSettingsUpdate }) => {
  /** Whether the settings controls (not the identity ones) accept input on this page. */
  const settingsEditable = !readOnly || (canManageClient && !!billingCompanyId);
  const [name, setName] = useState(user.name || "");
  const [isEditingName, setIsEditingName] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [settings, setSettings] = useState({
    emailNotifications: true,
    twoFactorEnabled: false,
    theme: "auto",
    language: "en"
  });
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  /** Read-only pages only: the client's settings could not be read, so say so rather than
   *  rendering the defaults as if they were theirs. */
  const [settingsUnavailable, setSettingsUnavailable] = useState(false);
  /** Read-only pages only: the CLIENT's own connections, from /api/client/settings. Kept apart
   *  from socialConnections/gmailAccounts, which are always the session user's. */
  const [clientConnections, setClientConnections] = useState<ClientConnections | null>(null);
  const [billing, setBilling] = useState<BillingSummary | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [billingPortalError, setBillingPortalError] = useState("");
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [passwordFieldErrors, setPasswordFieldErrors] = useState<Record<string, string>>({});
  const [isPasswordChangeSuccess, setIsPasswordChangeSuccess] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(userRoleProp);
  const [socialConnections, setSocialConnections] = useState({
    facebook: false,
    linkedin: false,
    googleads: false,
  });
  const [socialLoading, setSocialLoading] = useState(false);
  const [gmailAccounts, setGmailAccounts] = useState<GmailAccountConnection[]>([]);
  const [gmailLoading, setGmailLoading] = useState(false);
  const [showDeleteGmailModal, setShowDeleteGmailModal] = useState(false);
  const [gmailToDelete, setGmailToDelete] = useState<string | null>(null);
  const [isDeletingGmail, setIsDeletingGmail] = useState(false);
  const [detectedCalendarAccounts, setDetectedCalendarAccounts] = useState<DetectedCalendarAccount[]>([]);
  const [calendarSettingsLoading, setCalendarSettingsLoading] = useState(false);
  const [calendarToggleKeyLoading, setCalendarToggleKeyLoading] = useState<string | null>(null);

  const avatarMenuRef = useRef<HTMLDivElement>(null);
  const displayName = name && name.trim().length > 0 ? name : (user.email ? user.email.split("@")[0] : "User");

  // Both of these sync a prop into state that has a second source, so neither can be derived.
  //
  // `name` is an editable field: a derived value would throw away whatever the user had typed on
  // the next render. It still has to follow user.name, which changes when the profile is saved.
  // `userRole` is also written by the polling effect further down, which picks up a role an admin
  // changed elsewhere, so the prop is one of two inputs rather than the value itself.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(user.name || "");
  }, [user.name]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (userRoleProp) setUserRole(userRoleProp);
  }, [userRoleProp]);

  useEffect(() => {
    // Representatives' own billing, or a client's when staff are looking at their page.
    if (userRole !== "user" && !billingCompanyId) return;
    let cancelled = false;
    // Fetching is the effect's purpose and the pending flag has to flip before it starts, or the
    // card renders "no payment method on file" for a moment against data that has not arrived.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBillingLoading(true);
    void fetch(
      billingCompanyId
        ? `/api/client/billing?companyId=${encodeURIComponent(billingCompanyId)}`
        : "/api/client/billing"
    )
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (!cancelled) setBilling(body as BillingSummary | null);
      })
      .catch(() => {
        if (!cancelled) setBilling(null);
      })
      .finally(() => {
        if (!cancelled) setBillingLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userRole, billingCompanyId]);

  useEffect(() => {
    /**
     * Two sources, one shape.
     *
     * On your own page these come from user_preferences. On a client's page they come from that
     * client's own row — reading your preferences there would have shown YOUR theme and
     * notification setting under their name, which is worse than showing nothing, and is why
     * these cards used to be hidden in readOnly instead.
     *
     * When a client's settings cannot be read, the cards say so. The state object holds defaults
     * (notifications on, theme auto, English) and rendering those unlabelled would be the same
     * lie in a quieter form — a staff member cannot tell a real setting from a placeholder.
     */
    const endpoint = readOnly
      ? billingCompanyId
        ? `/api/client/settings?companyId=${encodeURIComponent(billingCompanyId)}`
        : null
      : "/api/profile/getSettings";

    if (!endpoint) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsLoadingSettings(false);
      setSettingsUnavailable(readOnly);
      return;
    }

    let cancelled = false;
    const loadSettings = async () => {
      try {
        const response = await fetch(endpoint);
        if (response.ok) {
          const { connections, ...settingsData } = await response.json();
          if (!cancelled) {
            setSettings((prev) => ({ ...prev, ...settingsData }));
            setClientConnections((connections as ClientConnections | undefined) ?? null);
            setSettingsUnavailable(false);
          }
        } else if (!cancelled) {
          setSettingsUnavailable(true);
        }
      } catch (error) {
        console.error("Failed to load settings:", error);
        if (!cancelled) setSettingsUnavailable(true);
      } finally {
        if (!cancelled) setIsLoadingSettings(false);
      }
    };
    loadSettings();
    return () => {
      cancelled = true;
    };
  }, [readOnly, billingCompanyId]);

  const loadSocialConnections = async () => {
    setSocialLoading(true);
    try {
      const [userRes, fbRes, liRes, gaRes] = await Promise.all([
        userRoleProp ? null : fetch("/api/profile/getUser"),
        fetch("/api/facebook/status"),
        fetch("/api/linkedin/status"),
        fetch("/api/googleads/status"),
      ]);

      if (userRes?.ok) {
        const userData = await userRes.json();
        setUserRole(userData?.role || null);
      }

      const [fb, li, ga] = await Promise.all([
        fbRes.ok ? fbRes.json() : Promise.resolve({ connected: false }),
        liRes.ok ? liRes.json() : Promise.resolve({ connected: false }),
        gaRes.ok ? gaRes.json() : Promise.resolve({ connected: false }),
      ]);

      setSocialConnections({
        facebook: !!fb.connected,
        linkedin: !!li.connected,
        googleads: !!ga.connected,
      });
    } catch (error) {
      console.error("Failed to load social connection statuses:", error);
    } finally {
      setSocialLoading(false);
    }
  };

  const loadGmailConnections = async (options?: { silent?: boolean }) => {
    const silent = !!options?.silent;
    if (!silent) setGmailLoading(true);
    try {
      const response = await fetch("/api/gmail/status");
      if (!response.ok) {
        // A background poll hiccup shouldn't blank out an already-loaded list — only the
        // user-initiated (non-silent) load treats a bad response as "no accounts".
        if (!silent) setGmailAccounts([]);
        return;
      }

      const data = await response.json();
      const accounts = Array.isArray(data?.accounts) ? data.accounts : [];
      setGmailAccounts(
        accounts.map((account: any) => ({
          email: typeof account?.email === "string" ? account.email : "",
          connected: !!account?.connected,
          expiresAt: typeof account?.expiresAt === "string" ? account.expiresAt : null,
        })).filter((account: GmailAccountConnection) => account.email.length > 0)
      );
    } catch (error) {
      console.error("Failed to load Gmail connections:", error);
      if (!silent) setGmailAccounts([]);
    } finally {
      if (!silent) setGmailLoading(false);
    }
  };

  const loadDetectedCalendars = async () => {
    setCalendarSettingsLoading(true);
    try {
      const response = await fetch("/api/google-calendar/calendars");
      if (!response.ok) {
        setDetectedCalendarAccounts([]);
        return;
      }
      const data = await response.json();
      const accounts = Array.isArray(data?.accounts) ? data.accounts : [];
      setDetectedCalendarAccounts(
        accounts.map((account: any) => ({
          email: typeof account?.email === "string" ? account.email : "",
          connected: !!account?.connected,
          calendars: Array.isArray(account?.calendars)
            ? account.calendars
                .map((calendar: any) => ({
                  id: typeof calendar?.id === "string" ? calendar.id : "",
                  summary: typeof calendar?.summary === "string" ? calendar.summary : "Untitled Calendar",
                  timeZone: typeof calendar?.timeZone === "string" ? calendar.timeZone : "UTC",
                  primary: calendar?.primary === true,
                  enabled: calendar?.enabled !== false,
                }))
                .filter((calendar: DetectedCalendar) => calendar.id.length > 0)
            : [],
        })).filter((account: DetectedCalendarAccount) => account.email.length > 0)
      );
    } catch (error) {
      console.error("Failed to load detected calendars:", error);
      setDetectedCalendarAccounts([]);
    } finally {
      setCalendarSettingsLoading(false);
    }
  };

  const handleCalendarToggle = async (accountEmail: string, calendarId: string, enabled: boolean) => {
    const toggleKey = `${accountEmail}::${calendarId}`;
    setCalendarToggleKeyLoading(toggleKey);
    try {
      const response = await fetch("/api/google-calendar/calendars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountEmail, calendarId, enabled }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to update calendar visibility.");
      }

      setDetectedCalendarAccounts((prev) =>
        prev.map((account) =>
          account.email !== accountEmail
            ? account
            : {
                ...account,
                calendars: account.calendars.map((calendar) =>
                  calendar.id === calendarId ? { ...calendar, enabled } : calendar
                ),
              }
        )
      );
    } catch (error) {
      setUpdateMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to update calendar visibility.",
      });
    } finally {
      setCalendarToggleKeyLoading(null);
    }
  };

  useEffect(() => {
    /**
     * Skipped entirely on someone else's page. All three read the SESSION user's connections —
     * /api/gmail/status, /api/google-calendar/calendars and the social status routes are all
     * scoped to whoever is logged in — so on a client's settings page they loaded the staff
     * member's own Google accounts, calendars and LinkedIn and rendered them under the client's
     * name. The client's own connections come from /api/client/settings instead.
     */
    if (readOnly) return;
    // See the note below: these are mount-only loaders that each set their own state after awaiting.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSocialConnections();
    loadGmailConnections();
    loadDetectedCalendars();
    // Mount-only on purpose. These loaders are plain functions, recreated on every render, so
    // listing them as dependencies would refetch all three on each render rather than once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly]);

  // Keep the role-gated sections (Gmail, calendars, social) in sync with an admin
  // changing this user's role elsewhere, without waiting on a full page reload.
  useEffect(() => {
    let cancelled = false;
    const syncRole = async () => {
      try {
        const response = await fetch("/api/profile/getRole");
        if (!response.ok || cancelled) return;
        const data = await response.json();
        const freshRole = typeof data?.role === "string" ? data.role : null;
        setUserRole((prev) => (prev === freshRole ? prev : freshRole));
      } catch (error) {
        console.error("Failed to sync role:", error);
      }
    };

    if (!userRoleProp) syncRole();
    const intervalId = setInterval(syncRole, 20000);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [userRoleProp]);

  // Periodically recheck Gmail connection status in the background (no dedicated push
  // webhook from Google — /api/gmail/status already re-validates/refreshes each token, so
  // polling it surfaces a revoked/expired grant without the user having to hit Refresh).
  useEffect(() => {
    const intervalId = setInterval(() => {
      loadGmailConnections({ silent: true });
    }, 60000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(event.target as Node)) {
        setShowAvatarMenu(false);
      }
    };

    if (showAvatarMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showAvatarMenu]);

  useEffect(() => {
    if (updateMessage && updateMessage.type === "success") {
      const timer = setTimeout(() => setUpdateMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [updateMessage]);

  const fetchUserData = async () => {
    try {
      const userResponse = await fetch("/api/profile/getUser");
      if (userResponse.ok) {
        const userData = await userResponse.json();
        return userData;
      }
    } catch (error) {
      console.error("Failed to fetch updated user data:", error);
    }
    return null;
  };

  const handleNameUpdate = async () => {
    setIsUpdating(true);
    setUpdateMessage(null);
    
    try {
      const response = await fetch("/api/profile/updateName", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        throw new Error("Failed to update name");
      }

      const userData = await fetchUserData();
      if (userData) {
        setName(userData.name || "");
        onNameUpdate?.(userData.name);
      }
      
      setShowSuccessModal(true);
      setUpdateMessage(null);
      setIsEditingName(false);
    } catch {
      setUpdateMessage({ type: "error", text: "Failed to update name. Please try again." });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSettingsUpdate = async (newSettings: Partial<typeof settings>) => {
    setIsUpdating(true);
    setUpdateMessage(null);

    try {
      // A client's settings live on their own row and are written through the client route; your
      // own live in user_preferences. Posting a client's change to the profile route would have
      // silently changed the staff member's own settings instead.
      const managingClient = readOnly && canManageClient && billingCompanyId;
      const response = await fetch(
        managingClient
          ? `/api/client/settings?companyId=${encodeURIComponent(billingCompanyId)}`
          : "/api/profile/updateSettings",
        {
          method: managingClient ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newSettings),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update settings");
      }

      const result = await response.json();
      setSettings(result);
      // Tell the panel, so anything rendered from these values outside this page follows the
      // change immediately rather than at the next full reload.
      onSettingsUpdate?.();
      setShowSuccessModal(true);
      setUpdateMessage(null);
    } catch (error) {
      console.error("Failed to update settings:", error);
      setUpdateMessage({ type: "error", text: "Failed to update settings. Please try again." });
    } finally {
      setIsUpdating(false);
    }
  };

  const uploadImageBlob = async (blob: Blob) => {
    setIsUpdating(true);
    setUpdateMessage(null);
    setCropImageSrc(null);
    
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = reader.result as string;
          const base64 = base64Data.split(',')[1];
          
          const response = await fetch("/api/profile/uploadImage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              imageData: base64,
              mimeType: blob.type || "image/jpeg"
            }),
          });

          if (!response.ok) {
            throw new Error("Failed to upload image");
          }

          onImageUpdate?.();
      onSettingsUpdate?.();
          
          setShowSuccessModal(true);
          setUpdateMessage(null);
          setShowAvatarMenu(false);
        } catch (error) {
          console.error("Error uploading image:", error);
          setUpdateMessage({ 
            type: "error", 
            text: error instanceof Error ? error.message : "Failed to upload image" 
          });
        } finally {
          setIsUpdating(false);
        }
      };
      
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error("Error processing image:", error);
      setUpdateMessage({ 
        type: "error", 
        text: "Failed to process image" 
      });
      setIsUpdating(false);
      setCropImageSrc(null);
    }
  };

  const handleImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setCropImageSrc(reader.result as string);
      setShowAvatarMenu(false);
    };
    reader.readAsDataURL(file);
  };

  const handleImageReset = async () => {
    setIsUpdating(true);
    setUpdateMessage(null);
    
    try {
      const response = await fetch("/api/profile/uploadImage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          imageData: null,
          mimeType: null
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to reset image");
      }

      onImageUpdate?.();
      onSettingsUpdate?.();
      
      setShowSuccessModal(true);
      setUpdateMessage(null);
      setShowAvatarMenu(false);
    } catch (error) {
      console.error("Error resetting image:", error);
      setUpdateMessage({ 
        type: "error", 
        text: error instanceof Error ? error.message : "Failed to reset image" 
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePasswordChange = async () => {
    const errors: Record<string, string> = {};

    if (!passwordData.currentPassword.trim()) {
      errors.currentPassword = "Current password is required.";
    }

    if (!passwordData.newPassword.trim()) {
      errors.newPassword = "New password is required.";
    } else if (passwordData.newPassword.length < 6) {
      errors.newPassword = "Password must be at least 6 characters long.";
    }

    if (!passwordData.confirmPassword.trim()) {
      errors.confirmPassword = "Please confirm your new password.";
    } else if (passwordData.newPassword !== passwordData.confirmPassword) {
      errors.confirmPassword = "New passwords do not match.";
    }

    setPasswordFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setIsUpdating(true);
    setPasswordFieldErrors({});
    
    try {
      const response = await fetch("/api/profile/changePassword", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        if (response.status === 400 && errorData.message === "Current password is incorrect") {
          setPasswordFieldErrors({ currentPassword: "The current password you entered is incorrect. Please try again." });
          return;
        }
        
        if (response.status === 400 && errorData.message === "New password must be at least 6 characters long") {
          setPasswordFieldErrors({ newPassword: "The new password must be at least 6 characters long." });
          return;
        }
        
        if (response.status === 400 && errorData.message === "User does not have a password set") {
          setPasswordFieldErrors({ currentPassword: "No password is currently set for this account. Please contact an administrator." });
          return;
        }
        
        throw new Error(errorData.message || "Failed to change password");
      }

      setShowSuccessModal(true);
      setIsPasswordChangeSuccess(true);
      setShowPasswordModal(false);
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPasswordFieldErrors({});
      
      setTimeout(() => {
        signOut({ callbackUrl: "/login" });
      }, 2000);
    } catch (error) {
      console.error("Error changing password:", error);
      setPasswordFieldErrors({ 
        general: error instanceof Error ? (error.message.endsWith('.') ? error.message : error.message + '.') : "Failed to change password." 
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePasswordFieldChange = (field: string, value: string) => {
    setPasswordFieldErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[field];
      delete newErrors.general;
      return newErrors;
    });
    setPasswordData(prev => ({ ...prev, [field]: value }));
  };

  const closePasswordModal = () => {
    setShowPasswordModal(false);
    setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setPasswordFieldErrors({});
  };

  const openDeleteGmailModal = (email: string) => {
    setGmailToDelete(email);
    setShowDeleteGmailModal(true);
  };

  const closeDeleteGmailModal = () => {
    if (isDeletingGmail) return;
    setShowDeleteGmailModal(false);
    setGmailToDelete(null);
  };

  const handleDeleteGmailAccount = async () => {
    if (!gmailToDelete) return;
    if (isDeletingGmail) return;
    setIsDeletingGmail(true);
    try {
      const response = await fetch("/api/gmail/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: gmailToDelete }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to delete Gmail account.");
      }
      setUpdateMessage({ type: "success", text: "Gmail account removed successfully." });
      setShowDeleteGmailModal(false);
      setGmailToDelete(null);
      await Promise.all([loadGmailConnections(), loadDetectedCalendars()]);
    } catch (error) {
      setUpdateMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to delete Gmail account.",
      });
    } finally {
      setIsDeletingGmail(false);
    }
  };


  const isDark = variant === "dark";
  const isPanel = variant === "panel";
  const cardBg = isDark ? "bg-[#2E0A4F]/90 border-white/10" : "bg-[#F1EFF6] border-transparent";
  const textPrimary = isDark ? "text-white" : "text-[#111827]";
  const textSecondary = isDark ? "text-white/70" : "text-[#6B7280]";
  const inputBg = isDark ? "bg-white/10 border-white/20 text-white placeholder-white/50" : "bg-white border-[#E5E7EB]";
  const pageBg = isDark ? "bg-transparent" : "bg-white";
  // Google accounts belong to whoever is signed in, so they are never part of someone else's page.
  const canManageGmailAccounts = !readOnly && ["user", "admin", "staff"].includes(userRole || "");
  const gmailSettingsSource = userRole === "admin" || userRole === "staff" ? "panel-settings" : "settings";
  // The email panel's settings render on a dark card, where the light tint disappears entirely.
  const skeletonTint = isDark ? "bg-white/10" : "bg-[#F1EFF6]";

  const openBillingPortal = async () => {
    setOpeningPortal(true);
    setBillingPortalError("");
    try {
      const response = await fetch("/api/client/billing-portal", { method: "POST" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body?.url) throw new Error(body?.message || "Could not open the billing portal.");
      window.location.href = body.url as string;
    } catch (e) {
      setBillingPortalError(e instanceof Error ? e.message : "Could not open the billing portal.");
      setOpeningPortal(false);
    }
  };

  /**
   * Shown until the settings request lands, so the page arrives once rather than in pieces.
   *
   * The cards used to render immediately against their defaults — an empty name, every toggle
   * off, the language on its first option — and then rearrange themselves when the real values
   * came back. The shapes here match the cards they stand in for, so nothing moves when they are
   * swapped out.
   */
  const cardsSkeleton = (
    <div className="space-y-4" aria-hidden>
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((card) => (
          <div key={card} className={`rounded-2xl ${cardBg} border p-5`}>
            <div className="mb-5 flex items-center gap-2">
              <div className={`h-7 w-7 animate-pulse rounded-lg ${skeletonTint}`} />
              <div className={`h-3.5 w-24 animate-pulse rounded ${skeletonTint}`} />
            </div>
            {card === 0 && <div className={`mb-5 h-24 w-24 animate-pulse rounded-full ${skeletonTint}`} />}
            <div className="space-y-4">
              {[0, 1, 2].map((row) => (
                <div key={row} className="space-y-1.5">
                  <div className={`h-2.5 w-20 animate-pulse rounded ${skeletonTint}`} />
                  <div className={`h-9 w-full animate-pulse rounded-[10px] ${skeletonTint}`} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {[0, 1].map((card) => (
        <div key={card} className={`rounded-2xl ${cardBg} border p-5`}>
          <div className="mb-5 flex items-center gap-2">
            <div className={`h-7 w-7 animate-pulse rounded-lg ${skeletonTint}`} />
            <div className={`h-3.5 w-32 animate-pulse rounded ${skeletonTint}`} />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {[0, 1, 2].map((cell) => (
              <div key={cell} className={`h-16 animate-pulse rounded-xl ${skeletonTint}`} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const cardsContent = (
    /* A grid, not CSS columns. Masonry filled both sides of the page but let each card start
       wherever the previous one happened to end, so nothing lined up with anything and the page
       read as a pile of boxes. Rows here are explicit: profile, security and preferences share
       the top row, and the wide cards below span the width. */
    <div className="space-y-4">
      {/* items-stretch, not items-start: the three cards in this row are meant to read as one
          band, and start let each one shrink to whatever it happened to contain. */}
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
      <div className={`h-full rounded-2xl ${cardBg} border p-5`}>
        {/* Heading first, then the details, with the picture beside them — the picture is the
            least of the three and was leading the card. */}
        <div className="mb-4 flex items-center gap-2">
          <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#701CC0]/10">
            <FiUser className="w-4 h-4 text-[#701CC0]" />
          </div>
        <h3 className={`text-[15px] font-semibold ${textPrimary}`}>Profile</h3>
        </div>
        {/* gap-3 and no flex-1 on the details: flex-1 let the name/email block absorb all the
            spare width in the card, which pinned the picture to the far right edge with a wide
            empty channel between the two. They belong together as one unit, so the details take
            their content width and the picture sits directly beside them. */}
        <div className="flex items-center gap-3">
          <div className="min-w-0">
            <div className="space-y-4">
              <div>
                <label className={`mb-1 block text-[11px] font-medium ${textSecondary}`}>Full Name</label>
                <div className="flex items-center gap-2">
                  <span className={`text-[13px] ${textPrimary}`}>{displayName}</span>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => { setName(user.name || ""); setIsEditingName(true); }}
                      className="text-[12.5px] font-medium text-[#701CC0] transition-colors hover:text-[#5f17a5]"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label className={`mb-1 block text-[11px] font-medium ${textSecondary}`}>Email</label>
                <div className="flex items-center gap-2">
                  <FiMail className={`h-3.5 w-3.5 ${textSecondary}`} />
                  <span className={`text-[13px] ${textSecondary}`}>{user.email || "No email"}</span>
                </div>
              </div>
            </div>

            {updateMessage && (
              <div
                className={`mt-4 p-3 rounded-xl border text-sm ${
                  updateMessage.type === "success"
                    ? "bg-green-500/10 border-green-500/20 text-green-600"
                    : "bg-red-500/10 border-red-500/20 text-red-600"
                }`}
              >
                {updateMessage.text}
              </div>
            )}
          </div>
          {/* mx-auto, so the leftover width in the row splits evenly either side of the picture
              and it lands halfway between the details and the card edge. flex-1 on the details
              put it hard right; nothing at all put it hard against the text. */}
          <div className="relative shrink-0 mx-auto" ref={avatarMenuRef}>
            <div className="relative inline-block">
              <ProfileImage
                src={user.image}
                alt={displayName}
                name={displayName}
                size={112}
                className={`ring-2 rounded-full ${isPanel ? "ring-gray-200" : "ring-[#701CC0]/30"}`}
                priority
                quality={100}
              />
              {!readOnly && (
              <button
                type="button"
                onClick={() => setShowAvatarMenu(!showAvatarMenu)}
                aria-label="Change profile picture"
                aria-expanded={showAvatarMenu}
                className="absolute bottom-0 right-0 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#701CC0] text-white ring-2 ring-white transition-colors hover:bg-[#5f17a5]"
              >
                <FiEdit3 className="h-4 w-4" />
              </button>
              )}
            </div>
            {showAvatarMenu && (
              <div
                role="menu"
                aria-label="Profile picture"
                className={`absolute right-0 top-full z-20 mt-1.5 w-[188px] rounded-xl border p-1 shadow-[0_10px_28px_-8px_rgba(16,24,40,0.22)] ${isDark ? "border-white/20 bg-[#2E0A4F]" : "border-[#E4E0EC] bg-white"}`}
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleImageUpload(file);
                    }
                    e.target.value = "";
                  }}
                  className="hidden"
                  id="image-upload"
                  disabled={isUpdating}
                />
                <label
                  htmlFor="image-upload"
                  className={`flex h-8 cursor-pointer items-center gap-2.5 whitespace-nowrap rounded-md px-2.5 text-[13px] transition-colors ${isDark ? "text-white hover:bg-white/10" : "text-[#374151] hover:bg-[#F5F3F9]"} ${isUpdating ? "cursor-not-allowed opacity-45" : ""}`}
                >
                  <FiUpload className={`h-3.5 w-3.5 shrink-0 ${isDark ? "" : "text-[#9CA3AF]"}`} />
                  {isUpdating ? "Uploading..." : "Upload Image"}
                </label>
                {user.image && (
                  <button
                    onClick={handleImageReset}
                    disabled={isUpdating}
                    className={`flex h-8 w-full items-center gap-2.5 whitespace-nowrap rounded-md px-2.5 text-left text-[13px] transition-colors ${isDark ? "text-white hover:bg-white/10" : "text-[#374151] hover:bg-[#F5F3F9]"} ${isUpdating ? "cursor-not-allowed opacity-45" : ""}`}
                  >
                    <FiRotateCcw className={`h-3.5 w-3.5 shrink-0 ${isDark ? "" : "text-[#9CA3AF]"}`} />
                    {isUpdating ? "Resetting..." : "Reset To Default"}
                  </button>
                )}
              </div>
            )}
          </div>

        </div>
      </div>


        {/* Shown on a client's page too, not just your own. Every control inside is already
            disabled under readOnly, so a staff member reads the client's settings without being
            able to change them — which is what the page was for. Hiding the whole card instead
            left Settings with a single Profile box and looked broken. */}
        <div className={`h-full rounded-2xl ${cardBg} border p-5`}>
          <div className="flex items-center gap-2 mb-5">
            <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#701CC0]/10">
              <FiShield className="w-4 h-4 text-[#701CC0]" />
            </div>
            <h3 className={`text-[15px] font-semibold ${textPrimary}`}>Security</h3>
          </div>

          {settingsUnavailable ? (
            <p className={`text-[13px] ${textSecondary}`}>
              This client&rsquo;s settings could not be loaded.
            </p>
          ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className={`text-[13px] font-medium ${textPrimary}`}>Email Notifications</p>
                <p className={`text-[12px] ${textSecondary}`}>Receive updates and alerts.</p>
              </div>
              <Toggle
                checked={settings.emailNotifications}
                onChange={(v) => handleSettingsUpdate({ emailNotifications: v })}
                disabled={!settingsEditable || isUpdating || isLoadingSettings}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className={`text-[13px] font-medium ${textPrimary}`}>Two-Factor Authentication</p>
                <p className={`text-[12px] ${textSecondary}`}>Coming soon.</p>
              </div>
              <Toggle
                checked={settings.twoFactorEnabled}
                onChange={(v) => handleSettingsUpdate({ twoFactorEnabled: v })}
                disabled
              />
            </div>
            {/* A hairline is enough to separate an action from the toggles above it; the rule
                plus a full row of padding read as a gap in the card. Sized like Add account. */}
            {!readOnly && (
            <div className={`mt-1 border-t pt-3 ${isDark ? "border-white/10" : "border-[#EEF1F7]"}`}>
              <button
                type="button"
                onClick={() => setShowPasswordModal(true)}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#701CC0] px-3 text-[12.5px] font-medium text-white transition-colors hover:bg-[#5f17a5]"
              >
                <FiLock className="h-3.5 w-3.5" />
                Change Password
              </button>
            </div>
            )}
          </div>
          )}
        </div>

        <div className={`h-full rounded-2xl ${cardBg} border p-5`}>
          <div className="flex items-center gap-2 mb-5">
            <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#701CC0]/10">
              <FiSettings className="w-4 h-4 text-[#701CC0]" />
            </div>
            <h3 className={`text-[15px] font-semibold ${textPrimary}`}>Preferences</h3>
          </div>

          {settingsUnavailable ? (
            <p className={`text-[13px] ${textSecondary}`}>
              This client&rsquo;s settings could not be loaded.
            </p>
          ) : (
          <div className="space-y-4">
            <div>
              <label className={`mb-1.5 block text-[11px] font-medium ${textSecondary}`}>Theme</label>
              <span className="relative block"><select
                className={`h-9 w-full appearance-none rounded-[10px] border px-3 pr-9 text-[13px] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#701CC0]/35 disabled:cursor-not-allowed disabled:opacity-60 ${inputBg} ${textPrimary}`}
                value={settings.theme}
                onChange={(e) => handleSettingsUpdate({ theme: e.target.value })}
                disabled={!settingsEditable || isUpdating || isLoadingSettings}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="auto">System</option>
              </select><FiChevronDown className={`pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${textSecondary}`} aria-hidden />
            </span>
            </div>
            <div>
              <label className={`mb-1.5 block text-[11px] font-medium ${textSecondary}`}>Language</label>
              <span className="relative block"><select
                className={`h-9 w-full appearance-none rounded-[10px] border px-3 pr-9 text-[13px] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#701CC0]/35 disabled:cursor-not-allowed disabled:opacity-60 ${inputBg} ${textPrimary}`}
                value={settings.language}
                onChange={(e) => handleSettingsUpdate({ language: e.target.value })}
                disabled={!settingsEditable || isUpdating || isLoadingSettings}
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="it">Italian</option>
                <option value="pt">Portuguese</option>
                <option value="ru">Russian</option>
                <option value="zh">Chinese</option>
                <option value="ja">Japanese</option>
                <option value="ko">Korean</option>
              </select><FiChevronDown className={`pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${textSecondary}`} aria-hidden />
            </span>
            </div>
          </div>
          )}
        </div>
      </div>

      {userRole === "user" && (
        <>
          {/* Read from Stripe, not from our own copy: a card is replaced and a renewal is turned
              off on Stripe's pages, and a mirrored value here would be stale the moment either
              happened. Managing any of it goes through the billing portal for the same reason —
              card details never touch this application. */}
          <div className={`rounded-2xl ${cardBg} border p-5`}>
            <div className="mb-5 flex items-center gap-2">
              <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#701CC0]/10">
                <FiCreditCard className="h-4 w-4 text-[#701CC0]" />
              </div>
              <h3 className={`font-semibold ${textPrimary}`}>Payment</h3>
            </div>
            {billingLoading ? (
              <div className="space-y-3">
                <div className={`h-4 w-56 animate-pulse rounded ${skeletonTint}`} />
                <div className={`h-4 w-40 animate-pulse rounded ${skeletonTint}`} />
              </div>
            ) : !billing?.connected ? (
              <p className={`text-sm ${textSecondary}`}>
                No payment method on file yet. Invoices are sent by email until one is added.
              </p>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className={`mb-1 text-[11px] font-medium ${textSecondary}`}>On File</p>
                  {billing.paymentMethods.length === 0 ? (
                    <p className={`text-sm ${textPrimary}`}>Nothing on file — paid by invoice.</p>
                  ) : (
                    <ul className="space-y-1">
                      {billing.paymentMethods.map((method) => (
                        <li key={method.id} className={`text-sm ${textPrimary}`}>
                          {method.type === "card"
                            ? `${(method.brand || "Card").replace(/^./, (c) => c.toUpperCase())} ending ${method.last4 ?? "••••"}`
                            : `${method.bankName || "Bank account"} ending ${method.last4 ?? "••••"}`}
                          {method.expMonth && method.expYear
                            ? ` · expires ${String(method.expMonth).padStart(2, "0")}/${method.expYear}`
                            : ""}
                          {method.isDefault ? " · default" : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <p className={`mb-1 text-[11px] font-medium ${textSecondary}`}>Automatic Renewal</p>
                  <p className={`text-sm ${textPrimary}`}>
                    {!billing.subscription
                      ? "No subscription — invoiced manually."
                      : billing.subscription.cancelAtPeriodEnd
                        ? `Off. Access ends ${billing.subscription.currentPeriodEnd ? new Date(billing.subscription.currentPeriodEnd).toLocaleDateString() : "at the end of this period"}.`
                        : `On. Renews ${billing.subscription.currentPeriodEnd ? new Date(billing.subscription.currentPeriodEnd).toLocaleDateString() : "each period"}.`}
                  </p>
                </div>

                {!readOnly && (
                <div className="space-y-1.5">
                  {/* The portal covers the billing details as well as the card now, so the label
                      no longer promises only one of the two. */}
                  <button
                    type="button"
                    onClick={() => void openBillingPortal()}
                    disabled={openingPortal}
                    className="inline-flex h-9 items-center gap-2 rounded-[10px] bg-[#701CC0] px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-[#5f17a5] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {openingPortal ? "Opening…" : "Manage Billing"}
                  </button>
                  <p className={`text-[12px] ${textSecondary}`}>
                    Update your card, billing address, company name, billing email or tax ID on
                    Stripe&rsquo;s secure pages.
                  </p>
                </div>
                )}
                {billingPortalError && <p className="text-[13px] text-[#B42318]">{billingPortalError}</p>}
              </div>
            )}
          </div>

          {readOnly ? (
            /* The client's own connections. The Social Connections card below reads the signed-in
               user's status routes, which on this page is the staff member looking at it — their
               accounts under someone else's name. This card is fed by /api/client/settings, which
               is scoped to the client. */
            /* Same SettingsCard chrome, heading and account rows as the Google Accounts card on
               your own settings page, so the two read as one design rather than two. What differs
               is only what a staff member may do: no "Add account", no Reconnect, no Remove —
               those are OAuth grants only the account holder can make. */
            <SettingsCard
              title="Google Accounts"
              icon={<FaGoogle className="w-4 h-4 text-[#EA4335]" />}
              description="Connected Google accounts, mailboxes and platforms for this client."
              cardClass={`rounded-2xl ${cardBg} border p-5`}
              titleClass={textPrimary}
              descriptionClass={textSecondary}
            >
              {!clientConnections ? (
                <p className={`text-[13px] ${textSecondary}`}>
                  This client&rsquo;s connections could not be loaded.
                </p>
              ) : (
                <div className="space-y-5">
                  {clientConnections.google.length === 0 ? (
                    <p className={`text-[13px] ${textSecondary}`}>No Google accounts connected yet.</p>
                  ) : (
                    <div className={`divide-y ${isDark ? "divide-white/10" : "divide-[#E6E2EE]"}`}>
                      {/* One Google grant covers Gmail and Calendar both — the calendar routes
                          read the same token — so this is one row, not two connections. */}
                      {clientConnections.google.map((account) => (
                        <div key={account.email} className="py-3.5 first:pt-0 last:pb-0">
                          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                            <div className="flex min-w-0 items-center gap-2.5">
                              <span className={`truncate text-[13px] font-medium ${textPrimary}`}>
                                {account.email}
                              </span>
                              <span
                                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                  account.needsReconnect
                                    ? "bg-[#FDF3E2] text-[#8A5A00]"
                                    : "bg-[#E7F7EE] text-[#11734B]"
                                }`}
                              >
                                {account.needsReconnect ? "Needs reconnect" : "Connected"}
                              </span>
                            </div>
                            <span className={`shrink-0 text-[12px] ${textSecondary}`}>
                              Gmail and Calendar
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div>
                    <p className={`mb-1.5 text-[11px] font-medium ${textSecondary}`}>
                      Workspace Mailboxes
                    </p>
                    {clientConnections.mailboxes.length === 0 ? (
                      <p className={`text-[13px] ${textSecondary}`}>No mailbox attached.</p>
                    ) : (
                      <ul className="space-y-1">
                        {clientConnections.mailboxes.map((mailbox) => (
                          <li key={mailbox.email} className={`text-[13px] ${textPrimary}`}>
                            {mailbox.email}
                            {mailbox.label ? <span className={textSecondary}> · {mailbox.label}</span> : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <p className={`mb-1.5 text-[11px] font-medium ${textSecondary}`}>Other Platforms</p>
                    <ul className="space-y-1">
                      {([
                        ["LinkedIn", clientConnections.linkedin],
                        ["Facebook", clientConnections.facebook],
                        ["Google Ads", clientConnections.googleads],
                      ] as const).map(([label, connected]) => (
                        <li key={label} className={`flex items-center justify-between text-[13px] ${textPrimary}`}>
                          <span>{label}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              connected ? "bg-[#E7F7EE] text-[#11734B]" : "bg-[#F3F1F8] text-[#5B5468]"
                            }`}
                          >
                            {connected ? "Connected" : "Not connected"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </SettingsCard>
          ) : (
          <div className={`rounded-2xl ${cardBg} border p-5`}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#701CC0]/10">
                  <FiRefreshCw className="w-4 h-4 text-[#701CC0]" />
                </div>
                <h3 className={`font-semibold ${textPrimary}`}>Social Connections</h3>
              </div>
              <button
                type="button"
                onClick={loadSocialConnections}
                disabled={socialLoading}
                className="text-sm px-3 py-1.5 rounded-lg border border-[#E5E7EB] text-[#374151] hover:bg-gray-50 disabled:opacity-50"
              >
                {socialLoading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
            <p className={`text-sm ${textSecondary} mb-4`}>
              Reconnect your social media accounts if tokens expire or posting access changes.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                {
                  key: "linkedin",
                  label: "LinkedIn",
                  path: "/api/linkedin/initiate?from=settings",
                  connected: socialConnections.linkedin,
                  icon: <FaLinkedinIn className="w-3.5 h-3.5 text-white" />,
                  iconBg: "bg-[#0A66C2]",
                  disabled: false,
                },
                {
                  key: "facebook",
                  label: "Facebook",
                  path: "/api/facebook/initiate",
                  connected: socialConnections.facebook,
                  icon: <FaFacebookF className="w-3.5 h-3.5 text-white" />,
                  iconBg: "bg-[#1877F2]",
                  disabled: true,
                },
                {
                  key: "googleads",
                  label: "Google Ads",
                  path: "/api/googleads/initiate",
                  connected: socialConnections.googleads,
                  icon: <FaGoogle className="w-3.5 h-3.5 text-white" />,
                  iconBg: "bg-[#EA4335]",
                  disabled: true,
                },
              ].map((item) => (
                <div
                  key={item.key}
                  className={`rounded-xl border p-4 ${
                    item.disabled
                      ? "border-[#E5E7EB] bg-[#F3F4F6] opacity-70"
                      : isDark
                        ? "border-white/10 bg-white/5"
                        : "border-[#E5E7EB] bg-[#FAFAFA]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-6 h-6 rounded-md inline-flex items-center justify-center ${item.iconBg}`}>
                        {item.icon}
                      </span>
                      <span className={`text-sm font-medium ${textPrimary}`}>{item.label}</span>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        item.disabled
                          ? "bg-gray-200 text-gray-700"
                          : item.connected
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {item.disabled ? "Disabled" : item.connected ? "Connected" : "Not Connected"}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={item.disabled}
                    onClick={() => window.open(item.path, "_blank", "noopener,noreferrer")}
                    className={`w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      item.disabled
                        ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                        : "bg-[#701CC0] text-white hover:bg-[#5f17a5]"
                    }`}
                  >
                    {item.disabled ? "Disabled" : "Reconnect"}
                  </button>
                </div>
              ))}
            </div>
          </div>
          )}

        </>
      )}

      {/* One card, not two.
          Connected accounts were listed here as a grid of small tiles whose emails were truncated
          to "alex…", and then listed again below under "Detected Google Calendars" — same
          addresses, same status pills, twice. A calendar belongs to an account, so each account is
          one row and its calendars sit under it. */}
      {canManageGmailAccounts && (
        <SettingsCard
          title="Google Accounts"
          icon={<FaGoogle className="w-4 h-4 text-[#EA4335]" />}
          description="Connected Google accounts, and which of their calendars count towards upcoming meetings."
          cardClass={`rounded-2xl ${cardBg} border p-5`}
          titleClass={textPrimary}
          descriptionClass={textSecondary}
          action={
            <div className="flex items-center gap-2">
              {/* No Refresh: the list loads on open and again after connecting or removing an
                  account, which is every moment it could be out of date. */}
              <button
                type="button"
                onClick={() => window.open(`/api/gmail/initiate?from=${encodeURIComponent(gmailSettingsSource)}`, "_self")}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#701CC0] px-3 text-[12.5px] font-medium text-white transition-colors hover:bg-[#5f17a5]"
              >
                <FiPlus className="w-3.5 h-3.5" />
                Add account
              </button>
            </div>
          }
        >
          {gmailLoading && gmailAccounts.length === 0 ? (
            /* Said "none connected" while the request was still out, which read as an answer. */
            <p className={`text-[13px] ${textSecondary}`}>Loading accounts…</p>
          ) : gmailAccounts.length === 0 ? (
            <p className={`text-[13px] ${textSecondary}`}>No Google accounts connected yet.</p>
          ) : (
            <div className={`divide-y ${isDark ? "divide-white/10" : "divide-[#E6E2EE]"}`}>
              {gmailAccounts.map((account) => {
                const calendarAccount = detectedCalendarAccounts.find((entry) => entry.email === account.email);
                const calendars = calendarAccount?.calendars ?? [];
                return (
                  <div key={account.email} className="py-3.5 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                      <div className="flex min-w-0 items-center gap-2.5">
                        {/* The full address, not the first four characters of it. */}
                        <span className={`truncate text-[13px] font-medium ${textPrimary}`}>{account.email}</span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            account.connected ? "bg-[#E7F7EE] text-[#11734B]" : "bg-[#FDF3E2] text-[#8A5A00]"
                          }`}
                        >
                          {account.connected ? "Connected" : "Needs reconnect"}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            window.open(
                              `/api/gmail/initiate?from=${encodeURIComponent(gmailSettingsSource)}&account=${encodeURIComponent(account.email)}`,
                              "_self"
                            )
                          }
                          /* Outlined and inline-flex: as bare text on a bare background it read as
                             a label rather than a control, and without the flex centring its text
                             sat on its own baseline instead of on the trash icon's centre line.
                             Both are h-8 now and share one border treatment. */
                          className={`inline-flex h-8 items-center rounded-lg border px-3 text-[12.5px] font-medium transition-colors ${
                            isDark
                              ? "border-white/25 text-white hover:border-white/40 hover:bg-white/10"
                              : "border-[#D8D2E4] text-[#374151] hover:border-[#701CC0]/45 hover:bg-[#F5F3F9]"
                          }`}
                        >
                          Reconnect
                        </button>
                        <button
                          type="button"
                          onClick={() => openDeleteGmailModal(account.email)}
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
                            isDark
                              ? "border-white/25 text-white/70 hover:border-red-400/60 hover:bg-red-500/10 hover:text-red-300"
                              : "border-[#D8D2E4] text-[#9CA3AF] hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                          }`}
                          aria-label={`Remove Gmail account ${account.email}`}
                          title="Remove account"
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {calendarSettingsLoading && calendars.length === 0 ? (
                      <p className={`mt-1.5 text-[12px] ${textSecondary}`}>Loading calendars…</p>
                    ) : calendars.length === 0 ? null : (
                      <ul className="mt-2 space-y-1">
                        {[...calendars]
                          .sort(
                            (a, b) =>
                              Number(b.enabled) - Number(a.enabled) ||
                              a.summary.localeCompare(b.summary)
                          )
                          .map((calendar) => {
                          const toggleKey = `${account.email}::${calendar.id}`;
                          return (
                            <li key={toggleKey} className="flex items-center justify-between gap-3 py-0.5 pl-1">
                              <div className="flex min-w-0 items-center gap-2">
                                <FiCalendar className={`w-3.5 h-3.5 shrink-0 ${textSecondary}`} />
                                <span className={`truncate text-[12.5px] ${textPrimary}`}>{calendar.summary}</span>
                              </div>
                              <Toggle
                                checked={calendar.enabled}
                                onChange={(value) => handleCalendarToggle(account.email, calendar.id, value)}
                                disabled={calendarToggleKeyLoading === toggleKey}
                              />
                            </li>
                          );
                          })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </SettingsCard>
      )}

      {/* Sign out lives here, not on the nav rail: the rail is for navigation, and a destructive
          action sitting one row below it was easy to mis-click. */}
      {!readOnly && (
      <div className={`rounded-2xl ${cardBg} border p-5`}>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h3 className={`text-[15px] font-semibold ${textPrimary}`}>Sign Out</h3>
            <p className={`text-[13px] ${textSecondary} mt-0.5`}>Ends your session on this device.</p>
          </div>
          {/* Solid red, and the same height and radius as every other button in the panel. The
              outlined version was a white box with a hairline that read as disabled next to the
              filled buttons it sits among, for the one action on the page that ends the session. */}
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-[10px] bg-[#B42318] px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-[#8f1c12] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B42318]"
          >
            <FiLogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </div>
      )}
    </div>
  );

  return (
    <div className={`w-full h-full ${pageBg} text-[#111014] flex flex-col`}>
      
      {isPanel && (
        <div className="flex-1 px-8 lg:px-14 pt-1 overflow-x-hidden">
          <div className="mx-auto w-full max-w-[1680px] flex flex-col h-full">
            <h1 className="text-[30px] leading-[1.15] font-semibold tracking-[-0.025em] text-[#111827] mt-8 mb-6">
              Account Settings
            </h1>
            <div className="pb-8">
              {isLoadingSettings ? cardsSkeleton : cardsContent}
            </div>
          </div>
        </div>
      )}

      
      {isDark && (
        <>
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
            <h1 className="text-xl font-semibold text-white">Account Settings</h1>
            {onClose && (
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-white" aria-label="Close settings">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="max-w-2xl mx-auto">
              {isLoadingSettings ? cardsSkeleton : cardsContent}
            </div>
          </div>
        </>
      )}

      
      {cropImageSrc && (
        <ImageCropModal
          imageSrc={cropImageSrc}
          onComplete={(blob) => uploadImageBlob(blob)}
          onCancel={() => setCropImageSrc(null)}
        />
      )}

      
      {showSuccessModal && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[200] p-4" 
          role="dialog" 
          aria-modal="true"
          onClick={(e) => e.target === e.currentTarget && (setShowSuccessModal(false), setIsPasswordChangeSuccess(false))}
        >
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col items-center text-center">
              <div className="relative mb-4 inline-flex h-16 w-16 items-center justify-center">
                <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-30 animate-ping" />
                <span className="relative inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <FiCheck className="h-8 w-8 text-green-600" />
                </span>
              </div>
              <h3 className="text-lg font-semibold text-[#111827] mb-2">
                {isPasswordChangeSuccess ? "Password Changed!" : "Settings Saved!"}
              </h3>
              <p className="text-sm text-[#6B7280] mb-6">
                {isPasswordChangeSuccess 
                  ? "Redirecting To Login..."
                  : "Your changes have been saved."
                }
              </p>
              <button
                className="w-full rounded-xl px-4 py-2.5 bg-[#701CC0] text-white hover:bg-[#5f17a5] text-sm font-medium transition-colors"
                onClick={() => { setShowSuccessModal(false); setIsPasswordChangeSuccess(false); }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      
      {isEditingName && (
        <Modal
          zIndexClass="z-50"
          backdropClassName="bg-black/50 backdrop-blur-sm"
          cardClassName="bg-white rounded-2xl shadow-xl p-6 max-w-lg w-full mx-4"
          label="Edit Name"
          onClose={() => setIsEditingName(false)}
        >
          <PanelModalHeader title="Edit Name" onClose={() => setIsEditingName(false)} />

          <div>
            <PanelFieldLabel required>Full Name</PanelFieldLabel>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={PANEL_FIELD}
              placeholder="Bidoof Sanchez"
              autoFocus
            />
          </div>

          {updateMessage?.type === "error" && (
            <p role="alert" className="mt-4 text-[13px] text-[#B42318]">{updateMessage.text}</p>
          )}

          <PanelModalFooter
            onCancel={() => {
              setName(user.name || "");
              setIsEditingName(false);
              setUpdateMessage(null);
            }}
            onConfirm={() => void handleNameUpdate()}
            confirmLabel={isUpdating ? "Saving…" : "Save Name"}
            confirmDisabled={isUpdating || name.trim() === ""}
          />
        </Modal>
      )}

      {showPasswordModal && (
        <Modal
          zIndexClass="z-50"
          backdropClassName="bg-black/50 backdrop-blur-sm"
          cardClassName="bg-white rounded-2xl shadow-xl p-6 max-w-lg w-full mx-4"
          label="Change Password"
          onClose={closePasswordModal}
        >
          <PanelModalHeader title="Change Password" onClose={closePasswordModal} />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <PanelFieldLabel required>Current Password</PanelFieldLabel>
              <input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={passwordData.currentPassword}
                onChange={(e) => handlePasswordFieldChange("currentPassword", e.target.value)}
                className={passwordFieldErrors.currentPassword ? PANEL_FIELD_INVALID : PANEL_FIELD}
              />
              {passwordFieldErrors.currentPassword && (
                <p className="mt-1 text-[12px] text-[#B42318]">{passwordFieldErrors.currentPassword}</p>
              )}
            </div>

            <div>
              <PanelFieldLabel required>New Password</PanelFieldLabel>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={passwordData.newPassword}
                onChange={(e) => handlePasswordFieldChange("newPassword", e.target.value)}
                className={passwordFieldErrors.newPassword ? PANEL_FIELD_INVALID : PANEL_FIELD}
              />
              {passwordFieldErrors.newPassword && (
                <p className="mt-1 text-[12px] text-[#B42318]">{passwordFieldErrors.newPassword}</p>
              )}
            </div>

            <div>
              <PanelFieldLabel required>Confirm New Password</PanelFieldLabel>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={passwordData.confirmPassword}
                onChange={(e) => handlePasswordFieldChange("confirmPassword", e.target.value)}
                className={passwordFieldErrors.confirmPassword ? PANEL_FIELD_INVALID : PANEL_FIELD}
              />
              {passwordFieldErrors.confirmPassword && (
                <p className="mt-1 text-[12px] text-[#B42318]">{passwordFieldErrors.confirmPassword}</p>
              )}
            </div>
          </div>

          {/* The catch branch files its message under `general`; naming it anything else here
              would have swallowed every unexpected failure silently. */}
          {passwordFieldErrors.general && (
            <p role="alert" className="mt-4 text-[13px] text-[#B42318]">{passwordFieldErrors.general}</p>
          )}

          <PanelModalFooter
            onCancel={closePasswordModal}
            onConfirm={() => void handlePasswordChange()}
            confirmLabel={isUpdating ? "Updating…" : "Update Password"}
            confirmDisabled={
              isUpdating ||
              !passwordData.currentPassword ||
              !passwordData.newPassword ||
              !passwordData.confirmPassword
            }
          />
        </Modal>
      )}

      {showDeleteGmailModal && (
        <ConfirmActionModal
          isOpen={showDeleteGmailModal}
          title="Remove Gmail Account"
          message={
            <>
              Are you sure you want to remove{" "}
              <span className="font-semibold text-[#111827]">{gmailToDelete || ""}</span>? This will remove the saved
              Gmail authorization for this account.
            </>
          }
          confirmLabel={isDeletingGmail ? "Removing..." : "Remove Account"}
          onConfirm={handleDeleteGmailAccount}
          onCancel={closeDeleteGmailModal}
        />
      )}
    </div>
  );
};

export default UserSettingsPage;
