import React, { useState, useEffect, useRef } from "react"
import Image from "next/image"
import { motion } from "framer-motion"

// 6x6 grid; `true` marks a visible (filled) cell.
const gridLayout = [
  [false, false, true, false, false, false],
  [true, false, false, true, true, false],
  [false, true, true, true, false, true],
  [true, false, false, true, false, false],
  [false, false, true, true, true, false],
  [false, true, false, false, false, false],
]

// Stripe-style traveling lines. Each set fires from one source cell to one or
// two target cells. Path coordinates are tuned to the 600x600 viewBox; the line
// colors are derived from the connected icons (source -> target gradient) rather
// than hard-coded.
const animationSets: { source: string; targets: string[]; paths: string[] }[] = [
  { source: "2-2", targets: ["0-2", "3-3"], paths: ["M250,200 L250,60", "M250,290 L250,335 C250,343 258,350 266,350 L310,350"] },
  { source: "2-2", targets: ["3-0", "4-2"], paths: ["M240,290 L240,340 C240,348 232,355 224,355 L93,355", "M255,290 L255,425"] },
  { source: "1-0", targets: ["2-1", "1-3"], paths: ["M93,150 L138,150 C144,150 150,156 150,165 L150,210", "M93,135 L310,135"] },
  { source: "4-4", targets: ["2-5", "1-4"], paths: ["M460,426 L460,270 C460,262 468,255 476,255 L512,255", "M445,426 L445,175"] },
  { source: "4-4", targets: ["2-3", "5-1"], paths: ["M455,426 L455,275 C455,255 450,250 440,250 L395,250", "M455,500 L455,555 C455,560 450,565 440,565 L190,565"] },
]

// Every social icon plus a representative brand color used for the connecting-line
// gradients. All logos are cycled through the grid over time (round-robin).
type Social = { src: string; alt: string; color: string }
const SOCIAL: Social[] = [
  { src: "/assets/Socials/Discord.png", alt: "Discord", color: "#5865F2" },
  { src: "/assets/Socials/Email.png", alt: "Email", color: "#EA4335" },
  { src: "/assets/Socials/Facebook.png", alt: "Facebook", color: "#1877F2" },
  { src: "/assets/Socials/GoHighLevel.png", alt: "GoHighLevel", color: "#2DD4BF" },
  { src: "/assets/Socials/GoogleAnalytics.png", alt: "Google Analytics", color: "#E37400" },
  { src: "/assets/Socials/GoogleBusiness.png", alt: "Google Business", color: "#4285F4" },
  { src: "/assets/Socials/Instagram.png", alt: "Instagram", color: "#E4405F" },
  { src: "/assets/Socials/LinkedIn.png", alt: "LinkedIn", color: "#0A66C2" },
  { src: "/assets/Socials/SEO.png", alt: "SEO", color: "#16A34A" },
  { src: "/assets/Socials/SnapChat.png", alt: "Snapchat", color: "#FACC15" },
  { src: "/assets/Socials/TikTok.png", alt: "TikTok", color: "#EE1D52" },
  { src: "/assets/Socials/Twitter.png", alt: "Twitter", color: "#1DA1F2" },
  { src: "/assets/Socials/YouTube.png", alt: "YouTube", color: "#FF0000" },
]

const WIDTH = 600
const HEIGHT = 600

// First and last coordinate of a path — used to orient the source->target gradient.
function pathEndpoints(d: string) {
  const nums = (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number)
  return {
    x1: nums[0] ?? 0,
    y1: nums[1] ?? 0,
    x2: nums[nums.length - 2] ?? 0,
    y2: nums[nums.length - 1] ?? 0,
  }
}

const pathVariants = {
  initial: { opacity: 0, pathLength: 0, pathOffset: 0 },
  drawing: {
    opacity: 1,
    pathLength: 1,
    transition: { pathLength: { duration: 0.6, ease: "easeInOut" as const }, opacity: { duration: 0.15 } },
  },
  showing: { opacity: 1, pathLength: 1, pathOffset: 0 },
  erasing: {
    opacity: 1,
    pathLength: 1,
    pathOffset: 1,
    transition: { pathOffset: { duration: 0.6, ease: "easeInOut" as const }, opacity: { duration: 0.5 } },
  },
  idle: { opacity: 0 },
}

