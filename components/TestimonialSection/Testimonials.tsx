"use client"
import Image from "next/image"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Bricolage_Grotesque, Inter } from "next/font/google"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"

const bricolage = Bricolage_Grotesque({ subsets: ["latin"] })
const inter = Inter({ subsets: ["latin"] })

const testimonials = [
  {
    name: "Nowfal Ebrahim",
    role: "Invisalign",
    text: "Vierra has helped Invisalign by providing doctor referrals and increasing our presence in offices and our total revenue. Every month, we increase our contracts with Vierra and see higher profits.",
    image: "/assets/Testimonials/TestimonialProfiles/NowfalEbrahim.png",
    companyLogo: "/assets/Testimonials/invisalign.png",
  },
  {
    name: "Deanna Mazzeo",
    role: "Somerville Dental Associates",
    text: "Our office had no online presence. Alex on Vierra has helped grow our Yelp and the number of new monthly patients we get, filling the annoying gaps in our schedule.",
    image: "/assets/Testimonials/TestimonialProfiles/DeannaMazzeo.png",
    companyLogo: "/assets/Testimonials/somerville.png",
  },
  {
    name: "Hannah Lowney",
    role: "Salon Renee",
    text: "Within just 3 months of Vierra handling my marketing, I saw more than triple the number of clients I used to get.",
    image: "/assets/Testimonials/TestimonialProfiles/HannahLowney.jpg",
    companyLogo: "/assets/Testimonials/renee.png",
  },
  {
    name: "Long Doan",
    role: "eCyberForce",
    text: "I struggled to get even a percentage of the leads my competitors were getting. After signing with Vierra, my leads have gone from roughly 20 to over 3000 in just a month.",
    image: "/assets/Testimonials/TestimonialProfiles/LongDoan.jpg",
    companyLogo: "/assets/Testimonials/ecyberforce.png",
  },
  {
    name: "Dennis Zax",
    role: "ezML",
    text: "Vierra's marketing approach is simple, structured, and intentional. They have made a huge impact on my life and my small business, not to be so small in a few months from the growth I've been seeing!",
    image: "/assets/Testimonials/TestimonialProfiles/DennisZax.jpg",
    companyLogo: "/assets/Testimonials/ezml.png",
  },
]

const n = testimonials.length
const STACK = 3

// Visual state for each position in the stack
const stackStyles = [
  { scale: 1,    y: 0,   zIndex: 30, opacity: 1 }, // front
  { scale: 0.95, y: -20, zIndex: 20, opacity: 1 }, // middle
  { scale: 0.90, y: -36, zIndex: 10, opacity: 1 }, // back
]

