"use client"
import { useEffect, useState } from "react"
import { Bricolage_Grotesque, Inter } from "next/font/google"
import Image from "next/image"
import { motion, useScroll, useTransform } from "framer-motion"
import { ArrowUpRight, Sparkles } from "lucide-react"
import { Button } from "../components/ui/button"
import { Header } from "@/components/Header"
import { Modal } from "@/components/Modal"
import { BusinessSolutions } from "@/components/BusinessSection/BusinessSolutions"
import Timeline from "@/components/BusinessSection/Timeline"
import { CaseStudies } from "@/components/WorkSection/CaseStudies"
import { StatsGrid } from "@/components/BusinessSection/StatsGrid"
import FeaturesV2 from "@/components/FeaturesSection/FeaturesV2"
import Tailored from "@/components/ServicesSection/Tailored"
import Integrations from "@/components/IntegrationsSection/Integrations"
import Testimonials from "@/components/TestimonialSection/Testimonials"
import Team from "@/components/TeamSection/Team"
import { FooterSection } from "@/components/FooterSection/MainComponent"

const bricolage = Bricolage_Grotesque({ subsets: ["latin"] })
const inter = Inter({ subsets: ["latin"] })
const gridLines = Array.from({ length: 7 }, (_, index) => index)
const headerVariants = {
  hidden: { opacity: 0, y: -20 },
  visible: { opacity: 1, y: 0 },
}
const heroVariants = {
  // No opacity fade on the hero text block — it holds the LCP <h1>, so it must
  // paint immediately in SSR HTML rather than waiting on JS. The slide (y) is a
  // GPU transform: it animates without blocking paint or causing layout shift.
  // The container only orchestrates the stagger; each child fades + drops in
  // from the top one after another, with a clear (but quick) cascade.
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.16, delayChildren: 0.12 },
  },
}
// Shared child entrance: fade + slide down from the top, smooth ease.
const heroChild = {
  hidden: { opacity: 0, y: -34 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } },
}
// "Trusted By Our Partners" entrance — staggers in just after the hero.
const partnersVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.14, delayChildren: 0.55 } },
}
const floatingGradientTransition = {
  duration: 5,
  repeat: Infinity,
  repeatType: "loop" as const,
  ease: "easeInOut" as const,
}

