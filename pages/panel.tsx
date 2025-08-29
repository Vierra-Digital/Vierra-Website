import React, { useEffect, useState } from "react"
import Head from "next/head"
import { Inter } from "next/font/google"
import Image from "next/image"
import { useRouter } from "next/navigation"
import SignPdfModal from "@/components/ui/SignPdfModal"
import LtvCalculatorModal from "@/components/ui/LtvCalculatorModal"
import Link from "next/link"
import { FiLogOut, FiFileText, FiUsers } from "react-icons/fi"
import { IoIosNotificationsOutline } from "react-icons/io";
import { AiOutlineAppstore } from "react-icons/ai";
import { PiUsersThree, PiCalculator } from "react-icons/pi";
import { BsPeople } from "react-icons/bs";
import { CiSearch } from "react-icons/ci";
import { RiArrowDropDownLine, RiMoneyDollarBoxLine } from "react-icons/ri";
import { FaRegFilePdf } from "react-icons/fa6";
import { useSession, signOut } from "next-auth/react"
import UserSettingsPage from "@/components/UserSettingsPage"
import AddClientModal from "@/components/ui/AddClientModal"
import type { SessionItem } from "@/types/session"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/pages/api/auth/[...nextauth]"
import type { GetServerSideProps } from "next"
import DashboardSection from "@/components/PanelPages/DashboardSection"
import ClientsSection from "@/components/PanelPages/ClientsSection"
import MarketingSection from "@/components/PanelPages/MarketingSection"
import TeamPanelSection from "@/components/PanelPages/TeamPanelSection"

const inter = Inter({ subsets: ["latin"] })

type PageProps = { dashboardHref: string }

