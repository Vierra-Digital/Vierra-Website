"use client"

import { motion } from "framer-motion"
import { Bricolage_Grotesque, Inter } from "next/font/google"
import PipelineGrid from "./PipelineGrid"
import AutopilotPlane from "./AutopilotPlane"
import FeatureBento from "./FeatureBento"

const bricolage = Bricolage_Grotesque({ subsets: ["latin"] })
const inter = Inter({ subsets: ["latin"] })

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } },
}

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
}

export default function FeaturesV2() {
  return (
    <section className="w-full bg-[#18042A] px-6 py-24 md:py-32 overflow-hidden">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={stagger}
        className="mx-auto max-w-7xl"
      >
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="max-w-3xl">
            <motion.span
              variants={fadeUp}
              className={`text-[11px] font-semibold uppercase tracking-[0.35em] text-[#C99DFF] ${inter.className}`}
            >
              The Vierra Engine
            </motion.span>
            <motion.h2
              variants={fadeUp}
              className={`mt-4 text-4xl md:text-6xl font-bold leading-[1.05] text-[#EFF3FF] ${bricolage.className}`}
            >
              Your Entire GTM On Autopilot
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className={`mt-5 text-lg text-[#B9A9D6] ${inter.className}`}
            >
              One centralized pipeline to take cold marketing into booked meetings.
              It sources, researches, and engages while you stay focused on closing.
            </motion.p>
          </div>
          <motion.div variants={fadeUp} className="w-full">
            <AutopilotPlane />
          </motion.div>
        </div>

        {/* Pipeline grid — outbound channels feed the engine, which pushes booked
            meetings + synced data out to the stack. */}
        <motion.div variants={fadeUp} className="mt-16">
          <PipelineGrid />
        </motion.div>

        {/* Capability boxes — bento layout with a mini-animation per box. */}
        <motion.div variants={fadeUp} className="mt-10">
          <FeatureBento />
        </motion.div>
      </motion.div>
    </section>
  )
}
