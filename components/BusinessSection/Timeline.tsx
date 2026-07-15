"use client"

import { bricolage, figtree } from "@/lib/fonts";
import { useRef, useState } from "react"
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from "framer-motion"
import { OnboardingStepAnim, TamMiningAnim } from "./OnboardingSteps"


// The onboarding journey, start to signed client. Each step's animation lives in
// OnboardingSteps (index-matched); step 3 (TAM) uses the WebGL Brand sphere.
const steps = [
  {
    n: 1,
    title: "Initial Meeting & Evaluation",
    text: "We meet, map your goals, and see if we are compatible to work with each other. We only move forward if we're confident in filling your pipeline.",
  },
  {
    n: 2,
    title: "Onboard Onto Our Platform",
    text: "Go through our onboarding module in under an hour. Connect inboxes, tools, and tell us more about your ICPs.",
  },
  {
    n: 3,
    title: "Full Market & ICP Research",
    text: "We research your entire market and lock in your exact ICP, profiling every account before any outreach.",
  },
  {
    n: 4,
    title: "TAM Sorting & Mining",
    text: "We mine your total addressable market and sort it by ICP fit, surfacing only the accounts worth pursuing.",
  },
  {
    n: 5,
    title: "Campaign Launching",
    text: "Multi-channel campaigns go live across email, LinkedIn, and SMS — coordinated and launched in sync.",
  },
  {
    n: 6,
    title: "Clients Signed Successfully",
    text: "Qualified meetings convert into booked calls and signed clients — then we optimize every week to scale.",
  },
]

// The intro title holds until DOCK_END, then simply crossfades into the steps
// (no upward slide) while the steps play out across the rest of the scroll.
const DOCK_END = 0.18

