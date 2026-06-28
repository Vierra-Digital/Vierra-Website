"use client"
import { motion } from "framer-motion"
import { Bricolage_Grotesque, Figtree } from "next/font/google"

const bricolage = Bricolage_Grotesque({ subsets: ["latin"] })
const figtree = Figtree({ subsets: ["latin"] })

interface Service {
  id: string
  name: string
  description: string
}

const services: Service[] = [
  {
    id: "01",
    name: "Warm Outreach",
    description:
      "A stagnant business is worse than a dying one. We use warm outreach through our connections to drive new leads flowing to your business.",
  },
  {
    id: "02",
    name: "Systems",
    description:
      "You're not getting new clients because you don't have systematic outreach. We build the foundational systems that maximize organic lead generation.",
  },
  {
    id: "03",
    name: "Targeted Ads",
    description:
      "We use the market's changing trends to push ads that reach an audience that wants your service, spending only on premium placements that convert.",
  },
  {
    id: "04",
    name: "Google Analytics",
    description:
      "Improve your business by making your data work for you. We use results-driven numbers to improve lead generation and increase client longevity.",
  },
]

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const } },
}

// Light, clean numbered steps with a staggered entrance and a growing accent bar.
export function Services() {
  return (
    <div className="mx-auto w-full max-w-7xl px-6" id="services">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.12 } } }}
        className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
      >
        {services.map((s) => (
          <motion.div
            key={s.id}
            variants={fadeUp}
            className="group relative flex flex-col rounded-3xl border border-[#ECE6F5] bg-white p-7 shadow-[0_18px_44px_-30px_rgba(112,28,192,0.5)] transition-transform duration-300 hover:-translate-y-1"
          >
            <span
              className={`grid h-12 w-12 place-items-center rounded-2xl bg-[#701CC0] text-lg font-semibold text-white ${bricolage.className}`}
            >
              {s.id}
            </span>
            <h3 className={`mt-5 text-xl font-semibold text-[#18042A] ${bricolage.className}`}>{s.name}</h3>
            <p className={`mt-2 flex-1 text-[15px] leading-relaxed text-[#5C5470] ${figtree.className}`}>
              {s.description}
            </p>
            <motion.div
              className="mt-5 h-[3px] rounded-full bg-[#701CC0]"
              initial={{ width: 0 }}
              whileInView={{ width: 40 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
            />
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}
