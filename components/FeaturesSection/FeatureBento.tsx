"use client"

import { motion } from "framer-motion"
import { Bricolage_Grotesque, Inter } from "next/font/google"
import type { ReactNode } from "react"
import { SiGmail, SiGoogle } from "react-icons/si"
import { FaLinkedin, FaInstagram, FaWhatsapp } from "react-icons/fa6"
import BrandSphere from "./BrandSphere"

const bricolage = Bricolage_Grotesque({ subsets: ["latin"] })
const inter = Inter({ subsets: ["latin"] })

/* ------------------------------------------------------------------ */
/* Per-box animations (compact, self-contained)                        */
/* ------------------------------------------------------------------ */

// Lead Research — profile rows whose "research" bars fill as they're enriched.
function LeadResearchAnim() {
  return (
    <div className="flex h-full flex-col justify-center gap-2 p-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-2 rounded-lg bg-white/5 p-2">
          <span className="h-6 w-6 shrink-0 rounded-full bg-gradient-to-br from-[#8F42FF] to-[#701CC0]" />
          <div className="flex-1 space-y-1.5">
            <div className="h-1.5 w-2/3 rounded-full bg-white/20" />
            <motion.div
              className="h-1.5 rounded-full bg-[#B366FF]"
              animate={{ width: ["18%", "85%", "18%"] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: i * 0.45 }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// Delivery Infrastructure — healthy sending throughput bars.
function DeliveryAnim() {
  return (
    <div className="flex h-full items-end justify-center gap-2 px-4 pb-5 pt-6">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <motion.span
          key={i}
          className="w-3 rounded-t-md bg-gradient-to-t from-[#701CC0] to-[#B366FF]"
          animate={{ height: [16, 70, 34, 58, 16] }}
          transition={{ duration: 2.4 + i * 0.25, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  )
}

// Omnichannel Campaigns — channel badges firing in sequence.
function OmnichannelAnim() {
  const chans = [
    { Icon: SiGmail, color: "#EA4335" },
    { Icon: FaLinkedin, color: "#0A66C2" },
    { Icon: FaInstagram, color: "#E4405F" },
    { Icon: FaWhatsapp, color: "#25D366" },
    { Icon: SiGoogle, color: "#4285F4" },
  ]
  return (
    <div className="flex h-full items-center justify-center gap-3">
      {chans.map(({ Icon, color }, i) => (
        <motion.span
          key={i}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5"
          animate={{ scale: [1, 1.18, 1], boxShadow: ["0 0 0 0 rgba(179,102,255,0)", "0 0 0 6px rgba(179,102,255,0.12)", "0 0 0 0 rgba(179,102,255,0)"] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut", delay: i * 0.28 }}
        >
          <Icon className="h-4 w-4" style={{ color }} aria-hidden />
        </motion.span>
      ))}
    </div>
  )
}

// Sales Intelligence — a lead dossier whose research fields populate, then a
// "meeting booked" tag lands (deep research handed to your AEs).
function SalesIntelAnim() {
  return (
    <div className="flex h-full items-center p-3">
      <div className="w-full rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="flex items-center gap-2">
          <span className="h-7 w-7 rounded-full bg-gradient-to-br from-[#8F42FF] to-[#701CC0]" />
          <div className="h-2 w-24 rounded-full bg-white/25" />
          <motion.span
            className="ml-auto rounded-full bg-[#22C55E]/20 px-2 py-0.5 text-[9px] font-semibold text-[#8FF0B0]"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: [0, 0, 1, 1], scale: [0.8, 0.8, 1, 1] }}
            transition={{ duration: 3.2, repeat: Infinity, times: [0, 0.6, 0.75, 1] }}
          >
            Meeting booked
          </motion.span>
        </div>
        <div className="mt-3 space-y-1.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="h-1.5 rounded-full bg-[#B366FF]/50"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: ["0%", `${70 - i * 12}%`], opacity: [0, 1] }}
              transition={{ duration: 0.6, repeat: Infinity, repeatType: "reverse", repeatDelay: 2, delay: i * 0.25 }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// Personalized Outreach — a personalized message with a live typing indicator.
function OutreachAnim() {
  return (
    <div className="flex h-full flex-col justify-center gap-2 p-3">
      <div className={`max-w-[85%] self-start rounded-2xl rounded-bl-sm bg-white/8 px-3 py-2 text-[11px] leading-snug text-white/80 ${inter.className}`}>
        Hi <span className="font-semibold text-[#C99DFF]">Jordan</span> — noticed you&apos;re scaling outbound…
      </div>
      <div className="flex items-center gap-1.5 self-start rounded-full bg-white/8 px-3 py-2">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-[#C99DFF]"
            animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
            transition={{ duration: 1, repeat: Infinity, ease: "easeInOut", delay: i * 0.18 }}
          />
        ))}
      </div>
    </div>
  )
}

// SEO / AEO / GEO — rank badge + AI answer-engine citations lighting up.
function SeoAnim() {
  const engines = ["Google", "ChatGPT", "Perplexity", "AI Overviews"]
  return (
    <div className="flex h-full flex-col justify-center gap-2 p-3">
      <div className="flex items-center gap-2 rounded-lg bg-white/5 p-2">
        <motion.span
          className="flex h-6 w-8 items-center justify-center rounded-md bg-[#22C55E]/20 text-[10px] font-bold text-[#8FF0B0]"
          animate={{ scale: [1, 1.12, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
          #1
        </motion.span>
        <div className="h-1.5 flex-1 rounded-full bg-white/20" />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {engines.map((e, i) => (
          <motion.span
            key={e}
            className={`rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[9px] font-medium text-[#C99DFF] ${inter.className}`}
            animate={{ opacity: [0.4, 1, 0.4], borderColor: ["rgba(255,255,255,0.1)", "rgba(143,66,255,0.5)", "rgba(255,255,255,0.1)"] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: i * 0.35 }}
          >
            {e}
          </motion.span>
        ))}
      </div>
    </div>
  )
}

// Analytics & Attribution — a bar chart growing with an up-trend.
function AnalyticsAnim() {
  const heights = [30, 46, 40, 62, 78]
  return (
    <div className="flex h-full items-end justify-center gap-2 px-4 pb-5 pt-6">
      {heights.map((h, i) => (
        <motion.span
          key={i}
          className="w-4 rounded-t-md bg-gradient-to-t from-[#701CC0] to-[#C99DFF]"
          initial={{ height: 8 }}
          whileInView={{ height: h }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
        />
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Bento grid                                                          */
/* ------------------------------------------------------------------ */

// `h` sets each card's animation-area height so the masonry has varied box
// heights (some tall, some short) instead of stretched wide cards.
type Box = { title: string; desc: string; anim: ReactNode; h: string }

const boxes: Box[] = [
  {
    title: "Lead Research",
    desc: "Every lead is enriched and qualified before it ever reaches your calendar.",
    anim: <LeadResearchAnim />,
    h: "h-32",
  },
  {
    title: "Delivery Infrastructure",
    desc: "Warmed inboxes and resilient sending infrastructure so your messages actually land.",
    anim: <DeliveryAnim />,
    h: "h-44",
  },
  {
    title: "Omnichannel Campaigns",
    desc: "Coordinated outreach across email, LinkedIn, social, SMS, and search — all firing in sync.",
    anim: <OmnichannelAnim />,
    h: "h-24",
  },
  {
    title: "Sales Intelligence",
    desc: "Your account executives walk into every meeting with deep, pre-built research on the lead.",
    anim: <SalesIntelAnim />,
    h: "h-36",
  },
  {
    title: "Personalized Outreach",
    desc: "Copy that speaks to real pain points and reads like a human, never a bot.",
    anim: <OutreachAnim />,
    h: "h-28",
  },
  {
    title: "SEO · AEO · GEO Visibility",
    desc: "Rank on Google and get cited by AI answer engines like ChatGPT, Perplexity, and AI Overviews.",
    anim: <SeoAnim />,
    h: "h-40",
  },
  {
    title: "Analytics & Attribution",
    desc: "Full-funnel reporting and attribution so you see exactly what's driving booked meetings.",
    anim: <AnalyticsAnim />,
    h: "h-32",
  },
]

function FeatureCard({ b, fill, className = "" }: { b: Box; fill?: boolean; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`flex break-inside-avoid flex-col overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#240A45] to-[#1A0735] p-5 transition-transform duration-300 hover:-translate-y-1 ${className}`}
    >
      <div className={`relative mb-5 overflow-hidden rounded-2xl border border-white/5 bg-[#160530] ${fill ? "min-h-[12rem] flex-1" : b.h}`}>
        {b.anim}
      </div>
      <h3 className={`text-lg font-semibold text-white ${bricolage.className}`}>{b.title}</h3>
      <p className={`mt-2 text-[14px] leading-relaxed text-[#B9A9D6] ${inter.className}`}>{b.desc}</p>
    </motion.div>
  )
}

export default function FeatureBento() {
  const side = boxes.find((b) => b.title === "Sales Intelligence") ?? boxes[0]
  const rest = boxes.filter((b) => b !== side)
  return (
    <div>
      {/* Top row: Brand Universe (2/3) + one capability (1/3) */}
      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="grid items-center gap-6 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#240A45] to-[#1A0735] p-6 md:p-8 sm:grid-cols-2 lg:col-span-2"
        >
          <div className="relative h-64 w-full sm:h-80 lg:h-[22rem]">
            <BrandSphere />
          </div>
          <div>
            <h3 className={`text-2xl font-bold text-white md:text-3xl ${bricolage.className}`}>Brand Universe</h3>
            <p className={`mt-3 max-w-md text-[15px] leading-relaxed text-[#B9A9D6] ${inter.className}`}>
              One of the largest verified databases of buyers on earth — mapped, segmented, and ready to target.
              Drag through the universe of brands and channels we reach.
            </p>
          </div>
        </motion.div>

        <FeatureCard b={side} fill className="lg:col-span-1" />
      </div>

      {/* Remaining capabilities — masonry with varied box heights */}
      <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
        {rest.map((b) => (
          <FeatureCard key={b.title} b={b} className="mb-4" />
        ))}
      </div>
    </div>
  )
}
