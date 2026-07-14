import { useEffect, useState } from "react"
import { bricolage, figtree } from "@/lib/fonts";
import { motion } from "framer-motion"
import type { IconType } from "react-icons"
import { FaLinkedin, FaComment, FaInstagram, FaFacebook, FaWhatsapp } from "react-icons/fa6"
import { SiGmail } from "react-icons/si"
import { FcGoogle } from "react-icons/fc"
import GridComponent from "./GridComponent"


interface TabItem {
  id: string
  title: string
  content: string
  icons: { Icon: IconType; color: string }[]
}

const tabs: TabItem[] = [
  {
    id: "email",
    title: "Email Cartography & Campaigns",
    content:
      "We mine and map high-intent inboxes, then run targeted campaigns that land your offer in front of the right businesses.",
    icons: [{ Icon: SiGmail, color: "#EA4335" }],
  },
  {
    id: "linkedin",
    title: "LinkedIn Sales Navigator",
    content:
      "We surface decision-makers and open real conversations with personalized InMails and account lists, directly in our CRM.",
    icons: [{ Icon: FaLinkedin, color: "#0A66C2" }],
  },
  {
    id: "meta",
    title: "Instagram And Facebook",
    content:
      "Paid and organic plays across Instagram and Facebook put your offer in front of the audiences most likely to convert.",
    icons: [
      { Icon: FaInstagram, color: "#E4405F" },
      { Icon: FaFacebook, color: "#1877F2" },
    ],
  },
  {
    id: "sms",
    title: "SMS & WhatsApp Warm Outreach",
    content:
      "Timely, personal text follow-ups that re-engage warm leads, bring back old accounts, and keeps deals moving forward.",
    icons: [
      { Icon: FaComment, color: "#16A34A" },
      { Icon: FaWhatsapp, color: "#25D366" },
    ],
  },
  {
    id: "organic",
    title: "Organic Leads & Sales Funnel",
    content:
      "Search content, SEO, AEO, and GEO funnels that pull in inbound leads who are already searching for exactly what you do.",
    icons: [{ Icon: FcGoogle, color: "#4285F4" }],
  },
]

export function BusinessSolutions() {
  const [active, setActive] = useState(0)

  // Headers cycle automatically; a manual click resets the timer (no scroll lock).
  useEffect(() => {
    const id = setTimeout(() => setActive((a) => (a + 1) % tabs.length), 2800)
    return () => clearTimeout(id)
  }, [active])

  const tab = tabs[active]

  return (
    <section id="solutions" className="relative bg-[#F3F3F3] px-6 py-24 md:py-28">
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
            of the largest verified brand universe databases of businesses in the world.
          </p>
        </div>

        {/* Outlet showcase (left, auto-cycling) + Stripe animation (right) */}
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
                <div className="flex items-center gap-3">
                  {tab.icons.map(({ Icon, color }, i) => (
                    <span
                      key={i}
                      className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-[0_12px_30px_-16px_rgba(112,28,192,0.5)]"
                    >
                      <Icon className="h-8 w-8" style={{ color }} aria-hidden />
                    </span>
                  ))}
                </div>
                <h3 className={`${bricolage.className} mt-3 flex items-end max-w-md text-4xl font-bold leading-[1.12] text-[#18042A] md:text-5xl min-h-[2.24em]`}>
                  {tab.title}
                </h3>
                <p className={`${figtree.className} mt-6 max-w-md text-xl leading-8 text-[#646A69] min-h-[6rem]`}>
                  {tab.content}
                </p>
              </motion.div>
            </div>

            {/* progress dots — click to jump */}
            <div className="mt-8 flex items-center gap-2.5">
              {tabs.map((t, i) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActive(i)}
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
    </section>
  )
}
