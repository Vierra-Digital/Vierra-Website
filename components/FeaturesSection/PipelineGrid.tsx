"use client"

import { motion } from "framer-motion"
import { Inter } from "next/font/google"
import type { IconType } from "react-icons"
import { FaLinkedin } from "react-icons/fa6"
import { SiGmail, SiGoogle, SiHubspot, SiGooglecalendar, SiSlack } from "react-icons/si"

const inter = Inter({ subsets: ["latin"] })

// Diagram coordinate space (matches the container's aspect ratio).
const VW = 1000
const VH = 460
const ENGINE = { x: 500, y: 230 }

type Node = { id: string; label: string; x: number; y: number; Icon?: IconType; color?: string }

// How the pipeline works: outbound channels feed raw prospects into the Vierra
// engine (research → enrich → sequence → qualify), which pushes booked meetings
// and synced data out to the team's stack.
const sources: Node[] = [
  { id: "mining", label: "Email Mining", x: 150, y: 70, Icon: SiGmail, color: "#EA4335" },
  { id: "campaigns", label: "Email Campaigns", x: 150, y: 177, Icon: SiGmail, color: "#EA4335" },
  { id: "linkedin", label: "LinkedIn Outreach", x: 150, y: 284, Icon: FaLinkedin, color: "#0A66C2" },
  { id: "cold", label: "Cold Email + SEO", x: 150, y: 391, Icon: SiGoogle, color: "#4285F4" },
]
const dests: Node[] = [
  { id: "crm", label: "CRM Sync", x: 850, y: 70, Icon: SiHubspot, color: "#FF7A59" },
  { id: "cal", label: "Calendar", x: 850, y: 177, Icon: SiGooglecalendar, color: "#4285F4" },
  { id: "slack", label: "Slack Alerts", x: 850, y: 284, Icon: SiSlack, color: "#9b6dff" },
  { id: "meet", label: "Meetings Booked", x: 850, y: 391 },
]

function pct(v: number, max: number) {
  return `${(v / max) * 100}%`
}

function NodePill({ n }: { n: Node }) {
  const Icon = n.Icon
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: pct(n.x, VW), top: pct(n.y, VH) }}
    >
      <div className={`inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-white/10 bg-[#2A1148] px-3 py-2 text-[13px] font-medium text-white shadow-[0_10px_30px_-18px_rgba(112,28,192,0.9)] ${inter.className}`}>
        {Icon ? <Icon className="h-4 w-4" style={{ color: n.color }} aria-hidden /> : null}
        {n.label}
      </div>
    </div>
  )
}

export default function PipelineGrid() {
  const lines = [
    ...sources.map((s) => ({ x1: s.x, y1: s.y, x2: ENGINE.x, y2: ENGINE.y })),
    ...dests.map((d) => ({ x1: ENGINE.x, y1: ENGINE.y, x2: d.x, y2: d.y })),
  ]
  return (
    <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#1F0A38]/70 p-6 md:p-10">
      {/* dotted grid backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background-image:radial-gradient(circle,_rgba(255,255,255,0.07)_1px,_transparent_1px)] [background-size:24px_24px]"
      />

      {/* --- desktop diagram --- */}
      <div className="relative mx-auto hidden w-full md:block" style={{ aspectRatio: `${VW} / ${VH}` }}>
        <svg viewBox={`0 0 ${VW} ${VH}`} className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid meet">
          {lines.map((l, i) => (
            <line
              key={i}
              x1={l.x1}
              y1={l.y1}
              x2={l.x2}
              y2={l.y2}
              className="pipe-line"
              stroke="#8F42FF"
              strokeOpacity="0.7"
              strokeWidth="2"
            />
          ))}
        </svg>

        {sources.map((n) => (
          <NodePill key={n.id} n={n} />
        ))}
        {dests.map((n) => (
          <NodePill key={n.id} n={n} />
        ))}

        {/* central engine */}
        <motion.div
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: pct(ENGINE.x, VW), top: pct(ENGINE.y, VH) }}
          animate={{ boxShadow: ["0 0 0 0 rgba(143,66,255,0.0)", "0 0 0 14px rgba(143,66,255,0.06)", "0 0 0 0 rgba(143,66,255,0.0)"] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-[#8F42FF] to-[#701CC0] px-7 py-5 text-center shadow-[0_24px_60px_-18px_rgba(112,28,192,1)]">
            <span className={`text-lg font-bold text-white ${inter.className}`}>Vierra</span>
            <span className={`text-[11px] uppercase tracking-[0.25em] text-white/70 ${inter.className}`}>Engine</span>
          </div>
        </motion.div>
      </div>

      {/* --- mobile fallback: stacked flow --- */}
      <div className={`relative space-y-3 md:hidden ${inter.className}`}>
        <div className="grid grid-cols-2 gap-2">
          {sources.map((n) => (
            <span key={n.id} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#2A1148] px-3 py-2 text-xs text-white">
              {n.Icon ? <n.Icon className="h-3.5 w-3.5" style={{ color: n.color }} aria-hidden /> : null}
              {n.label}
            </span>
          ))}
        </div>
        <div className="flex justify-center">
          <span className="rounded-xl bg-gradient-to-br from-[#8F42FF] to-[#701CC0] px-5 py-2.5 text-sm font-bold text-white">Vierra Engine</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {dests.map((n) => (
            <span key={n.id} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#2A1148] px-3 py-2 text-xs text-white">
              {n.Icon ? <n.Icon className="h-3.5 w-3.5" style={{ color: n.color }} aria-hidden /> : null}
              {n.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
