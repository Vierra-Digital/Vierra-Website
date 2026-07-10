"use client"

import { Bricolage_Grotesque, Figtree } from "next/font/google"
import { useEffect, useRef, useState } from "react"
import { motion, useScroll, useTransform, useMotionValueEvent } from "framer-motion"
import dynamic from "next/dynamic"

const bricolage = Bricolage_Grotesque({ subsets: ["latin"] })
const figtree = Figtree({ subsets: ["latin"] })

// WebGL models — client-only so three.js stays out of the SSR path.
const OnboardingModels3D = dynamic(() => import("./OnboardingModels3D"), {
  ssr: false,
  loading: () => <div aria-hidden className="absolute inset-0" />,
})

// Step-by-step of how onboarding a new client works. Each step's 3D model lives
// in OnboardingModels3D, indexed to match this order.
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

// Intro title stays centered & locked until HOLD_END, then docks to the top by
// DOCK_END; the onboarding steps play out across the rest of the scroll.
const HOLD_END = 0.2
const DOCK_END = 0.3

const Timeline = () => {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const [showIntro, setShowIntro] = useState(true)
  const [inView, setInView] = useState(false)
  const [reduced, setReduced] = useState(false)

  // Continuous scroll progress across the locked section (0 at the top, 1 at
  // the bottom) — drives the header dock + the crossfading step content/model.
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] })
  const headerTop = useTransform(scrollYProgress, [HOLD_END, DOCK_END], ["50%", "15%"])
  const headerScale = useTransform(scrollYProgress, [HOLD_END, DOCK_END], [1, 0.82])
  // Intro fades out fully before the step copy fades in (no overlapping text).
  const introOpacity = useTransform(scrollYProgress, [0, HOLD_END, DOCK_END - 0.04], [1, 1, 0])
  const stepOpacity = useTransform(scrollYProgress, [DOCK_END - 0.03, DOCK_END + 0.04], [0, 1])
  const modelOpacity = useTransform(scrollYProgress, [DOCK_END, DOCK_END + 0.1], [0, 1])

  // Discrete step index for the model + step copy (steps live after the intro).
  // `showIntro` hard-swaps the two header layers (not just opacity) so the intro
  // title can never ghost behind the step titles once it has docked.
  useMotionValueEvent(scrollYProgress, "change", (p) => {
    setShowIntro(p < DOCK_END - 0.02)
    const t = (p - DOCK_END) / (1 - DOCK_END)
    setActive(Math.max(0, Math.min(steps.length - 1, Math.floor(t * steps.length))))
  })

  // Only spin the WebGL loop while the section is on screen; honor reduced motion.
  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.02 })
    io.observe(el)
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReduced(mq.matches)
    const onMq = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener("change", onMq)
    return () => {
      io.disconnect()
      mq.removeEventListener("change", onMq)
    }
  }, [])

  const step = steps[active]

  return (
    <>
      {/* Desktop — scroll-locked stage. An intro header sits centered on screen,
          then docks to the top as one continuous move while its text morphs into
          the active onboarding step; the 3D model spins continuously in the
          middle and crossfades per step as you scroll. */}
      <div id="timeline-section" ref={sectionRef} className="relative mx-[-1.5rem] hidden h-[360vh] lg:block">
        <div className="sticky top-0 h-screen w-full overflow-hidden bg-gradient-to-b from-[#010205] via-[#0c0415] to-[#19082d] text-white">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-40 bg-gradient-to-b from-transparent to-[#010205]" />

          {/* 3D model — continuous, centered, crossfades to the active step. */}
          <motion.div style={{ opacity: modelOpacity }} className="absolute inset-0 z-10 flex items-center justify-center">
            <div className="h-[46vh] w-full max-w-3xl">
              <OnboardingModels3D step={active} paused={reduced} active={inView} />
            </div>
          </motion.div>

          {/* Header — moves center → top; content crossfades intro → step. Title
              scale matches the site's section headings (see FeaturesV2). */}
          <motion.div
            style={{ top: headerTop, y: "-50%", scale: headerScale }}
            className="absolute inset-x-0 z-20 flex h-52 items-center justify-center px-8"
          >
            <div className="relative w-full max-w-3xl text-center">
              {showIntro ? (
                <motion.div style={{ opacity: introOpacity }} className="absolute inset-x-0 top-0">
                  <span className={`${figtree.className} text-[11px] font-semibold uppercase tracking-[0.35em] text-[#C99DFF]`}>
                    Getting Started
                  </span>
                  <h2
                    style={{ fontSize: "clamp(1.5rem, 6.2vw, 3.75rem)" }}
                    className={`${bricolage.className} mt-4 font-bold leading-[1.05] text-[#EFF3FF]`}
                  >
                    How Onboarding Works
                  </h2>
                  <p className={`${figtree.className} mx-auto mt-5 max-w-xl text-lg text-[#B9A9D6]`}>
                    From the first call to a calendar full of qualified meetings — here&apos;s exactly how we get you live.
                  </p>
                </motion.div>
              ) : (
                <motion.div style={{ opacity: stepOpacity }} className="absolute inset-x-0 top-0">
                  <span className={`${figtree.className} text-[11px] font-semibold uppercase tracking-[0.35em] text-[#C99DFF]`}>
                    Step {step.n} of {steps.length}
                  </span>
                  <h2
                    style={{ fontSize: "clamp(1.5rem, 6.2vw, 3.75rem)" }}
                    className={`${bricolage.className} mt-4 font-bold leading-[1.05] text-[#EFF3FF]`}
                  >
                    {step.title}
                  </h2>
                  <p className={`${figtree.className} mx-auto mt-5 max-w-xl text-lg text-[#B9A9D6]`}>{step.text}</p>
                </motion.div>
              )}
            </div>
          </motion.div>

          {/* Progress rail — appears once the steps begin. */}
          <motion.div style={{ opacity: stepOpacity }} className="absolute inset-x-0 bottom-16 z-20 flex justify-center gap-2">
            {steps.map((s, i) => (
              <span
                key={s.n}
                className={`h-1.5 rounded-full transition-all duration-300 ${active === i ? "w-10 bg-[#C99DFF]" : "w-5 bg-white/15"}`}
              />
            ))}
          </motion.div>
        </div>
      </div>

      {/* Mobile — one sticky model that follows whichever step scrolls into view,
          with the step copy stacked below. */}
      <MobileTimeline reduced={reduced} />
    </>
  )
}

