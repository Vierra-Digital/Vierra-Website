"use client"

import { useState, useEffect, useRef, type ReactNode } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"
import { bricolage, inter } from "@/lib/fonts";
import { ArrowUpRight } from "lucide-react"
import { Modal } from "@/components/Modal"
import type { IconType } from "react-icons"
import { FaComment, FaLinkedin } from "react-icons/fa6"
import {
  SiGmail,
  SiSlack,
  SiGooglecalendar,
  SiGoogle,
  SiInstagram,
  SiGoogleads,
  SiSalesforce,
  SiHubspot,
  SiNotion,
  SiSpotify,
  SiAirbnb,
  SiFigma,
  SiDropbox,
} from "react-icons/si"


// Illustrative booked-meeting feed (sample data, not real bookings).
type Meeting = { company: string; source: string; Icon: IconType; color: string; time: string }
const meetings: Meeting[] = [
  { company: "Alo", source: "via LinkedIn InMail", Icon: FaLinkedin, color: "#0A66C2", time: "9:14 AM" },
  { company: "Gymshark", source: "via Cartography Email Campaign", Icon: SiGmail, color: "#EA4335", time: "10:02 AM" },
  { company: "Olipop", source: "via Instagram DM", Icon: SiInstagram, color: "#E4405F", time: "11:38 AM" },
  { company: "Glossier", source: "via Organic SEO Funnel", Icon: SiGoogle, color: "#4285F4", time: "12:21 PM" },
  { company: "Liquid Death", source: "via SMS Warm Outreach", Icon: FaComment, color: "#16A34A", time: "1:47 PM" },
  { company: "Allbirds", source: "via LinkedIn InMail", Icon: FaLinkedin, color: "#0A66C2", time: "2:30 PM" },
  { company: "Magic Spoon", source: "via Instagram DM", Icon: SiInstagram, color: "#E4405F", time: "3:52 PM" },
]

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } },
}

function MeetingCard({ m }: { m: Meeting }) {
  const SourceIcon = m.Icon
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-[#701CC0]/10 bg-white px-4 py-4 shadow-[0_12px_30px_-20px_rgba(112,28,192,0.5)] md:px-5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F4F2F8]">
        <SiGooglecalendar className="h-5 w-5" style={{ color: "#4285F4" }} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className={`truncate font-semibold text-[#18042A] ${inter.className}`}>
          Meeting booked with {m.company}
        </div>
        <div className={`mt-1 inline-flex items-center gap-1.5 text-xs text-[#5C5470] ${inter.className}`}>
          <SourceIcon className="h-3.5 w-3.5" style={{ color: m.color }} aria-hidden />
          {m.source}
        </div>
      </div>
      <span className={`shrink-0 text-xs font-medium text-[#9A93A8] ${inter.className}`}>{m.time}</span>
    </div>
  )
}