export default function Page() {
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Scroll-linked parallax for the hero's decorative layers. These are
  // GPU transforms (translateY) driven by native scroll position, so they add
  // depth without hijacking the scroll or causing layout shifts.
  const { scrollY } = useScroll()
  const blob1Y = useTransform(scrollY, [0, 800], [0, -420])
  const blob2Y = useTransform(scrollY, [0, 800], [0, 380])

  useEffect(() => {
    if (typeof window === "undefined") return
    const hash = window.location.hash
    if (!hash) return
    const sectionId = hash.replace("#", "")
    // Sections below the fold are lazy-loaded, so the target (and sections above
    // it) may mount after this runs and shift layout. Re-align repeatedly for a
    // few seconds: the first scroll is smooth, later ones snap to correct for any
    // shift from late-mounting siblings. Clean the hash from the URL at the end.
    let cancelled = false
    let scrolledOnce = false
    const start = Date.now()
    const settle = () => {
      if (cancelled) return
      const target = document.getElementById(sectionId)
      if (target) {
        target.scrollIntoView({ behavior: scrolledOnce ? "auto" : "smooth" })
        scrolledOnce = true
      }
      if (Date.now() - start < 4000) {
        window.setTimeout(settle, 250)
      } else if (scrolledOnce) {
        window.history.replaceState(null, "", window.location.pathname)
      }
    }
    settle()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <>
      <div className="min-h-screen bg-[#18042A] text-white relative overflow-hidden z-0">
        {gridLines.map((index) => (
          <motion.div
            key={index}
            className="absolute top-0 h-full border-l border-white opacity-[0.07] -z-10"
            style={{ left: `${(index + 1) * (100 / 8)}%` }}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "100%", opacity: 0.07, x: [0, 10, 0] }}
            transition={{
              duration: 1.1,
              delay: index * 0.06,
              ease: "easeInOut" as const,
              x: { duration: 4, repeat: Infinity, ease: "easeInOut" as const },
            }}
          />
        ))}

        {/* Moving space particles behind the hero. */}
        <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
          <div className="cta-stars" />
          <div className="cta-stars cta-stars--2" />
        </div>

        <motion.div initial="hidden" animate="visible" variants={headerVariants}>
          <Header />
        </motion.div>

        <main className="relative px-6 max-w-7xl mx-auto flex flex-col items-center justify-center text-center min-h-[88vh] pb-[4vh] gap-2">
          <motion.div style={{ y: blob1Y }} className="absolute -top-[6%] -left-[6%] -z-20">
            <motion.div
              initial={{ x: 0, y: 0 }}
              animate={{ x: [0, 10, 0], y: [0, 10, 0] }}
              transition={floatingGradientTransition}
              className="w-[470px] h-[470px] max-w-[475px] max-h-[475px] opacity-80 blur-[20px] rotate-[60deg] rounded-full bg-gradient-to-l from-[#701CC0] to-[#18042A]"
            />
          </motion.div>
          <motion.div style={{ y: blob2Y }} className="absolute -bottom-[42%] -right-[12%] -z-20">
            <motion.div
              initial={{ x: 0, y: 0 }}
              animate={{ x: [0, 10, 0], y: [0, 10, 0] }}
              transition={floatingGradientTransition}
              className="w-[545px] h-[545px] max-w-[550px] max-h-[550px] opacity-80 blur-[20px] rotate-[60deg] rounded-full bg-gradient-to-l from-[#701CC0] to-[#18042A]"
            />
          </motion.div>

          <motion.div initial="hidden" animate="visible" variants={heroVariants} className="flex flex-col items-center">
            <motion.span
              variants={heroChild}
              className={`mb-6 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.35em] text-[#C99DFF] ${inter.className}`}
            >
              <Sparkles size={14} className="text-[#C99DFF]" />
              B2B Lead Generation
            </motion.span>
            <motion.h1
              variants={heroChild}
              style={{ fontSize: "clamp(2.5rem, 7.6vw, 6rem)" }}
              className={`font-bold leading-[1.05] mb-6 text-[#EFF3FF] max-w-7xl ${bricolage.className}`}
            >
              <span
                className="bg-clip-text text-transparent bg-[length:200%_auto]"
                style={{
                  backgroundImage:
                    "linear-gradient(90deg, #8B5CF6, #D946EF 25%, #F0ABFC 50%, #A855F7 75%, #8B5CF6)",
                  animation: "vierra-bold-flow 4s linear infinite",
                }}
              >
                Risk-Averse
              </span>{" "}
              Lead Engine
              <br className="hidden md:block" /> For Your Business
            </motion.h1>

            <motion.p variants={heroChild} className={`text-white text-xl md:text-2xl mb-8 max-w-2xl ${inter.className}`}>
              Construct your funnel, research leads, capture signals, and schedule
              meetings autonomously.
            </motion.p>

            
            <div className="sr-only">
              <h2>About Vierra</h2>
              <p>
                Vierra is a B2B lead generation platform that helps businesses build a
                funnel, research leads, capture buying signals, and schedule meetings
                autonomously. Our case-study-proven, results-based systems help
                businesses increase ROI and conversions, scale efficiently, and fill
                their sales calendars with qualified leads.
              </p>
            </div>

            <motion.div variants={heroChild} className={`flex flex-col sm:flex-row items-center justify-center gap-4 ${inter.className}`}>
              <Button
                variant="secondary"
                className="flex items-center gap-2 bg-[#701CC0] hover:bg-[#8F42FF] text-white rounded-md px-8 py-7 shadow-[0px_4px_15.9px_0px_#701CC0B8] transform transition-transform duration-300 hover:scale-105"
                onClick={() => setIsModalOpen(true)}
              >
                Let&apos;s Talk
                <ArrowUpRight className="w-4 h-4 arrow-bob" />
              </Button>
            </motion.div>
          </motion.div>
        </main>

        {/* Partners banner — extends the hero's dark backdrop into a slim
            trusted-by strip directly beneath the hero content. */}
        <motion.section
          initial="hidden"
          animate="visible"
          variants={partnersVariants}
          className="relative z-10 px-6 pt-4 pb-20"
        >
          <div className="max-w-6xl mx-auto flex flex-col items-center gap-6">
            <motion.span
              variants={heroChild}
              className={`text-[11px] font-semibold uppercase tracking-[0.35em] text-[#C99DFF] ${inter.className}`}
            >
              Trusted By Our Partners
            </motion.span>
            <motion.div
              variants={heroChild}
              className={`flex flex-wrap justify-center items-center gap-x-10 gap-y-6 md:gap-x-14 ${inter.className}`}
            >
              <a
                href="https://www.isenberg.umass.edu/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="UMass Isenberg School of Management"
                className="opacity-80 transition-opacity duration-300 hover:opacity-100"
              >
                <Image src="/assets/Partners/Isenberg-w.png" alt="UMass Isenberg School of Management logo" width={580} height={120} className="h-7 w-auto object-contain" />
              </a>
              <a
                href="https://ironandwaterco.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Iron & Water Co."
                className="opacity-80 transition-opacity duration-300 hover:opacity-100"
              >
                <span className="whitespace-nowrap text-[15px] font-semibold uppercase tracking-[0.18em] text-white">
                  Iron &amp; Water Co.
                </span>
              </a>
              <a
                href="https://usegl.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Granite Logistics"
                className="opacity-80 transition-opacity duration-300 hover:opacity-100"
              >
                <Image src="/assets/Partners/Granite-w.png" alt="Granite Logistics logo" width={1041} height={240} className="h-8 w-auto object-contain" />
              </a>
              <a
                href="https://thearoundhub.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="The Around Hub"
                className="opacity-80 transition-opacity duration-300 hover:opacity-100"
              >
                <Image src="/assets/Partners/AroundHub-w.png" alt="The Around Hub logo" width={457} height={120} className="h-7 w-auto object-contain" />
              </a>
              <a
                href="https://freeclass.qigonginfusedyoga.com/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Qigong Infused Yoga"
                className="opacity-80 transition-opacity duration-300 hover:opacity-100"
              >
                <Image src="/assets/Partners/Qigong-w.png" alt="Qigong Infused Yoga logo" width={282} height={120} className="h-9 w-auto object-contain" />
              </a>
              <a
                href="https://somervilledentalassociates.com/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Somerville Dental"
                className="opacity-80 transition-opacity duration-300 hover:opacity-100"
              >
                <span className="whitespace-nowrap text-[15px] tracking-tight text-white">
                  <span className="font-bold">Somerville</span>{" "}
                  <span className="font-normal text-white/80">Dental</span>
                </span>
              </a>
            </motion.div>
          </div>
        </motion.section>
      </div>

      {isModalOpen && (
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      )}

      {/* 2. Multi-Channel Marketing Campaigns — outlets + database cloud. */}
      <BusinessSolutions />

      {/* Breathing room between the pinned Multi-Channel section and How It Works. */}
      <div aria-hidden className="h-16 md:h-28 bg-[#F3F3F3]" />

      {/* 3. Timeline / how it works. */}
      <Timeline />

      {/* 4. Why it works / case studies. Gradients into the GTM section below. */}
      <section className="w-full bg-gradient-to-b from-[#010205] via-[#010205] to-[#18042A] text-white pb-32">
        <CaseStudies />
      </section>

      {/* 6. Features v2 — big boxes + pipeline. */}
      <FeaturesV2 />

      {/* 7. Tailored To You — scroll-locked step cards. */}
      <Tailored />

      {/* Scale Your Business — stats. */}
      <section className="w-full bg-[#F3F3F3] py-24 md:py-28">
        <div className="px-6">
          <StatsGrid />
        </div>
      </section>

      {/* 8. Integrations — booked-meetings animation. */}
      <Integrations />

      {/* 9-11. Testimonials, leadership, footer. */}
      <Testimonials />
      <Team />
      <FooterSection />
    </>
  )
}
