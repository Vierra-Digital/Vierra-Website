"use client"

import { Play } from "lucide-react"
import { motion } from "framer-motion"
import { Bricolage_Grotesque, Inter } from "next/font/google"

const bricolage = Bricolage_Grotesque({ subsets: ["latin"] })
const inter = Inter({ subsets: ["latin"] })

export function CaseStudies() {
  return (
    <div className="mt-16 md:mt-32 px-4 md:px-20" id="cases">
      {/* Header above the copy */}
      <div className="mx-auto max-w-3xl text-center mb-12 md:mb-16">
        <span
          className={`${inter.className} text-[11px] font-semibold uppercase tracking-[0.35em] text-[#C99DFF]`}
        >
          See It In Action
        </span>
        <h2
          className={`${bricolage.className} mt-4 text-4xl md:text-6xl font-semibold leading-[1.05] text-white`}
        >
          Flood Your Sales Calendar
        </h2>
        <p className={`${inter.className} mx-auto mt-5 max-w-2xl text-base font-light text-white/80`}>
          The only platform needed to automatically find, reach &amp; close your
          entire market.
        </p>
      </div>

      {/* Placeholder for the demo video — real 16:9 video frame, purple space theme */}
      <div className="container mx-auto mb-10 px-0 md:px-16">
        <div className="mx-auto w-full max-w-[1100px]">
          <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-[#0B0414] shadow-[0_0_60px_2px_rgba(122,19,208,0.55)]">
            {/* purple space backdrop */}
            <div aria-hidden className="absolute inset-0 overflow-hidden">
              <div className="cta-stars" />
              <div className="cta-stars cta-stars--2" />
              <div className="absolute left-1/2 top-1/2 h-[440px] w-[440px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#701CC0] opacity-30 blur-[120px]" />
              {/* vignette — darkens the edges/corners */}
              <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_50%,transparent_45%,#0B0414_100%)]" />
            </div>
            {/* coming-soon content */}
            <div className="relative z-10 flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
              <div className="group relative flex items-center justify-center">
                {/* pulsing ring */}
                <motion.span
                  aria-hidden
                  className="absolute h-16 w-16 rounded-full bg-white/15 md:h-20 md:w-20"
                  animate={{ scale: [1, 1.6], opacity: [0.5, 0] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
                />
                <motion.span
                  className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/25 backdrop-blur-sm transition-transform duration-300 group-hover:scale-110 md:h-20 md:w-20"
                  animate={{ scale: [1, 1.06, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Play className="ml-1 h-7 w-7 text-white md:h-9 md:w-9" />
                </motion.span>
              </div>
              <h3 className={`${bricolage.className} text-2xl md:text-4xl font-semibold text-white`}>
                Coming Soon
              </h3>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