const Timeline = () => {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const [showIntro, setShowIntro] = useState(true)
  const [dir, setDir] = useState(1) // scroll direction: 1 = forward, -1 = back
  const activeRef = useRef(0)

  // Scroll drives which step is shown; all opacity is state-driven via
  // AnimatePresence so nothing sticks at a partial opacity mid-scroll.
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] })

  useMotionValueEvent(scrollYProgress, "change", (p) => {
    setShowIntro(p < DOCK_END - 0.01)
    const t = (p - DOCK_END) / (1 - DOCK_END)
    const idx = Math.max(0, Math.min(steps.length - 1, Math.floor(t * steps.length)))
    if (idx !== activeRef.current) {
      setDir(idx > activeRef.current ? 1 : -1)
      activeRef.current = idx
      setActive(idx)
    }
  })

  const step = steps[active]

  return (
    <>
      {/* Desktop — scroll-locked stage. An intro header sits centered on screen,
          then docks to the top while its text morphs into the active step; the
          step's animation plays in the band beneath it. */}
      <div id="timeline-section" ref={sectionRef} className="relative hidden h-[560vh] lg:block">
        <div className="sticky top-0 h-screen w-full overflow-hidden bg-[#0A0414] text-white">
          {/* Soft purple glow behind the stage — one clean highlight, not a busy gradient. */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 h-[70vmax] w-[70vmax] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70 blur-[130px]"
            style={{ background: "radial-gradient(circle, rgba(122,19,208,0.28), rgba(122,19,208,0) 70%)" }}
          />
          {/* Fade top + bottom edges so the section blends into its neighbors. */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-0 h-32 bg-gradient-to-b from-[#010205] to-transparent" />
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-32 bg-gradient-to-t from-[#010205] to-transparent" />

          {/* Animation stage — the active step's animation, centered in the band
              below the docked title. TAM uses the WebGL sphere; it only mounts
              when active so its canvas isn't rendered behind the other steps. */}
          <div className="absolute inset-x-0 top-[27%] bottom-[14%] z-10 flex items-center justify-center">
            <AnimatePresence mode="wait">
              {!showIntro && (
                <motion.div
                  key={active === 3 ? "tam" : `anim-${active}`}
                  className="absolute inset-0"
                  initial={{ opacity: 0, scale: 0.97, y: dir > 0 ? 40 : -40 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: dir > 0 ? -40 : 40 }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                >
                  {active === 3 ? <TamMiningAnim /> : <OnboardingStepAnim step={active} />}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Intro — centered hero; simply fades out into the steps (no slide). */}
          <AnimatePresence>
            {showIntro && (
              <motion.div
                key="intro"
                className="absolute inset-x-0 top-1/2 z-20 -translate-y-1/2 px-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="mx-auto max-w-4xl text-center">
                  <span className={`${figtree.className} text-[11px] font-semibold uppercase tracking-[0.35em] text-[#C99DFF]`}>
                    Getting Started
                  </span>
                  <h2
                    style={{ fontSize: "clamp(1.75rem, 6vw, 3.75rem)" }}
                    className={`${bricolage.className} mt-4 whitespace-nowrap font-bold leading-[1.05] text-[#EFF3FF]`}
                  >
                    Triple Your MRR In Under 6 Steps
                  </h2>
                  <p className={`${figtree.className} mx-auto mt-5 max-w-xl text-lg text-[#B9A9D6]`}>
                    From the first call to a calendar exploding with qualified leads. Here&apos;s exactly what you need to do.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Step header — docked near the top; crossfades between steps. */}
          <div className="absolute inset-x-0 top-[10%] z-20 px-8">
            <AnimatePresence mode="wait">
              {!showIntro && (
                <motion.div
                  key={`step-${active}`}
                  className="mx-auto max-w-3xl text-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                >
                  <span className={`${figtree.className} text-[11px] font-semibold uppercase tracking-[0.35em] text-[#C99DFF]`}>
                    Step {step.n} of {steps.length}
                  </span>
                  <h2
                    style={{ fontSize: "clamp(1.5rem, 5vw, 3rem)" }}
                    className={`${bricolage.className} mt-4 whitespace-nowrap font-bold leading-[1.05] text-[#EFF3FF]`}
                  >
                    {step.title}
                  </h2>
                  <p className={`${figtree.className} mx-auto mt-4 max-w-xl text-base text-[#B9A9D6]`}>{step.text}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Progress rail — appears once the steps begin. */}
          <AnimatePresence>
            {!showIntro && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="absolute inset-x-0 bottom-16 z-20 flex justify-center gap-2"
              >
                {steps.map((s, i) => (
                  <span
                    key={s.n}
                    className={`h-1.5 rounded-full transition-all duration-300 ${active === i ? "w-10 bg-[#C99DFF]" : "w-5 bg-white/15"}`}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Mobile — stacked cards, each with its own step animation. */}
      <MobileTimeline />
    </>
  )
}

function MobileTimeline() {
  return (
    <div className="relative -mx-[1.5rem] w-screen overflow-hidden bg-gradient-to-b from-[#010205] via-[#0c0415] to-[#19082d] py-16 text-white lg:hidden">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-32 bg-gradient-to-b from-transparent to-[#010205]" />
      <div className="relative z-10 px-6">
        <div className="mb-8 text-center">
          <span className={`${figtree.className} text-[11px] font-semibold uppercase tracking-[0.35em] text-[#C99DFF]`}>Getting Started</span>
          <h2
            style={{ fontSize: "clamp(1.9rem, 9vw, 3rem)" }}
            className={`${bricolage.className} mt-3 font-bold leading-[1.05] text-[#EFF3FF]`}
          >
            Triple Your MRR In Under 6 Steps
          </h2>
        </div>

        <div className="flex flex-col gap-6">
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true, amount: 0.4 }}
            >
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#7A13D0] text-sm font-bold text-white">{s.n}</span>
                <h3 className={`${bricolage.className} text-xl font-semibold`}>{s.title}</h3>
              </div>
              <div className="relative mb-3 h-60 overflow-hidden rounded-xl border border-white/5 bg-[#0c0415]">
                {i === 3 ? <TamMiningAnim /> : <OnboardingStepAnim step={i} />}
              </div>
              <p className={`text-[15px] leading-relaxed text-[#B9A9D6] ${figtree.className}`}>{s.text}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Timeline
