import React, { useEffect, useState } from "react";
import Head from "next/head";
import { Inter } from "next/font/google";
import Image from "next/image";
import { useRouter } from "next/navigation";
import SignPdfModal from "@/components/ui/SignPdfModal";
import Link from "next/link";
import { FiLogOut, FiFileText } from "react-icons/fi";
import { useSession, signOut } from "next-auth/react";
import UserSettingsPage from "@/components/UserSettingsPage";

const inter = Inter({ subsets: ["latin"] });

const PanelPage = () => {
  const router = useRouter();
  const [isSignModalOpen, setIsSignModalOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status !== "loading" && !session) {
      router.replace("/login");
    }
  }, [session, status, router]);

  if (status === "loading") {
    return (
      <div className="relative min-h-screen bg-gradient-to-br from-[#4F1488] via-[#2E0A4F] to-[#18042A] flex items-center justify-center">
        <p className="text-white text-xl">Loading...</p>
      </div>
    );
  }

  if (status === "authenticated") {
    return (
      <>
        <Head>
          <title>Vierra | Admin Panel</title>
        </Head>
        <div className="relative min-h-screen bg-[#18042A] text-white flex">
          <div className="absolute top-4 left-4 z-20">
            <Link href="/" legacyBehavior>
              <a aria-label="Go to homepage">
                <Image
                  src="/assets/vierra-logo.png"
                  alt="Vierra Logo"
                  width={120}
                  height={40}
                  className="cursor-pointer h-10 w-auto"
                />
              </a>
            </Link>
          </div>

          <div className="w-56 bg-[#2E0A4F] h-screen flex flex-col justify-between pt-20 pb-4 px-4">
            <div className="flex flex-col space-y-2">
              <button
                onClick={() => setIsSignModalOpen(true)}
                className={`flex items-center w-full p-2 rounded text-white/70 hover:text-white hover:bg-white/10 transition-colors duration-200`}
                aria-label="Prepare PDF for Signing"
              >
                <FiFileText className="w-5 h-5" />
                <span className={`ml-3 text-sm font-medium ${inter.className}`}>PDF Signer</span>
              </button>
            </div>

            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className={`flex items-center w-full p-2 rounded text-white/70 hover:text-white hover:bg-white/10 transition-colors duration-200`}
              aria-label="Logout"
            >
              <FiLogOut className="w-5 h-5" />
              <span className={`ml-3 text-sm font-medium ${inter.className}`}>Logout</span>
            </button>
          </div>

        <div className="flex-1 flex flex-col">
          {/* Top header bar */}
          <div className="h-16 bg-[#2E0A4F] flex items-center pl-64 pr-8 justify-end relative">
            <button
              className="ml-4 flex items-center focus:outline-none absolute right-8 top-1/2 -translate-y-1/2"
              aria-label="Open user settings"
              onClick={() => setShowSettings((prev) => !prev)}
            >
              <Image
                src={
                  typeof session?.user?.image === "string" && session.user.image.length > 0
                    ? session.user.image
                    : "/assets/vierra-logo.png"
                }
                alt="Profile"
                width={48}
                height={48}
                className="object-cover w-full h-full"
                priority
                quality={100}
              />
            </button>
          </div>
          {/* Main content area */}
          <div className="flex-1 flex items-center justify-center">
            {showSettings ? (
              <UserSettingsPage user={session?.user || { name: "Test User", email: "test@vierra.com", image: "/assets/vierra-logo.png" }} />
            ) : (
              // You can put your dashboard or leave this empty for now
              null
            )}
          </div>
        </div>
        </div>
        <SignPdfModal
          isOpen={isSignModalOpen}
          onClose={() => setIsSignModalOpen(false)}
        />
        {/* <UserSettingsModal
          open={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          user={session?.user || {}}
        /> */}
      </>
    );
  }

  return null;
};

export default PanelPage;
