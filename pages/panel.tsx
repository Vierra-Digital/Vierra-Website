import { useCallback, useEffect, useRef, useState } from "react"
import Head from "next/head"
import { inter } from "@/lib/fonts";
import Image from "next/image"
import ProfileImage from "@/components/ProfileImage"
import { profileImageSrc } from "@/lib/profileImage"
import { getInitialUserProfile } from "@/lib/profileImage.server"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useRouter } from "next/router"
// One icon family for the whole rail. Seven families for ten icons meant seven different
// stroke weights and optical sizes sitting in a column, which is most of what read as clutter.
import {
  FiShield,
  FiFolder,
  FiArrowLeft,
  FiMail,
  FiGrid,
  FiGlobe,
  FiFileText,
  FiUsers,
  FiPercent,
  FiFile,
  FiUserCheck,
} from "react-icons/fi"
import { RiArrowDropDownLine } from "react-icons/ri";
import { useSession } from "@/lib/session-client"
import { useActivityHeartbeat } from "@/hooks/useActivityHeartbeat"
const SignPdfSection = dynamic(
  () => import("@/components/PanelPages/SignPdfSection"),
  { ssr: false }
)
const AddClientModal = dynamic(() => import("@/components/ui/AddClientModal"), {
  ssr: false,
})
import { requireSession } from "@/lib/auth"
import type { GetServerSideProps } from "next"
const DashboardSection = dynamic(
  () => import("@/components/PanelPages/DashboardSection"),
  { ssr: false }
)
const ClientsSection = dynamic(
  () => import("@/components/PanelPages/ClientsSection"),
  { ssr: false }
)
const TeamPanelSection = dynamic(
  () => import("@/components/PanelPages/TeamPanelSection"),
  { ssr: false }
)
const LtvCalculatorSection = dynamic(
  () => import("@/components/PanelPages/LTVCalculatorSection"),
  { ssr: false }
)
const OutreachSection = dynamic(
  () => import("@/components/PanelPages/OutreachSection"),
  { ssr: false }
)
const ProjectManagement = dynamic(
  () => import("../components/PanelPages/ProjectManagement"),
  { ssr: false }
)
const BlogEditorSection = dynamic(
  () => import("@/components/PanelPages/BlogEditorSection"),
  { ssr: false }
)
const AdminEditorSection = dynamic(
  () => import("@/components/PanelPages/AdminEditorSection"),
  { ssr: false }
)
const FilesSection = dynamic(
  () => import("@/components/PanelPages/FilesSection"),
  { ssr: false }
)
const ClientViewOutreachSection = dynamic(
  () => import("@/components/PanelPages/ClientViewOutreachSection"),
  { ssr: false }
)
const LinkedInContextSection = dynamic(
  () => import("@/components/PanelPages/LinkedInContextSection"),
  { ssr: false }
)
const UserSettingsPage = dynamic(() => import("@/components/UserSettingsPage"), {
  ssr: false,
})


type PanelPageProps = {
  initialUserRole: "admin" | "staff"
  initialUserName: string | null
  initialImageVersion: number | string
}

// Maps a kept-alive panel section to the data domain in /api/panel/section-versions that
// backs it, so a change on the server (by this admin in another tab, or a different admin
// entirely) can force that one section to remount and refetch instead of showing what it
// last loaded. Sections not listed here (Dashboard, Clients, Ltv Calculator, Sign Pdf) either
// already refetch on their own (Clients' refreshTrigger) or have no server-mutated backing data.
const SECTION_VERSION_DOMAIN: Record<number, string> = {
  2: "team",
  5: "outreach",
  6: "projects",
  7: "blog",
  8: "team",
  10: "files",
}

