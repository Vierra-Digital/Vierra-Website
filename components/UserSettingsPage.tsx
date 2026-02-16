import React, { useState, useEffect, useRef } from "react";
import { signOut } from "next-auth/react";
import ProfileImage from "./ProfileImage";
import ImageCropModal from "./ImageCropModal";
import { FiEdit3, FiUpload, FiRotateCcw, FiLock, FiLogOut, FiUser, FiMail, FiShield, FiSettings, FiCheck } from "react-icons/fi";
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
}

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

const UserSettingsPage: React.FC<UserSettingsPageProps> = ({ user, onNameUpdate, onImageUpdate, onClose, variant = "panel" }) => {
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

  const avatarMenuRef = useRef<HTMLDivElement>(null);
  const displayName = name && name.trim().length > 0 ? name : (user.email ? user.email.split("@")[0] : "User");

  useEffect(() => {
    setName(user.name || "");
  }, [user.name]);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch("/api/profile/getSettings");
        if (response.ok) {
          const settingsData = await response.json();
          setSettings(settingsData);
        }
      } catch (error) {
        console.error("Failed to load settings:", error);
      } finally {
        setIsLoadingSettings(false);
      }
    };
    loadSettings();
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
      const response = await fetch("/api/profile/updateSettings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSettings),
      });

      if (!response.ok) {
        throw new Error("Failed to update settings");
      }

      const result = await response.json();
      setSettings(result);
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

  const isDark = variant === "dark";
  const isPanel = variant === "panel";
  const cardBg = isDark ? "bg-[#2E0A4F]/90 border-white/10" : "bg-white border-gray-100";
  const textPrimary = isDark ? "text-white" : "text-[#111827]";
  const textSecondary = isDark ? "text-white/70" : "text-[#6B7280]";
  const inputBg = isDark ? "bg-white/10 border-white/20 text-white placeholder-white/50" : "bg-white border-[#E5E7EB]";
  const pageBg = isDark ? "bg-transparent" : "bg-white";

  const cardsContent = (
    <div className="space-y-6">
      
      <div className={`rounded-xl ${cardBg} border p-6 shadow-sm`}>
        <div className="flex flex-col sm:flex-row gap-6">
          <div className="relative flex-shrink-0 self-start" ref={avatarMenuRef}>
            <div className="relative inline-block">
              <ProfileImage
                src={user.image}
                alt={displayName}
                name={displayName}
                size={96}
                className={`ring-2 rounded-full ${isPanel ? "ring-gray-200" : "ring-[#701CC0]/30"}`}
                priority
                quality={100}
              />
              <button
                onClick={() => setShowAvatarMenu(!showAvatarMenu)}
                className="absolute bottom-0 right-0 bg-[#701CC0] text-white rounded-full p-2 hover:bg-[#5f17a5] transition-colors shadow-lg"
              >
                <FiEdit3 className="w-4 h-4" />
              </button>
            </div>
            {showAvatarMenu && (
              <div className={`absolute top-full left-0 mt-2 w-48 rounded-xl shadow-xl border py-2 z-20 ${isDark ? "bg-[#2E0A4F] border-white/20" : "bg-white border-gray-100"}`}>
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
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm cursor-pointer transition-colors ${isDark ? "hover:bg-white/10 text-white" : "hover:bg-gray-50 text-[#111827]"} ${isUpdating ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <FiUpload className="w-4 h-4" />
                  {isUpdating ? "Uploading..." : "Upload Image"}
                </label>
                {user.image && (
                  <button
                    onClick={handleImageReset}
                    disabled={isUpdating}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm w-full text-left transition-colors ${isDark ? "hover:bg-white/10 text-white" : "hover:bg-gray-50 text-[#111827]"} ${isUpdating ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <FiRotateCcw className="w-4 h-4" />
                    {isUpdating ? "Resetting..." : "Reset To Default"}
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-lg bg-[#701CC0]/10">
                <FiUser className="w-4 h-4 text-[#701CC0]" />
              </div>
              <h3 className={`font-semibold ${textPrimary}`}>Profile</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium ${textSecondary} mb-1`}>Full Name</label>
                {isEditingName ? (
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={`flex-1 min-w-[180px] rounded-xl px-4 py-2.5 border focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent ${inputBg}`}
                      placeholder="Enter your name"
                      autoFocus
                    />
                    <button
                      onClick={handleNameUpdate}
                      disabled={isUpdating}
                      className="px-4 py-2.5 bg-[#701CC0] text-white rounded-xl hover:bg-[#5f17a5] disabled:opacity-50 text-sm font-medium transition-colors"
                    >
                      {isUpdating ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={() => { setName(user.name || (user.email ? user.email.split("@")[0] : "") || ""); setIsEditingName(false); setUpdateMessage(null); }}
                      className="px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 text-sm font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className={textPrimary}>{displayName}</span>
                    <button
                      onClick={() => setIsEditingName(true)}
                      className="text-[#701CC0] hover:text-[#5f17a5] text-sm font-medium transition-colors"
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>
              <div>
                <label className={`block text-sm font-medium ${textSecondary} mb-1`}>Email</label>
                <div className="flex items-center gap-2">
                  <FiMail className={`w-4 h-4 ${textSecondary}`} />
                  <span className={textSecondary}>{user.email || "No email"}</span>
                </div>
              </div>
            </div>

            {updateMessage?.type === "error" && (
              <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 text-sm">
                {updateMessage.text}
              </div>
            )}
          </div>
        </div>
      </div>

      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <div className={`rounded-xl ${cardBg} border p-6 shadow-sm`}>
          <div className="flex items-center gap-2 mb-5">
            <div className="p-1.5 rounded-lg bg-[#701CC0]/10">
              <FiShield className="w-4 h-4 text-[#701CC0]" />
            </div>
            <h3 className={`font-semibold ${textPrimary}`}>Security</h3>
          </div>

          <div className="space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className={`font-medium ${textPrimary}`}>Email Notifications</p>
                <p className={`text-sm ${textSecondary}`}>Receive updates and alerts.</p>
              </div>
              <Toggle
                checked={settings.emailNotifications}
                onChange={(v) => handleSettingsUpdate({ emailNotifications: v })}
                disabled={isUpdating || isLoadingSettings}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className={`font-medium ${textPrimary}`}>Two-Factor Authentication</p>
                <p className={`text-sm ${textSecondary}`}>Extra security layer.</p>
              </div>
              <Toggle
                checked={settings.twoFactorEnabled}
                onChange={(v) => handleSettingsUpdate({ twoFactorEnabled: v })}
                disabled={isUpdating || isLoadingSettings}
              />
            </div>
            <div className={`pt-4 border-t ${isDark ? "border-white/10" : "border-gray-100"}`}>
              <button
                onClick={() => setShowPasswordModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#701CC0] text-white rounded-xl hover:bg-[#5f17a5] text-sm font-medium transition-colors"
              >
                <FiLock className="w-4 h-4" />
                Change Password
              </button>
            </div>
          </div>
        </div>

        
        <div className={`rounded-xl ${cardBg} border p-6 shadow-sm`}>
          <div className="flex items-center gap-2 mb-5">
            <div className="p-1.5 rounded-lg bg-[#701CC0]/10">
              <FiSettings className="w-4 h-4 text-[#701CC0]" />
            </div>
            <h3 className={`font-semibold ${textPrimary}`}>Preferences</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className={`block text-sm font-medium ${textSecondary} mb-2`}>Theme</label>
              <select
                className={`w-full rounded-xl px-4 py-2.5 border focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent appearance-none ${inputBg} ${textPrimary}`}
                value={settings.theme}
                onChange={(e) => handleSettingsUpdate({ theme: e.target.value })}
                disabled={isUpdating || isLoadingSettings}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="auto">System</option>
              </select>
            </div>
            <div>
              <label className={`block text-sm font-medium ${textSecondary} mb-2`}>Language</label>
              <select
                className={`w-full rounded-xl px-4 py-2.5 border focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent appearance-none ${inputBg} ${textPrimary}`}
                value={settings.language}
                onChange={(e) => handleSettingsUpdate({ language: e.target.value })}
                disabled={isUpdating || isLoadingSettings}
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
              </select>
            </div>
          </div>
        </div>
      </div>

      
      <div className={`rounded-xl ${cardBg} border p-6 shadow-sm`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className={`font-semibold ${textPrimary}`}>Sign Out</h3>
            <p className={`text-sm ${textSecondary} mt-0.5`}>Sign out of your account on this device.</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 text-sm font-medium transition-colors shrink-0"
          >
            <FiLogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`w-full h-full ${pageBg} text-[#111014] flex flex-col`}>
      
      {isPanel && (
        <div className="flex-1 flex justify-center px-6 pt-2">
          <div className="w-full max-w-6xl flex flex-col h-full">
            <div className="w-full flex justify-between items-center mb-2">
              <div>
                <h1 className="text-2xl font-semibold text-[#111827] mt-6 mb-6">Account Settings</h1>
              </div>
            </div>
            <div className="pb-16">
              {cardsContent}
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
              {cardsContent}
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
                  ? "You will be logged out shortly."
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

      
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={closePasswordModal}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-[#E5E7EB]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#E5E7EB]">
              <div>
                <h2 className="text-lg font-semibold text-[#111827]">Change Password</h2>
                <p className="text-sm text-[#6B7280] mt-0.5">Update your account password</p>
              </div>
              <button 
                onClick={closePasswordModal}
                className="p-2 rounded-lg text-[#6B7280] hover:text-red-600 hover:bg-red-50 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {passwordFieldErrors.general && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                  {passwordFieldErrors.general}
                </div>
              )}

              <div>
                <label htmlFor="current-password" className="block text-sm font-medium text-[#374151] mb-1.5">Current Password</label>
                <input
                  id="current-password"
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => handlePasswordFieldChange("currentPassword", e.target.value)}
                  className={`w-full rounded-xl px-4 py-2.5 text-sm border focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent ${
                    passwordFieldErrors.currentPassword ? "border-red-500 bg-red-50" : "border-[#E5E7EB]"
                  }`}
                  placeholder="Enter current password"
                />
                {passwordFieldErrors.currentPassword && (
                  <p className="mt-1 text-sm text-red-600">{passwordFieldErrors.currentPassword}</p>
                )}
              </div>
              
              <div>
                <label htmlFor="new-password" className="block text-sm font-medium text-[#374151] mb-1.5">New Password</label>
                <input
                  id="new-password"
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => handlePasswordFieldChange("newPassword", e.target.value)}
                  className={`w-full rounded-xl px-4 py-2.5 text-sm border focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent ${
                    passwordFieldErrors.newPassword ? "border-red-500 bg-red-50" : "border-[#E5E7EB]"
                  }`}
                  placeholder="Enter new password"
                />
                {passwordFieldErrors.newPassword && (
                  <p className="mt-1 text-sm text-red-600">{passwordFieldErrors.newPassword}</p>
                )}
              </div>
              
              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-[#374151] mb-1.5">Confirm New Password</label>
                <input
                  id="confirm-password"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => handlePasswordFieldChange("confirmPassword", e.target.value)}
                  className={`w-full rounded-xl px-4 py-2.5 text-sm border focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent ${
                    passwordFieldErrors.confirmPassword ? "border-red-500 bg-red-50" : "border-[#E5E7EB]"
                  }`}
                  placeholder="Confirm new password"
                />
                {passwordFieldErrors.confirmPassword && (
                  <p className="mt-1 text-sm text-red-600">{passwordFieldErrors.confirmPassword}</p>
                )}
              </div>
            </div>

            <div className="px-6 py-4 bg-[#F9FAFB] border-t border-[#E5E7EB] rounded-b-2xl flex justify-end gap-3">
              <button
                onClick={closePasswordModal}
                disabled={isUpdating}
                className="px-4 py-2.5 border border-[#E5E7EB] rounded-xl text-[#374151] hover:bg-[#F3F4F6] text-sm font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handlePasswordChange}
                disabled={isUpdating}
                className="px-4 py-2.5 bg-[#701CC0] text-white rounded-xl hover:bg-[#5f17a5] text-sm font-medium transition-colors disabled:opacity-50"
              >
                {isUpdating ? "Changing..." : "Change Password"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserSettingsPage;
