"use client"

// Bespoke, self-contained animations for each step of the onboarding timeline.
// All DOM-based (CSS 3D transforms + SVG + Framer Motion) so they render
// reliably and never "fade" — except TAM Sort & Mining, which reuses the real
// WebGL Brand Universe sphere. Each animation is designed to fill its parent.
import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence, useSpring } from "framer-motion"
import dynamic from "next/dynamic"
import { Inter } from "next/font/google"
import { SiGmail } from "react-icons/si"
import { FaLinkedin, FaInstagram, FaWhatsapp, FaCommentSms, FaLinkedinIn, FaFacebookF, FaGoogle } from "react-icons/fa6"

const inter = Inter({ subsets: ["latin"] })

// 0 — Initial Meeting & Evaluation: a true WebGL 3D booking-card render.
const MeetingScene3D = dynamic(() => import("./MeetingScene3D"), {
  ssr: false,
  loading: () => <div aria-hidden className="absolute inset-0" />,
})
// 3 — TAM Sort & Mining: dense WebGL logo cloud with an ICP-sort countdown.
const TamSphere3D = dynamic(() => import("./TamSphere3D"), {
  ssr: false,
  loading: () => <div aria-hidden className="absolute inset-0" />,
})

/* 1 — Onboard Into Vierra: a 3D-tilted snapshot of the REAL onboarding module
   (light theme, exact styling from pages/session/onboarding), on its
   "Connect Social Accounts" step, connecting live. */
const ONB_PROVIDERS = [
  { Icon: FaLinkedinIn, name: "LinkedIn", c: "#0A66C2" },
  { Icon: FaFacebookF, name: "Facebook", c: "#1877F2" },
  { Icon: FaGoogle, name: "Google Ads", c: "#EA4335" },
]
// Exact modules + durations from the real onboarding (pages/session/onboarding).
const ONB_MODULES = [
  { label: "Introduction To Vierra", sub: "2 min · Video" },
  { label: "Expectations, Communication, And How We Work", sub: "2 min · Video" },
  { label: "Signing Contracts And Paying Invoices", sub: "5 min · Video And Action" },
  { label: "Connecting Social Media Accounts", sub: "2 min · Action" },
  { label: "About Your Business", sub: "6 min · Response" },
  { label: "Strategy Meeting", sub: "3 min · Video And Response" },
  { label: "Final Words", sub: "2 min · Video" },
]
// Main-panel content for the active module (video / connect / about form).
function ModuleMain({ cur }: { cur: number }) {
  if (cur === 3) {
    return (
      <div className="rounded-xl border border-[#E5E7EB] bg-white p-3 shadow-sm">
        <p className="mb-3 text-[9px] leading-relaxed text-[#6B7280]">Link your accounts so we can hit the ground running with your marketing strategy.</p>
        <div className="grid grid-cols-3 gap-2">
          {ONB_PROVIDERS.map(({ Icon, name, c }, i) => (
            <div key={name} className="flex flex-col items-center rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-2.5">
              <div className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-xl shadow-sm" style={{ backgroundColor: c }}>
                <Icon className="h-[13px] w-[13px] text-white" />
              </div>
              <span className="text-[9px] font-medium text-[#111827]">{name}</span>
              <motion.span
                className="mt-1 text-[7px] font-semibold text-green-600"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 + i * 0.35 }}
              >
                Connected
              </motion.span>
            </div>
          ))}
        </div>
        <div className="mt-3 inline-block rounded-lg border border-[#E5E7EB] px-2.5 py-1 text-[8px] font-medium text-[#374151]">Refresh Status</div>
      </div>
    )
  }
  if (cur === 4) {
    return (
      <div className="space-y-2.5 rounded-xl border border-[#E5E7EB] bg-white p-3 shadow-sm">
        {["What's your company website or main online presence?", "Preferred brand tone/voice?", "Describe your product or service in one sentence."].map((l) => (
          <div key={l}>
            <div className="mb-1 text-[8px] font-medium text-[#374151]">{l}</div>
            <div className="h-6 rounded-lg border border-[#E5E7EB] bg-[#FAFAFA]" />
          </div>
        ))}
      </div>
    )
  }
  // Video modules
  return (
    <div className="relative flex aspect-[16/9] items-center justify-center overflow-hidden rounded-xl bg-black shadow-lg">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 shadow-lg">
        <svg viewBox="0 0 24 24" className="ml-0.5 h-4 w-4" fill="#7A13D0">
          <path d="M8 5v14l11-7z" />
        </svg>
      </div>
      <span className="absolute bottom-2.5 left-3 text-[9px] font-medium text-white/85">{ONB_MODULES[cur].label}</span>
      <span className="absolute bottom-2.5 right-3 text-[8px] text-white/50">{ONB_MODULES[cur].sub.split(" · ")[0]}</span>
    </div>
  )
}