function MobileTimeline({ reduced }: { reduced: boolean }) {
  const [active, setActive] = useState(0)
  const [inView, setInView] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.02 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className="relative -mx-[1.5rem] w-screen overflow-hidden bg-gradient-to-b from-[#010205] via-[#0c0415] to-[#19082d] py-16 text-white lg:hidden"
    >
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-32 bg-gradient-to-b from-transparent to-[#010205]" />
      <div className="relative z-10 px-6">
        <div className="mb-6 text-center">
          <span className={`${figtree.className} text-[11px] font-semibold uppercase tracking-[0.35em] text-[#C99DFF]`}>Getting Started</span>
          <h2
            style={{ fontSize: "clamp(1.75rem, 9vw, 3rem)" }}
            className={`${bricolage.className} mt-3 font-bold leading-[1.05] text-[#EFF3FF]`}
          >
            How Onboarding Works
          </h2>
        </div>

        <div className="sticky top-16 z-10 mx-auto h-60 w-full max-w-sm">
          <OnboardingModels3D step={active} paused={reduced} active={inView} />
        </div>

        <div className="mt-4 flex flex-col gap-6">
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: false, amount: 0.6 }}
              onViewportEnter={() => setActive(i)}
            >
              <div className="mb-2 flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#7A13D0] text-sm font-bold text-white">{s.n}</span>
                <h3 className={`${bricolage.className} text-xl font-semibold`}>{s.title}</h3>
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
