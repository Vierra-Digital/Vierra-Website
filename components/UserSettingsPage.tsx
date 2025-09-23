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
  <div id="main-settings-page" className="w-full h-full flex flex-col items-center p-4 gap-y-4">
    <div id="main-info" className="flex w-full flex-col items-center">
      <h1 className="text-xl font-bold text-black">Account Settings</h1>
      <p className="text-[#B8AEE2] text-sm">Manage your profile and preferences</p>
    </div>
    <div id="profile-settings" className="flex w-full flex-col items-center gap-3">
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
      <div className="text-center">
        <div className="font-semibold text-xl text-black">{user.name || "User"}</div>
        <div className="text-[#B8AEE2]">{user.email || "No email"}</div>
      </div>

      <div className="w-full max-w-[600px] border-b border-black"></div>

      <div id="settings-form" className="flex flex-col w-full gap-3 items-center">
        <div id="email-settings" className="flex flex-col w-full items-center">
          <label className="block text-base font-semibold text-black mb-2">Email Notifications</label>
          <div className="flex items-center gap-2">
            <input type="checkbox" className="accent-[#701CC0]" id="emailNotifications" />
            <label htmlFor="emailNotifications" className="text-[#B8AEE2] text-sm">Receive updates & alerts</label>
          </div>
        </div>

        <div id="2fa" className="flex flex-col w-full items-center">
          <label className="block text-base font-semibold text-black mb-2">Two-Factor Authentication</label>
          <div className="flex items-center gap-2">
            <input type="checkbox" className="accent-[#701CC0]" id="emailNotifications" />
            <label htmlFor="emailNotifications" className="text-[#B8AEE2] text-sm">Enable 2FA for extra security</label>
          </div>
        </div>

        <div className="w-full max-w-[600px] border-b border-black"></div>

        <div className="flex flex-col w-full items-center">
          <label className="flex text-base font-semibold text-black mb-2">Theme</label>
          <select className="w-full max-w-xs border border-[#2E0A4F] rounded px-3 py-2 bg-[#18042A] text-white">
            <option>Light</option>
            <option>Dark</option>
            <option>System</option>
          </select>


        </div>

        <div className="flex flex-col w-full items-center">
          <label className="block text-base font-semibold text-black mb-2">Language</label>
          <select className="w-full max-w-xs border border-[#2E0A4F] rounded px-3 py-2 bg-[#18042A] text-white">
            <option>English</option>
            <option>Spanish</option>
            <option>French</option>
          </select>
        </div>

        <div className="flex flex-col">
          <label className="block text-base font-semibold text-white mb-2">Change Password</label>
          <button className="w-full max-w-xs p-2 rounded-lg bg-[#2E0A4F] text-[#B8AEE2] hover:bg-[#701CC0] transition font-semibold">
            Update Password
          </button>
        </div>

      </div>
    </div>
  </div>
);

export default UserSettingsPage;