import React, { useState, useEffect, useRef } from "react";
import { signOut } from "next-auth/react";
import ProfileImage from "./ProfileImage";
import { FiEdit3, FiUpload, FiRotateCcw, FiLock, FiLogOut, FiUser, FiMail, FiShield, FiSettings, FiCheck } from "react-icons/fi";
import { X } from "lucide-react";

interface UserSettingsPageProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  onNameUpdate?: (newName: string | null) => void;
  onImageUpdate?: (newImage: string | null) => void;
}

const UserSettingsPage: React.FC<UserSettingsPageProps> = ({ user, onNameUpdate, onImageUpdate }) => {
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

  const handleImageUpload = async (file: File) => {
    setIsUpdating(true);
    setUpdateMessage(null);
    
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
              mimeType: file.type
            }),
          });

          if (!response.ok) {
            throw new Error("Failed to upload image");
          }

          const userData = await fetchUserData();
          if (userData) {
            onImageUpdate?.(userData.image);
          }
          
          setShowSuccessModal(true);
          setUpdateMessage(null);
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
      
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Error processing file:", error);
      setUpdateMessage({ 
        type: "error", 
        text: error instanceof Error ? error.message : "Failed to process image" 
      });
      setIsUpdating(false);
    }
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

      const userData = await fetchUserData();
      if (userData) {
        onImageUpdate?.(userData.image);
      }
      
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

  return (
    <div className="w-full h-full bg-white text-[#111014] flex flex-col">
      <div className="flex-1 flex justify-center px-6 pt-2">
        <div className="w-full max-w-6xl pb-6">
          <h1 className="text-2xl font-semibold text-[#111827] mt-6 mb-6">
            Account Settings
          </h1>

          <div className="bg-[#F8F0FF] rounded-lg shadow-sm border border-[#E5E7EB] p-6 mb-6">
            <div className="flex items-start gap-6">
              <div className="relative" ref={avatarMenuRef}>
                <ProfileImage
                  src={user.image}
                  alt={displayName}
                  name={displayName}
                  size={120}
                  className="shadow-lg"
                  priority
                  quality={100}
                />
                <button
                  onClick={() => setShowAvatarMenu(!showAvatarMenu)}
                  className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-[#701CC0] text-white rounded-full p-2 hover:bg-[#5f17a5] transition-colors shadow-lg"
                >
                  <FiEdit3 className="w-4 h-4" />
                </button>
                
                {showAvatarMenu && (
                  <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-[#E5E7EB] py-2 z-10">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleImageUpload(file);
                          setShowAvatarMenu(false);
                        }
                      }}
                      className="hidden"
                      id="image-upload"
                      disabled={isUpdating}
                    />
                    <label
                      htmlFor="image-upload"
                      className={`flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50 cursor-pointer ${
                        isUpdating ? 'text-gray-400 cursor-not-allowed' : 'text-[#111827]'
                      }`}
                    >
                      <FiUpload className="w-4 h-4" />
                      {isUpdating ? "Uploading..." : "Upload Image"}
                    </label>
                    {user.image && (
                      <button
                        onClick={handleImageReset}
                        disabled={isUpdating}
                        className={`flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50 w-full text-left ${
                          isUpdating ? 'text-gray-400 cursor-not-allowed' : 'text-[#111827]'
                        }`}
                      >
                        <FiRotateCcw className="w-4 h-4" />
                        {isUpdating ? "Resetting..." : "Reset To Default"}
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex-1">
                <div className="mb-4">
                  <div className="flex items-center gap-3 mb-4">
                    <FiUser className="w-5 h-5 text-[#701CC0]" />
                    <h3 className="text-lg font-semibold text-[#111827]">Profile Information</h3>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-[#374151] mb-1">Full Name</label>
                      {isEditingName ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="flex-1 border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent"
                            placeholder="Enter your name"
                            autoFocus
                          />
                          <button
                            onClick={handleNameUpdate}
                            disabled={isUpdating}
                            className="px-4 py-2 bg-[#701CC0] text-white rounded-lg hover:bg-[#5f17a5] disabled:opacity-50 text-sm font-medium"
                          >
                            {isUpdating ? "Saving..." : "Save"}
                          </button>
                          <button
                            onClick={() => {
                              setIsEditingName(false);
                              setUpdateMessage(null);
                            }}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-[#111827]">{displayName}</span>
                          <button
                            onClick={() => setIsEditingName(true)}
                            className="text-[#701CC0] hover:text-[#5f17a5] text-sm underline"
                          >
                            Edit
                          </button>
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-[#374151] mb-1">Email Address</label>
                      <div className="flex items-center gap-2">
                        <FiMail className="w-4 h-4 text-[#6B7280]" />
                        <span className="text-[#6B7280]">{user.email || "No email"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {updateMessage && updateMessage.type === "error" && (
                  <div className="text-sm p-3 rounded-lg bg-red-50 text-red-700 border border-red-200">
                    {updateMessage.text}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#F8F0FF] rounded-lg shadow-sm border border-[#E5E7EB] p-6">
              <div className="flex items-center gap-3 mb-4">
                <FiShield className="w-5 h-5 text-[#701CC0]" />
                <h3 className="text-lg font-semibold text-[#111827]">Security</h3>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-sm font-medium text-[#374151] mb-1">Email Notifications</label>
                    <p className="text-xs text-[#6B7280]">Receive updates and alerts.</p>
                  </div>
                  <input 
                    type="checkbox" 
                    className="accent-[#701CC0]" 
                    checked={settings.emailNotifications}
                    onChange={(e) => handleSettingsUpdate({ emailNotifications: e.target.checked })}
                    disabled={isUpdating || isLoadingSettings}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-sm font-medium text-[#374151] mb-1">Two-Factor Authentication</label>
                    <p className="text-xs text-[#6B7280]">Enable 2FA for extra security.</p>
                  </div>
                  <input 
                    type="checkbox" 
                    className="accent-[#701CC0]" 
                    checked={settings.twoFactorEnabled}
                    onChange={(e) => handleSettingsUpdate({ twoFactorEnabled: e.target.checked })}
                    disabled={isUpdating || isLoadingSettings}
                  />
                </div>

                <div className="pt-4 border-t border-[#E5E7EB]">
                  <button
                    onClick={() => setShowPasswordModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-[#701CC0] text-white rounded-lg hover:bg-[#5f17a5] text-sm font-medium"
                  >
                    <FiLock className="w-4 h-4" />
                    Change Password
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-[#F8F0FF] rounded-lg shadow-sm border border-[#E5E7EB] p-6">
              <div className="flex items-center gap-3 mb-4">
                <FiSettings className="w-5 h-5 text-[#701CC0]" />
                <h3 className="text-lg font-semibold text-[#111827]">Preferences</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-2">Theme</label>
                  <div className="relative">
                    <select
                      className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent appearance-none bg-white"
                      value={settings.theme}
                      onChange={(e) => handleSettingsUpdate({ theme: e.target.value })}
                      disabled={isUpdating || isLoadingSettings}
                    >
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                      <option value="auto">System</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <svg className="w-4 h-4 text-[#6B7280]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-2">Language</label>
                  <div className="relative">
                    <select
                      className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent appearance-none bg-white"
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
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <svg className="w-4 h-4 text-[#6B7280]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 bg-[#F8F0FF] rounded-lg shadow-sm border border-[#E5E7EB] p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-[#111827] mb-1">Account Actions</h3>
                <p className="text-sm text-[#6B7280]">Sign out of your account.</p>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
              >
                <FiLogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>

          {showSuccessModal && (
            <div 
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[200] p-4" 
              role="dialog" 
              aria-modal="true"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setShowSuccessModal(false);
                }
              }}
            >
              <div 
                className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4" 
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex flex-col items-center text-center">
                  <div className="relative mb-4 inline-flex h-16 w-16 items-center justify-center">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-30 animate-ping" />
                    <span className="relative inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500 text-white">
                        <FiCheck className="h-6 w-6" />
                      </span>
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold text-[#111827] mb-2">
                    {isPasswordChangeSuccess ? "Password Changed Successfully!" : "Settings Updated Successfully!"}
                  </h3>
                  <p className="text-sm text-[#6B7280] mb-6">
                    {isPasswordChangeSuccess 
                      ? "Your password has been changed successfully. You will be logged out shortly."
                      : "Your changes have been saved successfully."
                    }
                  </p>
                  <button
                    className="w-full rounded-lg px-4 py-2 bg-[#701CC0] text-white hover:bg-[#5f17a5] text-sm font-medium transition-colors"
                    onClick={() => {
                      setShowSuccessModal(false);
                      setIsPasswordChangeSuccess(false);
                    }}
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}

          {showPasswordModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={closePasswordModal}>
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md border border-[#E5E7EB]" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-5 border-b border-[#E5E7EB]">
                  <div>
                    <h2 className="text-xl font-semibold text-[#111827]">Change Password</h2>
                    <p className="text-sm text-[#6B7280] mt-1">Update your account password.</p>
                  </div>
                  <button 
                    onClick={closePasswordModal}
                    className="text-red-400 hover:text-red-600 transition-colors duration-200 p-1 rounded-md hover:bg-red-50"
                    aria-label="Close modal"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 space-y-5">
                  {passwordFieldErrors.general && (
                    <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-2">
                      <p className="text-sm text-red-700">{passwordFieldErrors.general}</p>
                    </div>
                  )}

                  <div>
                    <label htmlFor="current-password" className="block text-sm font-medium text-[#374151] mb-1.5">
                      Current Password
                    </label>
                    <input
                      id="current-password"
                      type="password"
                      value={passwordData.currentPassword}
                      onChange={(e) => handlePasswordFieldChange("currentPassword", e.target.value)}
                      className={`w-full border rounded-lg px-4 py-2.5 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent transition-colors ${
                        passwordFieldErrors.currentPassword 
                          ? "border-red-500 bg-red-50" 
                          : "border-[#E5E7EB]"
                      }`}
                      placeholder="Enter current password"
                    />
                    {passwordFieldErrors.currentPassword && (
                      <p className="mt-1 text-sm text-red-600">{passwordFieldErrors.currentPassword}</p>
                    )}
                  </div>
                  
                  <div>
                    <label htmlFor="new-password" className="block text-sm font-medium text-[#374151] mb-1.5">
                      New Password
                    </label>
                    <input
                      id="new-password"
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) => handlePasswordFieldChange("newPassword", e.target.value)}
                      className={`w-full border rounded-lg px-4 py-2.5 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent transition-colors ${
                        passwordFieldErrors.newPassword 
                          ? "border-red-500 bg-red-50" 
                          : "border-[#E5E7EB]"
                      }`}
                      placeholder="Enter new password"
                    />
                    {passwordFieldErrors.newPassword && (
                      <p className="mt-1 text-sm text-red-600">{passwordFieldErrors.newPassword}</p>
                    )}
                  </div>
                  
                  <div>
                    <label htmlFor="confirm-password" className="block text-sm font-medium text-[#374151] mb-1.5">
                      Confirm New Password
                    </label>
                    <input
                      id="confirm-password"
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => handlePasswordFieldChange("confirmPassword", e.target.value)}
                      className={`w-full border rounded-lg px-4 py-2.5 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent transition-colors ${
                        passwordFieldErrors.confirmPassword 
                          ? "border-red-500 bg-red-50" 
                          : "border-[#E5E7EB]"
                      }`}
                      placeholder="Confirm new password"
                    />
                    {passwordFieldErrors.confirmPassword && (
                      <p className="mt-1 text-sm text-red-600">{passwordFieldErrors.confirmPassword}</p>
                    )}
                  </div>
                </div>

                <div className="px-6 py-4 bg-gray-50 border-t border-[#E5E7EB] rounded-b-xl flex items-center justify-between gap-3">
                  <button
                    onClick={closePasswordModal}
                    disabled={isUpdating}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePasswordChange}
                    disabled={isUpdating}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#701CC0] text-white rounded-lg hover:bg-[#5f17a5] text-sm font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    {isUpdating ? "Changing..." : "Change Password"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default UserSettingsPage;
