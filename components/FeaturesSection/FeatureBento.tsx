"use client"

import { motion } from "framer-motion"
import { Bricolage_Grotesque, Inter } from "next/font/google"
import type { ReactNode } from "react"
import { SiGmail } from "react-icons/si"
import { FaLinkedin, FaInstagram, FaFacebook, FaCommentSms, FaWhatsapp } from "react-icons/fa6"
import BrandSphere from "./BrandSphere"

const bricolage = Bricolage_Grotesque({ subsets: ["latin"] })
const inter = Inter({ subsets: ["latin"] })

// Shared reveal-on-scroll motion + card chrome, kept DRY across the bento.
const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.3 },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
}
const CARD_SHELL = "overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#240A45] to-[#1A0735]"
const MEDIA_SHELL = "rounded-2xl border border-white/5 bg-[#160530]"

/* ------------------------------------------------------------------ */
/* Per-box animations (compact, self-contained)                        */
/* ------------------------------------------------------------------ */

// Lead Research — a lead dossier that researches + enriches itself: a scanning
// sweep runs, verified fields populate one by one with check marks, then the
// lead is stamped "Qualified". Loops.
function LeadResearchAnim() {
  const CYCLE = 5.5
  // ── Lead Research animation copy (tweak these) ───────────────────────────
  const LEAD = {
    name: "Shelby Sapp",
    firm: "She Sells Academy",
    avatar: "/assets/leads/shelby.png",
  }
  const fields = [
    { k: "Role", v: "Founder & CEO" },
    { k: "Company", v: "She Sells Academy" },
    { k: "Focus", v: "Remote Closing & Sales Training" },
    { k: "Audience", v: "Women breaking into sales." },
    { k: "Signals", v: "Needing sales closer leads." },
  ]
  // ─────────────────────────────────────────────────────────────────────────
  const appear = (i: number) => 0.18 + i * 0.12
  return (
    <div className={`flex h-full flex-col gap-2.5 p-4 ${inter.className}`}>
      {/* Lead header: avatar + name placeholder + Qualified stamp */}
      <div className="flex items-center gap-2.5">
        <motion.span
          className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-[#8F42FF]/60"
          animate={{ boxShadow: ["0 0 0 0 rgba(179,102,255,0.55)", "0 0 0 8px rgba(179,102,255,0)"] }}
          transition={{ duration: 1.9, repeat: Infinity, ease: "easeOut" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={LEAD.avatar}
            alt=""
            aria-hidden
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
            className="h-full w-full select-none object-cover object-top"
          />
        </motion.span>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[13px] font-semibold text-white">{LEAD.name}</div>
          <div className="truncate text-[11px] text-[#B9A9D6]">{LEAD.firm}</div>
        </div>
        <motion.span
          className="ml-auto rounded-md bg-[#22C55E]/15 px-2 py-1 text-[10px] font-semibold text-[#8FF0B0]"
          animate={{ opacity: [0, 0, 1, 1, 0], scale: [0.8, 0.8, 1, 1, 0.85] }}
          transition={{ duration: CYCLE, times: [0, 0.74, 0.82, 0.94, 1], repeat: Infinity }}
        >
          ✓ Ideal client
        </motion.span>
      </div>

      {/* Scanning sweep */}
      <div className="relative h-6 shrink-0 overflow-hidden rounded-lg border border-white/8 bg-white/[0.03]">
        <motion.div
          className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-[#B366FF]/45 to-transparent"
          animate={{ x: ["-40%", "340%"] }}
          transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="absolute inset-0 flex items-center gap-1.5 px-2.5">
          <motion.span
            className="h-1.5 w-1.5 rounded-full bg-[#C99DFF]"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.1, repeat: Infinity }}
          />
          <span className="text-[9px] font-medium uppercase tracking-wider text-[#C99DFF]/80">Researching {LEAD.name}…</span>
        </div>
      </div>

      {/* Enriched fields populating one by one */}
      <div className="flex flex-col gap-1.5">
        {fields.map((f, i) => (
          <motion.div
            key={f.k}
            className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-2.5 py-1.5"
            animate={{ opacity: [0, 0, 1, 1, 0], x: [10, 10, 0, 0, 0] }}
            transition={{ duration: CYCLE, times: [0, appear(i) - 0.01, appear(i), 0.9, 1], repeat: Infinity, ease: "easeOut" }}
          >
            <span className="w-12 shrink-0 text-[9px] font-medium uppercase tracking-wide text-[#8E7BB0]">{f.k}</span>
            <span className="flex-1 truncate text-[11px] text-white/85">{f.v}</span>
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-[#8FF0B0]" fill="none" stroke="currentColor" strokeWidth="3">
              <motion.path
                d="M4 12l5 5L20 6"
                strokeLinecap="round"
                strokeLinejoin="round"
                animate={{ pathLength: [0, 0, 1, 1, 0] }}
                transition={{ duration: CYCLE, times: [0, appear(i) + 0.02, appear(i) + 0.12, 0.9, 1], repeat: Infinity }}
              />
            </svg>
          </motion.div>
        ))}
      </div>
    </div>
  )
}


// Delivery Infrastructure — a deliverability dashboard: an inbox-placement meter
// fills to 100%, and outbound subject lines type themselves out (staggered),
// each getting a delivered check (warmed inboxes → outbound actually lands).
function DeliveryAnim() {
  // Subject lines written per the copywriting notes: specific, a curiosity
  // question/info-gap, a pain+desire hook, in the prospect's language — no hype.
  const subjects = ["I got a quick question about She Sells", "Book 30+ calls, pay after", "Worth a look before your cohort?"]
  return (
    <div className={`flex h-full flex-col justify-center gap-3 p-4 ${inter.className}`}>
      <style>{`
        @keyframes di-type { 0%,6% { max-width: 0 } 32% { max-width: 60ch } 82% { max-width: 60ch } 100% { max-width: 0 } }
        .di-type { display: inline-block; width: max-content; max-width: 0; overflow: hidden; white-space: nowrap; vertical-align: bottom; border-right: 1.5px solid rgba(201,157,255,0.9); animation: di-type 6s steps(26) infinite; }
        @keyframes di-deliv { 0%,32% { opacity: 0; transform: translateX(4px) } 40%,80% { opacity: 1; transform: none } 100% { opacity: 0 } }
        .di-deliv { animation: di-deliv 6s infinite; }
        @media (prefers-reduced-motion: reduce) { .di-type { max-width: none; animation: none } .di-deliv { opacity: 1; animation: none } }
      `}</style>

      {/* Inbox-placement meter. */}
      <div>
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-[#B9A9D6]">Inbox Placement</span>
          <span className="font-semibold text-[#8FF0B0]">100%</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-[#8FF0B0] to-[#22C55E]"
            initial={{ width: 0 }}
            whileInView={{ width: "100%" }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Moving glow that sweeps along the filled line. */}
            <motion.span
              aria-hidden
              className="absolute inset-y-0 w-1/4 bg-gradient-to-r from-transparent via-white/80 to-transparent blur-[1px]"
              animate={{ x: ["-120%", "520%"] }}
              transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>
        </div>
      </div>

      {/* Outbound subject lines type out, then land — delivered. */}
      <div className="flex flex-col gap-2">
        {subjects.map((subj, i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.04] px-2.5 py-2">
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-[#C99DFF]" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="M3 7l9 6 9-6" />
            </svg>
            <span className="di-type text-[11px] text-white/85" style={{ animationDelay: `${i * 1.3}s` }}>
              {subj}
            </span>
            <span className="flex-1" />
            <svg
              viewBox="0 0 24 24"
              className="di-deliv h-4 w-4 shrink-0 text-[#8FF0B0]"
              style={{ animationDelay: `${i * 1.3}s` }}
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
            >
              <circle cx="12" cy="12" r="10" strokeWidth="1.5" opacity="0.5" />
              <path d="M8 12.5l2.5 2.5L16 9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        ))}
      </div>
    </div>
  )
}

// Omnichannel Campaigns — channel badges firing in sequence.
function OmnichannelAnim() {
  const chans = [
    { Icon: SiGmail, color: "#EA4335" },
    { Icon: FaLinkedin, color: "#0A66C2" },
    { Icon: FaInstagram, color: "#E4405F" },
    { Icon: FaFacebook, color: "#1877F2" },
    { Icon: FaCommentSms, color: "#22C55E" },
    { Icon: FaWhatsapp, color: "#25D366" },
  ]
  return (
    <div className="flex h-full flex-wrap items-center justify-center gap-2">
      {chans.map(({ Icon, color }, i) => (
        <motion.span
          key={i}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5"
          animate={{ scale: [1, 1.18, 1], boxShadow: ["0 0 0 0 rgba(179,102,255,0)", "0 0 0 6px rgba(179,102,255,0.12)", "0 0 0 0 rgba(179,102,255,0)"] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut", delay: i * 0.24 }}
        >
          <Icon className="h-4 w-4" style={{ color }} aria-hidden />
        </motion.span>
      ))}
    </div>
  )
}

// Sales Intelligence — a lead "fit score" gauge fills, key qualifying facts
// check off, and the lead is briefed for the AE.
function SalesIntelAnim() {
  const R = 16
  const C = 2 * Math.PI * R
  const CYCLE = 5
  const facts = ["Budget Confirmed", "Decision-Maker", "Active Project"]
  const appear = (i: number) => 0.16 + i * 0.14
  return (
    <div className="flex h-full items-center justify-center gap-3 p-3">
      {/* Fit-score gauge — fills, holds, resets on a loop. */}
      <div className="relative h-16 w-16 shrink-0">
        <svg viewBox="0 0 40 40" className="h-full w-full -rotate-90">
          <circle cx="20" cy="20" r={R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="4" />
          <motion.circle
            cx="20"
            cy="20"
            r={R}
            fill="none"
            stroke="#8FF0B0"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={C}
            animate={{ strokeDashoffset: [C, C * (1 - 0.92), C * (1 - 0.92), C] }}
            transition={{ duration: CYCLE, times: [0, 0.3, 0.85, 1], repeat: Infinity, ease: "easeInOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
          <span className="text-[14px] font-bold text-white">92</span>
          <span className="text-[7px] uppercase tracking-wide text-[#B9A9D6]">fit</span>
        </div>
      </div>
      {/* Qualifying facts check off, then the AE hand-off — loops. */}
      <div className={`space-y-1.5 ${inter.className}`}>
        {facts.map((t, i) => (
          <motion.div
            key={t}
            className="flex items-center gap-1.5"
            animate={{ opacity: [0, 0, 1, 1, 0], x: [8, 8, 0, 0, 0] }}
            transition={{ duration: CYCLE, times: [0, appear(i), Math.min(appear(i) + 0.08, 0.99), 0.9, 1], repeat: Infinity, ease: "easeOut" }}
          >
            <span className="text-[10px] text-[#8FF0B0]">✓</span>
            <span className="text-[10px] text-white/80">{t}</span>
          </motion.div>
        ))}
        <motion.span
          className="mt-1 inline-block rounded-full bg-[#701CC0]/40 px-2 py-0.5 text-[9px] font-semibold text-[#E6D2FF]"
          animate={{ opacity: [0, 0, 1, 1, 0], y: [4, 4, 0, 0, 0] }}
          transition={{ duration: CYCLE, times: [0, 0.62, 0.7, 0.9, 1], repeat: Infinity }}
        >
          Briefed For Your AE
        </motion.span>
      </div>
    </div>
  )
}

// Personalized Outreach — a live SMS thread. Each message is preceded by a
// typing indicator, shows the sender's profile picture + a timestamp, and the
// back-and-forth plays out (then loops).
const OUTREACH_CYCLE = 10
const OUTREACH_MSGS = [
  { from: "you", time: "2:14 PM", text: "Hi Shelby! Loved seeing She Sells Academy open a new cohort. We keep sales calendars full of qualified calls, no extra hires needed. Open to a quick look?" },
  { from: "them", time: "2:15 PM", text: "Honestly, this is perfect timing. Send me a couple times and I'm in" },
  { from: "you", time: "2:15 PM", text: "Does Thursday afternoon work for you?" },
  { from: "them", time: "2:16 PM", text: "Yes! That sounds good" },
  { from: "you", time: "2:16 PM", text: "Love it. Just booked you a Thursday slot. Talk soon!" },
  { from: "them", time: "2:17 PM", text: "Amazing, see you then" },
] as const

function OutreachAvatar({ you }: { you: boolean }) {
  // "you" = Alex (Vierra rep) on the right; the other side is Shelby.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={you ? "/assets/Team/Alex.png" : "/assets/leads/shelby.png"}
      alt=""
      aria-hidden
      draggable={false}
      className="h-6 w-6 shrink-0 select-none rounded-full object-cover object-top"
    />
  )
}

function OutreachMsg({ i }: { i: number }) {
  const m = OUTREACH_MSGS[i]
  const you = m.from === "you"
  const at = 0.05 + i * 0.13 // when the text lands — even cadence for every message
  const typeAt = Math.max(0.01, at - 0.05) // when the typing bubble appears
  const bubble = `rounded-2xl px-3 py-2 text-[12px] leading-snug ${you ? "rounded-br-md bg-[#701CC0]/45 text-white" : "rounded-bl-md bg-white/10 text-white/90"}`
  return (
    <motion.div
      className={`flex max-w-full items-end gap-1.5 ${you ? "flex-row-reverse self-end" : "self-start"}`}
      animate={{ opacity: [0, 0, 1, 1] }}
      transition={{ duration: OUTREACH_CYCLE, times: [0, typeAt, Math.min(typeAt + 0.01, 0.99), 1], repeat: Infinity }}
    >
      <OutreachAvatar you={you} />
      <div className="grid max-w-[80%]">
        {/* Typing bubble (shows first) */}
        <motion.div
          className={`${bubble} flex items-center gap-1 self-${you ? "end" : "start"}`}
          style={{ gridArea: "1 / 1" }}
          animate={{ opacity: [0, 1, 1, 0, 0] }}
          transition={{ duration: OUTREACH_CYCLE, times: [0, typeAt, at - 0.005, at, 1], repeat: Infinity }}
        >
          {[0, 1, 2].map((d) => (
            <motion.span
              key={d}
              className="h-1.5 w-1.5 rounded-full bg-current opacity-70"
              animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
              transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut", delay: d * 0.15 }}
            />
          ))}
        </motion.div>
        {/* Message + timestamp (replaces the typing bubble) */}
        <motion.div
          style={{ gridArea: "1 / 1" }}
          className={`flex flex-col ${you ? "items-end" : "items-start"}`}
          animate={{ opacity: [0, 0, 1, 1] }}
          transition={{ duration: OUTREACH_CYCLE, times: [0, at - 0.005, at, 1], repeat: Infinity }}
        >
          <div className={bubble}>{m.text}</div>
          <span className="mt-0.5 px-1 text-[8px] text-white/40">{m.time}</span>
        </motion.div>
      </div>
    </motion.div>
  )
}

function OutreachAnim() {
  return (
    <div className={`flex h-full flex-col gap-2 p-4 ${inter.className}`}>
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-[#C99DFF]/80">
        <span className="h-2 w-2 rounded-full bg-[#22C55E]" /> SMS Thread · Live
      </div>
      <div className="flex flex-1 flex-col justify-end gap-2 overflow-hidden">
        {OUTREACH_MSGS.map((_, i) => (
          <OutreachMsg key={i} i={i} />
        ))}
      </div>
    </div>
  )
}

// SEO / AEO / GEO — a search query, the #1 organic rank, and AI answer-engine
// citations lighting up one by one.
function SeoAnim() {
  const engines = ["Google", "ChatGPT", "Claude", "Perplexity", "AI Overviews"]
  return (
    <div className={`flex h-full flex-col justify-center gap-2 p-3 ${inter.className}`}>
      <style>{`
        @keyframes seo-typing { 0% { width: 0 } 45% { width: 22ch } 100% { width: 22ch } }
        .seo-type { display: inline-block; width: 0; overflow: hidden; white-space: nowrap; vertical-align: bottom; animation: seo-typing 4s steps(20) infinite; }
        @media (prefers-reduced-motion: reduce) { .seo-type { width: auto; animation: none; } }
      `}</style>
      {/* Search query, typing out, with a blinking cursor. */}
      <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
        <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0 text-[#C99DFF]" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4-4" strokeLinecap="round" />
        </svg>
        <span className="seo-type text-[10px] text-white/70">b2b lead generation</span>
        <motion.span
          className="ml-auto h-3 w-[1.5px] bg-[#C99DFF]"
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      </div>
      {/* Organic #1 rank — the bar fills all the way. */}
      <div className="flex items-center gap-2 rounded-lg bg-white/5 p-2">
        <motion.span
          className="flex h-6 w-8 items-center justify-center rounded-md bg-[#22C55E]/20 text-[10px] font-bold text-[#8FF0B0]"
          animate={{ scale: [1, 1.12, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
          #1
        </motion.span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15">
          <motion.div
            className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-[#8FF0B0] to-[#22C55E]"
            animate={{ width: ["0%", "100%", "100%"] }}
            transition={{ duration: 3, times: [0, 0.55, 1], repeat: Infinity, ease: "easeInOut" }}
          >
            {/* Moving glow that sweeps along the filled line. */}
            <motion.span
              aria-hidden
              className="absolute inset-y-0 w-1/4 bg-gradient-to-r from-transparent via-white/80 to-transparent blur-[1px]"
              animate={{ x: ["-120%", "520%"] }}
              transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>
        </div>
      </div>
      {/* Cited across answer engines. */}
      <div className="flex flex-wrap gap-1.5">
        {engines.map((e, i) => (
          <motion.span
            key={e}
            className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[9px] font-medium text-[#C99DFF]"
            animate={{ opacity: [0.4, 1, 0.4], borderColor: ["rgba(255,255,255,0.1)", "rgba(143,66,255,0.5)", "rgba(255,255,255,0.1)"] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: i * 0.35 }}
          >
            <span className="text-[#8FF0B0]">✓</span>
            {e}
          </motion.span>
        ))}
      </div>
    </div>
  )
}

// Analytics & Attribution — a centered conversion funnel that loops: each bar
// grows out from the middle (staggered), holds, then fades and re-grows. Shows
// drop-off %, flags the weak stage "Optimize", and tallies the booked total.
// Drop-off % = 1 − (stage ÷ previous stage), checked against the counts.
function AnalyticsAnim() {
  const CYCLE = 5.5
  const stages = [
    { label: "Leads", v: "12,480", w: 100, drop: "", opt: false },
    { label: "Engaged", v: "3,240", w: 66, drop: "-74%", opt: false },
    { label: "Replied", v: "940", w: 40, drop: "-71%", opt: true },
    { label: "Booked", v: "312", w: 32, drop: "-67%", opt: false },
  ]
  return (
    <div className={`flex h-full flex-col items-center justify-center gap-1.5 p-4 ${inter.className}`}>
      {stages.map((s, i) => {
        // Appear (extend) top→bottom, then disappear (retract) bottom→top.
        // No opacity fade on the bar itself — width only. The side labels
        // (drop-% + Optimize) fade in/out on the same clock so the whole row
        // collapses together instead of leaving floating text behind.
        const N = stages.length
        const gStart = 0.05 + i * 0.08 // top rows grow first
        const sStart = 0.62 + (N - 1 - i) * 0.07 // bottom rows shrink first
        const times = [0, gStart, gStart + 0.12, sStart, sStart + 0.14, 1]
        const present = [0, 0, 1, 1, 0, 0] // matches the bar's grow → hold → retract
        const sideTx = { duration: CYCLE, times, repeat: Infinity }
        return (
        <div key={s.label} className="flex w-full items-center justify-center gap-2">
          <motion.span
            className="w-14 shrink-0 text-right text-[8px] text-[#8FF0B0]"
            animate={{ opacity: present }}
            transition={sideTx}
          >
            {s.drop}
          </motion.span>
          <motion.div
            className={`relative flex h-6 items-center justify-center overflow-hidden rounded-md ${
              s.opt ? "bg-gradient-to-r from-[#F0ABFC] to-[#B366FF]" : "bg-gradient-to-r from-[#701CC0] to-[#B366FF]"
            }`}
            animate={{ width: ["0%", "0%", `${s.w}%`, `${s.w}%`, "0%", "0%"] }}
            transition={{ duration: CYCLE, times, repeat: Infinity, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="truncate px-2 text-[10px] font-semibold text-white">
              {s.label} · {s.v}
            </span>
          </motion.div>
          {s.opt ? (
            <motion.span
              className="w-14 shrink-0 whitespace-nowrap rounded-full bg-[#F0ABFC]/20 px-1.5 py-0.5 text-center text-[8px] font-semibold text-[#F0ABFC]"
              animate={{ opacity: present }}
              transition={sideTx}
            >
              ↑ Optimize
            </motion.span>
          ) : (
            <span className="w-14 shrink-0" aria-hidden />
          )}
        </div>
        )
      })}
      <motion.div
        className="mt-1 flex items-center gap-1.5 text-[9px] font-medium text-[#8FF0B0]"
        animate={{ opacity: [0, 0, 1, 1, 0, 0] }}
        transition={{ duration: CYCLE, times: [0, 0.42, 0.52, 0.62, 0.78, 1], repeat: Infinity }}
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#8FF0B0]" /> 312 Meetings Booked · +142% MoM
      </motion.div>
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
    desc: "Every lead is enriched and qualified before it ever reaches your campaign efforts.",
    anim: <LeadResearchAnim />,
    h: "h-32",
  },
  {
    title: "Delivery Infrastructure",
    desc: "Warmed inboxes, deliverability tools, and sending infrastructure so your outbound actually lands.",
    anim: <DeliveryAnim />,
    h: "h-44",
  },
  {
    title: "Omnichannel Campaigns",
    desc: "Coordinated outreach across email, LinkedIn, Instagram, SMS, and more, all firing in sync.",
    anim: <OmnichannelAnim />,
    h: "h-24",
  },
  {
    title: "Personalized Outreach",
    desc: "Copy that speaks to real pain points and reads as your top sales closer.",
    anim: <OutreachAnim />,
    h: "h-28",
  },
  {
    title: "Sales Intelligence",
    desc: "Arm your AEs with deep intelligence on every lead.",
    anim: <SalesIntelAnim />,
    h: "h-36",
  },
  {
    title: "SEO · AEO · GEO Visibility",
    desc: "Rank on Google and get cited by AI answer engines like ChatGPT, Claude, Perplexity, and AI Overviews.",
    anim: <SeoAnim />,
    h: "h-40",
  },
  {
    title: "Analytics & Attribution",
    desc: "Full-funnel reporting and attribution so you see exactly what's driving meetings booked and where you can improve your funnel.",
    anim: <AnalyticsAnim />,
    h: "h-40",
  },
]

function FeatureCard({ b, fill, className = "" }: { b: Box; fill?: boolean; className?: string }) {
  return (
    <motion.div
      {...reveal}
      className={`flex break-inside-avoid flex-col ${CARD_SHELL} p-5 transition-transform duration-300 hover:-translate-y-1 ${className}`}
    >
      <div className={`relative mb-5 overflow-hidden ${MEDIA_SHELL} ${fill ? "min-h-[12rem] flex-1" : b.h}`}>
        {b.anim}
      </div>
      <h3 className={`text-lg font-semibold text-white ${bricolage.className}`}>{b.title}</h3>
      <p className={`mt-2 text-[14px] leading-relaxed text-[#B9A9D6] ${inter.className}`}>{b.desc}</p>
    </motion.div>
  )
}

export default function FeatureBento() {
  const side = boxes.find((b) => b.title === "Lead Research") ?? boxes[0]
  const delivery = boxes.find((b) => b.title === "Delivery Infrastructure")
  const outreach = boxes.find((b) => b.title === "Personalized Outreach")
  const omni = boxes.find((b) => b.title === "Omnichannel Campaigns")
  const salesIntel = boxes.find((b) => b.title === "Sales Intelligence")
  // Bottom full-width row: SEO + Analytics.
  const rest = boxes.filter((b) => b !== side && b !== delivery && b !== outreach && b !== omni && b !== salesIntel)
  return (
    <div>
      {/* Top row: Brand Universe (2/3) + Lead Research (1/3) */}
      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <motion.div
          {...reveal}
          className={`grid items-center gap-6 ${CARD_SHELL} p-6 md:p-8 sm:grid-cols-2 lg:col-span-2`}
        >
          <div className="relative h-64 w-full sm:h-80 lg:h-[22rem]">
            <BrandSphere />
          </div>
          <div>
            <h3 className={`text-2xl font-bold text-white md:text-3xl ${bricolage.className}`}>Brand Universe</h3>
            <p className={`mt-3 max-w-md text-[15px] leading-relaxed text-[#B9A9D6] ${inter.className}`}>
              One of the largest verified databases of buyers on the market. Mapped, segmented, and ready to
              target. We&apos;ve built our entire infrastructure on the world&apos;s most comprehensive database of
              business owners, CMOs, and founders.
            </p>
            <p className={`mt-4 max-w-md text-[15px] leading-relaxed text-[#B9A9D6] ${inter.className}`}>
              When you&apos;re selling to other businesses, you need a platform that understands your industry.
            </p>
          </div>
        </motion.div>

        <FeatureCard b={side} fill className="lg:col-span-1" />
      </div>

      {/* Row 2: Personalized Outreach (tall/double, left 1/3) + Delivery
          Infrastructure (2/3 right, wrench left of the copy). */}
      <div className="mb-4 grid items-stretch gap-4 lg:grid-cols-3">
        {outreach && (
          <motion.div {...reveal} className={`flex flex-col ${CARD_SHELL} p-5 lg:col-span-1`}>
            <div className={`relative mb-4 min-h-[24rem] flex-1 overflow-hidden ${MEDIA_SHELL}`}>
              {outreach.anim}
            </div>
            <h3 className={`text-lg font-semibold text-white ${bricolage.className}`}>{outreach.title}</h3>
            <p className={`mt-2 text-[14px] leading-relaxed text-[#B9A9D6] ${inter.className}`}>{outreach.desc}</p>
          </motion.div>
        )}

        {/* Right column (2/3): Delivery on top, then Omnichannel + Sales
            Intelligence filling the gap beneath it (beside the tall Outreach). */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          {delivery && (
            <motion.div {...reveal} className={`grid items-center gap-6 ${CARD_SHELL} p-6 md:p-8 sm:grid-cols-2`}>
              <div className={`relative h-52 w-full ${MEDIA_SHELL} sm:h-60`}>
                {delivery.anim}
              </div>
              <div>
                <h3 className={`text-2xl font-bold text-white md:text-3xl ${bricolage.className}`}>{delivery.title}</h3>
                <p className={`mt-3 max-w-md text-[15px] leading-relaxed text-[#B9A9D6] ${inter.className}`}>{delivery.desc}</p>
              </div>
            </motion.div>
          )}
          <div className="grid flex-1 gap-4 sm:grid-cols-5">
            {omni && <FeatureCard b={omni} fill className="sm:col-span-3" />}
            {salesIntel && <FeatureCard b={salesIntel} fill className="sm:col-span-2" />}
          </div>
        </div>
      </div>

      {/* Bottom row: SEO · AEO · GEO + Analytics & Attribution. */}
      <div className="grid gap-4 sm:grid-cols-2">
        {rest.map((b) => (
          <FeatureCard key={b.title} b={b} />
        ))}
      </div>
    </div>
  )
}
