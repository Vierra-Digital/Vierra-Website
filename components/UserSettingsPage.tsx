import React, { useState, useEffect, useRef } from "react";
import { signOut } from "next-auth/react";
import Image from "next/image";
import ProfileImage from "./ProfileImage";
import { FiEdit3, FiUpload, FiRotateCcw, FiLock, FiLogOut, FiUser, FiMail, FiShield, FiSettings } from "react-icons/fi";
import { Bricolage_Grotesque } from "next/font/google";

const bricolageGrotesque = Bricolage_Grotesque({ subsets: ["latin"] });

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
  
  // Settings state
  const [settings, setSettings] = useState({
    emailNotifications: true,
    twoFactorEnabled: false,
    theme: "auto",
    language: "en"
  });
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  const avatarMenuRef = useRef<HTMLDivElement>(null);
  const displayName = name && name.trim().length > 0 ? name : (user.email ? user.email.split("@")[0] : "User");

  // Update local name state when user prop changes
  useEffect(() => {
    setName(user.name || "");
  }, [user.name]);

  // Load settings on component mount
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

  // Handle click outside avatar menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(event.target as Node)) {
        setShowAvatarMenu(false);
      }
    };

    if (showAvatarMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAvatarMenu]);

  // Auto-dismiss success messages after 3 seconds
  useEffect(() => {
    if (updateMessage && updateMessage.type === "success") {
      const timer = setTimeout(() => {
        setUpdateMessage(null);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [updateMessage]);

  const handleNameUpdate = async () => {
    setIsUpdating(true);
    setUpdateMessage(null);
    
    try {
      const response = await fetch("/api/profile/updateName", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        throw new Error("Failed to update name");
      }

      const result = await response.json();
      
      // Update the local name state with the response
      setName(result.name || "");
      
      // Fetch the latest user data to ensure we have the most up-to-date info
      try {
        const userResponse = await fetch("/api/profile/getUser");
        if (userResponse.ok) {
          const userData = await userResponse.json();
          setName(userData.name || "");
          // Notify parent component of the name update
          if (onNameUpdate) {
            onNameUpdate(userData.name);
          }
        }
      } catch (fetchError) {
        console.error("Failed to fetch updated user data:", fetchError);
      }
      
      setUpdateMessage({ type: "success", text: "Name updated successfully!" });
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newSettings),
      });

      if (!response.ok) {
        throw new Error("Failed to update settings");
      }

      const result = await response.json();
      setSettings(result);
      setUpdateMessage({ type: "success", text: "Settings updated successfully!" });
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
      // Convert file to base64
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = reader.result as string;
          const base64 = base64Data.split(',')[1]; // Remove data:image/...;base64, prefix
          
          const response = await fetch("/api/profile/uploadImage", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ 
              imageData: base64,
              mimeType: file.type
            }),
          });

          if (!response.ok) {
            throw new Error("Failed to upload image");
          }

          // Fetch fresh user data to ensure we have the latest
          try {
            const userResponse = await fetch("/api/profile/getUser");
            if (userResponse.ok) {
              const userData = await userResponse.json();
              onImageUpdate?.(userData.image);
            }
          } catch (fetchError) {
            console.error("Failed to fetch updated user data:", fetchError);
          }
          
          setUpdateMessage({ type: "success", text: "Image updated successfully!" });
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          imageData: null,
          mimeType: null
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to reset image");
      }

      // Fetch fresh user data to ensure we have the latest
      try {
        const userResponse = await fetch("/api/profile/getUser");
        if (userResponse.ok) {
          const userData = await userResponse.json();
          onImageUpdate?.(userData.image);
        }
      } catch (fetchError) {
        console.error("Failed to fetch updated user data:", fetchError);
      }
      
      setUpdateMessage({ type: "success", text: "Image reset to default successfully!" });
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
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setUpdateMessage({ type: "error", text: "New passwords do not match" });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setUpdateMessage({ type: "error", text: "Password must be at least 6 characters long" });
      return;
    }

    setIsUpdating(true);
    setUpdateMessage(null);
    
    try {
      const response = await fetch("/api/profile/changePassword", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // Handle specific error cases
        if (response.status === 400 && errorData.message === "Current password is incorrect") {
          setUpdateMessage({ 
            type: "error", 
            text: "The current password you entered is incorrect. Please try again." 
          });
          return;
        }
        
        if (response.status === 400 && errorData.message === "New password must be at least 6 characters long") {
          setUpdateMessage({ 
            type: "error", 
            text: "The new password must be at least 6 characters long." 
          });
          return;
        }
        
        if (response.status === 400 && errorData.message === "User does not have a password set") {
          setUpdateMessage({ 
            type: "error", 
            text: "No password is currently set for this account. Please contact an administrator." 
          });
          return;
        }
        
        throw new Error(errorData.message || "Failed to change password");
      }

      setUpdateMessage({ type: "success", text: "Password changed successfully! You will be logged out." });
      setShowPasswordModal(false);
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
      
      // Logout after successful password change
      setTimeout(() => {
        signOut({ callbackUrl: "/login" });
      }, 2000);
    } catch (error) {
      console.error("Error changing password:", error);
      setUpdateMessage({ 
        type: "error", 
        text: error instanceof Error ? error.message : "Failed to change password" 
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="w-full h-full bg-white text-[#111014] flex flex-col pb-8">
      {/* Content Container - Centered */}
      <div className="flex-1 flex justify-center px-6 pt-2">
        <div className="w-full max-w-6xl">
          {/* Header */}
          <h1 className="text-2xl font-semibold text-[#111827] mt-6 mb-6">
            Account Settings
          </h1>

      {/* Profile Section */}
      <div className="bg-[#F8F0FF] rounded-lg shadow-sm border border-[#E5E7EB] p-6 mb-6">
          <div className="flex items-start gap-6">
          {/* Avatar Section */}
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
            
            {/* Avatar Menu */}
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
                    {isUpdating ? "Resetting..." : "Reset to Default"}
                  </button>
                )}
              </div>
            )}
            </div>

          {/* Profile Info */}
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

            {updateMessage && (
              <div className={`text-sm p-3 rounded-lg ${
                updateMessage.type === "success" 
                  ? "bg-green-50 text-green-700 border border-green-200" 
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}>
                {updateMessage.text}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Security Settings */}
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

        {/* Preferences */}
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

      {/* Logout Section */}
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

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowPasswordModal(false)}>
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-[#701CC0]/10 flex items-center justify-center">
                <FiLock className="w-6 h-6 text-[#701CC0]" />
              </div>
              <h3 className="text-xl font-semibold text-[#111827]">Change Password</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-2">Current Password</label>
                <input
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent"
                  placeholder="Enter current password"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-2">New Password</label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent"
                  placeholder="Enter new password"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-2">Confirm New Password</label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent"
                  placeholder="Confirm new password"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setShowPasswordModal(false)}
                className="px-4 py-2 rounded-lg border border-[#E5E7EB] text-[#374151] hover:bg-gray-50 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handlePasswordChange}
                disabled={isUpdating || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  isUpdating || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-[#701CC0] text-white hover:bg-[#5f17a5]'
                }`}
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