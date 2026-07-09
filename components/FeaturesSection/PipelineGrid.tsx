"use client"

import { motion } from "framer-motion"
import { Inter } from "next/font/google"
import type { IconType } from "react-icons"
import { FaLinkedin, FaInstagram, FaFacebook, FaWhatsapp, FaCalendarCheck, FaUsers, FaBullseye, FaPlug } from "react-icons/fa6"
import { SiGmail, SiGoogle, SiHubspot, SiSalesforce, SiZoho, SiClickup, SiSlack } from "react-icons/si"

const inter = Inter({ subsets: ["latin"] })

// Everything lives in one SVG coordinate space (boxes via foreignObject), so
// connectors always meet box centres. `tier` drives the staggered funnel reveal.
type Kind = "default" | "engine" | "primary" | "small"
type Node = { id: string; label: string; x: number; y: number; tier: number; Icon?: IconType; color?: string; kind?: Kind }

const nodes: Node[] = [
  { id: "icp", label: "ICP", x: 270, y: 250, tier: 0, Icon: FaBullseye, color: "#C99DFF" },
  { id: "intent", label: "Deep Intent Research", x: 270, y: 345, tier: 1 },
  { id: "instagram", label: "Instagram", x: 480, y: 150, tier: 2, Icon: FaInstagram, color: "#E4405F" },
  { id: "facebook", label: "Facebook", x: 480, y: 225, tier: 2, Icon: FaFacebook, color: "#1877F2" },
  { id: "li-campaigns", label: "LinkedIn Campaigns", x: 480, y: 300, tier: 2, Icon: FaLinkedin, color: "#0A66C2" },
  { id: "li-nav", label: "LinkedIn Sales Navigator", x: 480, y: 375, tier: 2, Icon: FaLinkedin, color: "#0A66C2" },
  { id: "email", label: "Email Cartography", x: 480, y: 450, tier: 2, Icon: SiGmail, color: "#EA4335" },
  { id: "sms", label: "SMS & WhatsApp", x: 480, y: 525, tier: 2, Icon: FaWhatsapp, color: "#25D366" },
  { id: "campaigns", label: "Campaigns", x: 700, y: 345, tier: 3 },
  { id: "positive", label: "Positive Intents", x: 920, y: 345, tier: 4 },
  { id: "vierra", label: "Vierra", x: 1140, y: 345, tier: 5, kind: "engine" },
  { id: "seo", label: "SEO · AEO · GEO", x: 1140, y: 110, tier: 6, Icon: SiGoogle, color: "#4285F4" },
  { id: "crm", label: "CRM Sync", x: 1140, y: 560, tier: 6, Icon: SiHubspot, color: "#FF7A59" },
  { id: "slack", label: "Slack Alerts", x: 1360, y: 250, tier: 6, Icon: SiSlack, color: "#9b6dff" },
  { id: "ae", label: "AE Research Report", x: 1360, y: 440, tier: 6, Icon: FaUsers, color: "#9b6dff" },
  { id: "meetings", label: "Meetings Booked", x: 1580, y: 345, tier: 7, Icon: FaCalendarCheck, kind: "primary" },
  { id: "salesforce", label: "Salesforce", x: 430, y: 650, tier: 8, Icon: SiSalesforce, color: "#00A1E0", kind: "small" },
  { id: "hubspot", label: "HubSpot", x: 650, y: 650, tier: 8, Icon: SiHubspot, color: "#FF7A59", kind: "small" },
  { id: "zoho", label: "Zoho", x: 870, y: 650, tier: 8, Icon: SiZoho, color: "#E42527", kind: "small" },
  { id: "monday", label: "Monday", x: 1090, y: 650, tier: 8, kind: "small" },
  { id: "clickup", label: "ClickUp", x: 1310, y: 650, tier: 8, Icon: SiClickup, color: "#7B68EE", kind: "small" },
  { id: "custom", label: "Custom Integrations", x: 1530, y: 650, tier: 8, Icon: FaPlug, color: "#C99DFF", kind: "small" },
]

