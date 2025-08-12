import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Inter } from "next/font/google";
import { FiFileText, FiUsers, FiLogOut, FiLink, FiChevronRight } from "react-icons/fi";
import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import UserSettingsPage from "@/components/UserSettingsPage";

const inter = Inter({ subsets: ["latin"] });

type PageProps = { dashboardHref: string };

export default function ConnectPage({ dashboardHref }: PageProps) {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [showSettings, setShowSettings] = useState(false);

    const [fbConnected, setFb] = useState(false);
    const [liConnected, setLi] = useState(false);
    const [gaConnected, setGa] = useState(false);
    const [loading, setLoading] = useState(true);

    // Fetch connection status
    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) { setLoading(false); return; }

        (async () => {
            try {
                const [fb, li, ga] = await Promise.all([
                    fetch(`/api/facebook/status`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : { connected: false }).catch(() => ({ connected: false })),
                    fetch(`/api/linkedin/status`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : { connected: false }).catch(() => ({ connected: false })),
                    fetch(`/api/googleads/status`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : { connected: false }).catch(() => ({ connected: false })),
                ]);
                setFb(!!fb.connected); setLi(!!li.connected); setGa(!!ga.connected);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const startOauth = (provider: "facebook" | "linkedin" | "googleads") => {
        window.location.href = `/api/${provider}/initiate`;
    };

    // Layout (same as /client)
    return (
        <>
            <div className="relative min-h-screen bg-[#18042A] text-white flex">
                {/* Logo */}
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
                            className="flex items-center w-full p-2 rounded text-white/70 hover:text-white hover:bg-white/10 transition-colors duration-200"
                        >
                            <FiFileText className="w-5 h-5" />
                            <span className={`ml-3 text-sm font-medium ${inter.className}`}>Dashboard</span>
                        </button>

                        <button
                            onClick={() => router.push("/connect")}
                            className="flex items-center w-full p-2 rounded text-white bg-white/10 transition-colors duration-200"
                        >
                            <FiLink className="w-5 h-5" />
                            <span className={`ml-3 text-sm font-medium ${inter.className}`}>Connect</span>
                        </button>
                    </div>

                    <button
                        onClick={() => signOut({ callbackUrl: "/login" })}
                        className="flex items-center w-full p-2 rounded text-white/70 hover:text-white hover:bg-white/10 transition-colors duration-200"
                    >
                        <FiLogOut className="w-5 h-5" />
                        <span className={`ml-3 text-sm font-medium ${inter.className}`}>Logout</span>
                    </button>
                </div>

                {/* Right side */}
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

                    {/* Content */}
                    <div className="flex-1 bg-[#18042A] overflow-auto p-6">
                        {showSettings ? (
                            <UserSettingsPage user={session?.user || { name: "Test User", email: "test@vierra.com", image: "/assets/vierra-logo.png" }} />
                        ) : (<>
                            <h2 className="text-2xl font-bold mb-6">Connect Your Accounts</h2>
                            {loading ? (
                                <p className="text-white/70">Checking connections…</p>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <button
                                        onClick={() => startOauth("facebook")}
                                        className="flex items-center justify-between p-5 bg-white/5 rounded-lg hover:bg-white/10 transition"
                                    >
                                        <span className="text-white">
                                            Facebook {fbConnected ? "(Connected)" : "(Not Connected)"}
                                        </span>
                                        <FiChevronRight className="w-5 h-5 text-white/70" />
                                    </button>

                                    <button
                                        onClick={() => startOauth("linkedin")}
                                        className="flex items-center justify-between p-5 bg-white/5 rounded-lg hover:bg-white/10 transition"
                                    >
                                        <span className="text-white">
                                            LinkedIn {liConnected ? "(Connected)" : "(Not Connected)"}
                                        </span>
                                        <FiChevronRight className="w-5 h-5 text-white/70" />
                                    </button>

                                    <button
                                        onClick={() => startOauth("googleads")}
                                        className="flex items-center justify-between p-5 bg-white/5 rounded-lg hover:bg-white/10 transition"
                                    >
                                        <span className="text-white">
                                            Google Ads {gaConnected ? "(Connected)" : "(Not Connected)"}
                                        </span>
                                        <FiChevronRight className="w-5 h-5 text-white/70" />
                                    </button>
                                </div>
                            )}
                        </>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

/** SSR guard: logged-in users only; admins bounce to /panel */
export const getServerSideProps: GetServerSideProps = async (ctx) => {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    if (!session) return { redirect: { destination: "/login", permanent: false } };
    const role = (session.user as any).role;
    if ((session.user as any).role !== "user") {
        return { redirect: { destination: "/panel", permanent: false } };
    }
    return { props: { dashboardHref: role === "user" ? "/client" : "/panel" } };
};
