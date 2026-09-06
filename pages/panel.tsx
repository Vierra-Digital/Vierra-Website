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
  FiFile,
  FiUserCheck,
} from "react-icons/fi"
import { RiArrowDropDownLine } from "react-icons/ri";
import { useSession } from "@/lib/session-client"
import { useActivityHeartbeat } from "@/hooks/useActivityHeartbeat"
import { useActiveClient } from "@/lib/activeClient"
import { PANEL_SECTIONS, resolvePanelSection } from "@/lib/panel/navigation"
import { confirmDiscardDrafts } from "@/lib/panel/drafts"
import { usePageLeaveGuard } from "@/hooks/useDraftGuard"

/**
 * The sections this file actually mounts. PANEL_SECTIONS is wider — it still carries ltv, blog and
 * artemis, which this branch removed from the panel — so a URL naming one of those has to be caught
 * here instead of switching to a section with nothing behind it.
 */
const RENDERED_SECTIONS = new Set([0, 1, 2, 5, 6, 8, 9, 10])

/**
 * Sections whose markup is gated on !isStaff. resolvePanelSection already withholds 8 and 9 from
 * staff, but not 1 — it has no reason to, since Clients is staff-visible on master. Here it is not,
 * so a staff member following ?section=clients would land on a section that renders nothing.
 */
const ADMIN_ONLY_SECTIONS = new Set([1, 8, 9])
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
const OutreachSection = dynamic(
  () => import("@/components/PanelPages/OutreachSection"),
  { ssr: false }
)
const ProjectManagement = dynamic(
  () => import("../components/PanelPages/ProjectManagement"),
  { ssr: false }
)
const AdminEditorSection = dynamic(
  () => import("@/components/PanelPages/AdminEditorSection"),
  { ssr: false }
)
const ClientOverviewSection = dynamic(
  () => import("@/components/PanelPages/ClientOverviewSection"),
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
  8: "team",
  10: "files",
}

