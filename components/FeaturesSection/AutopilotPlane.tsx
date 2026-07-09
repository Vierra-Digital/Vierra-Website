"use client"

import { motion } from "framer-motion"

// A clean, gently gliding plane with a flowing dashed trail and soft glow.
// Self-contained SVG (no box, no text, no libraries beyond framer-motion).
export default function AutopilotPlane() {
  return (
    <div className="relative mx-auto flex w-full max-w-md items-center justify-center">
      <svg viewBox="0 0 340 220" className="w-full overflow-visible" role="img" aria-label="A plane gliding on autopilot">
        <defs>
          <linearGradient id="ap2-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F3ECFF" />
            <stop offset="100%" stopColor="#8F42FF" />
          </linearGradient>
          <linearGradient id="ap2-trail" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#B366FF" stopOpacity="0" />
            <stop offset="100%" stopColor="#B366FF" stopOpacity="0.9" />
          </linearGradient>
          <radialGradient id="ap2-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#701CC0" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#701CC0" stopOpacity="0" />
          </radialGradient>
        </defs>

        <ellipse cx="180" cy="115" rx="150" ry="90" fill="url(#ap2-glow)" />

        {/* flowing dashed trail */}
        <path
          d="M30,160 C110,160 130,80 235,66"
          fill="none"
          stroke="url(#ap2-trail)"
          strokeWidth="3"
          strokeDasharray="4 9"
          strokeLinecap="round"
        >
          <animate attributeName="stroke-dashoffset" from="0" to="-26" dur="0.8s" repeatCount="indefinite" />
        </path>

        {/* plane — gently glides (translate only, so the banking angle stays clean) */}
        <motion.g
          animate={{ x: [0, 10, 0], y: [0, -12, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        >
          <g transform="translate(210 52) rotate(-16)">
            <path d="M0,8 L44,15 L0,22 L11,15 Z" fill="url(#ap2-body)" />
            <path d="M0,8 L44,15 L11,15 Z" fill="#F3ECFF" opacity="0.6" />
            <path d="M11,15 L0,22 L0,8 Z" fill="#4C1690" opacity="0.5" />
          </g>
        </motion.g>
      </svg>
    </div>
  )
}
