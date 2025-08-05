import React from "react";
import Image from "next/image";

interface UserSettingsPageProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

const UserSettingsPage: React.FC<UserSettingsPageProps> = ({ user }) => (
  <div className="w-full max-w-4xl mx-auto px-4 sm:px-8 py-8 flex flex-col gap-8">
    {/* Page Title */}
    <div className="pb-6 border-b border-[#2E0A4F]">
      <h1 className="text-2xl sm:text-3xl font-bold text-white">Account Settings</h1>
      <p className="text-[#B8AEE2] text-sm mt-1">Manage your profile and preferences</p>
    </div>

    {/* Profile Section */}
    <div className="flex flex-col sm:flex-row items-center gap-6 pb-8 border-b border-[#2E0A4F]">
      <div className="w-28 h-28 rounded-full border-4 border-[#701CC0] shadow-lg overflow-hidden bg-[#2E0A4F] flex items-center justify-center">
        <Image
          src={user.image || "/assets/vierra-logo.png"}
          alt="Profile"
          width={112}
          height={112}
          className="w-full h-full object-contain"
          style={{ borderRadius: "50%" }}
          priority
          quality={100}
          unoptimized
        />
      </div>
      <div className="text-center sm:text-left">
        <div className="font-semibold text-xl text-white">{user.name || "User"}</div>
        <div className="text-[#B8AEE2]">{user.email || "No email"}</div>
      </div>
    </div>

    {/* Settings Form */}
    <div className="flex flex-col gap-8 max-w-2xl w-full">
      {/* Email Notifications */}
      <div>
        <label className="block text-base font-semibold text-white mb-2">Email Notifications</label>
        <div className="flex items-center gap-2">
          <input type="checkbox" className="accent-[#701CC0]" id="emailNotifications" />
          <label htmlFor="emailNotifications" className="text-[#B8AEE2] text-sm">Receive updates & alerts</label>
        </div>
      </div>

      {/* Two-Factor Authentication */}
      <div>
        <label className="block text-base font-semibold text-white mb-2">Two-Factor Authentication</label>
        <div className="flex items-center gap-2">
          <input type="checkbox" className="accent-[#701CC0]" id="twoFactor" />
          <label htmlFor="twoFactor" className="text-[#B8AEE2] text-sm">Enable 2FA for extra security</label>
        </div>
      </div>

      {/* Theme */}
      <div>
        <label className="block text-base font-semibold text-white mb-2">Theme</label>
        <select className="w-full max-w-xs border border-[#2E0A4F] rounded px-3 py-2 bg-[#18042A] text-white">
          <option>Light</option>
          <option>Dark</option>
          <option>System</option>
        </select>
      </div>

      {/* Language */}
      <div>
        <label className="block text-base font-semibold text-white mb-2">Language</label>
        <select className="w-full max-w-xs border border-[#2E0A4F] rounded px-3 py-2 bg-[#18042A] text-white">
          <option>English</option>
          <option>Spanish</option>
          <option>French</option>
        </select>
      </div>

      {/* Change Password */}
      <div>
        <label className="block text-base font-semibold text-white mb-2">Change Password</label>
        <button className="w-full max-w-xs py-2 rounded-lg bg-[#2E0A4F] text-[#B8AEE2] hover:bg-[#701CC0] transition font-semibold">
          Update Password
        </button>
      </div>
    </div>
    <div className="h-8" /> {/* Spacer for bottom padding on mobile */}
  </div>
);

export default UserSettingsPage;