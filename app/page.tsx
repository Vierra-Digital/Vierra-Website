"use client"
import { useEffect, useState } from "react"
import { Bricolage_Grotesque, Inter } from "next/font/google"
import Image from "next/image"
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
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { staggerChildren: 0.2, ease: "easeOut" },
  },
}
const heroTitleTransition = { duration: 0.6, ease: "easeOut" }
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
  ease: "easeInOut",
}
const heroImageTransition = {
  duration: 2,
  repeat: Infinity,
  repeatType: "loop" as const,
  ease: "easeInOut",
}
const LazyBusinessSolutions = dynamic(
  () =>
    import("@/components/BusinessSection/BusinessSolutions").then(
      (mod) => mod.BusinessSolutions
    ),
  { ssr: false, loading: () => <div className="min-h-[320px] bg-[#F3F3F3]" /> }
)
const LazyServices = dynamic(() => import("@/components/ServicesSection/Main"), {
  ssr: false,
  loading: () => <div className="min-h-screen bg-[#010205]" />,
})
const LazyTestimonials = dynamic(
  () => import("@/components/TestimonialSection/Testimonials"),
  { ssr: false, loading: () => <div className="min-h-[480px] bg-[#010205]" /> }
)
const LazyTeam = dynamic(() => import("@/components/TeamSection/Team"), {
  ssr: false,
  loading: () => <div className="min-h-[480px] bg-[#010205]" />,
})
const LazyFooter = dynamic(
  () =>
    import("@/components/FooterSection/MainComponent").then(
      (mod) => mod.FooterSection
    ),
  { ssr: false, loading: () => <div className="min-h-[240px] bg-[#7A13D0]" /> }
)

export default function Page() {
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    const hash = window.location.hash
    if (!hash) return
    const sectionId = hash.replace("#", "")
    let attempts = 0
    const maxAttempts = 30
    const tryScroll = () => {
      const target = document.getElementById(sectionId)
      if (target) {
        target.scrollIntoView({ behavior: "smooth" })
        window.history.replaceState(null, "", window.location.pathname)
        return
      }
      attempts += 1
      if (attempts < maxAttempts) {
        window.setTimeout(tryScroll, 100)
      }
    }
    tryScroll()
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
              ease: "easeInOut",
              x: { duration: 4, repeat: Infinity, ease: "easeInOut" },
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
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={heroTitleTransition}
              className={`text-5xl md:text-6xl font-bold leading-tight mb-6 text-[#EFF3FF] ${bricolage.className}`}
            >
              <span
                className="inline-block bg-gradient-to-r from-[#8F42FF] via-[#B366FF] via-[#D4A5FF] via-[#B366FF] to-[#8F42FF] bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient"
                style={gradientTextStyle}
              >
                Risk-Averse
              </span>{" "}
              Guaranteed Leads For Your Business
            </motion.h1>

            <motion.p variants={ctaVariants} className={`text-[#9BAFC3] text-lg mb-6 ${inter.className}`}>
              Scale your business effortlessly. Fill in your sales calendar and
              eliminate risky marketing investments.
            </motion.p>

            
            <div className="sr-only">
              <h2>About Vierra</h2>
              <p>
                Vierra is a digital marketing and lead generation platform that helps businesses 
                increase ROI, leads, and conversions through guaranteed lead generation services. 
                Our application provides case-study-proven, results-based marketing solutions to 
                help businesses scale efficiently, optimize ad spending, and fill their sales 
                calendars with qualified leads. We work closely with each client to deliver 
                professional digital marketing services that eliminate risky marketing investments 
                and maximize return on advertising spend.
              </p>
            </div>

            <motion.div variants={ctaVariants} className={`flex flex-col sm:flex-row items-center gap-4 ${inter.className}`}>
              <Button
                variant="secondary"
                className="flex items-center gap-2 bg-[#701CC0] hover:bg-[#8F42FF] text-white rounded-full px-8 py-7 shadow-[0px_4px_15.9px_0px_#701CC0B8] transform transition-transform duration-300 hover:scale-105"
                onClick={() => setIsModalOpen(true)}
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
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="flex-shrink-0"
          >
            <motion.div initial={{ y: 0 }} animate={{ y: [0, -10, 0] }} transition={heroImageTransition}>
              <Image
                src="/assets/image1.png"
                alt="Vierra"
                width={750}
                height={685}
                priority
                quality={100}
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
                    alt="Partner Logo"
                    width={112}
                    height={24}
                  />
                </a>
                <a
                  href="https://www.athenahealth.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Image
                    src="/assets/Partners/Athena.png"
                    alt="Partner Logo"
                    width={175}
                    height={24}
                  />
                </a>
                <a
                  href="https://www.harvardpilgrim.org/public/home"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Image
                    src="/assets/Partners/Harvard.png"
                    alt="Partner Logo"
                    width={109}
                    height={32}
                  />
                </a>
                <a
                  href="https://www.futuredocs.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Image
                    src="/assets/Partners/NationalAcademy.png"
                    alt="Partner Logo"
                    width={123}
                    height={48}
                  />
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