function GridComponent() {
  const [activeSet, setActiveSet] = useState(0)
  const [phase, setPhase] = useState<"drawing" | "showing" | "erasing" | "idle">("idle")
  const [isAnimating, setIsAnimating] = useState(false)
  const [activeNodes, setActiveNodes] = useState<string[]>([])
  const [cellIcon, setCellIcon] = useState<Record<string, number>>({})
  const iconCursor = useRef(0)
  const lastSetRef = useRef(-1)

  useEffect(() => {
    let timers: ReturnType<typeof setTimeout>[] = []
    let cancelled = false
    const after = (ms: number, fn: () => void) => { timers.push(setTimeout(() => !cancelled && fn(), ms)) }
    const clearTimers = () => { timers.forEach(clearTimeout); timers = [] }

    // Give each connected cell the next icon in the round-robin, so every logo
    // continuously cycles through the grid over time.
    const assignIcons = (keys: string[]) =>
      setCellIcon((prev) => {
        const next = { ...prev }
        keys.forEach((k) => {
          next[k] = iconCursor.current % SOCIAL.length
          iconCursor.current += 1
        })
        return next
      })

    const runCycle = () => {
      if (cancelled) return
      // Random set each cycle (never the same one twice in a row).
      let idx = Math.floor(Math.random() * animationSets.length)
      if (animationSets.length > 1 && idx === lastSetRef.current) idx = (idx + 1) % animationSets.length
      lastSetRef.current = idx
      const set = animationSets[idx]

      setActiveSet(idx)
      setIsAnimating(true)
      setPhase("drawing")
      // Assign icons to source AND targets up front so line gradients know both
      // colors, but only reveal the source logo until the line arrives.
      assignIcons([set.source, ...set.targets])
      setActiveNodes([set.source])

      after(600, () => { setActiveNodes([set.source, ...set.targets]); setPhase("showing") })
      after(3400, () => setPhase("erasing"))
      after(4100, () => { setIsAnimating(false); setPhase("idle"); setActiveNodes([]); after(500, runCycle) })
    }

    runCycle()
    return () => { cancelled = true; clearTimers() }
  }, [])

  const isNodeActive = (key: string) => activeNodes.includes(key)
  const colorOf = (key: string) => {
    const i = cellIcon[key]
    return i != null ? SOCIAL[i].color : "#701CC0"
  }

  const set = animationSets[activeSet]

  return (
    <div className="relative" style={{ width: "fit-content" }}>
      {/* Traveling source -> target lines, each colored with a gradient from the
          source icon's color to the target icon's color. */}
      <svg
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
        style={{ minWidth: "100%", minHeight: "100%" }}
        preserveAspectRatio="xMidYMid meet"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      >
        {isAnimating && (
          <>
            <defs>
              {set.paths.map((d, i) => {
                const e = pathEndpoints(d)
                return (
                  <linearGradient
                    key={`g-${activeSet}-${i}`}
                    id={`ln-${activeSet}-${i}`}
                    gradientUnits="userSpaceOnUse"
                    x1={e.x1}
                    y1={e.y1}
                    x2={e.x2}
                    y2={e.y2}
                  >
                    <stop offset="0%" stopColor={colorOf(set.source)} />
                    <stop offset="100%" stopColor={colorOf(set.targets[i])} />
                  </linearGradient>
                )
              })}
            </defs>
            {set.paths.map((d, i) => (
              <motion.path
                key={`${activeSet}-${i}`}
                d={d}
                stroke={`url(#ln-${activeSet}-${i})`}
                strokeWidth={3}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                variants={pathVariants}
                initial="initial"
                animate={phase}
              />
            ))}
          </>
        )}
      </svg>

      {/* 6x6 grid. Filled cells always render a box (faint when empty); logos fade
          in when a line connects. Hover enlarges the whole box (no rotation). */}
      <div role="grid" className="grid grid-cols-6 gap-x-2 gap-y-3 mx-auto" style={{ width: "fit-content" }}>
        {gridLayout.map((row, r) =>
          row.map((filled, c) => {
            const key = `${r}-${c}`
            if (!filled) {
              return <div key={key} className="w-[45px] h-[45px] sm:w-[55px] sm:h-[55px] md:w-[80px] md:h-[80px]" aria-hidden />
            }
            const iconIndex = cellIcon[key]
            const showIcon = isNodeActive(key) && iconIndex != null
            const icon = iconIndex != null ? SOCIAL[iconIndex] : null
            return (
              <div key={key} className="w-[45px] h-[45px] sm:w-[55px] sm:h-[55px] md:w-[80px] md:h-[80px] z-10">
                <div className="group relative flex h-full w-full items-center justify-center">
                  {/* The box frame — this is what enlarges on hover (the icon stays put). */}
                  <div
                    className={`absolute inset-0 rounded-xl border transition-all duration-300 ease-out group-hover:scale-[1.12] group-hover:border-[#701CC0]/40 group-hover:shadow-[0_6px_18px_-8px_rgba(112,28,192,0.35)] ${
                      showIcon
                        ? "border-transparent bg-white shadow-[0_8px_22px_-10px_rgba(17,24,39,0.35)]"
                        : "border-[#C4C2D6] bg-transparent"
                    }`}
                  >
                    {/* Empty-state marker — inner circle, fades out when a logo shows. */}
                    <span
                      className={`absolute left-1/2 top-1/2 h-1/3 w-1/3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#AEACC4] transition-opacity duration-300 ${
                        showIcon ? "opacity-0" : "opacity-100"
                      }`}
                    />
                  </div>
                  {/* Icon sits above the frame and does NOT scale on hover. */}
                  {icon && (
                    <Image
                      src={icon.src}
                      alt={icon.alt}
                      width={48}
                      height={48}
                      draggable={false}
                      onDragStart={(e) => e.preventDefault()}
                      className={`grid-social-icon relative z-10 w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 object-contain transition-opacity duration-300 ease-out ${
                        showIcon ? "opacity-100" : "opacity-0"
                      }`}
                    />
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default GridComponent
