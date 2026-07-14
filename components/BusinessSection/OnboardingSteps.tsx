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
import { FaLinkedin, FaInstagram, FaWhatsapp, FaCommentSms, FaLinkedinIn, FaFacebookF, FaGoogle, FaPaperPlane } from "react-icons/fa6"

const inter = Inter({ subsets: ["latin"] })

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
  const [done, setDone] = useState(false)
  const [paused, setPaused] = useState(false)
  const resumeRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Auto-play the module flow; on the last module it lands on the success
  // screen, holds, then loops back to module 1. Manual clicks pause the loop
  // and resume it after a few seconds of inactivity.
  useEffect(() => {
    if (paused) return
    let t: ReturnType<typeof setTimeout>
    if (done) {
      t = setTimeout(() => {
        setDone(false)
        setCur(0)
      }, 2600)
    } else if (cur === ONB_MODULES.length - 1) {
      t = setTimeout(() => setDone(true), 1900)
    } else {
      t = setTimeout(() => setCur((c) => c + 1), 1900)
    }
    return () => clearTimeout(t)
  }, [cur, done, paused])
  const goTo = (i: number) => {
    setDone(false)
    setCur(Math.max(0, Math.min(ONB_MODULES.length - 1, i)))
    setPaused(true)
    if (resumeRef.current) clearTimeout(resumeRef.current)
    resumeRef.current = setTimeout(() => setPaused(false), 7000)
  }
  const complete = () => {
    setDone(true)
    setPaused(true)
    if (resumeRef.current) clearTimeout(resumeRef.current)
    resumeRef.current = setTimeout(() => {
      setDone(false)
      setCur(0)
      setPaused(false)
    }, 3000)
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
            {done ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-1 flex-col items-center justify-center text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 220, damping: 14 }}
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-[#059669] shadow-lg"
                >
                  <svg className="h-7 w-7" fill="none" stroke="#fff" strokeWidth={3} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </motion.div>
                <h3 className="mt-4 text-[16px] font-bold text-[#111827]">You&apos;re all set!</h3>
                <p className="mt-1.5 max-w-[280px] text-[11px] leading-relaxed text-[#6B7280]">
                  Onboarding complete — welcome to Vierra. Your strategist will reach out to kick off your campaigns.
                </p>
                <div className="mt-4 rounded-full bg-[#059669]/10 px-3 py-1.5 text-[10px] font-semibold text-[#059669]">
                  All {ONB_MODULES.length} modules completed
                </div>
              </motion.div>
            ) : (
              <>
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
                    onClick={() => (isLast ? complete() : goTo(cur + 1))}
                    className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-[10px] font-semibold text-white shadow-sm transition ${isLast ? "bg-[#059669] hover:bg-[#047857]" : "bg-[#7A13D0] hover:bg-[#6B11B8]"}`}
                  >
                    {isLast ? "Complete Modules" : "Continue"}
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={isLast ? "M5 13l4 4L19 7" : "M9 5l7 7-7 7"} />
                    </svg>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        {/* Sidebar — the real "Modules" rail; items are clickable to navigate. */}
        <aside className="flex w-[236px] shrink-0 flex-col border-l border-[#E5E7EB] bg-white p-4">
          <h4 className="mb-3 text-[9px] font-semibold uppercase tracking-[0.2em] text-[#9CA3AF]">Modules</h4>
          <div className="flex-1 space-y-1">
            {ONB_MODULES.map((m, i) => {
              const completed = done || i < cur
              const isCurrent = !done && i === cur
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

/* 2 — Full Market & ICP Research: a slanted 3D research dashboard — a scored
   lead list on the left, an enriched research panel (firmographics, tech stack,
   buying signals, ICP match) on the right. */
function IcpResearchAnim() {
  const leads = [
    { name: "Marcus Lee", role: "VP Sales · Fintech", fit: 94 },
    { name: "Dana Rivera", role: "Founder · SaaS", fit: 88 },
    { name: "Priya Shah", role: "CMO · Health", fit: 91 },
    { name: "Owen Park", role: "Head of Growth · E-comm", fit: 85 },
  ]
  const stack = ["HubSpot", "Segment", "Snowflake"]
  const signals = ["Hiring SDRs", "Raised Series B", "Visited pricing page"]
  return (
    <div className={`flex h-full w-full items-center justify-center [perspective:1700px] ${inter.className}`}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, y: [0, -6, 0] }}
        transition={{ opacity: { duration: 0.5 }, y: { duration: 6, repeat: Infinity, ease: "easeInOut" } }}
        style={{ rotateX: 7, rotateY: -16 }}
        className="flex w-[620px] max-w-[92vw] gap-3 rounded-2xl border border-white/10 bg-gradient-to-b from-[#241046] to-[#180733] p-4 shadow-2xl ring-1 ring-black/20"
      >
        {/* Left — scored lead list */}
        <div className="w-[52%] shrink-0">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-white">Market & ICP Research</span>
            <span className="flex items-center gap-1 text-[8px] text-[#8FF0B0]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#8FF0B0]" /> Scanning
            </span>
          </div>
          <div className="space-y-1.5">
            {leads.map((l, i) => (
              <motion.div
                key={l.name}
                className="relative flex items-center gap-2 overflow-hidden rounded-xl border border-white/10 bg-white/5 p-2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: i * 0.12 }}
              >
                <motion.div
                  className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-[#B366FF]/40 to-transparent"
                  animate={{ x: ["-120%", "420%"] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: i * 0.3 }}
                />
                <div className="h-7 w-7 shrink-0 rounded-full bg-gradient-to-br from-[#8F42FF] to-[#701CC0]" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[10px] font-semibold text-white">{l.name}</div>
                  <div className="truncate text-[8px] text-[#B9A9D6]">{l.role}</div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[11px] font-bold text-[#8FF0B0]">{l.fit}</span>
                  <span className="text-[6px] uppercase tracking-wide text-[#8E7BB0]">ICP fit</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Right — enriched research panel for the top lead */}
        <div className="flex-1 rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-[10px] font-semibold text-white">Marcus Lee</div>
          <div className="text-[8px] text-[#B9A9D6]">Acme Fintech · San Francisco</div>

          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {[["Revenue", "$48M"], ["Employees", "220"]].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-white/5 p-1.5">
                <div className="text-[6px] uppercase tracking-wide text-[#8E7BB0]">{k}</div>
                <div className="text-[10px] font-semibold text-white">{v}</div>
              </div>
            ))}
          </div>

          <div className="mt-2">
            <div className="text-[6px] uppercase tracking-wide text-[#8E7BB0]">Tech stack</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {stack.map((s, i) => (
                <motion.span
                  key={s}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6 + i * 0.15 }}
                  className="rounded-md bg-[#701CC0]/25 px-1.5 py-0.5 text-[7px] font-medium text-[#C99DFF]"
                >
                  {s}
                </motion.span>
              ))}
            </div>
          </div>

          <div className="mt-2">
            <div className="text-[6px] uppercase tracking-wide text-[#8E7BB0]">Buying signals</div>
            <div className="mt-1 space-y-1">
              {signals.map((s, i) => (
                <motion.div
                  key={s}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 + i * 0.18 }}
                  className="flex items-center gap-1 text-[8px] text-[#D9CCF2]"
                >
                  <span className="h-1 w-1 rounded-full bg-[#8FF0B0]" /> {s}
                </motion.div>
              ))}
            </div>
          </div>

          <div className="mt-3">
            <div className="mb-1 flex justify-between text-[7px] text-[#8E7BB0]">
              <span>ICP match</span>
              <span className="text-[#8FF0B0]">94%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-[#8F42FF] to-[#8FF0B0]"
                initial={{ width: 0 }}
                animate={{ width: "94%" }}
                transition={{ duration: 1, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

/* 3 — TAM Sorting & Mining: dense logo cloud, nudged down so it sits centered
   in the stage below the docked title. */
function TamMiningAnim() {
  return (
    <div className="absolute inset-x-0 bottom-0 top-[9%]">
      <TamSphere3D />
    </div>
  )
}

/* 4 — Campaign Launching: a live multi-channel launch console — per-channel
   progress bars fill in sequence and the total dispatched count settles. */
function CampaignLaunchAnim() {
  const chans = [
    { Icon: SiGmail, c: "#EA4335", name: "Email", sent: "1,240" },
    { Icon: FaLinkedin, c: "#0A66C2", name: "LinkedIn", sent: "860" },
    { Icon: FaInstagram, c: "#E4405F", name: "Instagram", sent: "540" },
    { Icon: FaCommentSms, c: "#22C55E", name: "SMS", sent: "410" },
    { Icon: FaWhatsapp, c: "#25D366", name: "WhatsApp", sent: "320" },
  ]
  return (
    <div className={`flex h-full w-full items-center justify-center ${inter.className}`}>
      <motion.div
        className="w-[400px] max-w-[92vw] rounded-2xl border border-white/10 bg-gradient-to-b from-[#241046] to-[#180733] p-4 shadow-2xl"
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[12px] font-semibold text-white">Campaign Launch</span>
          <motion.span
            className="flex items-center gap-1 rounded-full bg-[#22C55E]/15 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide text-[#8FF0B0]"
            animate={{ opacity: [0.45, 1, 0.45] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#8FF0B0]" /> Live
          </motion.span>
        </div>
        <div className="space-y-2.5">
          {chans.map((ch, i) => (
            <div key={ch.name} className="flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/5">
                <ch.Icon style={{ color: ch.c }} className="h-3.5 w-3.5" />
              </span>
              <div className="flex-1">
                <div className="mb-0.5 flex justify-between text-[8px]">
                  <span className="text-[#D9CCF2]">{ch.name}</span>
                  <span className="text-[#8FF0B0]">{ch.sent} sent</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: ch.c }}
                    initial={{ width: "0%" }}
                    animate={{ width: ["0%", "100%", "100%", "0%"] }}
                    transition={{ duration: 4.4, times: [0, 0.45, 0.9, 1], delay: i * 0.18, repeat: Infinity, ease: "easeInOut" }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-white/5 py-1.5 text-[9px] font-medium text-[#C99DFF]">
          <FaPaperPlane className="h-2.5 w-2.5" /> 3,370 messages dispatched across 5 channels
        </div>
      </motion.div>
    </div>
  )
}

/* 5 — Clients Signed Successfully: a signed-client card with an MRR figure and
   a confetti burst on loop. */
const CONFETTI = [
  { c: "#8F42FF", x: -70, r: -50 },
  { c: "#22C55E", x: -46, r: 40 },
  { c: "#C99DFF", x: -22, r: -30 },
  { c: "#FBBF24", x: 6, r: 60 },
  { c: "#EC4899", x: 28, r: -60 },
  { c: "#38BDF8", x: 52, r: 35 },
  { c: "#8FF0B0", x: 74, r: -45 },
  { c: "#B366FF", x: -60, r: 55 },
  { c: "#F59E0B", x: 44, r: -25 },
  { c: "#8F42FF", x: 18, r: 50 },
]
function ClientsSignedAnim() {
  return (
    <div className={`flex h-full w-full items-center justify-center ${inter.className}`}>
      <div className="relative w-[300px] max-w-[92vw]">
        {/* confetti burst */}
        {CONFETTI.map((p, i) => (
          <motion.span
            key={i}
            className="absolute left-1/2 top-2 h-2 w-2 rounded-[1px]"
            style={{ backgroundColor: p.c }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 0], x: [0, p.x], y: [0, 150], rotate: [0, p.r * 4] }}
            transition={{ duration: 2.4, delay: 0.4 + (i % 5) * 0.05, repeat: Infinity, repeatDelay: 2, ease: "easeOut" }}
          />
        ))}

        <motion.div
          className="relative rounded-2xl border border-white/10 bg-gradient-to-b from-[#F7F3FF] to-[#EADCFF] p-5 text-[#2A1148] shadow-2xl"
          style={{ rotateY: 10, rotateX: 6 }}
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#8F42FF] to-[#701CC0] text-[13px] font-bold text-white">SS</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-bold">She Sells Academy</div>
              <div className="text-[10px] text-[#6B5B85]">Coaching · Annual contract</div>
            </div>
            <motion.span
              className="flex items-center gap-1 rounded-full bg-[#22C55E] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: [0, 1, 1], scale: [0.6, 1, 1] }}
              transition={{ duration: 2.4, times: [0, 0.25, 1], repeat: Infinity, repeatDelay: 2 }}
            >
              Signed
            </motion.span>
          </div>

          <div className="mt-4 rounded-xl bg-white/65 p-3 text-center">
            <div className="text-[8px] font-semibold uppercase tracking-[0.15em] text-[#7A13D0]/70">New recurring revenue</div>
            <motion.div
              className="mt-0.5 text-[22px] font-black leading-none text-[#7A13D0]"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: [0, 1, 1], y: [8, 0, 0] }}
              transition={{ duration: 2.4, times: [0, 0.35, 1], repeat: Infinity, repeatDelay: 2 }}
            >
              +$12,000<span className="text-[11px] font-bold text-[#7A13D0]/60">/mo</span>
            </motion.div>
          </div>

          <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] font-medium text-[#059669]">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#059669] text-[8px] text-white">✓</span>
            Deal closed — campaigns optimizing weekly
          </div>
        </motion.div>
      </div>
    </div>
  )
}

const MB_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
const MB_WDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MB_WDAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

/* 0 — Initial Meeting & Evaluation: a looped 2D booking flow — a cursor picks a
   Calendly slot, confirms, and it lands as a scheduled event in Google Calendar. */
function MeetingBookingAnim() {
  // step 0: hover slot · 1: slot selected (Confirm appears) · 2: click Confirm · 3: booked (Google Calendar)
  const [step, setStep] = useState(0)
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => setNow(new Date()), [])
  useEffect(() => {
    const seq: [number, number][] = [
      [0, 1500],
      [1, 1300],
      [2, 900],
      [3, 3400],
    ]
    let i = 0
    let t: ReturnType<typeof setTimeout>
    const tick = () => {
      setStep(seq[i][0])
      t = setTimeout(() => {
        i = (i + 1) % seq.length
        tick()
      }, seq[i][1])
    }
    tick()
    return () => clearTimeout(t)
  }, [])

  const booked = step === 3
  const slots = ["9:00am", "9:30am", "10:00am", "10:30am", "11:00am"]
  const chosen = 2 // 10:00am

  // Auto-updating booking date (client-only to avoid hydration mismatch): ~3
  // days out, nudged onto a weekday.
  const booking = now
    ? (() => {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3)
        const wd = d.getDay()
        if (wd === 0) d.setDate(d.getDate() + 1)
        else if (wd === 6) d.setDate(d.getDate() + 2)
        return d
      })()
    : null
  const bMonth = booking ? MB_MONTHS[booking.getMonth()] : ""
  const bYear = booking ? booking.getFullYear() : ""
  const bDay = booking ? booking.getDate() : 0
  const bWdayFull = booking ? MB_WDAY_FULL[booking.getDay()] : ""
  const daysInMonth = booking ? new Date(booking.getFullYear(), booking.getMonth() + 1, 0).getDate() : 30
  const firstDow = booking ? new Date(booking.getFullYear(), booking.getMonth(), 1).getDay() : 0
  const bookingCol = booking ? (booking.getDay() + 6) % 7 : 1
  const weekDays = booking
    ? Array.from({ length: 5 }).map((_, i) => {
        const d = new Date(booking)
        d.setDate(booking.getDate() - bookingCol + i)
        return d
      })
    : []

  // Cursor target (px within the 300-tall body).
  const cursor = booked
    ? { x: 280, y: 285, o: 0 }
    : step >= 2
    ? { x: 452, y: 118, o: 1 }
    : { x: 356, y: 118, o: 1 }

  // Interactive tilt — the card follows the cursor, springs back on leave.
  const rx = useSpring(5, { stiffness: 120, damping: 18 })
  const ry = useSpring(-8, { stiffness: 120, damping: 18 })
  const onMove = (e: React.MouseEvent) => {
    const r = e.currentTarget.getBoundingClientRect()
    ry.set(-8 + ((e.clientX - r.left) / r.width - 0.5) * 16)
    rx.set(5 - ((e.clientY - r.top) / r.height - 0.5) * 12)
  }
  const onLeave = () => {
    rx.set(5)
    ry.set(-8)
  }

  return (
    <div className="flex h-full w-full items-center justify-center [perspective:1600px]" onMouseMove={onMove} onMouseLeave={onLeave}>
      <motion.div
        style={{ rotateX: rx, rotateY: ry }}
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        className={`relative w-[560px] max-w-[92vw] overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10 ${inter.className}`}
      >
        {/* Browser chrome */}
        <div className="flex items-center gap-2 border-b border-[#E5E7EB] bg-[#F3F4F6] px-3 py-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
          <div className="ml-2 flex-1 truncate rounded-md border border-[#E5E7EB] bg-white px-3 py-1 text-[10px] text-[#6B7280]">
            {booked ? "calendar.google.com" : "calendly.com/vierra/strategy-call"}
          </div>
        </div>

        <div className="relative h-[300px] overflow-hidden">
          <AnimatePresence mode="wait">
            {!booked ? (
              <motion.div key="calendly" className="absolute inset-0 flex" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.4 }}>
                {/* Left: meeting info + mini month */}
                <div className="w-[45%] border-r border-[#E5E7EB] p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/assets/vierra-logo-black.png" alt="Vierra" className="h-3.5 w-auto object-contain" />
                  <div className="mt-2 text-[15px] font-bold text-[#111827]">Strategy Call</div>
                  <div className="mt-1 text-[10px] text-[#6B7280]">30 min · Video call</div>
                  <div className="mt-3 text-[9px] font-semibold text-[#374151]">{bMonth} {bYear}</div>
                  <div className="mt-1.5 grid grid-cols-7 gap-1 text-center">
                    {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                      <div key={i} className="text-[8px] font-semibold text-[#9CA3AF]">{d}</div>
                    ))}
                    {Array.from({ length: firstDow }).map((_, i) => (
                      <div key={`b${i}`} />
                    ))}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1
                      const sel = day === bDay
                      return (
                        <div key={day} className={`flex h-4 items-center justify-center rounded-full text-[8px] ${sel ? "bg-[#7A13D0] font-bold text-white" : "text-[#374151]"}`}>
                          {day}
                        </div>
                      )
                    })}
                  </div>
                </div>
                {/* Right: time slots */}
                <div className="flex-1 p-4">
                  <div className="mb-2 text-[11px] font-semibold text-[#111827]">{bWdayFull}, {bMonth} {bDay}</div>
                  <div className="space-y-1.5">
                    {slots.map((s, i) => {
                      const isChosen = i === chosen && step >= 1
                      return (
                        <div key={s} className="flex items-center gap-1.5">
                          <div className={`flex-1 rounded-lg border py-1.5 text-center text-[10px] font-semibold transition-colors duration-300 ${isChosen ? "border-[#7A13D0] bg-[#7A13D0]/5 text-[#7A13D0]" : "border-[#E5E7EB] text-[#374151]"}`}>
                            {s}
                          </div>
                          <AnimatePresence>
                            {isChosen && (
                              <motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }} className="overflow-hidden">
                                <div className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[10px] font-semibold text-white transition ${step >= 2 ? "bg-[#5f0fa3]" : "bg-[#7A13D0]"}`}>Confirm</div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div key="gcal" className="absolute inset-0 p-4" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
                <div className="mb-2 text-[12px] font-semibold text-[#111827]">{bMonth} {bYear}</div>
                <div className="grid grid-cols-5 gap-px overflow-hidden rounded-lg border border-[#E5E7EB] bg-[#E5E7EB]">
                  {weekDays.map((d, i) => (
                    <div key={i} className="bg-[#FAFAFA] py-1 text-center text-[8px] font-semibold text-[#6B7280]">{MB_WDAY[d.getDay()]} {d.getDate()}</div>
                  ))}
                  {Array.from({ length: 15 }).map((_, k) => {
                    const r = Math.floor(k / 5)
                    const c = k % 5
                    return (
                      <div key={k} className="relative h-11 bg-white">
                        {r === 1 && c === bookingCol && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.7 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.35, type: "spring", stiffness: 220, damping: 16 }}
                            className="absolute inset-x-0.5 inset-y-0.5 rounded-md bg-gradient-to-br from-[#7A13D0] to-[#9D4EDD] p-1 text-[7px] font-semibold leading-tight text-white shadow"
                          >
                            Strategy Call
                            <br />
                            10:00–10:30
                          </motion.div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Confirmation modal */}
                <motion.div
                  className="absolute inset-0 flex items-center justify-center bg-black/25 backdrop-blur-[1px]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  <motion.div
                    className="w-[240px] rounded-2xl bg-white p-4 text-center shadow-2xl ring-1 ring-black/10"
                    initial={{ opacity: 0, scale: 0.85, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ delay: 0.6, type: "spring", stiffness: 220, damping: 16 }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/assets/vierra-logo-black.png" alt="Vierra" className="mx-auto h-3.5 w-auto object-contain" />
                    <motion.div
                      className="mx-auto mt-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#22C55E]"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.75, type: "spring", stiffness: 240, damping: 14 }}
                    >
                      <svg className="h-5 w-5" fill="none" stroke="#fff" strokeWidth={3} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </motion.div>
                    <div className="mt-2.5 text-[12px] font-bold text-[#111827]">Meeting scheduled</div>
                    <div className="mt-1 text-[10px] text-[#6B7280]">{bWdayFull}, {bMonth} {bDay} · 10:00 AM</div>
                    <div className="mt-3 rounded-lg bg-[#F3F4F6] py-1.5 text-[9px] font-medium text-[#374151]">Added to Google Calendar</div>
                  </motion.div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Cursor */}
          <motion.div
            className="pointer-events-none absolute left-0 top-0 z-30"
            animate={{ x: cursor.x, y: cursor.y, opacity: cursor.o, scale: step === 2 ? 0.82 : 1 }}
            transition={{
              x: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
              y: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
              scale: { duration: 0.15 },
              opacity: { duration: 0.3 },
            }}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 drop-shadow-md" fill="#111827" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round">
              <path d="M4 2 L4 20 L9 15 L12 22 L15 21 L12 14 L19 14 Z" />
            </svg>
          </motion.div>
        </div>
      </motion.div>
    </div>
  )
}

// TAM (step index 3) is rendered separately in the timeline so its WebGL canvas
// isn't remounted on every scroll; this covers the five DOM-based steps.
export function OnboardingStepAnim({ step }: { step: number }) {
  switch (step) {
    case 0:
      return <MeetingBookingAnim />
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
