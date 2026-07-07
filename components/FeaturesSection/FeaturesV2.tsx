"use client"

import { motion } from "framer-motion"
import { Bricolage_Grotesque, Inter } from "next/font/google"
import { Globe, BarChart3, Share2, MessagesSquare, Radar, Search, Server } from "lucide-react"
import PipelineGrid from "./PipelineGrid"
import AutopilotPlane from "./AutopilotPlane"

const bricolage = Bricolage_Grotesque({ subsets: ["latin"] })
const inter = Inter({ subsets: ["latin"] })

// The capabilities behind the engine, shown as compact feature boxes.
const features = [
  {
    icon: Globe,
    title: "Brand Universe",
    copy: "One of the largest verified databases of buyers — mapped, segmented, and ready to target.",
  },
  {
    icon: BarChart3,
    title: "Sales Intelligence",
    copy: "Analytics plus pre-researched lead context, from the first signal to a booked meeting.",
  },
  {
    icon: Share2,
    title: "Omni-Channel Campaigns",
    copy: "Coordinated outreach across email, social, SMS, and search — all firing in sync.",
  },
  {
    icon: MessagesSquare,
    title: "Painpoint, Human-like Messaging",
    copy: "Copy that speaks to real pain points and reads like a human, never a bot.",
  },
  {
    icon: Radar,
    title: "Signals",
    copy: "We watch buying signals in real time and engage the moment intent spikes.",
  },
  {
    icon: Search,
    title: "Lead Research",
    copy: "Every lead is enriched and qualified before it ever reaches your calendar.",
  },
  {
    icon: Server,
    title: "Delivery Infrastructure",
    copy: "Warmed inboxes and resilient sending infrastructure so your messages actually land.",
  },
]

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

        {/* Capability boxes. */}
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, copy }) => (
            <motion.div
              key={title}
              variants={fadeUp}
              className="flex flex-col rounded-3xl border border-white/10 bg-gradient-to-b from-[#240A45] to-[#1A0735] p-6 transition-transform duration-300 hover:-translate-y-1"
            >
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#701CC0]/25 text-[#C99DFF]">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className={`text-lg font-semibold text-white ${bricolage.className}`}>
                {title}
              </h3>
              <p className={`mt-2 flex-1 text-[14px] leading-relaxed text-[#B9A9D6] ${inter.className}`}>
                {copy}
              </p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  )
}
