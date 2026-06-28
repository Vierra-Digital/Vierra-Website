"use client"

import { useRef } from "react"
import { motion } from "framer-motion"
import type { IconType } from "react-icons"
import { FaLinkedin } from "react-icons/fa6"
import {
  SiGmail,
  SiMeta,
  SiGoogle,
  SiGoogleads,
  SiInstagram,
  SiSpotify,
  SiAirbnb,
  SiFigma,
  SiDropbox,
  SiNotion,
  SiSalesforce,
  SiHubspot,
  SiSlack,
} from "react-icons/si"

// A scattered cloud of "companies in the database." Icon bubbles are real brand
// marks; the rest are tinted spheres so the cloud reads full without inventing
// logos. Swap in real client logos here later.
type Bubble = { Icon?: IconType; color: string }
const BUBBLES: Bubble[] = [
  { Icon: SiGmail, color: "#EA4335" },
  { Icon: FaLinkedin, color: "#0A66C2" },
  { Icon: SiMeta, color: "#0467DF" },
  { Icon: SiInstagram, color: "#E4405F" },
  { Icon: SiGoogle, color: "#4285F4" },
  { Icon: SiGoogleads, color: "#FBBC04" },
  { Icon: SiSpotify, color: "#1DB954" },
  { Icon: SiAirbnb, color: "#FF5A5F" },
  { Icon: SiFigma, color: "#F24E1E" },
  { Icon: SiDropbox, color: "#0061FF" },
  { Icon: SiNotion, color: "#101010" },
  { Icon: SiSalesforce, color: "#00A1E0" },
  { Icon: SiHubspot, color: "#FF7A59" },
  { Icon: SiSlack, color: "#4A154B" },
  { color: "#C99DFF" },
  { color: "#8F42FF" },
  { color: "#B06BFF" },
  { color: "#9b6dff" },
  { color: "#7A13D0" },
  { color: "#D4A5FF" },
  { color: "#a78bce" },
  { color: "#701CC0" },
]

const GOLDEN = Math.PI * (3 - Math.sqrt(5))

export default function LogoCloud() {
  const ref = useRef<HTMLDivElement>(null)
  const n = BUBBLES.length
  return (
    <div ref={ref} className="relative mx-auto aspect-square w-full max-w-[460px]">
      {BUBBLES.map((b, i) => {
        // deterministic phyllotaxis scatter (SSR-safe — no random)
        const r = 42 * Math.sqrt((i + 0.5) / n)
        const a = i * GOLDEN
        const x = 50 + r * Math.cos(a)
        const y = 50 + r * Math.sin(a)
        const size = 38 + (i % 3) * 12
        const floatY = 6 + (i % 4) * 3
        const dur = 4 + (i % 5)
        const Icon = b.Icon
        return (
          <motion.div
            key={i}
            className="absolute"
            style={{ left: `${x}%`, top: `${y}%` }}
            animate={{ y: [0, -floatY, 0] }}
            transition={{ duration: dur, repeat: Infinity, ease: "easeInOut", delay: (i % 6) * 0.4 }}
          >
            <motion.div
              drag
              dragConstraints={ref}
              dragElastic={0.5}
              dragSnapToOrigin
              dragMomentum={false}
              whileHover={{ scale: 1.08 }}
              whileDrag={{ scale: 1.14, zIndex: 30 }}
              className={`flex cursor-grab items-center justify-center rounded-full shadow-[0_14px_30px_-14px_rgba(24,4,42,0.45)] active:cursor-grabbing ${
                Icon ? "bg-white ring-1 ring-black/[0.04]" : ""
              }`}
              style={{
                width: size,
                height: size,
                marginLeft: -size / 2,
                marginTop: -size / 2,
                ...(Icon ? {} : { background: `radial-gradient(circle at 32% 28%, ${b.color}, ${b.color}aa)` }),
              }}
            >
              {Icon ? <Icon style={{ color: b.color, width: size * 0.44, height: size * 0.44 }} aria-hidden /> : null}
            </motion.div>
          </motion.div>
        )
      })}
    </div>
  )
}
