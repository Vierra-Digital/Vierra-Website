import React from "react";
import { signOut } from "next-auth/react";
import Image from "next/image";

interface UserSettingsPageProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

const UserSettingsPage: React.FC<UserSettingsPageProps> = ({ user }) => {
  const displayName = user.name && user.name.trim().length > 0 ? user.name : (user.email ? user.email.split("@")[0] : "User");

  return (
    <div className="w-full h-full bg-white p-8 overflow-auto">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-semibold text-[#111827]">Account Settings</h1>
        </div>

  <div className="bg-[#F8F0FF] rounded-lg shadow-sm border border-[#EDE6FB] p-6">
          <div className="flex items-start gap-6">
            <div className="w-28 h-28 rounded-full border-4 border-[#701CC0] shadow-lg overflow-hidden bg-[#2E0A4F] flex items-center justify-center flex-shrink-0">
              <Image
                src={user.image || "/assets/vierra-logo.png"}
                alt={displayName}
                width={112}
                height={112}
                className="w-full h-full object-contain"
                style={{ borderRadius: "50%" }}
                priority
                quality={100}
                unoptimized
              />
            </div>

            <div className="flex-1">
              <div className="text-left">
                <div className="font-semibold text-xl text-black">{displayName}</div>
                <div className="text-[#6B7280]">{user.email || "No email"}</div>
              </div>

              <div className="mt-6 border-t pt-6">
                <div id="settings-form" className="flex flex-col w-full gap-6">
                  <div id="email-settings" className="flex flex-col w-full">
                    <label className="block text-base font-semibold text-[#111827] mb-2">Email Notifications</label>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" className="accent-[#701CC0]" id="emailNotifications" />
                      <label htmlFor="emailNotifications" className="text-[#677489] text-sm">Receive Updates &amp; Alerts</label>
                    </div>
                  </div>

                  <div id="2fa" className="flex flex-col w-full">
                    <label className="block text-base font-semibold text-[#111827] mb-2">Two-Factor Authentication</label>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" className="accent-[#701CC0]" id="twoFactor" />
                      <label htmlFor="twoFactor" className="text-[#677489] text-sm">Enable 2FA For Extra Security</label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex flex-col">
                      <label className="flex text-base font-semibold text-[#111827] mb-2">Theme</label>
                        <select
                          className="w-full max-w-xs border border-[#D1D5DB] rounded px-3 py-2 bg-white text-black appearance-none pr-10"
                          style={{
                            backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'><path fill='%236B7280' d='M5.23 7.21a.75.75 0 0 1 1.06-.02L10 10.672l3.71-3.483a.75.75 0 1 1 1.04 1.082l-4.25 3.994a.75.75 0 0 1-1.04 0L5.25 8.272a.75.75 0 0 1-.02-1.062z'/></svg>\")",
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'right 0.75rem center',
                            backgroundSize: '1rem',
                          }}
                        >
                          <option>Light</option>
                          <option>Dark</option>
                          <option>System</option>
                        </select>
                    </div>

                    <div className="flex flex-col">
                      <label className="block text-base font-semibold text-[#111827] mb-2">Language</label>
                      <select
                        className="w-full max-w-xs border border-[#D1D5DB] rounded px-3 py-2 bg-white text-black appearance-none pr-10"
                        style={{
                          backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'><path fill='%236B7280' d='M5.23 7.21a.75.75 0 0 1 1.06-.02L10 10.672l3.71-3.483a.75.75 0 1 1 1.04 1.082l-4.25 3.994a.75.75 0 0 1-1.04 0L5.25 8.272a.75.75 0 0 1-.02-1.062z'/></svg>\")",
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 0.75rem center',
                          backgroundSize: '1rem',
                        }}
                      >
                        <option>English</option>
                        <option>Spanish</option>
                        <option>French</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-base font-semibold text-[#111827] mb-2">Change Password</label>
                    <button className="px-4 py-2 rounded-lg bg-[#701CC0] text-white hover:bg-[#5a0fb0] focus:outline-none focus:ring-2 focus:ring-[#EDE6FB] transition font-semibold">Update Password</button>
                  </div>

                  <div>
                    <button
                      onClick={() => signOut({ callbackUrl: "/login" })}
                      className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition font-semibold"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default UserSettingsPage;