const PanelPage = ({ initialUserRole, initialUserName, initialImageVersion }: PanelPageProps) => {
  const router = useRouter()
  const [showSettings, setShowSettings] = useState(false)
  const [navigationNotice, setNavigationNotice] = useState("")
  /**
   * Sections stay mounted behind display:none so returning to one is instant, which also means it
   * shows whatever it last loaded. Files is the one where that is visibly wrong — a PDF filed from
   * the signer belongs in the list the moment the reader opens it — so each visit bumps this and
   * the section refetches.
   */
  const [filesVisitCount, setFilesVisitCount] = useState(0)
  const clientListScrollRef = useRef(0)
  const clientListReturnIdRef = useRef("")
  const [currentSection, setCurrentSection] = useState(0);
  // Section 0 is always mounted; section 1 (Clients) joins it immediately for admins, who land
  // there most often right after Dashboard. Seeded here rather than added by an effect — this is
  // gated on initialUserRole, which comes from SSR and so is identical on the server and the first
  // client render, meaning there is nothing to defer.
  const [visitedSections, setVisitedSections] = useState<Set<number>>(() =>
    initialUserRole === "admin" ? new Set([0, 1]) : new Set([0])
  )
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
  const [viewClient, setViewClient] = useState<{ id: string; name: string; email: string; companyId: string } | null>(null)
  const resolvedUserRole = ((session?.user as any)?.role ?? initialUserRole) as "admin" | "staff"
  const { activeClient, setActiveClient } = useActiveClient()

  /**
   * The section lives in the URL, so Back/Forward and bookmarks work and a link can point at a
   * particular page of the panel. The nav buttons only push; this effect is the single place that
   * turns a URL into state, which is why they do not set it themselves.
   *
   * resolvePanelSection is shared with master and still knows the sections this branch dropped
   * (ltv, blog, artemis — LTV is a modal now). Those resolve to a number nothing renders, so they
   * are checked against what is actually mounted and fall back to Dashboard with a notice rather
   * than showing an empty panel.
   */
  useEffect(() => {
    if (!router.isReady) return
    const resolved = resolvePanelSection(router.query.section, resolvedUserRole)
    const available =
      RENDERED_SECTIONS.has(resolved.section) &&
      !(resolvedUserRole === "staff" && ADMIN_ONLY_SECTIONS.has(resolved.section))
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentSection(available ? resolved.section : 0)
    setNavigationNotice(
      resolved.invalid || !available ? "This page is unavailable. Showing Dashboard." : ""
    )
  }, [router.isReady, router.query.section, resolvedUserRole])

  usePageLeaveGuard()

  const navigateSection = (section: number) => {
    void (async () => {
      if (!(await confirmDiscardDrafts())) return
      if (section === 10) setFilesVisitCount((count) => count + 1)
      setShowSettings(false)
      setIsSidebarOpen(false)
      await router
        .push(
          { pathname: "/panel", query: { ...router.query, section: PANEL_SECTIONS[section] } },
          undefined,
          { shallow: true, scroll: false }
        )
        .catch(() => {})
    })()
  }

  const isAdmin = resolvedUserRole === "admin"
  const isStaff = resolvedUserRole === "staff"
  const canAccessEmailPanel = isAdmin || isStaff

  // Moved above the effect that calls it. As a hoisted function declaration its position never
  // affected behaviour, but referencing it from further up the file read as a use-before-
  // declaration, and the compiler flagged it as one.
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

  useEffect(() => {
    // Fetching the profile on mount: the call flips its own state after awaiting, which is what
    // an effect is for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCurrentUser()
  }, [])

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
    // Accumulated history, not derived state: once a section has been visited it stays mounted for
    // the session. Recording it here rather than in the navigation handlers catches every path that
    // can change the section, including a deep link landing straight on one.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      // eslint-disable-next-line react-hooks/set-state-in-effect
      checkSectionVersions()
    }
  }, [currentSection, checkSectionVersions])

  useEffect(() => {
    if (!router.isReady) return;
    // Query parameters are not populated until the router is ready, so this cannot be read during
    // the first render — deferring it is the only way to honour ?settings=1.
    if (router.query.settings === "1") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowSettings(true);
    }
  }, [router.isReady, router.query.settings]);

  useActivityHeartbeat();



  /**
   * Scoped to "client": a draft belonging to the client workspace should be settled before moving
   * within it, while a draft elsewhere in the panel is not this navigation's business.
   */
  const navigateViewModeSection = (section: 0 | 1 | 2 | 3) => {
    void (async () => {
      if (!(await confirmDiscardDrafts("client"))) return
      setViewModeSection(section)
      setShowSettings(false)
      setIsSidebarOpen(false)
    })()
  }

  const enterClientViewMode = async (client: { id: string; name: string; email: string; companyId: string }) => {
    if (!(await confirmDiscardDrafts())) return
    // Where to put the reader back when they return: the row they opened, and the scroll offset
    // the list was at. Without both, leaving a workspace dropped them at the top of an unfamiliar
    // list with focus on the body.
    clientListScrollRef.current = document.getElementById("right-side-body")?.scrollTop ?? 0
    clientListReturnIdRef.current = `open-client-${client.id}`
    setViewClient(client)
    setIsClientViewMode(true)
    setViewModeSection(0)
    setCurrentSection(1)
    setShowSettings(false)
    setIsSidebarOpen(false)
  }

  /**
   * Runs after the state change has been queued, so the list is back on screen by the time the
   * frame fires and there is something to focus and scroll.
   */
  const restoreClientList = () => {
    requestAnimationFrame(() => {
      document.getElementById(clientListReturnIdRef.current)?.focus({ preventScroll: true })
      const body = document.getElementById("right-side-body")
      if (body) body.scrollTop = clientListScrollRef.current
    })
  }

  const exitClientViewMode = async () => {
    if (!(await confirmDiscardDrafts("client"))) return
    restoreClientList()
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
                <button type="button" aria-current={viewModeSection === 0 && !showSettings ? "page" : undefined} onClick={() => navigateViewModeSection(0)} className={`w-[calc(100%-16px)] shrink-0 flex h-[34px] flex-row items-center rounded-lg gap-x-3 px-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition-colors duration-150 ${viewModeSection === 0 ? 'bg-white/[0.16] text-white font-medium' : 'text-white hover:bg-white/[0.09]'}`}>
                  <FiGrid className="w-4 h-4 shrink-0" />
                  <span className={`text-xs tracking-[-0.005em] ${inter.className}`}>
                    Dashboard
                  </span>
                </button>
                <button type="button" aria-current={viewModeSection === 2 && !showSettings ? "page" : undefined} onClick={() => navigateViewModeSection(2)} className={`w-[calc(100%-16px)] shrink-0 flex h-[34px] flex-row items-center rounded-lg gap-x-3 px-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition-colors duration-150 ${viewModeSection === 2 ? 'bg-white/[0.16] text-white font-medium' : 'text-white hover:bg-white/[0.09]'}`}>
                  <FiGlobe className="w-4 h-4 shrink-0" />
                  <span className={`text-xs tracking-[-0.005em] ${inter.className}`}>
                    Outreach
                  </span>
                </button>
                <button type="button" aria-current={viewModeSection === 3 && !showSettings ? "page" : undefined} onClick={() => navigateViewModeSection(3)} className={`w-[calc(100%-16px)] shrink-0 flex h-[34px] flex-row items-center rounded-lg gap-x-3 px-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition-colors duration-150 ${viewModeSection === 3 ? 'bg-white/[0.16] text-white font-medium' : 'text-white hover:bg-white/[0.09]'}`}>
                  <FiFileText className="w-4 h-4 shrink-0" />
                  <span className={`text-xs tracking-[-0.005em] ${inter.className}`}>
                    Context
                  </span>
                </button>
                <button type="button" aria-current={viewModeSection === 1 && !showSettings ? "page" : undefined} onClick={() => navigateViewModeSection(1)} className={`w-[calc(100%-16px)] shrink-0 flex h-[34px] flex-row items-center rounded-lg gap-x-3 px-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition-colors duration-150 ${viewModeSection === 1 ? 'bg-white/[0.16] text-white font-medium' : 'text-white hover:bg-white/[0.09]'}`}>
                  <FiFolder className="w-4 h-4 shrink-0" />
                  <span className={`text-xs tracking-[-0.005em] ${inter.className}`}>
                    Files
                  </span>
                </button>
              </>
            ) : (
              <>
                <button type="button" aria-current={currentSection === 0 && !showSettings ? "page" : undefined} onClick={() => navigateSection(0)} className={`w-[calc(100%-16px)] shrink-0 flex h-[34px] flex-row items-center rounded-lg gap-x-3 px-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition-colors duration-150 ${currentSection === 0 ? 'bg-white/[0.16] text-white font-medium' : 'text-white hover:bg-white/[0.09]'}`}>
                  <FiGrid className="w-4 h-4 shrink-0" />
                  <span className={`text-xs tracking-[-0.005em] ${inter.className}`}>
                    Dashboard
                  </span>
                </button>
                {!isStaff && (
                  <button type="button" aria-current={currentSection === 1 && !showSettings ? "page" : undefined} onClick={() => navigateSection(1)} className={`w-[calc(100%-16px)] shrink-0 flex h-[34px] flex-row items-center rounded-lg gap-x-3 px-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition-colors duration-150 ${currentSection === 1 ? 'bg-white/[0.16] text-white font-medium' : 'text-white hover:bg-white/[0.09]'}`}>
                    <FiUsers className="w-4 h-4 shrink-0" />
                    <span className={`text-xs tracking-[-0.005em] ${inter.className}`}>
                      Clients
                    </span>
                  </button>
                )}
                <button type="button" aria-current={currentSection === 2 && !showSettings ? "page" : undefined} onClick={() => navigateSection(2)} className={`w-[calc(100%-16px)] shrink-0 flex h-[34px] flex-row items-center rounded-lg gap-x-3 px-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition-colors duration-150 ${currentSection === 2 ? 'bg-white/[0.16] text-white font-medium' : 'text-white hover:bg-white/[0.09]'}`}>
                  <FiUserCheck className="w-4 h-4 shrink-0" />
                  <span className={`text-xs tracking-[-0.005em] ${inter.className}`}>
                    Staff Orbital
                  </span>
                </button>
                {canAccessEmailPanel && (
                  <button type="button" onClick={() => { window.open('/panel/email', '_blank', 'noopener,noreferrer'); setIsSidebarOpen(false); }} className="w-[calc(100%-16px)] shrink-0 flex h-[34px] flex-row items-center rounded-lg gap-x-3 px-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition-colors duration-150 hover:bg-white hover:text-black">
                    <FiMail className="w-4 h-4 shrink-0" />
                    <span className={`text-xs tracking-[-0.005em] ${inter.className}`}>
                      Email Panel
                    </span>
                  </button>
                )}
                <button type="button" aria-current={currentSection === 5 && !showSettings ? "page" : undefined} onClick={() => navigateSection(5)} className={`w-[calc(100%-16px)] shrink-0 flex h-[34px] flex-row items-center rounded-lg gap-x-3 px-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition-colors duration-150 ${currentSection === 5 ? 'bg-white/[0.16] text-white font-medium' : 'text-white hover:bg-white/[0.09]'}`}>
                  <FiGlobe className="w-4 h-4 shrink-0" />
                  <span className={`text-xs tracking-[-0.005em] ${inter.className}`}>
                    Marketing Tracker
                  </span>
                </button>
                <button type="button" aria-current={currentSection === 6 && !showSettings ? "page" : undefined} onClick={() => navigateSection(6)} className={`w-[calc(100%-16px)] shrink-0 flex h-[34px] flex-row items-center rounded-lg gap-x-3 px-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition-colors duration-150 ${currentSection === 6 ? 'bg-white/[0.16] text-white font-medium' : 'text-white hover:bg-white/[0.09]'}`}>
                  <FiFolder className="w-4 h-4 shrink-0" />
                  <span className={`text-xs tracking-[-0.005em] ${inter.className}`}>
                    Project Tasks
                  </span>
                </button>
                
                {!isStaff && (
                  <button
                    type="button"
                    aria-current={currentSection === 9 && !showSettings ? "page" : undefined}
                    onClick={() => navigateSection(9)}
                    className={`w-[calc(100%-16px)] shrink-0 flex h-[34px] flex-row items-center rounded-lg gap-x-3 px-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition-colors duration-150 ${currentSection === 9 ? 'bg-white/[0.16] text-white font-medium' : 'text-white hover:bg-white/[0.09]'}`}
                  >
                    <FiFile />
                    <span className={`text-xs tracking-[-0.005em] ${inter.className}`}>
                      PDF Signer
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  aria-current={currentSection === 10 && !showSettings ? "page" : undefined}
                  onClick={() => navigateSection(10)}
                  className={`w-[calc(100%-16px)] shrink-0 flex h-[34px] flex-row items-center rounded-lg gap-x-3 px-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition-colors duration-150 ${currentSection === 10 ? 'bg-white/[0.16] text-white font-medium' : 'text-white hover:bg-white/[0.09]'}`}
                >
                  <FiFolder className="w-4 h-4 shrink-0" />
                  <span className={`text-xs tracking-[-0.005em] ${inter.className}`}>
                    Files
                  </span>
                </button>
                {!isStaff && (
                  <button
                    type="button"
                    aria-current={currentSection === 8 && !showSettings ? "page" : undefined}
                    onClick={() => navigateSection(8)}
                    className={`w-[calc(100%-16px)] shrink-0 flex h-[34px] flex-row items-center rounded-lg gap-x-3 px-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition-colors duration-150 ${currentSection === 8 ? 'bg-white/[0.16] text-white font-medium' : 'text-white hover:bg-white/[0.09]'}`}
                  >
                    <FiShield className="w-4 h-4 shrink-0" />
                    <span className={`text-xs tracking-[-0.005em] ${inter.className}`}>
                      User Management
                    </span>
                  </button>
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
                onClick={() => void exitClientViewMode()}
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
              {/* Announced rather than shown: a bookmark to a removed section lands on Dashboard,
                  and without this the panel just looks like it ignored the link. */}
              <span role="status" className="sr-only">
                {navigationNotice}
              </span>
              {isClientViewMode ? (
                    <>
                      {viewModeSection === 0 && (
                        <ClientOverviewSection
                          companyId={viewClient?.companyId ?? null}
                          title={viewClient?.name || "Client"}
                        />
                      )}
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
                          {/*
                            Choosing a client is what scopes the rest of the panel: panelFetch reads
                            the id back out of the cache and sends it as companyId. onSetActiveClient
                            was dropped here, so "Set Active" called an undefined callback and nothing
                            was ever written — every request went out unscoped. isAdmin was dropped
                            with it, which defaulted to false and hid the admin row actions.
                          */}
                          <ClientsSection
                            isAdmin={isAdmin}
                            onAddClient={() => setIsAddClientOpen(true)}
                            refreshTrigger={clientRefreshTrigger}
                            onViewClient={(client) => void enterClientViewMode(client)}
                            activeCompanyId={activeClient?.id ?? null}
                            onSetActiveClient={(client) =>
                              // null clears it, which puts the dashboard and the trackers back to
                              // the company-wide view.
                              setActiveClient(
                                client ? { id: client.companyId, name: client.businessName } : null
                              )
                            }
                          />
                        </div>
                      )}
                      {visitedSections.has(2) && (
                        <div key={`section-2-${sectionEpoch[2] || 0}`} style={{ display: currentSection === 2 ? undefined : "none" }}>
                          <TeamPanelSection userRole={resolvedUserRole} />
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
                          <FilesSection refreshTrigger={filesVisitCount} />
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