export default function TestimonialsSection() {
  const [current, setCurrent] = useState(0)
  const [direction, setDirection] = useState(1)

  const next = () => {
    setDirection(1)
    setCurrent(p => (p + 1) % n)
  }
  const prev = () => {
    setDirection(-1)
    setCurrent(p => (p - 1 + n) % n)
  }

  useEffect(() => {
    const timer = setInterval(next, 5000)
    return () => clearInterval(timer)
  }, [current])

  // Build the visible stack (front … back)
  const stack = Array.from({ length: STACK }, (_, pos) => ({
    tIndex: (current + pos) % n,
    pos,
  }))

  return (
    <section className="w-full bg-[#010205] text-white pt-16 pb-24 px-6 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-[#701CC0]/8 rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* Heading */}
      <motion.div
        className="text-center mb-20 max-w-2xl mx-auto"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.65, ease: [0.32, 0.72, 0, 1] }}
      >
        <p className={`text-[#701CC0] text-xs font-semibold tracking-[0.2em] uppercase mb-4 ${inter.className}`}>
          Client Results
        </p>
        <h2 className={`text-4xl md:text-5xl font-bold leading-tight ${bricolage.className}`}>
          See How We{" "}
          <span className="bg-gradient-to-r from-[#8F42FF] via-[#B366FF] to-[#D4A5FF] bg-clip-text text-transparent">
            Increased Profits
          </span>{" "}
          For Top Experts in the Industry.
        </h2>
      </motion.div>

      {/* Card stack */}
      <motion.div
        className="max-w-5xl mx-auto"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.65, delay: 0.15, ease: [0.32, 0.72, 0, 1] }}
      >
        {/*
          paddingTop reserves space so the peaking back/middle cards
          don't overlap the heading above.
          The inner div has a fixed height; all cards are absolute inset-0.
          Rendered back→front so DOM order gives front the highest natural z.
        */}
        <div className="relative" style={{ paddingTop: 40 }}>
          <div className="relative" style={{ height: 460 }}>
            <AnimatePresence mode="sync" custom={direction}>
              {[...stack].reverse().map(({ tIndex, pos }) => {
                const t = testimonials[tIndex]
                const isFront = pos === 0
                const s = stackStyles[pos]

                return (
                  <motion.div
                    key={tIndex}
                    className="absolute inset-0 rounded-[40px] border border-[#42345055] bg-gradient-to-br from-[#0D0618] to-[#100820] overflow-hidden"
                    custom={direction}
                    initial={
                      direction > 0
                        ? { scale: 0.86, y: -50, opacity: 0, zIndex: 10 }
                        : { scale: 1.04, y: -80, opacity: 0, zIndex: 35 }
                    }
                    animate={{
                      scale: s.scale,
                      y: s.y,
                      zIndex: s.zIndex,
                      opacity: s.opacity,
                    }}
                    exit={
                      direction > 0
                        ? { scale: 0.88, y: -50, opacity: 0, zIndex: 5 }
                        : { scale: 1.04, y: -80, opacity: 0, zIndex: 35 }
                    }
                    transition={{ duration: 0.55, ease: [0.32, 0.72, 0, 1] }}
                  >
                    {/* Glow — front card only */}
                    {isFront && (
                      <div className="absolute -top-24 -right-24 w-[300px] h-[300px] bg-[#701CC0]/12 rounded-full blur-[80px] pointer-events-none" />
                    )}

                    {isFront ? (
                      /* ── Front card: full content ── */
                      <div className="relative p-10 md:p-14 h-full flex flex-col md:flex-row md:gap-14 md:items-center">
                        {/* Quote */}
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <span className={`block text-[100px] leading-none text-[#701CC0]/25 -mb-4 select-none ${bricolage.className}`}>
                            &ldquo;
                          </span>
                          <p className={`text-xl md:text-2xl font-light leading-relaxed text-white/85 ${bricolage.className}`}>
                            {t.text}
                          </p>
                        </div>

                        {/* Divider */}
                        <div className="hidden md:block w-px self-stretch bg-[#42345044] flex-shrink-0" />

                        {/* Person + company */}
                        <div className="md:w-44 flex-shrink-0 mt-8 md:mt-0 flex flex-col items-center text-center">
                          <div className="relative mb-4">
                            <div className="absolute inset-0 rounded-full bg-[#701CC0] blur-[12px] scale-110 opacity-50" />
                            <Image
                              src={t.image}
                              alt={t.name}
                              width={80}
                              height={80}
                              quality={100}
                              className="relative w-16 h-16 md:w-20 md:h-20 rounded-full object-cover ring-2 ring-[#701CC0]"
                            />
                          </div>
                          <p className={`font-semibold text-base leading-tight mb-1 ${bricolage.className}`}>
                            {t.name}
                          </p>
                          <p className={`text-xs text-white/50 mb-6 ${inter.className}`}>
                            {t.role}
                          </p>
                          <div className="bg-[#701CC0] rounded-2xl px-6 py-4 flex items-center justify-center">
                            <Image
                              src={t.companyLogo}
                              alt={t.role}
                              width={140}
                              height={52}
                              className="h-10 w-auto object-contain filter invert brightness-0"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* ── Backing card: faded preview ── */
                      <div className="relative p-10 md:p-14 h-full flex flex-col justify-center pointer-events-none select-none opacity-40">
                        <span className={`block text-[100px] leading-none text-[#701CC0]/25 -mb-4 ${bricolage.className}`}>
                          &ldquo;
                        </span>
                        <p className={`text-xl md:text-2xl font-light leading-relaxed text-white/85 line-clamp-3 ${bricolage.className}`}>
                          {t.text}
                        </p>
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* Auto-advance progress bar */}
        <div className="mt-6 h-[2px] w-full bg-[#42345044]">
          <motion.div
            key={`pb-${current}`}
            className="h-full bg-[#701CC0]"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 5, ease: "linear" }}
          />
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-center gap-5 mt-6">
          <motion.button
            onClick={prev}
            className="w-9 h-9 rounded-full border border-[#42345088] flex items-center justify-center text-white/50 hover:text-white hover:border-[#701CC0] transition-colors duration-200"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.88 }}
            aria-label="Previous testimonial"
          >
            <ChevronLeft size={16} />
          </motion.button>

          <div className="flex items-center gap-1.5">
            {testimonials.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  setDirection(i > current ? 1 : -1)
                  setCurrent(i)
                }}
                aria-label={`Go to testimonial ${i + 1}`}
              >
                <motion.div
                  className="h-2 rounded-full bg-[#701CC0]"
                  animate={{
                    width: i === current ? 28 : 8,
                    opacity: i === current ? 1 : 0.25,
                  }}
                  transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
                />
              </button>
            ))}
          </div>

          <motion.button
            onClick={next}
            className="w-9 h-9 rounded-full border border-[#42345088] flex items-center justify-center text-white/50 hover:text-white hover:border-[#701CC0] transition-colors duration-200"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.88 }}
            aria-label="Next testimonial"
          >
            <ChevronRight size={16} />
          </motion.button>
        </div>
      </motion.div>
    </section>
  )
}
