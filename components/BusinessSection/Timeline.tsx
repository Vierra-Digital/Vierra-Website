"use client"

import { Bricolage_Grotesque, Figtree } from "next/font/google"
import { useState, useEffect } from "react"
import { motion } from "framer-motion"

const bricolage = Bricolage_Grotesque({ subsets: ["latin"] })
const figtree = Figtree({ subsets: ["latin"] })

// Step-by-step of how onboarding a new client works.
const steps = [
  {
    n: 1,
    title: "Discovery Call",
    text: "We map your ICP, goals, and current funnel on a quick kickoff call — and confirm we're a fit to work together.",
  },
  {
    n: 2,
    title: "Setup & Integrations",
    text: "We connect your inboxes, CRM, and tools, then warm your sending infrastructure so your outbound actually lands.",
  },
  {
    n: 3,
    title: "Campaign Build",
    text: "Our team writes painpoint-driven messaging and builds multi-channel sequences tailored to your market.",
  },
  {
    n: 4,
    title: "Launch & Scale",
    text: "Campaigns go live. We watch buying signals, book meetings, and optimize every week to grow your pipeline.",
  },
]

/* ---- thematic (lightly 3D) animation per step ---------------------------- */

// 1 — Discovery: a radar locks onto your ideal customer.
function OnbDiscovery() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="relative h-52 w-52">
        {[0, 1, 2, 3].map((i) => (
          <motion.span
            key={i}
            className="absolute inset-0 m-auto rounded-full border border-[#B366FF]/50"
            animate={{ scale: [0.15, 1], opacity: [0.85, 0] }}
            transition={{ duration: 2.6, repeat: Infinity, delay: i * 0.65, ease: "easeOut" }}
          />
        ))}
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/10" />
        <div className="absolute top-1/2 left-0 h-px w-full -translate-y-1/2 bg-white/10" />
        <span className="absolute inset-0 m-auto h-3 w-3 rounded-full bg-[#C99DFF] shadow-[0_0_14px_4px_rgba(179,102,255,0.7)]" />
        <motion.div
          className={`absolute right-0 top-8 rounded-lg border border-white/15 bg-[#1A0735] px-2.5 py-1.5 text-[11px] text-white shadow-lg ${figtree.className}`}
          animate={{ opacity: [0, 0, 1, 1], y: [10, 10, 0, 0] }}
          transition={{ duration: 3.2, times: [0, 0.4, 0.55, 1], repeat: Infinity }}
        >
          Ideal client matched ✓
        </motion.div>
      </div>
    </div>
  )
}

// 2 — Setup: your stack connects to the Vierra hub.
function OnbSetup() {
  const c = 104
  const r = 74
  const nodes = [45, 135, 225, 315].map((d) => {
    const a = (d * Math.PI) / 180
    return { x: c + Math.cos(a) * r, y: c + Math.sin(a) * r }
  })
  return (
    <div className="flex h-full items-center justify-center [perspective:900px]">
      <svg viewBox="0 0 208 208" className="h-52 w-52 [transform:rotateX(16deg)]">
        <defs>
          <linearGradient id="onb-hub" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8F42FF" />
            <stop offset="100%" stopColor="#701CC0" />
          </linearGradient>
        </defs>
        {nodes.map((n, i) => (
          <line key={`l${i}`} x1={c} y1={c} x2={n.x} y2={n.y} stroke="#B366FF" strokeWidth="2" strokeDasharray="4 8" opacity="0.55">
            <animate attributeName="stroke-dashoffset" from="24" to="0" dur="1s" repeatCount="indefinite" />
          </line>
        ))}
        {nodes.map((n, i) => (
          <g key={`n${i}`}>
            <rect x={n.x - 16} y={n.y - 16} width="32" height="32" rx="9" fill="#1A0735" stroke="rgba(255,255,255,0.15)" />
            <circle cx={n.x} cy={n.y} r="5" fill="#C99DFF" />
          </g>
        ))}
        <rect x={c - 22} y={c - 22} width="44" height="44" rx="13" fill="url(#onb-hub)" />
        <circle cx={c} cy={c} r="6" fill="#fff" opacity="0.9" />
      </svg>
    </div>
  )
}

