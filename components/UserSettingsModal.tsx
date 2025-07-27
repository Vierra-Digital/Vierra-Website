import React from "react";
import Image from "next/image";

interface UserSettingsModalProps {
  open: boolean;
  onClose: () => void;
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

const UserSettingsModal: React.FC<UserSettingsModalProps> = ({ open, onClose, user }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1B0932] rounded-2xl shadow-2xl w-[92vw] max-w-md p-6 border border-[#2E0A4F] relative">
        {/* X button for closing modal */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-[#FF0000] transition-colors z-10"
          aria-label="Close modal"
        >
          <svg width={24} height={24} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        {/* Profile section */}
        <div className="flex flex-col items-center mb-6">
          {/* Profile image is displayed in a circle, with object-fit: contain to avoid cropping */}
          <div className="w-24 h-24 rounded-full border-4 border-[#701CC0] shadow-lg overflow-hidden mb-2 bg-[#2E0A4F] flex items-center justify-center">
            <Image
              src={user.image || "/assets/vierra-logo.png"}
              alt="Profile"
              width={96}
              height={96}
              className="w-full h-full object-contain"
              style={{ borderRadius: "50%" }}
              priority
              quality={100}
              unoptimized
            />
          </div>
          <div className="text-center">
            <div className="font-semibold text-lg text-white">{user.name || "User"}</div>
            <div className="text-sm text-[#B8AEE2]">{user.email || "No email"}</div>
          </div>
        </div>
        <hr className="border-[#2E0A4F] mb-4" />
        {/* Settings relevant for admin panel */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#B8AEE2] mb-1">Email Notifications</label>
            <div className="flex items-center">
              <input type="checkbox" className="accent-[#701CC0] mr-2" id="emailNotifications" />
              <label htmlFor="emailNotifications" className="text-white text-sm">Receive updates & alerts</label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#B8AEE2] mb-1">Two-Factor Authentication</label>
            <div className="flex items-center">
              <input type="checkbox" className="accent-[#701CC0] mr-2" id="twoFactor" />
              <label htmlFor="twoFactor" className="text-white text-sm">Enable 2FA for extra security</label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#B8AEE2] mb-1">Theme</label>
            <select className="w-full border border-[#2E0A4F] rounded px-2 py-1 bg-[#18042A] text-white">
              <option>Light</option>
              <option>Dark</option>
              <option>System</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#B8AEE2] mb-1">Language</label>
            <select className="w-full border border-[#2E0A4F] rounded px-2 py-1 bg-[#18042A] text-white">
              <option>English</option>
              <option>Spanish</option>
              <option>French</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#B8AEE2] mb-1">Change Password</label>
            <button className="w-full py-2 mt-1 rounded-lg bg-[#2E0A4F] text-[#B8AEE2] hover:bg-[#701CC0] transition font-semibold">
              Update Password
            </button>
          </div>
        </div>
        <button
          onClick={onClose}
          className="mt-6 w-full bg-[#701CC0] text-white py-2 rounded-lg hover:bg-[#4F1488] transition font-semibold shadow"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default UserSettingsModal;