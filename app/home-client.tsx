"use client"
import { useEffect, useState } from "react"
import { Bricolage_Grotesque, Inter } from "next/font/google"
import Image from "next/image"
import Link from "next/link"
import { track } from "@/lib/track"
import { motion } from "framer-motion"
import { ArrowUpRight } from "lucide-react"
import dynamic from "next/dynamic"
import { Button } from "../components/ui/button"
import { Header } from "@/components/Header"
import { Modal } from "@/components/Modal"

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
  hidden: { y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { staggerChildren: 0.2, ease: "easeOut" as const },
  },
}
const heroTitleTransition = { duration: 0.6, ease: "easeOut" as const }
const ctaVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}
const gradientTextStyle = {
  backgroundSize: "200% auto",
  animation: "gradient-horizontal 3s ease infinite",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  filter: "brightness(1.2)",
}
const floatingGradientTransition = {
  duration: 5,
  repeat: Infinity,
  repeatType: "loop" as const,
  ease: "easeInOut" as const,
}
const heroImageTransition = {
  duration: 2,
  repeat: Infinity,
  repeatType: "loop" as const,
  ease: "easeInOut" as const,
}
const LazyBusinessSolutions = dynamic(
  () =>
    import("@/components/BusinessSection/BusinessSolutions").then(
      (mod) => mod.BusinessSolutions
    ),
  { loading: () => <div className="min-h-[320px] bg-[#F3F3F3]" /> }
)
const LazyServices = dynamic(() => import("@/components/ServicesSection/Main"), {
  loading: () => <div className="min-h-screen bg-[#010205]" />,
})
const LazyTestimonials = dynamic(
  () => import("@/components/TestimonialSection/Testimonials"),
  { loading: () => <div className="min-h-[480px] bg-[#010205]" /> }
)
const LazyTeam = dynamic(() => import("@/components/TeamSection/Team"), {
  loading: () => <div className="min-h-[480px] bg-[#010205]" />,
})
const LazyFooter = dynamic(
  () =>
    import("@/components/FooterSection/MainComponent").then(
      (mod) => mod.FooterSection
    ),
  { loading: () => <div className="min-h-[240px] bg-[#7A13D0]" /> }
)