const PanelPage = ({ dashboardHref }: PageProps) => {
  const router = useRouter()
  const [isSignModalOpen, setIsSignModalOpen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const [currentSection, setCurrentSection] = useState(0);
  // [0: dashboard, 1: clients, 2: team, 3: marketing]

  const [isLtvModalOpen, setIsLtvModalOpen] = useState(false)
  const { data: session } = useSession()
  const [isAddClientOpen, setIsAddClientOpen] = useState(false)
  const [items, setItems] = useState<SessionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSessions()
  }, [])

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
      </Head>
      <div id="main-panel" className="w-screen h-screen bg-white flex flex-row">
        <div id="left-side" className="flex flex-col w-[243px] h-full z-20 bg-[#701CC0]">
          <div id="vierra-nameplate-body" className="w-full h-20 flex items-center justify-center mb-4">
            <Link href="/">
              <Image
                src={"/assets/vierra-logo-black-3.png"}
                alt={"Vierra Go Home"}
                width={56}
                height={32}
                className="w-24 bg-white rounded-sm pt-1 px-2"
              />
            </Link>
          </div>
          <div id="panel-nav" className="w-full h-full flex flex-col gap-y-[5px] items-center text-[#EDF1F5]">
            <div id="panel-nav-item" onClick={() => setCurrentSection(0)} className="w-[90%] flex h-[47px] flex-row items-center hover:bg-white rounded-xl gap-x-[10px] pl-8 cursor-pointer hover:text-black">
              <AiOutlineAppstore />
              <span className={`text-xs font-normal ${inter.className}`}>
                Dashboard
              </span>
            </div>
            <div id="panel-nav-item" onClick={() => setCurrentSection(1)} className="w-[90%] flex h-[47px] flex-row items-center hover:bg-white rounded-xl gap-x-[10px] pl-8 cursor-pointer hover:text-black">
              <PiUsersThree />
              <span className={`text-xs ${inter.className}`}>
                Clients
              </span>
            </div>
            <div id="panel-nav-item" onClick={() => setCurrentSection(2)} className="w-[90%] flex h-[47px] flex-row items-center hover:bg-white rounded-xl gap-x-[10px] pl-8 cursor-pointer hover:text-black">
              <BsPeople />
              <span className={`text-xs ${inter.className}`}>
                Team
              </span>
            </div>
            <div id="panel-nav-item" onClick={() => setCurrentSection(3)} className="w-[90%] flex h-[47px] flex-row items-center gap-x-[10px] pl-8 cursor-pointer hover:bg-white rounded-xl hover:text-black">
              <RiMoneyDollarBoxLine />
              <span className={`text-xs ${inter.className}`}>
                Marketing
              </span>
            </div>
            <div id="panel-nav-item" className="w-full flex h-[47px] flex-row items-center gap-x-[10px] pl-8 hover:text-black">

            </div>
            <div id="panel-nav-item" onClick={() => setIsSignModalOpen(true)} className="w-[90%] flex h-[47px] flex-row items-center gap-x-[10px] pl-8 cursor-pointer hover:bg-white rounded-xl hover:text-black">
              <FaRegFilePdf />
              <span className={`text-xs ${inter.className}`}>
                PDF Signer
              </span>
            </div>
            <div id="panel-nav-item" onClick={() => setIsLtvModalOpen(true)} className="w-[90%] flex h-[47px] flex-row items-center hover:bg-white rounded-xl gap-x-[10px] pl-8 cursor-pointer hover:text-black">
              <PiCalculator />
              <span className={`text-xs ${inter.className}`}>
                LTV Calculator
              </span>
            </div>
          </div>
        </div>
        <div id="right-side" className="flex flex-col w-full h-full">
          <div id="right-side-heading" className="flex w-full flex-row h-16 bg-[#F8F0FF]">
            <div id="left-side-search-holder" className="flex w-1/2 h-full pl-4 items-center">
              <div id="search-bar" className="w-[270px] h-[36px] z-40 flex items-center border border-[#A6A9AC] rounded-lg gap-x-2 p-2 text-[#A6A9AC] cursor-pointer">
                <CiSearch height={10} width={10} className="w-6 h-6" />
                <span className={`text-sm ${inter.className}`}>Search</span>
              </div>
            </div>
            <div id="right-side-info-holder" className="flex w-1/2 h-full items-center justify-end p-2 gap-x-8 text-[#A6A9AC]">
              <IoIosNotificationsOutline height={10} width={10} className="w-8 h-8" />
              <div id="user-holder" className="flex items-center w-auto h-auto">
                <button
                  className="flex items-center gap-x-2"
                  aria-label="Open user settings"
                  onClick={() => setShowSettings((prev) => !prev)}
                >
                  <Image
                    src={
                      typeof session?.user?.image === "string" &&
                        session.user.image.length > 0
                        ? session.user.image
                        : "/assets/vierra-logo-black.png"
                    }
                    alt="Profile"
                    width={32}
                    height={32}
                    className="object-cover w-8 h-8 rounded-full bg-black"
                    priority
                    quality={100}
                  />
                  <div id="name-holder" className="w-auto h-auto text-[#111014] flex items-center font-semibold">
                    <span className="">{session?.user?.name ? session.user.name : "Vierra Admin"}</span>
                  </div>
                  <div id="dropdowner" className="">
                    <RiArrowDropDownLine width={32}
                      height={32} className="w-8 h-8" />
                  </div>
                </button>
              </div>
            </div>
          </div>
          <div id="right-side-body" className="flex w-full h-full bg-white">
            {/* This is the working area. Put in different options (Dashboard, Clients, etc. ) as components */}

            {currentSection === 0 && <DashboardSection />}
            {currentSection === 1 && <ClientsSection />}
            {currentSection === 2 && <TeamPanelSection />}
            {currentSection === 3 && <MarketingSection />}

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
      {isLtvModalOpen && (
        <LtvCalculatorModal
          isOpen={isLtvModalOpen}
          onClose={() => setIsLtvModalOpen(false)}
        />
      )}
      {isAddClientOpen && (
        <AddClientModal
          isOpen={isAddClientOpen}
          onClose={() => {
            setIsAddClientOpen(false)
            fetchSessions() // safety refetch
          }}
          onCreated={(row) => {
            setItems((prev) => [row, ...prev])
          }}
        />
      )}
    </>
  )

  return null
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
