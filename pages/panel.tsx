import React, { useEffect, useState } from "react"
import Head from "next/head"
import { Inter } from "next/font/google"
import Image from "next/image"
import ProfileImage from "@/components/ProfileImage"
import SignPdfModal from "@/components/ui/SignPdfModal"
import Link from "next/link"
import { FiLogOut, FiShield } from "react-icons/fi"
import { IoIosNotificationsOutline } from "react-icons/io";
import { AiOutlineAppstore } from "react-icons/ai";
import { PiUsersThree, PiCalculator } from "react-icons/pi";
import { BsPeople } from "react-icons/bs";
import { CiSearch } from "react-icons/ci";
import { RiArrowDropDownLine, RiFolder3Line } from "react-icons/ri";
import { FaRegFilePdf } from "react-icons/fa6";
import { HiOutlineDocumentText } from "react-icons/hi";
import { HiGlobeAlt } from "react-icons/hi2";
import { useSession, signOut } from "next-auth/react"
import UserSettingsPage from "@/components/UserSettingsPage"
import AddClientModal from "@/components/ui/AddClientModal"
import type { SessionItem } from "@/types/session"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/pages/api/auth/[...nextauth]"
import type { GetServerSideProps } from "next"
import DashboardSection from "@/components/PanelPages/DashboardSection"
import ClientsSection from "@/components/PanelPages/ClientsSection"
import TeamPanelSection from "@/components/PanelPages/TeamPanelSection"
import LtvCalculatorSection from "@/components/PanelPages/LTVCalculatorSection"
import OutreachSection from "@/components/PanelPages/OutreachSection"
import ProjectManagement from "../components/PanelPages/ProjectManagement"
import BlogEditorSection from "@/components/PanelPages/BlogEditorSection"
import AdminEditorSection from "@/components/PanelPages/AdminEditorSection"

const inter = Inter({ subsets: ["latin"] })

type PageProps = { dashboardHref: string }

