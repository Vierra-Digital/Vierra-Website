import { useRef, useState } from "react"
import { Bricolage_Grotesque, Figtree } from "next/font/google"
import { motion, useScroll, useMotionValueEvent } from "framer-motion"
import type { IconType } from "react-icons"
import { FaLinkedin, FaComment } from "react-icons/fa6"
import { SiGmail, SiMeta, SiGoogle } from "react-icons/si"
import GridComponent from "./GridComponent"

const bricolage = Bricolage_Grotesque({ subsets: ["latin"] })
const figtree = Figtree({ subsets: ["latin"] })

interface TabItem {
  id: string
  title: string
  content: string
  Icon: IconType
  color: string
}

const tabs: TabItem[] = [
  {
    id: "email",
    title: "Email Cartography & Campaigns",
    content:
      "We mine and map high-intent inboxes, then run targeted campaigns that land your offer in front of the right buyers.",
    Icon: SiGmail,
    color: "#EA4335",
  },
  {
    id: "linkedin",
    title: "LinkedIn Sales Navigator & InMails",
    content:
      "Precision prospecting on LinkedIn — we surface decision-makers and open real conversations with personalized InMails.",
    Icon: FaLinkedin,
    color: "#0A66C2",
  },
  {
    id: "meta",
    title: "Meta: Instagram And Facebook",
    content:
      "Paid and organic plays across Instagram and Facebook put your offer in front of the audiences most likely to convert.",
    Icon: SiMeta,
    color: "#0467DF",
  },
  {
    id: "sms",
    title: "SMS Warm Outreach",
    content:
      "Timely, personal text follow-ups that re-engage warm leads and keep deals moving forward.",
    Icon: FaComment,
    color: "#16A34A",
  },
  {
    id: "organic",
    title: "Organic Leads",
    content:
      "Content and SEO funnels pull in inbound leads who are already searching for exactly what you do.",
    Icon: SiGoogle,
    color: "#4285F4",
  },
]

export function BusinessSolutions() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] })
  const [active, setActive] = useState(0)

  // Page-scroll drives which outreach method is shown (no hover-trap, no
  // site-wide snap) — the section pins and steps through the channels.
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setActive(Math.min(tabs.length - 1, Math.max(0, Math.floor(v * tabs.length))))
  })
  const goTo = (i: number) => {
    const el = ref.current
    if (!el) return
    const scrollable = el.offsetHeight - window.innerHeight
    window.scrollTo({ top: el.offsetTop + ((i + 0.5) / tabs.length) * scrollable, behavior: "smooth" })
  }

  const tab = tabs[active]
  const Icon = tab.Icon

  return (
    <section ref={ref} id="solutions" className="relative bg-[#F3F3F3]" style={{ height: `${tabs.length * 55}vh` }}>
      <div className="sticky top-0 flex h-screen items-center overflow-hidden px-6">
        <div className="mx-auto w-full max-w-7xl max-md:px-2">
          {/* Centered header */}
          <div className="mb-12 text-center md:mb-14">
            <span className={`${figtree.className} text-[11px] font-semibold uppercase tracking-[0.35em] text-[#701CC0]`}>
              Campaign Outlets
            </span>
            <h2 className={`${bricolage.className} mt-4 text-4xl font-bold leading-[1.05] text-[#18042A] md:text-6xl`}>
              Multi-Channel Marketing
            </h2>
            <p className={`${figtree.className} mx-auto mt-5 max-w-2xl text-lg leading-7 text-[#5C5470]`}>
              Reach your entire market across every channel that converts, powered by one
              of the largest verified brand universe databases of buyers in the world.
            </p>
          </div>

          {/* Outlet showcase (left, scroll-driven) + Stripe animation (right) */}
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div>
              <div className="relative flex min-h-[240px] w-full items-center">
                <motion.div
                  key={active}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  className="flex flex-col items-start text-left"
                >
                  <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-[0_12px_30px_-16px_rgba(112,28,192,0.5)]">
                    <Icon className="h-8 w-8" style={{ color: tab.color }} aria-hidden />
                  </span>
                  <h3 className={`${bricolage.className} mt-6 text-4xl font-bold leading-[1.08] text-[#18042A] md:text-5xl`}>
                    {tab.title}
                  </h3>
                  <p className={`${figtree.className} mt-4 max-w-md text-xl leading-8 text-[#646A69]`}>
                    {tab.content}
                  </p>
                </motion.div>
              </div>

              {/* progress dots — reflect scroll position; click to jump */}
              <div className="mt-8 flex items-center gap-2.5">
                {tabs.map((t, i) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => goTo(i)}
                    aria-label={t.title}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === active ? "w-10 bg-[#701CC0]" : "w-1.5 bg-[#701CC0]/25 hover:bg-[#701CC0]/50"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Stripe-style traveling grid */}
            <div className="relative mx-auto">
              <GridComponent />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
