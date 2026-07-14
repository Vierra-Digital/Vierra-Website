"use client"

import { useRef, useState, useEffect } from "react"
import { motion, useScroll, useTransform, useMotionValueEvent } from "framer-motion"
import { Search, Check } from "lucide-react"
import { bricolage, inter } from "@/lib/fonts";


/* ----------------------------- Card animations ----------------------------- */

// 1. Deep Research — scans the research fields we dig into, checking each off.
function ResearchAnim() {
  const facets = ["Market & TAM", "Competitors", "Buyers & ICPs", "Pain Points", "Your Edge"]
  return (
    <div className="w-[270px] rounded-2xl border border-[#ECE8F2] bg-white p-5 shadow-[0_20px_50px_-30px_rgba(112,28,192,0.5)]">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#701CC0]/12">
          <Search className="h-3.5 w-3.5 text-[#701CC0]" />
        </span>
        <span className={`flex items-center text-[11px] font-semibold uppercase tracking-[0.18em] text-[#701CC0] ${inter.className}`}>
          Researching
          <span className="ml-0.5 inline-flex">
            {[0, 1, 2].map((d) => (
              <motion.span
                key={d}
                animate={{ opacity: [0.2, 1, 0.2] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: d * 0.2 }}
              >
                .
              </motion.span>
            ))}
          </span>
        </span>
      </div>
      <div className="space-y-2.5">
        {facets.map((f, i) => (
          <div key={f} className="flex items-center gap-2.5">
            <motion.span
              className="flex h-5 w-5 items-center justify-center rounded-full"
              animate={{ backgroundColor: ["rgba(112,28,192,0.12)", "#701CC0", "#701CC0", "rgba(112,28,192,0.12)"] }}
              transition={{ duration: 4.5, times: [0, 0.25, 0.82, 1], repeat: Infinity, ease: "easeInOut", delay: i * 0.5 }}
            >
              <motion.span
                animate={{ opacity: [0, 1, 1, 0], scale: [0.4, 1, 1, 0.4] }}
                transition={{ duration: 4.5, times: [0, 0.25, 0.82, 1], repeat: Infinity, ease: "easeInOut", delay: i * 0.5 }}
              >
                <Check className="h-3 w-3 text-white" strokeWidth={3} />
              </motion.span>
            </motion.span>
            <span className={`text-sm text-[#3A3346] ${inter.className}`}>{f}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// 2. Value Ladder — ascending labeled stages that light up in sequence as a
// marker climbs, then resets. State-driven so the motion stays clean (no jank).
const ladderTiers = ["Discovery", "Outreach", "Signals", "Meeting Booked"]
function StaircaseAnim() {
  const pw = 122
  const ph = 32
  const dx = 34
  const dy = 42
  const [active, setActive] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setActive((a) => (a + 1) % ladderTiers.length), 1100)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="relative h-[210px] w-[230px]">
      {ladderTiers.map((label, i) => {
        const lit = i <= active
        return (
          <motion.div
            key={label}
            className={`absolute flex items-center justify-center rounded-lg text-[11px] font-semibold shadow-[0_10px_24px_-16px_rgba(112,28,192,0.8)] ${inter.className}`}
            style={{ left: i * dx, bottom: i * dy, width: pw, height: ph }}
            animate={{
              backgroundColor: lit ? "#7A2FD0" : "rgba(112,28,192,0.10)",
              color: lit ? "#FFFFFF" : "#9C8FBC",
            }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            {label}
          </motion.div>
        )
      })}
      {/* glowing marker that springs to the top edge of the active stage */}
      <motion.div
        className="absolute h-3.5 w-3.5 rounded-full bg-white shadow-[0_0_14px_4px_rgba(143,66,255,0.85)]"
        animate={{ left: active * dx + pw - 16, bottom: active * dy + ph - 7 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
      />
    </div>
  )
}

// 3. Personalized Feedback — lead signals orbit the Vierra mark and pulse inward
// (we read every outbound signal), while the engine tweaks and sends back out.
const fbSignals = ["Replies", "Opens", "Clicks", "Booked", "Visits"]
function FeedbackAnim() {
  const C = 115
  const R = 92
  const nodes = fbSignals.map((label, i) => {
    const a = ((i * 360) / fbSignals.length - 90) * (Math.PI / 180)
    return { label, x: C + R * Math.cos(a), y: C + R * Math.sin(a) }
  })
  return (
    <div className="relative h-[230px] w-[230px]">
      {/* slow rotating dashed ring */}
      <motion.svg
        viewBox="0 0 230 230"
        className="absolute inset-0 h-full w-full"
        animate={{ rotate: 360 }}
        transition={{ duration: 26, repeat: Infinity, ease: "linear" }}
      >
        <circle cx="115" cy="115" r="92" fill="none" stroke="#701CC0" strokeOpacity="0.18" strokeWidth="1.5" strokeDasharray="2 7" />
      </motion.svg>

      {/* inbound signal pulses (signal -> Vierra) */}
      {nodes.map((nd, i) => (
        <motion.div
          key={`p-${i}`}
          className="absolute h-2 w-2 rounded-full bg-[#8F42FF] shadow-[0_0_8px_2px_rgba(143,66,255,0.7)]"
          style={{ marginLeft: -4, marginTop: -4 }}
          animate={{ left: [nd.x, C], top: [nd.y, C], opacity: [0, 1, 0], scale: [0.5, 1, 0.4] }}
          transition={{ duration: 1.9, repeat: Infinity, ease: "easeIn", delay: i * 0.42, times: [0, 0.75, 1] }}
        />
      ))}

      {/* signal chips around the circle */}
      {nodes.map((nd, i) => (
        <div
          key={`c-${i}`}
          className={`absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-[#701CC0]/15 bg-white px-2.5 py-1 text-[10px] font-semibold text-[#46256E] shadow-[0_8px_20px_-12px_rgba(112,28,192,0.6)] ${inter.className}`}
          style={{ left: nd.x, top: nd.y }}
        >
          {nd.label}
        </div>
      ))}

      {/* center Vierra mark */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <motion.div
          className="flex h-16 w-16 items-center justify-center rounded-full bg-white ring-1 ring-[#701CC0]/15 shadow-[0_0_26px_rgba(112,28,192,0.4)]"
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/vierra-v-2d.png" alt="Vierra" className="h-7 w-auto" />
        </motion.div>
      </div>
    </div>
  )
}

// 4. You Get Paid First — a clean floating coin with a shine sweep and rising +$.
function MoneyAnim() {
  return (
    <div className="relative flex h-[210px] w-[210px] items-center justify-center">
      <motion.div
        className="absolute h-[150px] w-[150px] rounded-full bg-[#701CC0] blur-[45px]"
        animate={{ opacity: [0.15, 0.32, 0.15], scale: [1, 1.1, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="relative flex h-[120px] w-[120px] items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#8F42FF] to-[#701CC0] shadow-[0_18px_44px_-12px_rgba(112,28,192,0.8)]"
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <span className={`text-5xl font-extrabold text-white ${bricolage.className}`}>$</span>
        {/* shine sweep */}
        <motion.div
          className="absolute -inset-y-3 w-8 -skew-x-12 bg-white/25 blur-md"
          animate={{ x: [-60, 160] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.8 }}
        />
      </motion.div>
      {/* rising +$ */}
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className={`absolute text-sm font-bold text-[#8F42FF] ${bricolage.className}`}
          style={{ left: 48 + i * 52 }}
          animate={{ y: [30, -64], opacity: [0, 1, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.7, ease: "easeOut" }}
        >
          +$
        </motion.span>
      ))}
    </div>
  )
}

type Step = { n: string; title: string; copy: string; anim: React.ReactNode }
const steps: Step[] = [
  {
    n: "01",
    title: "Deep Research",
    copy:
      "We dig into your market, competitors, buyers, ICPs, struggles, and your edge. We don't move forward until we master your industry.",
    anim: <ResearchAnim />,
  },
  {
    n: "02",
    title: "Value Ladder",
    copy:
      "We map your sales and marketing offers into a clear value ladder, turning first-touch leads into repeat, higher-value clients over time.",
    anim: <StaircaseAnim />,
  },
  {
    n: "03",
    title: "Personalized Feedback",
    copy:
      "Every result feeds back into the CRM. We continuously test, learn, and refine so your funnel compounds month over month.",
    anim: <FeedbackAnim />,
  },
  {
    n: "04",
    title: "You Get Paid First",
    copy:
      "We bet on your success. If you don't close deals, we don't earn. No risky investments or over-spending on dead marketing campaigns.",
    anim: <MoneyAnim />,
  },
]

export default function Tailored() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] })
  const [active, setActive] = useState(0)
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setActive(Math.min(steps.length - 1, Math.max(0, Math.floor(v * steps.length))))
  })

  // Slide the track with scroll, dwelling on EACH card (you linger, then it
  // slides to the next). No spring, so fast scrolling tracks exactly.
  const x = useTransform(
    scrollYProgress,
    [0, 0.18, 0.27, 0.45, 0.54, 0.72, 0.81, 1],
    ["0%", "0%", "-25%", "-25%", "-50%", "-50%", "-75%", "-75%"]
  )

  return (
    <section
      ref={ref}
      id="services"
      className="relative bg-[#F3F3F3] text-[#18042A]"
      style={{ height: `${steps.length * 85}vh` }}
    >
      <div className="sticky top-0 flex h-screen flex-col overflow-hidden">
        {/* Pinned header + subtext */}
        <div className="shrink-0 px-6 pt-20 text-center md:pt-24">
          <span className={`text-[11px] font-semibold uppercase tracking-[0.35em] text-[#701CC0] ${inter.className}`}>
            What you get
          </span>
          <h2 className={`mt-4 text-4xl font-bold leading-[1.05] text-[#18042A] md:text-6xl ${bricolage.className}`}>
            Tailored To You
          </h2>
          <p className={`mx-auto mt-5 max-w-2xl text-lg text-[#5C5470] ${inter.className}`}>
            We&apos;re obsessed with making our founders win. Our success is built
            around getting your products and services in the hands of the perfect
            customer base.
          </p>
          {/* step indicators */}
          <div className="mt-8 flex justify-center gap-2">
            {steps.map((s, i) => (
              <div
                key={s.n}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === active ? "w-9 bg-[#701CC0]" : "w-1.5 bg-[#18042A]/15"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Horizontal card track, driven by scroll */}
        <div className="relative flex-1 overflow-hidden">
          <motion.div style={{ x }} className="flex h-full w-[400vw]">
            {steps.map((s) => (
              <div key={s.n} className="flex h-full w-screen shrink-0 items-center justify-center px-6 md:px-16">
                <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-8 rounded-[40px] border border-[#701CC0]/10 bg-white p-8 shadow-[0_30px_80px_-40px_rgba(112,28,192,0.45)] md:flex-row md:gap-12 md:p-14">
                  <div className="flex-1">
                    <span className={`text-sm font-semibold tracking-[0.3em] text-[#701CC0] ${inter.className}`}>
                      STEP {s.n}
                    </span>
                    <h3 className={`mt-3 text-3xl font-bold leading-tight text-[#18042A] md:text-5xl ${bricolage.className}`}>
                      {s.title}
                    </h3>
                    <p className={`mt-4 max-w-md text-base leading-relaxed text-[#5C5470] md:text-lg ${inter.className}`}>
                      {s.copy}
                    </p>
                  </div>
                  <div className="flex h-[240px] w-full max-w-[300px] shrink-0 items-center justify-center">
                    {s.anim}
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  )
}