// 3 — Campaign build: messaging sequences stack up.
function OnbCampaign() {
  return (
    <div className="flex h-full items-center justify-center [perspective:1000px]">
      <div className="relative h-44 w-64 [transform:rotateY(-16deg)_rotateX(6deg)]">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute left-0 w-full rounded-xl border border-white/12 bg-gradient-to-br from-[#2A1148] to-[#1A0735] p-3 shadow-xl"
            style={{ top: `${i * 46}px`, zIndex: 3 - i }}
            animate={{ x: [44, 0, 0, 44], opacity: [0, 1, 1, 0] }}
            transition={{ duration: 4.2, times: [0, 0.22, 0.82, 1], repeat: Infinity, delay: i * 0.35, ease: "easeOut" }}
          >
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#B366FF]" />
              <div className="h-2 w-28 rounded-full bg-white/25" />
            </div>
            <div className="mt-2 h-1.5 w-3/4 rounded-full bg-white/12" />
            <div className="mt-1.5 h-1.5 w-1/2 rounded-full bg-white/10" />
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// 4 — Launch: pipeline climbs.
function OnbLaunch() {
  const bars = [26, 44, 38, 60, 82]
  return (
    <div className="relative flex h-full items-end justify-center [perspective:800px]">
      <div className="flex items-end gap-2.5 [transform:rotateX(12deg)]">
        {bars.map((h, i) => (
          <motion.span
            key={i}
            className="w-6 rounded-t-md bg-gradient-to-t from-[#701CC0] to-[#C99DFF]"
            style={{ height: h }}
            animate={{ height: [10, h] }}
            transition={{ duration: 0.8, delay: i * 0.12, repeat: Infinity, repeatType: "reverse", repeatDelay: 2, ease: [0.22, 1, 0.36, 1] }}
          />
        ))}
      </div>
      <motion.svg
        viewBox="0 0 24 24"
        className="absolute right-6 top-6 h-7 w-7 text-[#C99DFF]"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        animate={{ y: [12, -48], opacity: [0, 1, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeOut" }}
      >
        <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
      </motion.svg>
    </div>
  )
}

function StepVisual({ index }: { index: number }) {
  if (index === 0) return <OnbDiscovery />
  if (index === 1) return <OnbSetup />
  if (index === 2) return <OnbCampaign />
  return <OnbLaunch />
}

const Timeline = () => {
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (window.innerWidth < 1024) return
    const onScroll = () => {
      const el = document.getElementById("timeline-section")
      if (!el) return
      const { offsetTop, offsetHeight } = el
      const progress = (window.scrollY - offsetTop) / (offsetHeight - window.innerHeight)
      setActive(Math.max(0, Math.min(steps.length - 1, Math.floor(progress * steps.length))))
    }
    window.addEventListener("scroll", onScroll)
    onScroll()
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <>
      {/* Desktop — scroll-locked (sticky), same 200vh dimensions as before. */}
      <div id="timeline-section" className="relative mx-[-1.5rem] hidden h-[200vh] lg:block">
        <div className="sticky top-0 flex h-screen w-full flex-col justify-center overflow-hidden bg-gradient-to-r from-[#010205] via-[#0c0415] to-[#19082d] px-20 py-16 text-white">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-40 bg-gradient-to-b from-transparent to-[#010205]" />
          <span className={`${figtree.className} text-[12px] font-semibold uppercase tracking-[0.35em] text-[#C99DFF]`}>Getting Started</span>
          <h2 className={`${bricolage.className} mt-4 mb-12 text-5xl font-normal`}>How Onboarding Works</h2>

          <div className="grid grid-cols-2 items-center gap-16">
            {/* Steps rail — the active step expands its description as you scroll. */}
            <div className="flex flex-col gap-3">
              {steps.map((s, i) => {
                const on = active === i
                return (
                  <div
                    key={s.n}
                    className={`flex gap-4 rounded-2xl border p-4 transition-colors duration-300 ${
                      on ? "border-[#7A13D0] bg-white/[0.04]" : "border-white/5"
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors duration-300 ${
                        on ? "bg-[#7A13D0] text-white" : "bg-white/10 text-white/50"
                      }`}
                    >
                      {s.n}
                    </span>
                    <div className="min-w-0">
                      <h3 className={`${bricolage.className} text-xl font-semibold transition-colors duration-300 ${on ? "text-white" : "text-white/45"}`}>
                        {s.title}
                      </h3>
                      <motion.p
                        className={`overflow-hidden text-[15px] leading-relaxed text-[#B9A9D6] ${figtree.className}`}
                        animate={{ opacity: on ? 1 : 0, height: on ? "auto" : 0, marginTop: on ? 8 : 0 }}
                        transition={{ duration: 0.35, ease: "easeOut" }}
                      >
                        {s.text}
                      </motion.p>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Thematic animation for the active step (crossfades). */}
            <div className="relative h-80 w-full">
              {steps.map((s, i) => (
                <motion.div
                  key={s.n}
                  className="absolute inset-0"
                  animate={{ opacity: active === i ? 1 : 0, scale: active === i ? 1 : 0.94 }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  style={{ pointerEvents: "none" }}
                >
                  <StepVisual index={i} />
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile — stacked steps, each revealing on scroll. */}
      <div className="relative -mx-[1.5rem] w-screen overflow-hidden bg-gradient-to-b from-[#010205] via-[#0c0415] to-[#19082d] py-16 text-white lg:hidden">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-32 bg-gradient-to-b from-transparent to-[#010205]" />
        <div className="relative z-10 px-6">
          <span className={`${figtree.className} text-[11px] font-semibold uppercase tracking-[0.35em] text-[#C99DFF]`}>Getting Started</span>
          <h2 className={`${bricolage.className} mt-3 mb-10 text-4xl font-normal`}>How Onboarding Works</h2>
          <div className="flex flex-col gap-6">
            {steps.map((s, i) => (
              <motion.div
                key={s.n}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                viewport={{ once: true, amount: 0.4 }}
              >
                <div className="mb-3 flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#7A13D0] text-sm font-bold text-white">{s.n}</span>
                  <h3 className={`${bricolage.className} text-xl font-semibold`}>{s.title}</h3>
                </div>
                <div className="relative mb-3 h-40 overflow-hidden rounded-xl border border-white/5 bg-[#0c0415]">
                  <StepVisual index={i} />
                </div>
                <p className={`text-[15px] leading-relaxed text-[#B9A9D6] ${figtree.className}`}>{s.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

export default Timeline