const PanelPage = ({ dashboardHref }: PageProps) => {
  const [isSignModalOpen, setIsSignModalOpen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const [currentSection, setCurrentSection] = useState(0);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const { data: session } = useSession()
  const [isAddClientOpen, setIsAddClientOpen] = useState(false)
  const [items, setItems] = useState<SessionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentUserName, setCurrentUserName] = useState<string | null>(null)
  const [currentUserImage, setCurrentUserImage] = useState<string | null>(null)

  // keep prop used to satisfy linting after removing the button usage
  void dashboardHref

  useEffect(() => {
    fetchSessions()
    fetchCurrentUser()
  }, [])

  // Track user activity
  useEffect(() => {
    const updateActivity = async () => {
      try {
        await fetch("/api/profile/updateActivity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "online" }),
        });
      } catch (error) {
        console.error("Failed to update activity:", error);
      }
    };

    // Update activity on mount
    updateActivity();

    // Update activity every 2 minutes while user is active
    const interval = setInterval(updateActivity, 2 * 60 * 1000);

    // Update activity on page visibility change
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        updateActivity();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Cleanup
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  async function fetchCurrentUser() {
    try {
      const response = await fetch("/api/profile/getUser")
      if (response.ok) {
        const userData = await response.json()
        setCurrentUserName(userData.name)
        setCurrentUserImage(userData.image)
      }
    } catch (error) {
      console.error("Failed to fetch current user:", error)
    }
  }

  async function fetchSessions() {
    try {
      setLoading(true)
      const r = await fetch("/api/session/listClientSessions")
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const data: SessionItem[] = await r.json()
      setItems(data)
    } catch (e: any) {
      setError(e?.message ?? "Failed to load sessions")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Head>
        <title>Vierra | Admin Panel</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <div id="main-panel" className="w-full h-screen bg-white flex flex-row overflow-hidden">
  <div id="left-side" className={`relative flex flex-col  h-full z-20 bg-[#701CC0] transition-all ease-in-out duration-300 ${isSidebarOpen ? "min-w-[243px]" : "w-0"} md:w-[243px] overflow-hidden pb-8 md:pb-12`}>
          <div id="vierra-nameplate-body" className="w-full h-20 flex items-center justify-center mb-4">
            <Link href="/">
              <Image
                src="/assets/vierra-logo.png"
                alt="Vierra Go Home"
                width={56}
                height={32}
                className="w-24 rounded-sm"
              />
            </Link>
          </div>
          <div id="panel-nav" className="w-full h-full flex flex-col gap-y-[5px] items-center text-[#EDF1F5]">
            <div id="panel-nav-item" onClick={() => { setCurrentSection(0); setShowSettings(false); setIsSidebarOpen(false)}} className={`w-[90%] flex h-[47px] flex-row items-center rounded-xl gap-x-[10px] pl-8 cursor-pointer ${currentSection === 0 ? 'bg-white text-black' : 'hover:bg-white hover:text-black'}`}>
              <AiOutlineAppstore />
              <span className={`text-xs font-normal ${inter.className}`}>
                Dashboard
              </span>
            </div>
            <div id="panel-nav-item" onClick={() => { setCurrentSection(1); setShowSettings(false); setIsSidebarOpen(false)}} className={`w-[90%] flex h-[47px] flex-row items-center rounded-xl gap-x-[10px] pl-8 cursor-pointer ${currentSection === 1 ? 'bg-white text-black' : 'hover:bg-white hover:text-black'}`}>
              <PiUsersThree />
              <span className={`text-xs ${inter.className}`}>
                Clients
              </span>
            </div>
            <div id="panel-nav-item" onClick={() => { setCurrentSection(2); setShowSettings(false); setIsSidebarOpen(false)}} className={`w-[90%] flex h-[47px] flex-row items-center rounded-xl gap-x-[10px] pl-8 cursor-pointer ${currentSection === 2 ? 'bg-white text-black' : 'hover:bg-white hover:text-black'}`}>
              <BsPeople />
              <span className={`text-xs ${inter.className}`}>
                Staff Orbital
              </span>
            </div>
            <div id="panel-nav-item" onClick={() => { setCurrentSection(5); setShowSettings(false); setIsSidebarOpen(false)}} className={`w-[90%] flex h-[47px] flex-row items-center rounded-xl gap-x-[10px] pl-8 cursor-pointer ${currentSection === 5 ? 'bg-white text-black' : 'hover:bg-white hover:text-black'}`}>
              <HiGlobeAlt />
              <span className={`text-xs ${inter.className}`}>
                Marketing Tracker
              </span>
            </div>
            <div id="panel-nav-item" onClick={() => { setCurrentSection(6); setShowSettings(false); setIsSidebarOpen(false)}} className={`w-[90%] flex h-[47px] flex-row items-center rounded-xl gap-x-[10px] pl-8 cursor-pointer ${currentSection === 6 ? 'bg-white text-black' : 'hover:bg-white hover:text-black'}`}>
              <RiFolder3Line />
              <span className={`text-xs ${inter.className}`}>
                Project Tasks
              </span>
            </div>
            
            <div id="panel-nav-item" onClick={() => setIsSignModalOpen(true)} className="w-[90%] flex h-[47px] flex-row items-center gap-x-[10px] pl-8 cursor-pointer hover:bg-white rounded-xl hover:text-black">
              <FaRegFilePdf />
              <span className={`text-xs ${inter.className}`}>
                PDF Signer
              </span>
            </div>
            <div
              id="panel-nav-item"
              onClick={() => { setCurrentSection(4); setShowSettings(false); setIsSidebarOpen(false)}}
              className={`w-[90%] flex h-[47px] flex-row items-center rounded-xl gap-x-[10px] pl-8 cursor-pointer ${currentSection === 4 ? 'bg-white text-black' : 'hover:bg-white hover:text-black'}`}
            >
              <PiCalculator />
              <span className={`text-xs ${inter.className}`}>
                LTV Calculator
              </span>
            </div>
            <div
              id="panel-nav-item"
              onClick={() => { setCurrentSection(7); setShowSettings(false); setIsSidebarOpen(false)}}
              className={`w-[90%] flex h-[47px] flex-row items-center rounded-xl gap-x-[10px] pl-8 cursor-pointer ${currentSection === 7 ? 'bg-white text-black' : 'hover:bg-white hover:text-black'}`}
            >
              <HiOutlineDocumentText />
              <span className={`text-xs ${inter.className}`}>
                Blog Editor
              </span>
            </div>
            <div
              id="panel-nav-item"
              onClick={() => { setCurrentSection(8); setShowSettings(false); setIsSidebarOpen(false)}}
              className={`w-[90%] flex h-[47px] flex-row items-center rounded-xl gap-x-[10px] pl-8 cursor-pointer ${currentSection === 8 ? 'bg-white text-black' : 'hover:bg-white hover:text-black'}`}
            >
              <FiShield />
              <span className={`text-xs ${inter.className}`}>
                User Management
              </span>
            </div>
            {/* Logout moved to bottom of sidebar */}
          </div>

          {/* Bottom logout button: keep as the last item in the sidebar with some breathing room */}
          <div className="w-full flex justify-center absolute bottom-6 left-0">
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="group w-[90%] flex h-[47px] flex-row items-center gap-x-[10px] pl-8 justify-start rounded-xl text-white bg-transparent hover:bg-white hover:text-black transition"
            >
              <FiLogOut className="w-5 h-5 text-white group-hover:text-black transition-colors" />
              <span className={`text-xs ${inter.className} ml-2`}>Logout</span>
            </button>
          </div>
        </div>
          <div id="right-side" className="flex flex-col w-full h-full overflow-y-auto relative">
          <div id="right-side-heading" className="flex w-full flex-row h-16 bg-[#F8F0FF]">
            <div className="md:hidden flex items-center pl-2">
              <button
                onClick={() => {
                  setIsSidebarOpen(!isSidebarOpen);
                  setShowSettings(false);
                }}
                aria-label="Toggle sidebar"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-[#701CC0]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
            <div id="left-side-search-holder" className="flex w-1/2 h-full pl-4 items-center">
              <div id="search-bar" className="w-full max-w-xs md:max-w-md z-40">
                <label htmlFor="panel-search" className="sr-only">Search</label>
                <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-sm border border-transparent focus-within:ring-2 focus-within:ring-[#701CC0] transition">
                  <CiSearch className="w-5 h-5 text-[#701CC0] flex-shrink-0" />
                  <input
                    id="panel-search"
                    type="search"
                    placeholder="Search"
                    className={`flex-1 text-sm placeholder:text-[#9CA3AF] bg-transparent outline-none ${inter.className}`}
                  />
                  {loading && <span className={`ml-3 text-xs text-[#6B7280] ${inter.className}`}>Loading...</span>}
                </div>
              </div>
            </div>
            <div id="right-side-info-holder" className="flex w-1/2 h-full items-center justify-end p-2 gap-x-4 md:gap-x-8 text-[#A6A9AC]">
              <div className="relative">
                <IoIosNotificationsOutline height={10} width={10} className="w-8 h-8" />
                <span className="absolute -top-1 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{items.length}</span>
              </div>
              <div id="user-holder" className="flex items-center w-auto h-auto">
                <button
                  className="flex items-center gap-x-2"
                  aria-label="Open user settings"
                  onClick={() => setShowSettings((prev) => !prev)}
                >
                <ProfileImage
                  src={currentUserImage ? `/api/profile/getImage?t=${Date.now()}` : null}
                  alt="Profile"
                  name={currentUserName || session?.user?.name || "User"}
                  size={32}
                  className="shadow-md"
                  priority
                  quality={100}
                />
                  <div id="name-holder" className="hidden w-auto h-auto text-[#111014] md:flex items-center font-semibold">
                    <span className="">{currentUserName || session?.user?.name || "Vierra Admin"}</span>
                  </div>
                  <div id="dropdowner" className="hidden md:flex">
                    <RiArrowDropDownLine width={32}
                      height={32} className="w-8 h-8" />
                  </div>
                </button>
              </div>
            </div>
          </div>
  <div id="right-side-body" className="flex w-full h-full bg-white overflow-y-auto overflow-x-hidden pb-24 relative">
            {loading && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/60 backdrop-blur-sm">
                <div className="h-10 w-10 border-4 border-[#E5E7EB] border-t-[#701CC0] rounded-full animate-spin" aria-label="Loading" />
              </div>
            )}
            {error && (
              <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-red-100 text-red-700 px-4 py-2 rounded-md">
                {error}
              </div>
            )}
            {showSettings ? (<>
              <UserSettingsPage
                user={{
                  name: currentUserName,
                  email: session?.user?.email || "test@vierra.com",
                  image: currentUserImage ? `/api/profile/getImage?t=${Date.now()}` : null,
                }}
                onNameUpdate={setCurrentUserName}
                onImageUpdate={() => setCurrentUserImage(`updated-${Date.now()}`)}
              />
            </>)
              : (
                <>
                  {currentSection === 0 && <DashboardSection />}
                  {currentSection === 1 && <ClientsSection onAddClient={() => setIsAddClientOpen(true)} />}
                  {currentSection === 2 && <TeamPanelSection />}
                  {currentSection === 4 && <LtvCalculatorSection />}
                  {currentSection === 5 && <OutreachSection />}
                  {currentSection === 6 && <ProjectManagement />}
                  {currentSection === 7 && <BlogEditorSection />}
                  {currentSection === 8 && <AdminEditorSection />}
                </>
              )}


          </div>
        </div>
      </div>

      <SignPdfModal
        isOpen={isSignModalOpen}
        onClose={() => setIsSignModalOpen(false)}
      />
      {isAddClientOpen && (
        <AddClientModal
          isOpen={isAddClientOpen}
          onClose={() => {
            setIsAddClientOpen(false)
            fetchSessions()
          }}
          onCreated={(row) => {
            setItems((prev) => [row, ...prev])
          }}
        />
      )}
    </>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions)

  if (!session) {
    return { redirect: { destination: "/login", permanent: false } }
  }
  const role = (session.user as any).role
  if ((session.user as any).role === "user") {
    return { redirect: { destination: "/client", permanent: false } }
  }
  return { props: { dashboardHref: role === "user" ? "/client" : "/panel" } }
}

export default PanelPage