// Meetings pop in one at a time at the top (like live notifications arriving)
// and push the older ones down until they fade out at the bottom.
function MeetingFeed() {
  const [ids, setIds] = useState<number[]>([])
  const counter = useRef(0)
  useEffect(() => {
    const tick = () => setIds((prev) => [counter.current++, ...prev].slice(0, 6))
    tick()
    const t = setInterval(tick, 850)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="flex flex-col gap-4">
      <AnimatePresence initial={false}>
        {ids.map((id) => (
          <motion.div
            key={id}
            layout
            initial={{ opacity: 0, scale: 0.9, y: -14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
          >
            <MeetingCard m={meetings[id % meetings.length]} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

/* ------------------------- Feature bento boxes ------------------------- */

// Shared box chrome — white card with the section's purple-tinted edge/shadow.
function FeatureBox({
  className = "",
  compact = false,
  children,
}: {
  className?: string
  compact?: boolean
  children: ReactNode
}) {
  const pad = compact ? "p-5 md:p-6" : "p-6 md:p-8"
  return (
    <div
      className={`rounded-3xl border border-[#701CC0]/10 bg-white shadow-[0_18px_44px_-30px_rgba(112,28,192,0.55)] ${pad} ${className}`}
    >
      {children}
    </div>
  )
}

// Box title sits on the same line as its icon.
function BoxHeader({ Icon, color, title }: { Icon: IconType; color: string; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#F4F2F8]">
        <Icon className="h-6 w-6" style={{ color }} aria-hidden />
      </span>
      <h3 className={`text-xl font-semibold text-[#18042A] md:text-2xl ${bricolage.className}`}>{title}</h3>
    </div>
  )
}

// --- Calendar box: an empty week view that fills with booked meetings over
// time, then quietly previews a couple of them as clean detail cards. ---
const calDays = ["Tue 08", "Wed 09", "Thu 10", "Fri 11", "Sat 12"]
const calTone: Record<"blue" | "pink" | "purple" | "plain", string> = {
  blue: "bg-[#D6ECFB] text-[#1B3A4B]",
  pink: "bg-[#F7DCEA] text-[#6E2A49]",
  purple: "bg-[#EAE2FB] text-[#46256E]",
  plain: "bg-white border border-[#ECE8F2] text-[#3A3346]",
}
type CalMeeting = {
  id: string
  col: number
  row: number
  client: string
  type: string
  t12: string
  t24: string
  tone: keyof typeof calTone
  attendee: string
  link: string
}
// Meetings populate in a random order onto the empty grid each cycle.
const calMeetings: CalMeeting[] = [
  { id: "tilebar", col: 0, row: 0, client: "TileBar", type: "Discovery Call", t12: "11AM – 12PM", t24: "11:00 – 12:00", tone: "blue", attendee: "Jordan Lee · Head of Growth", link: "meet.vierra.co/tb-9f2" },
  { id: "standup1", col: 1, row: 0, client: "Sales Standup", type: "Internal", t12: "11 – 11:30AM", t24: "11:00 – 11:30", tone: "plain", attendee: "Vierra Sales team", link: "meet.vierra.co/standup" },
  { id: "ids", col: 2, row: 0, client: "IDS Society", type: "Product Demo", t12: "11AM – 12PM", t24: "11:00 – 12:00", tone: "pink", attendee: "Priya N · Director", link: "meet.vierra.co/ids-3k1" },
  { id: "pcrichards", col: 3, row: 0, client: "P.C. Richards", type: "Discovery Call", t12: "11AM – 12PM", t24: "11:00 – 12:00", tone: "purple", attendee: "Marcus W · VP Sales", link: "meet.vierra.co/pcr-7p4" },
  { id: "lunch", col: 4, row: 0, client: "Lunch", type: "Break", t12: "12 – 1PM", t24: "12:00 – 13:00", tone: "plain", attendee: "Out of office", link: "—" },
  { id: "standup2", col: 0, row: 1, client: "Sales Standup", type: "Internal", t12: "12:30 – 1PM", t24: "12:30 – 13:00", tone: "plain", attendee: "Vierra Sales team", link: "meet.vierra.co/standup" },
  { id: "vsync", col: 2, row: 1, client: "Vierra Sync", type: "Internal", t12: "12 – 1PM", t24: "12:00 – 13:00", tone: "purple", attendee: "Vierra team", link: "meet.vierra.co/sync" },
]

// Decorative — opens and closes on its own as part of the loop, so it's
// pointer-events-none and has no interactive controls. Deliberately minimal.
function MeetingModal({ m, mode }: { m: CalMeeting; mode: "12h" | "24h" }) {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-3"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="absolute inset-0 bg-white/60" />
      <motion.div
        role="dialog"
        aria-label={`Meeting with ${m.client}`}
        initial={{ opacity: 0, y: 10, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 6, scale: 0.98 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className={`relative w-[208px] rounded-2xl border border-[#ECE8F2] bg-white p-5 text-center shadow-[0_24px_60px_-22px_rgba(24,4,42,0.4)] ${inter.className}`}
      >
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9A93A8]">{m.type}</div>
        <h4 className={`mt-1.5 text-lg font-semibold leading-tight text-[#18042A] ${bricolage.className}`}>{m.client}</h4>
        <p className="mt-1 text-sm text-[#5C5470]">{calDays[m.col]} · {mode === "12h" ? m.t12 : m.t24}</p>
        <div className="mt-4 rounded-xl bg-[#701CC0] px-4 py-2.5 text-sm font-medium text-white">Join call</div>
      </motion.div>
    </motion.div>
  )
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function CalendarVisual() {
  const [mode, setMode] = useState<"12h" | "24h">("12h")
  const [shownIds, setShownIds] = useState<number[]>([]) // meeting indices on the grid
  const [selected, setSelected] = useState<number | null>(null) // modal meeting index

  // Loop forever: reveal meetings in a random order, preview a couple of client
  // calls as modals, then clear and re-shuffle. Randomness lives in the effect
  // (client-only), so there's no SSR hydration mismatch.
  useEffect(() => {
    let alive = true
    const timers: ReturnType<typeof setTimeout>[] = []
    const wait = (ms: number) =>
      new Promise<void>((res) => {
        timers.push(setTimeout(res, ms))
      })
    const run = async () => {
      while (alive) {
        const order = shuffle(calMeetings.map((_, i) => i))
        const revealed: number[] = []
        for (const idx of order) {
          revealed.push(idx)
          setShownIds([...revealed])
          if (calMeetings[idx].type === "Discovery Call") {
            // pop the discovery-call modal right as it lands on the calendar
            await wait(450)
            if (!alive) return
            setSelected(idx)
            await wait(1500)
            if (!alive) return
            setSelected(null)
            await wait(400)
            if (!alive) return
          } else {
            await wait(550)
            if (!alive) return
          }
        }
        await wait(1100)
        if (!alive) return
        setShownIds([])
        await wait(1100)
        if (!alive) return
      }
    }
    run()
    return () => {
      alive = false
      timers.forEach(clearTimeout)
    }
  }, [])

  const shown = shownIds.map((i) => calMeetings[i])

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#ECE8F2]">
      {/* toolbar with the 12h / 24h toggle */}
      <div className="flex justify-end border-b border-[#F0EDF5] p-2.5">
        <div className={`inline-flex items-center rounded-lg bg-[#F4F2F8] p-0.5 text-xs font-medium ${inter.className}`}>
          {(["12h", "24h"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`rounded-md px-2.5 py-1 transition-colors ${
                mode === m ? "bg-white text-[#18042A] shadow-sm" : "text-[#9A93A8] hover:text-[#5C5470]"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      {/* day headers */}
      <div className={`grid grid-cols-5 border-b border-[#F0EDF5] text-center text-[11px] text-[#6B6580] ${inter.className}`}>
        {calDays.map((d) => (
          <div key={d} className="py-2">{d}</div>
        ))}
      </div>
      {/* two rows that fill in over time */}
      {[0, 1].map((row) => (
        <div key={row} className="grid grid-cols-5">
          {[0, 1, 2, 3, 4].map((col) => {
            const m = shown.find((e) => e.col === col && e.row === row)
            return (
              <div key={col} className="min-h-[66px] border-b border-r border-[#F4F1F8] p-1.5 last:border-r-0">
                <AnimatePresence>
                  {m && (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                      className={`flex h-full flex-col justify-center rounded-lg px-2 py-1.5 ${calTone[m.tone]} ${inter.className}`}
                    >
                      <span className="truncate text-[11px] font-semibold leading-tight">{m.client}</span>
                      <span className="mt-0.5 truncate text-[10px] opacity-80">{mode === "12h" ? m.t12 : m.t24}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      ))}

      <AnimatePresence>
        {selected !== null && <MeetingModal m={calMeetings[selected]} mode={mode} />}
      </AnimatePresence>
    </div>
  )
}

// --- Slack box: a looping conversation between Alex (Vierra) and a client as a
// meeting gets booked, confirmed, and the details get shared. Each message is
// preceded by a typing bubble from the next speaker, so the thread flows like a
// real chat instead of snapping between states. ---
type ChatWho = "alex" | "lynne"
const chatPeople: Record<ChatWho, { name: string; org: string; img: string; dark: boolean }> = {
  alex: { name: "Alex", org: "Vierra", img: "/assets/Team/Alex.png", dark: true },
  lynne: { name: "Lynne", org: "Qigong Infused Yoga", img: "/assets/Testimonials/TestimonialProfiles/Lynne.jpg", dark: false },
}
type ChatMsg = { who: ChatWho; text: string; time: string }
const chatScript: ChatMsg[] = [
  { who: "alex", text: "Cheers Lynne! Booked you a new discovery call from UMass Amherst!", time: "3:21 PM" },
  { who: "lynne", text: "Thank you so much! That's wonderful", time: "3:21 PM" },
  { who: "lynne", text: "Who's the lead?", time: "3:22 PM" },
  { who: "alex", text: "A large university near your location who wants to have you come in and teach some classes!", time: "3:22 PM" },
  { who: "alex", text: "Notes and call link are in the invite.", time: "3:23 PM" },
  { who: "lynne", text: "Perfect, I'll start preparing", time: "3:23 PM" },
]

function ChatAvatar({ src, name }: { src: string; name: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <Image src={src} alt={name} width={36} height={36} className="h-9 w-9 shrink-0 rounded-xl object-cover" />
}

function ChatBubble({ m }: { m: ChatMsg }) {
  const p = chatPeople[m.who]
  return (
    <div className={p.dark ? "" : "ml-6"}>
      <div className={`flex items-start gap-3 rounded-2xl p-3.5 ${p.dark ? "bg-[#2A2030]" : "bg-[#F4F2F8]"}`}>
        <ChatAvatar src={p.img} name={p.name} />
        <div className="min-w-0">
          <div className={`flex flex-wrap items-center gap-x-2 ${inter.className}`}>
            <span className={`text-sm font-semibold ${p.dark ? "text-white" : "text-[#18042A]"}`}>{p.name}</span>
            <span className={`text-[11px] ${p.dark ? "text-white/40" : "text-[#9A93A8]"}`}>from {p.org}</span>
            <span className={`text-[11px] ${p.dark ? "text-white/40" : "text-[#9A93A8]"}`}>{m.time}</span>
          </div>
          <p className={`mt-0.5 text-sm leading-relaxed ${p.dark ? "text-white/85" : "text-[#5C5470]"} ${inter.className}`}>
            {m.text}
          </p>
        </div>
      </div>
    </div>
  )
}

function TypingBubble({ who }: { who: ChatWho }) {
  const p = chatPeople[who]
  return (
    <div className={p.dark ? "" : "ml-6"}>
      <div className={`inline-flex items-center gap-2.5 rounded-2xl p-3 ${p.dark ? "bg-[#2A2030]" : "bg-[#F4F2F8]"}`}>
        <ChatAvatar src={p.img} name={p.name} />
        <span className="inline-flex items-center gap-1.5">
          {[0, 150, 300].map((d) => (
            <span
              key={d}
              className={`h-1.5 w-1.5 animate-bounce rounded-full ${p.dark ? "bg-white/50" : "bg-[#B9B2C7]"}`}
              style={{ animationDelay: `${d}ms` }}
            />
          ))}
        </span>
      </div>
    </div>
  )
}

function SlackVisual() {
  // Play the full conversation message-by-message (each preceded by a typing
  // bubble), then take a beat, clear the thread, and start a fresh one — so the
  // restart reads as a new conversation rather than an abrupt jump.
  const [count, setCount] = useState(0) // messages revealed in the current cycle
  const [typing, setTyping] = useState(false)
  useEffect(() => {
    let alive = true
    const timers: ReturnType<typeof setTimeout>[] = []
    const wait = (ms: number) =>
      new Promise<void>((res) => {
        timers.push(setTimeout(res, ms))
      })
    const run = async () => {
      while (alive) {
        for (let i = 0; i < chatScript.length; i++) {
          setTyping(true)
          await wait(1000)
          if (!alive) return
          setTyping(false)
          setCount(i + 1)
          await wait(1500)
          if (!alive) return
        }
        // conversation complete — breather, clear, empty pause, then restart
        await wait(1100)
        if (!alive) return
        setCount(0)
        await wait(1100)
        if (!alive) return
      }
    }
    run()
    return () => {
      alive = false
      timers.forEach(clearTimeout)
    }
  }, [])

  const windowSize = 3
  const ids: number[] = []
  for (let k = Math.max(0, count - windowSize); k < count; k++) ids.push(k)
  const nextWho = chatScript[count % chatScript.length].who

  return (
    // Fixed-height window; the message stack is absolutely positioned and
    // bottom-anchored so it can never change the box height or shift the page.
    <div className="relative h-[236px] overflow-hidden">
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3">
        <AnimatePresence initial={false}>
          {ids.map((id) => (
            <motion.div
              key={id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.2 } }}
              transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            >
              <ChatBubble m={chatScript[id % chatScript.length]} />
            </motion.div>
          ))}
          {typing && (
            <motion.div
              key="typing"
              layout
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <TypingBubble who={nextWho} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// --- Gmail box: a compact "new reply" notification cycling through senders. ---
const gmailReplies: { Icon: IconType; color: string; from: string; subject: string }[] = [
  { Icon: SiSpotify, color: "#1DB954", from: "Spotify", subject: "Re: Campaign results" },
  { Icon: SiAirbnb, color: "#FF5A5F", from: "Airbnb", subject: "Re: Following up" },
  { Icon: SiFigma, color: "#F24E1E", from: "Figma", subject: "Re: Quick question" },
  { Icon: SiDropbox, color: "#0061FF", from: "Dropbox", subject: "Re: Next steps" },
]

function GmailVisual() {
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setI((p) => (p + 1) % gmailReplies.length), 1700)
    return () => clearInterval(t)
  }, [])
  const r = gmailReplies[i]
  const ReplyIcon = r.Icon
  return (
    <div className="relative min-h-[60px]">
      <AnimatePresence initial={false}>
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-x-0 top-0 flex items-center gap-3 rounded-2xl border border-[#F0EDF5] bg-white px-3.5 py-3 shadow-[0_10px_28px_-22px_rgba(112,28,192,0.5)]"
        >
          {/* sender's brand logo */}
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F4F2F8]">
            <ReplyIcon className="h-5 w-5" style={{ color: r.color }} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className={`flex items-center gap-2 ${inter.className}`}>
              <span className="truncate text-sm font-semibold text-[#18042A]">{r.from}</span>
              {/* pulsing unread dot */}
              <span className="relative ml-auto flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#EA4335] opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#EA4335]" />
              </span>
            </div>
            <div className={`truncate text-xs text-[#5C5470] ${inter.className}`}>{r.subject}</div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// --- CRM box: orbital grid — tools revolve around a central Vierra "V". ---
const orbitTools: { Icon: IconType; color: string; label: string }[] = [
  { Icon: SiGmail, color: "#EA4335", label: "Gmail" },
  { Icon: FaLinkedin, color: "#0A66C2", label: "LinkedIn" },
  { Icon: SiInstagram, color: "#E4405F", label: "Instagram" },
  { Icon: SiGoogleads, color: "#4285F4", label: "Google Ads" },
  { Icon: SiHubspot, color: "#FF7A59", label: "HubSpot" },
  { Icon: SiSalesforce, color: "#00A1E0", label: "Salesforce" },
]

function OrbitVisual() {
  const R = 38 // node radius as % of the square
  const spin = { duration: 34, repeat: Infinity, ease: "linear" as const }
  const nodes = orbitTools.map((t, i) => {
    const a = (i / orbitTools.length) * Math.PI * 2 - Math.PI / 2
    return { ...t, x: 50 + R * Math.cos(a), y: 50 + R * Math.sin(a) }
  })
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[380px]">
      {/* rotating layer: rings + connector lines + tool nodes */}
      <motion.div className="absolute inset-0" animate={{ rotate: 360 }} transition={spin}>
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
          <circle cx="50" cy="50" r={R} fill="none" stroke="#701CC0" strokeOpacity="0.15" strokeWidth="0.4" />
          <circle cx="50" cy="50" r={R * 0.58} fill="none" stroke="#701CC0" strokeOpacity="0.1" strokeWidth="0.4" />
          {nodes.map((n, i) => (
            <line key={i} x1="50" y1="50" x2={n.x} y2={n.y} stroke="#701CC0" strokeOpacity="0.18" strokeWidth="0.4" />
          ))}
        </svg>
        {nodes.map((n, i) => {
          const NodeIcon = n.Icon
          return (
            <div
              key={i}
              className="absolute"
              style={{ left: `${n.x}%`, top: `${n.y}%`, transform: "translate(-50%, -50%)" }}
            >
              {/* counter-rotate so the icon stays upright as the layer spins */}
              <motion.div
                animate={{ rotate: -360 }}
                transition={spin}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#EFEAF6] bg-white shadow-[0_8px_20px_-12px_rgba(112,28,192,0.55)]"
              >
                <NodeIcon className="h-5 w-5" style={{ color: n.color }} aria-hidden />
              </motion.div>
            </div>
          )
        })}
      </motion.div>
      {/* center Vierra badge (static, on top) — the 2D V mark on a white tile */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white ring-1 ring-[#701CC0]/15 shadow-[0_14px_34px_-10px_rgba(112,28,192,0.55)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <Image src="/assets/vierra-v-2d.png" alt="Vierra" width={210} height={184} className="h-8 w-auto" />
        </div>
      </div>
    </div>
  )
}

export default function Integrations() {
  const [contactOpen, setContactOpen] = useState(false)
  return (
    <section className="w-full bg-[#F3F3F3] px-6 py-24 md:py-32">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
        className="mx-auto grid max-w-7xl items-stretch gap-12 lg:grid-cols-2"
      >
        {/* Left: copy, vertically centered against the meetings feed */}
        <div className="flex flex-col justify-center">
          <motion.span
            variants={fadeUp}
            className={`text-[11px] font-semibold uppercase tracking-[0.35em] text-[#701CC0] ${inter.className}`}
          >
            Integrations
          </motion.span>
          <motion.h2
            variants={fadeUp}
            className={`mt-4 text-4xl md:text-6xl font-bold leading-[1.05] text-[#18042A] ${bricolage.className}`}
          >
            Drop Vierra Right Into Your Stack
          </motion.h2>
          <motion.p
            variants={fadeUp}
            className={`mt-5 max-w-md text-lg text-[#5C5470] ${inter.className}`}
          >
            The engine connects to your inbox, calendar, and CRM, then books
            qualified meetings into your existing workflow.
          </motion.p>
          <motion.div variants={fadeUp} className="mt-8">
            <button
              type="button"
              onClick={() => setContactOpen(true)}
              className={`inline-flex items-center gap-2 rounded-md bg-[#701CC0] px-8 py-4 font-medium text-white shadow-[0_0_26px_0px_rgba(255,255,255,0.65)] transition-transform duration-300 hover:scale-105 ${inter.className}`}
            >
              Let&apos;s Talk <ArrowUpRight className="h-4 w-4 arrow-bob" />
            </button>
          </motion.div>
        </div>

        {/* Right: meetings pop in one-by-one like live notifications */}
        <motion.div
          variants={fadeUp}
          className="relative h-[460px] overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,#000_8%,#000_92%,transparent)] [-webkit-mask-image:linear-gradient(to_bottom,transparent,#000_8%,#000_92%,transparent)]"
        >
          {/* Absolutely positioned so the (clipped) stack never inflates the row. */}
          <div className="absolute inset-x-0 top-0">
            <MeetingFeed />
          </div>
        </motion.div>
      </motion.div>

      {/* Feature bento — Calendar (top-left) + Slack (bottom-left) stacked, and
          the taller CRM orbital box filling the right column. */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.12 } } }}
        className="mx-auto mt-16 grid max-w-7xl gap-5 md:mt-24 lg:grid-cols-2 lg:items-stretch"
      >
        {/* Left column: Calendar + Slack */}
        <motion.div variants={fadeUp} className="flex flex-col gap-5">
          <FeatureBox>
            <BoxHeader Icon={SiGooglecalendar} color="#4285F4" title="Calendar Sync" />
            <p className={`mt-4 text-[15px] leading-relaxed text-[#5C5470] ${inter.className}`}>
              We sync directly with your calendar around your real availability. Just
              create call-blocks and Vierra fills them with qualified meetings.
            </p>
            <div className="mt-6">
              <CalendarVisual />
            </div>
          </FeatureBox>

          <FeatureBox>
            <BoxHeader Icon={SiSlack} color="#4A154B" title="Slack Alerts" />
            <p className={`mt-4 text-[15px] leading-relaxed text-[#5C5470] ${inter.className}`}>
              Your team gets pinged in Slack the moment a meeting is booked or a lead
              replies with pre-call lead insights, so nothing slips.
            </p>
            <div className="mt-6">
              <SlackVisual />
            </div>
          </FeatureBox>
        </motion.div>

        {/* Right column: CRM orbital grid + a smaller Gmail box beneath it */}
        <motion.div variants={fadeUp} className="flex h-full flex-col gap-5">
          <FeatureBox className="flex flex-1 flex-col">
            <BoxHeader Icon={SiNotion} color="#000000" title="6 Platforms, One Manager" />
            <p className={`mt-4 text-[15px] leading-relaxed text-[#5C5470] ${inter.className}`}>
              Every outbound communication, signal, lead, and meeting booked flows
              into your CRM automatically. Vierra sits at the center of your stack
              and keeps all your platforms in sync.
            </p>
            <div className="flex flex-1 items-center justify-center py-4">
              <OrbitVisual />
            </div>
          </FeatureBox>

          <FeatureBox compact>
            <BoxHeader Icon={SiGmail} color="#EA4335" title="Shared Inboxes" />
            <p className={`mt-3 text-sm leading-relaxed text-[#5C5470] ${inter.className}`}>
              Campaigns and replies land in your inbox and Vierra keeps every thread
              moving.
            </p>
            <div className="mt-4">
              <GmailVisual />
            </div>
          </FeatureBox>
        </motion.div>
      </motion.div>

      {contactOpen && <Modal isOpen={contactOpen} onClose={() => setContactOpen(false)} />}
    </section>
  )
}