function OnboardModuleAnim() {
  const [cur, setCur] = useState(0)
  const [paused, setPaused] = useState(false)
  const resumeRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Auto-loop through the modules ("flipping through" each section) until the
  // user interacts; clicking a module / Previous / Continue drives it manually,
  // then it resumes the loop after a few seconds of inactivity.
  useEffect(() => {
    if (paused) return
    const id = setInterval(() => setCur((c) => (c + 1) % ONB_MODULES.length), 2600)
    return () => clearInterval(id)
  }, [paused])
  const goTo = (i: number) => {
    setCur(Math.max(0, Math.min(ONB_MODULES.length - 1, i)))
    setPaused(true)
    if (resumeRef.current) clearTimeout(resumeRef.current)
    resumeRef.current = setTimeout(() => setPaused(false), 7000)
  }
  const isLast = cur === ONB_MODULES.length - 1

  // Interactive tilt — the panel follows the cursor, springs back on leave.
  const rx = useSpring(5, { stiffness: 120, damping: 18 })
  const ry = useSpring(-11, { stiffness: 120, damping: 18 })
  const onMove = (e: React.MouseEvent) => {
    const r = e.currentTarget.getBoundingClientRect()
    ry.set(-11 + ((e.clientX - r.left) / r.width - 0.5) * 24)
    rx.set(5 - ((e.clientY - r.top) / r.height - 0.5) * 18)
  }
  const onLeave = () => {
    rx.set(5)
    ry.set(-11)
  }

  return (
    <div className="flex h-full w-full items-center justify-center [perspective:1800px]" onMouseMove={onMove} onMouseLeave={onLeave}>
      <motion.div
        style={{ rotateX: rx, rotateY: ry }}
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        className={`flex w-[680px] overflow-hidden rounded-2xl bg-[#FAFAFA] shadow-2xl ring-1 ring-black/10 ${inter.className}`}
      >
        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] bg-white px-4 py-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/vierra-logo-black.png" alt="Vierra" className="h-4 w-auto object-contain" />
            <span className="flex items-center gap-1.5 text-[9px] text-[#6B7280]">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Session active
            </span>
          </div>
          <div className="flex flex-1 flex-col p-4">
            <div className="mb-2 flex items-center gap-2.5">
              <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[#7A13D0]">Module {cur + 1}</span>
              <span className="text-[9px] text-[#9CA3AF]">Step {cur + 1} of {ONB_MODULES.length}</span>
            </div>
            <div className="mb-3 h-1 w-full rounded-full bg-[#E5E7EB]">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-[#7A13D0] to-[#9D4EDD]"
                animate={{ width: `${((cur + 1) / ONB_MODULES.length) * 100}%` }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <AnimatePresence mode="wait">
              <motion.div key={cur} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.3 }} className="flex flex-1 flex-col">
                <h3 className="mb-3 text-[15px] font-semibold leading-tight tracking-tight text-[#111827]">{ONB_MODULES[cur].label}</h3>
                <ModuleMain cur={cur} />
              </motion.div>
            </AnimatePresence>
            {/* Footer nav — Previous + Continue / Complete Modules */}
            <div className="mt-auto flex items-center justify-between pt-3">
              <button
                type="button"
                onClick={() => goTo(cur - 1)}
                disabled={cur === 0}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-semibold transition ${cur === 0 ? "cursor-not-allowed text-[#D1D5DB]" : "text-[#374151] hover:bg-[#F3F4F6]"}`}
              >
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Previous
              </button>
              <button
                type="button"
                onClick={() => goTo(cur + 1)}
                className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-[10px] font-semibold text-white shadow-sm transition ${isLast ? "bg-[#059669] hover:bg-[#047857]" : "bg-[#7A13D0] hover:bg-[#6B11B8]"}`}
              >
                {isLast ? "Complete Modules" : "Continue"}
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={isLast ? "M5 13l4 4L19 7" : "M9 5l7 7-7 7"} />
                </svg>
              </button>
            </div>
          </div>
        </div>
        {/* Sidebar — the real "Modules" rail; items are clickable to navigate. */}
        <aside className="flex w-[236px] shrink-0 flex-col border-l border-[#E5E7EB] bg-white p-4">
          <h4 className="mb-3 text-[9px] font-semibold uppercase tracking-[0.2em] text-[#9CA3AF]">Modules</h4>
          <div className="flex-1 space-y-1">
            {ONB_MODULES.map((m, i) => {
              const completed = i < cur
              const isCurrent = i === cur
              return (
                <button
                  key={m.label}
                  type="button"
                  onClick={() => goTo(i)}
                  className={`flex w-full items-start gap-2 rounded-lg p-1.5 text-left transition-colors duration-200 hover:bg-[#7A13D0]/5 ${isCurrent ? "bg-[#7A13D0]/5 ring-1 ring-[#7A13D0]/20" : ""}`}
                >
                  <span
                    className={`mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[7px] font-bold ${
                      completed ? "bg-[#059669] text-white" : isCurrent ? "bg-[#7A13D0] text-white" : "bg-[#E5E7EB] text-[#9CA3AF]"
                    }`}
                  >
                    {completed ? (
                      <svg className="h-2 w-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-[9px] font-medium leading-snug ${isCurrent ? "text-[#111827]" : completed ? "text-[#374151]" : "text-[#6B7280]"}`}>{m.label}</span>
                    <span className={`block text-[7px] ${isCurrent ? "text-[#7A13D0]" : "text-[#9CA3AF]"}`}>{m.sub}</span>
                  </span>
                </button>
              )
            })}
          </div>
          <div className="mt-3 space-y-1 border-t border-[#E5E7EB] pt-2.5 text-[7px] text-[#9CA3AF]">
            <div className="flex justify-between">
              <span>Client</span>
              <span className="font-medium text-[#374151]">Shelby Sapp</span>
            </div>
            <div className="flex justify-between">
              <span>Business</span>
              <span className="font-medium text-[#374151]">She Sells Academy</span>
            </div>
          </div>
        </aside>
      </motion.div>
    </div>
  )
}

/* 2 — Full Market & ICP Research: lead profiles researched + scored. */
function IcpResearchAnim() {
  const leads = [
    { name: "Marcus Lee", role: "VP Sales · Fintech", fit: 94 },
    { name: "Dana Rivera", role: "Founder · SaaS", fit: 88 },
    { name: "Priya Shah", role: "CMO · Health", fit: 91 },
  ]
  return (
    <div className={`flex h-full w-full items-center justify-center ${inter.className}`}>
      <div className="flex w-[320px] flex-col gap-2.5">
        {leads.map((l, i) => (
          <motion.div
            key={l.name}
            className="relative flex items-center gap-3 overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-[#240A45] to-[#1A0735] p-3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: i * 0.15 }}
          >
            <motion.div
              className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-[#B366FF]/40 to-transparent"
              animate={{ x: ["-120%", "420%"] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: i * 0.3 }}
            />
            <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-[#8F42FF] to-[#701CC0]" />
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold text-white">{l.name}</div>
              <div className="truncate text-[10px] text-[#B9A9D6]">{l.role}</div>
            </div>
            <motion.div
              className="flex flex-col items-end"
              animate={{ opacity: [0, 0, 1] }}
              transition={{ duration: 3, times: [0, 0.3 + i * 0.12, 0.45 + i * 0.12], repeat: Infinity }}
            >
              <span className="text-[14px] font-bold text-[#8FF0B0]">{l.fit}</span>
              <span className="text-[8px] uppercase tracking-wide text-[#8E7BB0]">ICP fit</span>
            </motion.div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

/* 3 — TAM Sort & Mining: dense logo cloud, no HUD, looping ICP-sort countdown. */
function TamMiningAnim() {
  return (
    <div className="absolute inset-0">
      <TamSphere3D />
    </div>
  )
}

/* 4 — Campaign Launching: launch ring fills, channels fire, status → live. */
function CampaignLaunchAnim() {
  const chans = [
    { Icon: SiGmail, c: "#EA4335" },
    { Icon: FaLinkedin, c: "#0A66C2" },
    { Icon: FaInstagram, c: "#E4405F" },
    { Icon: FaCommentSms, c: "#22C55E" },
    { Icon: FaWhatsapp, c: "#25D366" },
  ]
  const C = 2 * Math.PI * 44
  return (
    <div className={`flex h-full w-full flex-col items-center justify-center gap-6 ${inter.className}`}>
      <div className="relative flex h-32 w-32 items-center justify-center">
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90">
          <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5" />
          <motion.circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke="#B366FF"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={C}
            animate={{ strokeDashoffset: [C, 0, 0, C] }}
            transition={{ duration: 4.5, times: [0, 0.5, 0.82, 1], repeat: Infinity, ease: "easeInOut" }}
          />
        </svg>
        <motion.svg
          viewBox="0 0 24 24"
          className="h-8 w-8 text-[#C99DFF]"
          fill="currentColor"
          animate={{ y: [0, 0, -10, 0], scale: [1, 1, 1.15, 1], rotate: [0, 0, -8, 0] }}
          transition={{ duration: 4.5, times: [0, 0.5, 0.62, 0.8], repeat: Infinity }}
        >
          <path d="M2 21l21-9L2 3v7l15 2-15 2z" />
        </motion.svg>
      </div>
      <div className="grid gap-3 text-center">
        <div className="flex justify-center gap-3">
          {chans.map(({ Icon, c }, i) => (
            <motion.span
              key={i}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5"
              animate={{ scale: [1, 1.2, 1], boxShadow: ["0 0 0 0 rgba(179,102,255,0)", "0 0 0 6px rgba(179,102,255,0.25)", "0 0 0 0 rgba(179,102,255,0)"] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }}
            >
              <Icon style={{ color: c }} className="h-4 w-4" />
            </motion.span>
          ))}
        </div>
        <div className="relative h-4">
          <motion.span
            className="absolute inset-x-0 text-[11px] font-medium text-[#C99DFF]"
            animate={{ opacity: [1, 1, 0, 0] }}
            transition={{ duration: 4.5, times: [0, 0.45, 0.55, 1], repeat: Infinity }}
          >
            Launching campaigns…
          </motion.span>
          <motion.span
            className="absolute inset-x-0 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#8FF0B0]"
            animate={{ opacity: [0, 0, 1, 1, 0] }}
            transition={{ duration: 4.5, times: [0, 0.55, 0.62, 0.92, 1], repeat: Infinity }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#8FF0B0]" /> Campaigns live
          </motion.span>
        </div>
      </div>
    </div>
  )
}

/* 5 — Clients Signed Successfully: signature draws, "Signed" stamp, toast. */
function ClientsSignedAnim() {
  return (
    <div className={`flex h-full w-full items-center justify-center ${inter.className}`}>
      <motion.div
        className="relative w-[280px] rounded-2xl border border-white/10 bg-gradient-to-b from-[#F7F3FF] to-[#E9DEFF] p-5 text-[#2A1148] shadow-2xl"
        style={{ transform: "perspective(1200px) rotateY(12deg) rotateX(6deg)" }}
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="mb-2 text-[12px] font-bold">Service Agreement</div>
        <div className="mb-1 space-y-1.5">
          <div className="h-1.5 w-full rounded bg-[#2A1148]/15" />
          <div className="h-1.5 w-4/5 rounded bg-[#2A1148]/15" />
          <div className="h-1.5 w-3/5 rounded bg-[#2A1148]/15" />
        </div>
        <div className="mt-4 border-t border-dashed border-[#2A1148]/30 pt-2 text-[9px] uppercase tracking-wide text-[#2A1148]/50">Signature</div>
        <svg viewBox="0 0 120 40" className="h-10 w-32">
          <motion.path
            d="M4 30 C 18 6, 26 34, 38 18 S 60 6, 72 24 S 96 8, 116 20"
            fill="none"
            stroke="#7A13D0"
            strokeWidth="2.5"
            strokeLinecap="round"
            animate={{ pathLength: [0, 1, 1, 0] }}
            transition={{ duration: 4.5, times: [0, 0.5, 0.9, 1], repeat: Infinity, ease: "easeInOut" }}
          />
        </svg>
        <motion.div
          className="absolute right-4 top-9 rotate-[-14deg] rounded-md border-2 border-[#22C55E] px-2 py-0.5 text-[13px] font-black uppercase tracking-wider text-[#22C55E]"
          animate={{ opacity: [0, 0, 1, 1, 0], scale: [1.6, 1.6, 1, 1, 1.6] }}
          transition={{ duration: 4.5, times: [0, 0.55, 0.66, 0.92, 1], repeat: Infinity }}
        >
          Signed
        </motion.div>
        <motion.div
          className="absolute -bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-[#22C55E]/40 bg-[#0c0415] px-3 py-1.5 shadow-lg"
          animate={{ opacity: [0, 0, 1, 1, 0], y: [10, 10, 0, 0, 10] }}
          transition={{ duration: 4.5, times: [0, 0.6, 0.7, 0.92, 1], repeat: Infinity }}
        >
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#22C55E] text-[9px] text-white">✓</span>
          <span className="text-[11px] font-medium text-[#8FF0B0]">New client signed</span>
        </motion.div>
      </motion.div>
    </div>
  )
}

// TAM (step index 3) is rendered separately in the timeline so its WebGL canvas
// isn't remounted on every scroll; this covers the five DOM-based steps.
export function OnboardingStepAnim({ step }: { step: number }) {
  switch (step) {
    case 0:
      return <MeetingScene3D />
    case 1:
      return <OnboardModuleAnim />
    case 2:
      return <IcpResearchAnim />
    case 4:
      return <CampaignLaunchAnim />
    case 5:
      return <ClientsSignedAnim />
    default:
      return null
  }
}

export { TamMiningAnim }