const PanelPage = ({ initialUserRole, initialUserName, initialImageVersion }: PanelPageProps) => {
  const router = useRouter()
  const [showSettings, setShowSettings] = useState(false)
  const [currentSection, setCurrentSection] = useState(0);
  const [visitedSections, setVisitedSections] = useState<Set<number>>(() => new Set([0]))
  const [sectionEpoch, setSectionEpoch] = useState<Record<number, number>>({})
  const lastSectionVersionsRef = useRef<Record<string, string>>({})
  const visitedSectionsRef = useRef<Set<number>>(new Set([0]))
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const { data: session } = useSession()
  const [isAddClientOpen, setIsAddClientOpen] = useState(false)
  const [clientRefreshTrigger, setClientRefreshTrigger] = useState(0)
  const [currentUserName, setCurrentUserName] = useState<string | null>(initialUserName)
  const [imageVersion, setImageVersion] = useState<number | string>(initialImageVersion)
  const [isClientViewMode, setIsClientViewMode] = useState(false)
  const [viewModeSection, setViewModeSection] = useState<0 | 1 | 2 | 3>(0)
  const [viewClient, setViewClient] = useState<{ id: string; name: string; email: string } | null>(null)
  const resolvedUserRole = ((session?.user as any)?.role ?? initialUserRole) as "admin" | "staff"
  const isAdmin = resolvedUserRole === "admin"
  const isStaff = resolvedUserRole === "staff"
  const canAccessEmailPanel = isAdmin || isStaff

  useEffect(() => {
    fetchCurrentUser()
  }, [])

  // Clients is the section admins land on most right after Dashboard, and its fetch is a
  // single cheap indexed query — worth mounting (and fetching) immediately on login rather
  // than waiting for the first click, same treatment as Settings. Gated on initialUserRole
  // (known synchronously from SSR) rather than resolvedUserRole, which depends on the
  // session hook resolving client-side first.
  useEffect(() => {
    if (initialUserRole === "admin") {
      setVisitedSections((prev) => (prev.has(1) ? prev : new Set(prev).add(1)))
    }
  }, [initialUserRole])

  // Staff Orbital is common but not the universal first click — warm it a couple seconds
  // after login instead of competing with Dashboard/Settings/Clients for the same burst of
  // initial requests.
  useEffect(() => {
    const timer = setTimeout(() => {
      setVisitedSections((prev) => (prev.has(2) ? prev : new Set(prev).add(2)))
    }, 2000)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    setVisitedSections((prev) => (prev.has(currentSection) ? prev : new Set(prev).add(currentSection)))
  }, [currentSection])

  useEffect(() => {
    visitedSectionsRef.current = visitedSections
  }, [visitedSections])

  const hasVersionedSection = useCallback(
    (sections: Set<number>) => Array.from(sections).some((s) => s in SECTION_VERSION_DOMAIN),
    []
  )

  const checkSectionVersions = useCallback(async () => {
    try {
      const res = await fetch("/api/panel/section-versions", { cache: "no-store" })
      if (!res.ok) return
      const data: Record<string, string> = await res.json()
      const changedDomains = new Set<string>()
      for (const [domain, version] of Object.entries(data)) {
        const prev = lastSectionVersionsRef.current[domain]
        if (prev !== undefined && prev !== version) changedDomains.add(domain)
        lastSectionVersionsRef.current[domain] = version
      }
      if (changedDomains.size === 0) return
      setSectionEpoch((prev) => {
        const next = { ...prev }
        Object.entries(SECTION_VERSION_DOMAIN).forEach(([sectionKey, domain]) => {
          if (changedDomains.has(domain)) {
            const sectionNum = Number(sectionKey)
            next[sectionNum] = (next[sectionNum] || 0) + 1
          }
        })
        return next
      })
    } catch {
      // Best-effort staleness check; keep showing whatever's already loaded on failure.
    }
  }, [])

  // Only worth hitting the DB for staff who have actually visited a section backed by
  // /api/panel/section-versions — most sections (Dashboard, Clients, Ltv Calculator, Sign
  // Pdf) either don't need it or already refetch on their own, and most staff never touch
  // Team/Files/Outreach/Projects/Blog in a given session at all.
  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden && hasVersionedSection(visitedSectionsRef.current)) checkSectionVersions()
    }
    document.addEventListener("visibilitychange", handleVisibility)
    return () => document.removeEventListener("visibilitychange", handleVisibility)
  }, [checkSectionVersions, hasVersionedSection])

  useEffect(() => {
    // Runs on the *first* visit too (not just revisits): checkSectionVersions() is a no-op
    // the first time it sees a domain (nothing to diff against yet), but it still records
    // that domain's baseline version. Skipping the first visit would mean the baseline gets
    // captured one visit too late — the first revisit would silently adopt whatever changed
    // in the meantime as the new "no change" baseline instead of detecting it.
    if (currentSection in SECTION_VERSION_DOMAIN) {
      checkSectionVersions()
    }
  }, [currentSection, checkSectionVersions])

  useEffect(() => {
    if (!router.isReady) return;
    if (router.query.settings === "1") {
      setShowSettings(true);
    }
  }, [router.isReady, router.query.settings]);

  useActivityHeartbeat();

  async function fetchCurrentUser() {
    try {
      const response = await fetch("/api/profile/getUser")
      if (response.ok) {
        const userData = await response.json()
        setCurrentUserName(userData.name)
        if (userData.imageVersion) setImageVersion(userData.imageVersion)
      }
    } catch (error) {
      console.error("Failed to fetch current user:", error)
    }
  }

  const enterClientViewMode = (client: { id: string; name: string; email: string }) => {
    setViewClient(client)
    setIsClientViewMode(true)
    setViewModeSection(0)
    setCurrentSection(1)
    setShowSettings(false)
    setIsSidebarOpen(false)
  }

  const exitClientViewMode = () => {
    setIsClientViewMode(false)
    setViewClient(null)
    setViewModeSection(0)
    setCurrentSection(1)
    setShowSettings(false)
  }


  return (
    <>
      <Head>
        <title>Vierra | Admin Panel</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <div id="main-panel" className="fixed inset-0 w-full h-full bg-white flex flex-row overflow-hidden">
        <div id="left-side" className={`relative flex flex-col h-full shrink-0 z-20 bg-[#6B1BC4] border-r border-white/[0.09] transition-all ease-in-out duration-300 ${isSidebarOpen ? "min-w-[224px]" : "w-0"} md:w-[224px] overflow-hidden`}>
          <div id="vierra-nameplate-body" className="w-full shrink-0 flex items-center justify-center px-4 pt-7 pb-6">
            <Link href="/">
              <Image
                src="/assets/vierra-logo-panel.png"
                alt="Vierra Go Home"
                width={152}
                height={56}
                className="w-[108px] h-auto"
              />
            </Link>
          </div>
          <div id="panel-nav" className="w-full flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col gap-y-[14px] items-center text-[#EDF1F5] pt-0 pb-5">
            {isClientViewMode ? (
              <>
                <div id="panel-nav-item" onClick={() => { setViewModeSection(0); setShowSettings(false); setIsSidebarOpen(false)}} className={`w-[calc(100%-16px)] flex h-[34px] flex-row items-center rounded-lg gap-x-3 px-3 cursor-pointer transition-colors duration-150 ${viewModeSection === 0 ? 'bg-white/[0.16] text-white font-medium' : 'text-white hover:bg-white/[0.09]'}`}>
                  <FiGrid className="w-4 h-4 shrink-0" />
                  <span className={`text-xs tracking-[-0.005em] ${inter.className}`}>
                    Dashboard
                  </span>
                </div>
                <div id="panel-nav-item" onClick={() => { setViewModeSection(2); setShowSettings(false); setIsSidebarOpen(false)}} className={`w-[calc(100%-16px)] flex h-[34px] flex-row items-center rounded-lg gap-x-3 px-3 cursor-pointer transition-colors duration-150 ${viewModeSection === 2 ? 'bg-white/[0.16] text-white font-medium' : 'text-white hover:bg-white/[0.09]'}`}>
                  <FiGlobe className="w-4 h-4 shrink-0" />
                  <span className={`text-xs tracking-[-0.005em] ${inter.className}`}>
                    Outreach
                  </span>
                </div>
                <div id="panel-nav-item" onClick={() => { setViewModeSection(3); setShowSettings(false); setIsSidebarOpen(false)}} className={`w-[calc(100%-16px)] flex h-[34px] flex-row items-center rounded-lg gap-x-3 px-3 cursor-pointer transition-colors duration-150 ${viewModeSection === 3 ? 'bg-white/[0.16] text-white font-medium' : 'text-white hover:bg-white/[0.09]'}`}>
                  <FiFileText className="w-4 h-4 shrink-0" />
                  <span className={`text-xs tracking-[-0.005em] ${inter.className}`}>
                    Context
                  </span>
                </div>
                <div id="panel-nav-item" onClick={() => { setViewModeSection(1); setShowSettings(false); setIsSidebarOpen(false)}} className={`w-[calc(100%-16px)] flex h-[34px] flex-row items-center rounded-lg gap-x-3 px-3 cursor-pointer transition-colors duration-150 ${viewModeSection === 1 ? 'bg-white/[0.16] text-white font-medium' : 'text-white hover:bg-white/[0.09]'}`}>
                  <FiFolder className="w-4 h-4 shrink-0" />
                  <span className={`text-xs tracking-[-0.005em] ${inter.className}`}>
                    Files
                  </span>
                </div>
              </>
            ) : (
              <>
                <div id="panel-nav-item" onClick={() => { setCurrentSection(0); setShowSettings(false); setIsSidebarOpen(false)}} className={`w-[calc(100%-16px)] flex h-[34px] flex-row items-center rounded-lg gap-x-3 px-3 cursor-pointer transition-colors duration-150 ${currentSection === 0 ? 'bg-white/[0.16] text-white font-medium' : 'text-white hover:bg-white/[0.09]'}`}>
                  <FiGrid className="w-4 h-4 shrink-0" />
                  <span className={`text-xs tracking-[-0.005em] ${inter.className}`}>
                    Dashboard
                  </span>
                </div>
                {!isStaff && (
                  <div id="panel-nav-item" onClick={() => { setCurrentSection(1); setShowSettings(false); setIsSidebarOpen(false)}} className={`w-[calc(100%-16px)] flex h-[34px] flex-row items-center rounded-lg gap-x-3 px-3 cursor-pointer transition-colors duration-150 ${currentSection === 1 ? 'bg-white/[0.16] text-white font-medium' : 'text-white hover:bg-white/[0.09]'}`}>
                    <FiUsers className="w-4 h-4 shrink-0" />
                    <span className={`text-xs tracking-[-0.005em] ${inter.className}`}>
                      Clients
                    </span>
                  </div>
                )}
                <div id="panel-nav-item" onClick={() => { setCurrentSection(2); setShowSettings(false); setIsSidebarOpen(false)}} className={`w-[calc(100%-16px)] flex h-[34px] flex-row items-center rounded-lg gap-x-3 px-3 cursor-pointer transition-colors duration-150 ${currentSection === 2 ? 'bg-white/[0.16] text-white font-medium' : 'text-white hover:bg-white/[0.09]'}`}>
                  <FiUserCheck className="w-4 h-4 shrink-0" />
                  <span className={`text-xs tracking-[-0.005em] ${inter.className}`}>
                    Staff Orbital
                  </span>
                </div>
                {canAccessEmailPanel && (
                  <div id="panel-nav-item" onClick={() => { window.open('/panel/email', '_blank', 'noopener,noreferrer'); setIsSidebarOpen(false); }} className="w-[calc(100%-16px)] flex h-[34px] flex-row items-center rounded-lg gap-x-3 px-3 cursor-pointer transition-colors duration-150 hover:bg-white hover:text-black">
                    <FiMail className="w-4 h-4 shrink-0" />
                    <span className={`text-xs tracking-[-0.005em] ${inter.className}`}>
                      Email Panel
                    </span>
                  </div>
                )}
                <div id="panel-nav-item" onClick={() => { setCurrentSection(5); setShowSettings(false); setIsSidebarOpen(false)}} className={`w-[calc(100%-16px)] flex h-[34px] flex-row items-center rounded-lg gap-x-3 px-3 cursor-pointer transition-colors duration-150 ${currentSection === 5 ? 'bg-white/[0.16] text-white font-medium' : 'text-white hover:bg-white/[0.09]'}`}>
                  <FiGlobe className="w-4 h-4 shrink-0" />
                  <span className={`text-xs tracking-[-0.005em] ${inter.className}`}>
                    Marketing Tracker
                  </span>
                </div>
                <div id="panel-nav-item" onClick={() => { setCurrentSection(6); setShowSettings(false); setIsSidebarOpen(false)}} className={`w-[calc(100%-16px)] flex h-[34px] flex-row items-center rounded-lg gap-x-3 px-3 cursor-pointer transition-colors duration-150 ${currentSection === 6 ? 'bg-white/[0.16] text-white font-medium' : 'text-white hover:bg-white/[0.09]'}`}>
                  <FiFolder className="w-4 h-4 shrink-0" />
                  <span className={`text-xs tracking-[-0.005em] ${inter.className}`}>
                    Project Tasks
                  </span>
                </div>
                
                {!isStaff && (
                  <div
                    id="panel-nav-item"
                    onClick={() => { setCurrentSection(9); setShowSettings(false); setIsSidebarOpen(false); }}
                    className={`w-[calc(100%-16px)] flex h-[34px] flex-row items-center rounded-lg gap-x-3 px-3 cursor-pointer transition-colors duration-150 ${currentSection === 9 ? 'bg-white/[0.16] text-white font-medium' : 'text-white hover:bg-white/[0.09]'}`}
                  >
                    <FiFile />
                    <span className={`text-xs tracking-[-0.005em] ${inter.className}`}>
                      PDF Signer
                    </span>
                  </div>
                )}
                <div
                  id="panel-nav-item"
                  onClick={() => { setCurrentSection(4); setShowSettings(false); setIsSidebarOpen(false)}}
                  className={`w-[calc(100%-16px)] flex h-[34px] flex-row items-center rounded-lg gap-x-3 px-3 cursor-pointer transition-colors duration-150 ${currentSection === 4 ? 'bg-white/[0.16] text-white font-medium' : 'text-white hover:bg-white/[0.09]'}`}
                >
                  <FiPercent className="w-4 h-4 shrink-0" />
                  <span className={`text-xs tracking-[-0.005em] ${inter.className}`}>
                    LTV Calculator
                  </span>
                </div>
                <div
                  id="panel-nav-item"
                  onClick={() => { setCurrentSection(7); setShowSettings(false); setIsSidebarOpen(false)}}
                  className={`w-[calc(100%-16px)] flex h-[34px] flex-row items-center rounded-lg gap-x-3 px-3 cursor-pointer transition-colors duration-150 ${currentSection === 7 ? 'bg-white/[0.16] text-white font-medium' : 'text-white hover:bg-white/[0.09]'}`}
                >
                  <FiFileText className="w-4 h-4 shrink-0" />
                  <span className={`text-xs tracking-[-0.005em] ${inter.className}`}>
                    Blog Editor
                  </span>
                </div>
                <div
                  id="panel-nav-item"
                  onClick={() => { setCurrentSection(10); setShowSettings(false); setIsSidebarOpen(false)}}
                  className={`w-[calc(100%-16px)] flex h-[34px] flex-row items-center rounded-lg gap-x-3 px-3 cursor-pointer transition-colors duration-150 ${currentSection === 10 ? 'bg-white/[0.16] text-white font-medium' : 'text-white hover:bg-white/[0.09]'}`}
                >
                  <FiFolder className="w-4 h-4 shrink-0" />
                  <span className={`text-xs tracking-[-0.005em] ${inter.className}`}>
                    Files
                  </span>
                </div>
                {!isStaff && (
                  <div
                    id="panel-nav-item"
                    onClick={() => { setCurrentSection(8); setShowSettings(false); setIsSidebarOpen(false)}}
                    className={`w-[calc(100%-16px)] flex h-[34px] flex-row items-center rounded-lg gap-x-3 px-3 cursor-pointer transition-colors duration-150 ${currentSection === 8 ? 'bg-white/[0.16] text-white font-medium' : 'text-white hover:bg-white/[0.09]'}`}
                  >
                    <FiShield className="w-4 h-4 shrink-0" />
                    <span className={`text-xs tracking-[-0.005em] ${inter.className}`}>
                      User Management
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* One nav-item-height gap above the bottom action. The nav list above is
              flex-1 + scrollable, so it absorbs extra height and this gap only
              compresses on screens too short to fit everything — never overlaps. */}
          <div className="w-full shrink-0" style={{ height: 52 }} aria-hidden="true" />
          <div className="w-full flex flex-col items-center shrink-0 gap-y-0.5 border-t border-white/[0.09] pt-2.5 pb-3">
            {/* Account lives at the foot of the rail and opens upward — the pattern Linear,
                Vercel and Attio share. It replaces a 48px global bar whose only other control
                was a search field that did nothing. */}
            <div className="relative w-[calc(100%-16px)]">
              <button
                type="button"
                aria-label="Open user settings"
                aria-expanded={showSettings}
                onClick={() => setShowSettings((prev) => !prev)}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors duration-150 ${showSettings ? "bg-white/[0.08]" : "hover:bg-white/[0.05]"}`}
              >
                <ProfileImage
                  src={profileImageSrc(imageVersion)}
                  alt="Profile"
                  name={currentUserName || session?.user?.name || "User"}
                  size={26}
                  priority
                  quality={100}
                />
                <span className={`min-w-0 flex-1 truncate text-xs font-medium text-white ${inter.className}`}>
                  {currentUserName || session?.user?.name || "Vierra Admin"}
                </span>
                <RiArrowDropDownLine className={`h-5 w-5 shrink-0 text-white/50 transition-transform duration-150 ${showSettings ? "rotate-180" : ""}`} />
              </button>
            </div>

            {isClientViewMode ? (
              <button
                onClick={exitClientViewMode}
                className="group w-[calc(100%-16px)] flex h-[34px] flex-row items-center gap-x-2.5 px-3 justify-start rounded-lg text-white bg-transparent hover:bg-white/[0.09] transition-colors duration-150"
              >
                <FiArrowLeft className="w-4 h-4 shrink-0" />
                <span className={`text-xs ${inter.className} ml-2`}>Back</span>
              </button>
            ) : null}
            {/* Logout lives in Account Settings, reachable from the account chip above — the rail
                is for navigation, and a sign-out sitting one row under it was easy to mis-click. */}
          </div>
        </div>
        <div id="right-side" className="flex flex-col flex-1 min-w-0 h-full relative overflow-x-hidden">
          {/* Section wrappers are plain block divs, so as flex items with no grow they
              shrink-to-fit their content — every page rendered at its content width and sat
              left with dead space beside it, which got worse the wider the display. Forcing
              children to full width fixes all of them at once. */}
          {/* The sidebar toggle lived in the removed top bar. On mobile the rail collapses to
              w-0, so without this there is no way to open it. */}
          <button
            type="button"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            aria-label="Toggle sidebar"
            className="md:hidden absolute left-3 top-3 z-30 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#ECE9F3] bg-white/95 text-[#701CC0] shadow-sm backdrop-blur"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div id="right-side-body" className="flex w-full h-full bg-white overflow-y-auto overflow-x-hidden relative [&>div]:w-full [&>div]:min-w-0">
            {/* Mounted immediately on login (not lazily on first click) and kept mounted for the
                rest of the session — matches the visitedSections pattern below — so switching to
                Settings never re-triggers its getSettings/gmail/social/calendar fetches. */}
            <div style={{ display: showSettings ? undefined : "none" }}>
              <UserSettingsPage
                user={{
                  name: currentUserName,
                  email: session?.user?.email || "test@vierra.com",
                  image: profileImageSrc(imageVersion),
                }}
                userRole={resolvedUserRole}
                onNameUpdate={setCurrentUserName}
                onImageUpdate={async () => {
                  const r = await fetch("/api/profile/getUser")
                  if (r.ok) {
                    const d = await r.json()
                    if (d.imageVersion) setImageVersion(d.imageVersion)
                  }
                }}
                onClose={() => setShowSettings(false)}
                variant="panel"
              />
            </div>
            <div style={{ display: showSettings ? "none" : undefined }}>
              {isClientViewMode ? (
                    <>
                      {viewModeSection === 0 && <DashboardSection />}
                      {viewModeSection === 1 && (
                        <FilesSection readOnly allowDelete showOwnerInReadOnly fileFilter={viewClient?.id} />
                      )}
                      {viewModeSection === 2 && <ClientViewOutreachSection clientId={viewClient?.id || null} />}
                      {viewModeSection === 3 && <LinkedInContextSection title="Context" clientId={viewClient?.id || null} />}
                    </>
                  ) : (
                    <>
                      {visitedSections.has(0) && (
                        <div style={{ display: currentSection === 0 ? undefined : "none" }}>
                          <DashboardSection />
                        </div>
                      )}
                      {visitedSections.has(1) && !isStaff && (
                        <div style={{ display: currentSection === 1 ? undefined : "none" }}>
                          <ClientsSection
                            onAddClient={() => setIsAddClientOpen(true)}
                            refreshTrigger={clientRefreshTrigger}
                            onViewClient={enterClientViewMode}
                          />
                        </div>
                      )}
                      {visitedSections.has(2) && (
                        <div key={`section-2-${sectionEpoch[2] || 0}`} style={{ display: currentSection === 2 ? undefined : "none" }}>
                          <TeamPanelSection userRole={resolvedUserRole} />
                        </div>
                      )}
                      {visitedSections.has(4) && (
                        <div style={{ display: currentSection === 4 ? undefined : "none" }}>
                          <LtvCalculatorSection />
                        </div>
                      )}
                      {visitedSections.has(5) && (
                        <div key={`section-5-${sectionEpoch[5] || 0}`} style={{ display: currentSection === 5 ? undefined : "none" }}>
                          <OutreachSection />
                        </div>
                      )}
                      {visitedSections.has(6) && (
                        <div key={`section-6-${sectionEpoch[6] || 0}`} style={{ display: currentSection === 6 ? undefined : "none" }}>
                          <ProjectManagement />
                        </div>
                      )}
                      {visitedSections.has(7) && (
                        <div
                          key={`section-7-${sectionEpoch[7] || 0}`}
                          className="w-full pb-24"
                          style={{ display: currentSection === 7 ? undefined : "none" }}
                        >
                          <BlogEditorSection />
                        </div>
                      )}
                      {visitedSections.has(8) && !isStaff && (
                        <div key={`section-8-${sectionEpoch[8] || 0}`} style={{ display: currentSection === 8 ? undefined : "none" }}>
                          <AdminEditorSection />
                        </div>
                      )}
                      {visitedSections.has(9) && !isStaff && (
                        <div style={{ display: currentSection === 9 ? undefined : "none" }}>
                          <SignPdfSection />
                        </div>
                      )}
                      {visitedSections.has(10) && (
                        <div key={`section-10-${sectionEpoch[10] || 0}`} style={{ display: currentSection === 10 ? undefined : "none" }}>
                          <FilesSection />
                        </div>
                      )}
                    </>
                  )}
            </div>
          </div>
        </div>
      </div>

      {isAddClientOpen && (
        <AddClientModal
          isOpen={isAddClientOpen}
          onClose={() => {
            setIsAddClientOpen(false)
          }}
          onCreated={() => {
            setClientRefreshTrigger(prev => prev + 1)
          }}
        />
      )}
      <style jsx>{`
        #right-side-body {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        #right-side-body::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await requireSession(ctx.req, ctx.res)

  if (!session) {
    return { redirect: { destination: "/login", permanent: false } }
  }
  if (session.kind === "client") {
    return { redirect: { destination: "/client", permanent: false } }
  }
  if (session.kind !== "member") {
    return { redirect: { destination: "/onboarding/start", permanent: false } }
  }
  if (session.user.role !== "staff" && session.user.role !== "admin") {
    return { redirect: { destination: "/onboarding/start", permanent: false } }
  }
  const profile = await getInitialUserProfile(session.user.id)
  return {
    props: {
      initialUserRole: (session.user as any).role as "admin" | "staff",
      initialUserName: profile.name,
      initialImageVersion: profile.imageVersion,
    },
  }
}

export default PanelPage
