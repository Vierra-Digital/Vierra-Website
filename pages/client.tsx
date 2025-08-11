import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { FiLogOut, FiFileText, FiUsers, FiLink } from "react-icons/fi";
import { Inter } from "next/font/google";
import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import UserSettingsPage from "@/components/UserSettingsPage";

type PageProps = { dashboardHref: string };

const inter = Inter({ subsets: ["latin"] });

export default function ClientsPage({ dashboardHref }: PageProps) {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [showSettings, setShowSettings] = useState(false);

    useEffect(() => {
        if (status === "loading") return;
        if (!session) router.replace("/login");
    }, [session, status, router]);

    if (status === "loading") {
        return (
            <div className="relative min-h-screen bg-gradient-to-br from-[#4F1488] via-[#2E0A4F] to-[#18042A] flex items-center justify-center">
                <p className="text-white text-xl">Loading...</p>
            </div>
        );
    }

    return (
        <>
            <div className="relative min-h-screen bg-[#18042A] text-white flex">
                {/* Logo top-left */}
                <div className="absolute top-4 left-4 z-20">
                    <Link href={dashboardHref} aria-label="Go to homepage" className="block">
                        <Image
                            src="/assets/vierra-logo.png"
                            alt="Vierra Logo"
                            width={120}
                            height={40}
                            className="cursor-pointer h-10 w-auto"
                        />
                    </Link>
                </div>

                {/* Sidebar */}
                <div className="w-56 bg-[#2E0A4F] h-screen flex flex-col justify-between pt-20 pb-4 px-4">
                    <div className="flex flex-col space-y-2">
                        <button
                            onClick={() => router.push("/client")}
                            className={`flex items-center w-full p-2 rounded text-white/70 hover:text-white hover:bg-white/10 transition-colors duration-200`}
                        >
                            <FiFileText className="w-5 h-5" />
                            <span className={`ml-3 text-sm font-medium ${inter.className}`}>
                                Dashboard
                            </span>
                        </button>
                        <button
                            onClick={() => router.push("/connect")}
                            className="flex items-center w-full p-2 rounded text-white/70 hover:text-white hover:bg-white/10 transition-colors duration-200"
                        >
                            <FiLink className="w-5 h-5" />
                            <span className={`ml-3 text-sm font-medium ${inter.className}`}>Connect</span>
                        </button>
                    </div>

                    <button
                        onClick={() => signOut({ callbackUrl: "/login" })}
                        className={`flex items-center w-full p-2 rounded text-white/70 hover:text-white hover:bg-white/10 transition-colors duration-200`}
                    >
                        <FiLogOut className="w-5 h-5" />
                        <span className={`ml-3 text-sm font-medium ${inter.className}`}>
                            Logout
                        </span>
                    </button>

                </div>

                {/* Main content */}
                <div className="flex-1 flex flex-col">
                    {/* Top bar */}
                    <div className="h-16 bg-[#2E0A4F] flex items-center pl-64 pr-8 justify-end relative">
                        <button
                            className="ml-4 flex items-center focus:outline-none absolute right-8 top-1/2 -translate-y-1/2"
                            aria-label="Open user settings"
                            onClick={() => setShowSettings((prev) => !prev)}
                        >
                            <Image
                                src={
                                    typeof session?.user?.image === "string" &&
                                        session.user.image.length > 0
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

                    <div className="flex-1 bg-[#18042A] overflow-auto p-6">
                        {showSettings ? (
                            <UserSettingsPage user={session?.user || { name: "Test User", email: "test@vierra.com", image: "/assets/vierra-logo.png" }} />
                        ) : (
                            <>
                                < div className="flex-1 bg-[#18042A] overflow-auto p-6">
                                    <h2 className="text-2xl font-bold mb-6">Dashboard</h2>
                                    <p>Welcome, {session?.user?.email}</p>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div >
        </>
    );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    if (!session) {
        return { redirect: { destination: "/login", permanent: false } };
    }
    const role = (session.user as any).role;

    // Not logged in -> login
    if (!session) {
        return { redirect: { destination: "/login", permanent: false } };
    }

    // If not a "user", send to admin panel
    if ((session.user as any).role !== "user") {
        return { redirect: { destination: "/panel", permanent: false } };
    }

    return { props: { dashboardHref: role === "user" ? "/client" : "/panel" } };
};