const byId = Object.fromEntries(nodes.map((n) => [n.id, n])) as Record<string, Node>

function elbow(a: Node, b: Node) {
  const midX = (a.x + b.x) / 2
  return `M${a.x},${a.y} H${midX} V${b.y} H${b.x}`
}

const STEP = 0.14

const edges: [string, string][] = [
  ["icp", "intent"],
  ["intent", "instagram"], ["intent", "facebook"], ["intent", "li-campaigns"], ["intent", "li-nav"], ["intent", "email"], ["intent", "sms"],
  ["instagram", "campaigns"], ["facebook", "campaigns"], ["li-campaigns", "campaigns"], ["li-nav", "campaigns"], ["email", "campaigns"], ["sms", "campaigns"],
  ["campaigns", "positive"],
  ["positive", "vierra"],
  ["vierra", "seo"], ["vierra", "crm"], ["vierra", "slack"], ["vierra", "ae"],
  ["slack", "meetings"], ["ae", "meetings"],
]

// CRM Sync fans down into the CRM stack along a shared bus (tier 8).
const crmBus = ["M1140,560 V610", "M430,610 H1530", "M430,610 V650", "M650,610 V650", "M870,610 V650", "M1090,610 V650", "M1310,610 V650", "M1530,610 V650"]

const linePaths = [
  ...edges.map(([a, b]) => ({ d: elbow(byId[a], byId[b]), delay: byId[b].tier * STEP })),
  ...crmBus.map((d) => ({ d, delay: 8 * STEP })),
]

const dims = (k?: Kind) =>
  k === "engine" ? { w: 150, h: 66 } : k === "small" ? { w: 134, h: 38 } : { w: 158, h: 44 }

function NodeBox({ n }: { n: Node }) {
  const { w, h } = dims(n.kind)
  const Icon = n.Icon
  return (
    <motion.g
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.45, delay: n.tier * STEP, ease: [0.22, 1, 0.36, 1] }}
    >
      <foreignObject x={n.x - w / 2} y={n.y - h / 2} width={w} height={h} style={{ overflow: "visible" }}>
        {n.kind === "engine" ? (
          <div className="flex h-full w-full items-center justify-center rounded-2xl bg-gradient-to-br from-[#8F42FF] to-[#701CC0] shadow-[0_18px_50px_-18px_rgba(112,28,192,1)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/vierra-logo-panel.png" alt="Vierra" style={{ height: 26, width: "auto" }} />
          </div>
        ) : (
          <div
            className={`flex h-full w-full items-center justify-center gap-2 rounded-lg px-2.5 text-center font-medium leading-tight ${n.kind === "small" ? "text-[10px]" : "text-[11px]"} ${
              n.kind === "primary"
                ? "bg-gradient-to-br from-[#8F42FF] to-[#701CC0] text-white shadow-[0_14px_34px_-16px_rgba(112,28,192,1)]"
                : "border border-white/10 bg-[#2A1148] text-white"
            } ${inter.className}`}
          >
            {Icon ? <Icon style={{ color: n.color, width: 13, height: 13, flexShrink: 0 }} aria-hidden /> : null}
            <span>{n.label}</span>
          </div>
        )}
      </foreignObject>
    </motion.g>
  )
}

export default function PipelineGrid() {
  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#1F0A38]/70 p-4 md:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background-image:radial-gradient(circle,_rgba(255,255,255,0.06)_1px,_transparent_1px)] [background-size:22px_22px]"
      />
      <svg viewBox="150 56 1550 646" className="relative mx-auto w-full" preserveAspectRatio="xMidYMid meet">
        {linePaths.map((p, i) => (
          <motion.path
            key={i}
            d={p.d}
            fill="none"
            stroke="#8F42FF"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            whileInView={{ pathLength: 1, opacity: 0.7 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.55, delay: p.delay, ease: "easeInOut" }}
          />
        ))}
        {nodes.map((n) => (
          <NodeBox key={n.id} n={n} />
        ))}
      </svg>
    </div>
  )
}