export default function HomeClient() {
  const [isModalOpen, setIsModalOpen] = useState(false)

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
            className="absolute top-0 h-full border-l border-white opacity-5 -z-10"
            style={{ left: `${(index + 1) * (100 / 8)}%` }}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "100%", opacity: 0.05, x: [0, 10, 0] }}
            transition={{
              duration: 3,
              delay: index * 0.2,
              ease: "easeInOut" as const,
              x: { duration: 4, repeat: Infinity, ease: "easeInOut" as const },
            }}
          />
        ))}

        <motion.div initial="hidden" animate="visible" variants={headerVariants}>
          <Header />
        </motion.div>

        <main className="relative px-6 max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10">
          <motion.div
            initial={{ x: 0, y: 0 }}
            animate={{ x: [0, 10, 0], y: [0, 10, 0] }}
            transition={floatingGradientTransition}
            className="absolute top-[7%] left-[10%] w-[470px] h-[470px] max-w-[475px] max-h-[475px] opacity-80 blur-[20px] rotate-[60deg] rounded-full bg-gradient-to-l from-[#701CC0] to-[#18042A] -z-20"
          />
          <motion.div
            initial={{ x: 0, y: 0 }}
            animate={{ x: [0, 10, 0], y: [0, 10, 0] }}
            transition={floatingGradientTransition}
            className="absolute -bottom-[32%] -right-[3%] w-[545px] h-[545px] max-w-[550px] max-h-[550px] opacity-80 blur-[20px] rotate-[60deg] rounded-full bg-gradient-to-l from-[#701CC0] to-[#18042A] -z-20"
          />

          <motion.div initial="hidden" animate="visible" variants={heroVariants} className="max-w-2xl">
            <motion.h1
              initial={{ y: 20 }}
              animate={{ y: 0 }}
              transition={heroTitleTransition}
              className={`text-5xl md:text-6xl font-bold leading-tight mb-6 text-[#EFF3FF] ${bricolage.className}`}
            >
              <span
                className="inline-block bg-gradient-to-r from-[#8F42FF] via-[#B366FF] via-[#D4A5FF] via-[#B366FF] to-[#8F42FF] bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient"
                style={gradientTextStyle}
              >
                Risk-Averse
              </span>{" "}
              Lead Engine For Your Business
            </motion.h1>

            <motion.p variants={ctaVariants} className={`text-[#9BAFC3] text-lg mb-6 ${inter.className}`}>
              Scale your business effortlessly. Fill in your sales calendar and
              eliminate risky marketing investments.
            </motion.p>

            
            <div className="sr-only">
              <h2>About Vierra</h2>
              <p>
                Vierra is a B2B lead generation agency that runs on a risk-averse,
                pay-after-results model instead of a fixed retainer. Founded in 2019 and
                headquartered in Medford, MA with an office in New York, NY, Vierra ties
                its fees to booked meetings and qualified pipeline rather than upfront ad
                spend, so clients are not paying for activity that never turns into revenue.
                Vierra builds the outreach systems, ad campaigns, and analytics that fill a
                sales calendar with qualified leads, then optimizes toward what actually converts.
              </p>
              <p>
                Read the full breakdown:{" "}
                <Link href="/blog/what-is-risk-averse-lead-generation-and-why-it-beats-paying-upfront">
                  What Is Risk-Averse Lead Generation?
                </Link>
              </p>
              <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                  __html: JSON.stringify({
                    "@context": "https://schema.org",
                    "@type": "WebPage",
                    "@id": "https://vierradev.com/#webpage",
                    url: "https://vierradev.com",
                    speakable: {
                      "@type": "SpeakableSpecification",
                      cssSelector: ["h1", ".sr-only h2", ".sr-only p"],
                    },
                  }),
                }}
              />
            </div>

            <motion.div variants={ctaVariants} className={`flex flex-col sm:flex-row items-center gap-4 ${inter.className}`}>
              <Button
                variant="secondary"
                className="flex items-center gap-2 bg-[#701CC0] hover:bg-[#8F42FF] text-white rounded-full px-8 py-7 shadow-[0px_4px_15.9px_0px_#701CC0B8] transform transition-transform duration-300 hover:scale-105"
                onClick={() => { track("cta_click", { location: "hero" }); setIsModalOpen(true); }}
              >
                Free Audit Call
                <ArrowUpRight className="w-4 h-4" />
              </Button>
              <Button
                variant="link"
                className="text-white text-[16px] relative group hover:text-[#8F42FF] pl-2"
                onClick={() => {
                  document.getElementById("services")?.scrollIntoView({
                    behavior: "smooth",
                  })
                }}
              >
                What We Do
                <span className="absolute left-2 bottom-0 w-0 h-[1px] bg-[#8F42FF] transition-all duration-300 group-hover:w-[calc(100%-20px)]" />
              </Button>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ scale: 0.96 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" as const }}
            className="flex-shrink-0"
          >
            <motion.div initial={{ y: 0 }} animate={{ y: [0, -10, 0] }} transition={heroImageTransition}>
              <Image
                src="/assets/image1.png"
                alt="Vierra risk-averse lead generation platform for scaling businesses"
                width={750}
                height={685}
                priority
                quality={80}
                sizes="(max-width: 768px) 90vw, 750px"
              />
            </motion.div>
          </motion.div>
        </main>

        <section className="w-full py-16">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-col md:flex-row items-center gap-12">
              <h2
                className={`text-white text-xl font-medium whitespace-nowrap ${bricolage.className}`}
              >
                Trusted By Our Partners
              </h2>
              <div className="flex flex-wrap md:flex-nowrap justify-center items-center gap-12 md:gap-24 w-full">
                <a
                  href="https://www.isenberg.umass.edu/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Image
                    src="/assets/Partners/Isenberg.png"
                    alt="UMass Isenberg School of Management logo"
                    width={112}
                    height={24}
                  />
                </a>
                <a
                  href="https://ironandwaterco.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <div className="flex items-center gap-2 text-white">
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <path d="M18 20V6.5C18 4.01472 15.9853 2 13.5 2H10.5C8.01472 2 6 4.01472 6 6.5V20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                      <path d="M9 9.25C11.7 9.25 13.5 11.05 13.5 13.75C13.5 16.45 11.7 18.25 9 18.25" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                      <circle cx="14.75" cy="11.25" r="0.95" fill="currentColor"/>
                    </svg>
                    <span className="text-[11px] md:text-xs font-semibold tracking-[0.2em] whitespace-nowrap">
                      IRON &amp; WATER CO.
                    </span>
                  </div>
                </a>
                <a
                  href="https://happystack.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <div className="flex items-center gap-2">
                    <Image
                      src="/assets/Partners/HappyStack.png"
                      alt="HappyStack mascot"
                      width={30}
                      height={30}
                      className="w-6 h-6 object-contain"
                    />
                    <Image
                      src="/assets/Partners/HappyStack.svg"
                      alt="HappyStack"
                      width={117}
                      height={19}
                      className="w-auto h-3.5 md:h-4"
                    />
                  </div>
                </a>
                <a
                  href="https://somervilledentalassociates.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <div className="flex items-center gap-2 text-white whitespace-nowrap">
                    <svg
                      width="20"
                      height="24"
                      viewBox="0 0 20 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <path
                        d="M10 22C6.6 22 3.5 19.4 2.9 15.9L1.3 6.2C1.1 4.6 2.3 3.2 3.9 3.2C5 3.2 6 3.8 6.5 4.8L7.3 6.3C8 7.6 9.9 7.6 10.6 6.3L11.4 4.8C11.9 3.8 12.9 3.2 14 3.2C15.6 3.2 16.8 4.6 16.6 6.2L15 15.9C14.4 19.4 13.4 22 10 22Z"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className="text-[12px] md:text-sm tracking-[0.01em]">
                      <span className="font-bold">Somerville</span>{" "}
                      <span className="font-normal text-white/85">Dental</span>
                    </span>
                  </div>
                </a>
              </div>
            </div>
          </div>
        </section>
      </div>
      {isModalOpen && (
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      )}
      <LazyBusinessSolutions />
      <LazyServices />
      <LazyTestimonials />
      <LazyTeam />
      <LazyFooter />
    </>
  )
}
