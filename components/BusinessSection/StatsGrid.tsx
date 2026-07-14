"use client"
import { TrendingUp } from "lucide-react"
import { bricolage, inter } from "@/lib/fonts";
import { useEffect, useState, useRef } from "react"
import { motion, animate, useInView } from "framer-motion"


const cardVar = {
  hidden: { opacity: 0, y: 28, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } },
}
const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.14 } },
}

// Counts the numeric part of a stat up from 0 when it scrolls into view,
// preserving any prefix/suffix (e.g. "$", "%", "M+"). Re-runs whenever `value`
// changes (so the rotating box counts up on every slide).
function CountUp({ value, duration = 1.6 }: { value: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: false, amount: 0.4 })
  const parsed = value.match(/^(\D*)([\d.]+)(.*)$/)
  const prefix = parsed ? parsed[1] : ""
  const numStr = parsed ? parsed[2] : value
  const suffix = parsed ? parsed[3] : ""
  const target = parsed ? parseFloat(numStr) : 0
  const decimals = numStr.includes(".") ? numStr.split(".")[1].length : 0
  const [display, setDisplay] = useState(parsed ? `${prefix}${(0).toFixed(decimals)}${suffix}` : value)
  useEffect(() => {
    if (!parsed) {
      setDisplay(value)
      return
    }
    if (!inView) {
      setDisplay(`${prefix}${(0).toFixed(decimals)}${suffix}`)
      return
    }
    const controls = animate(0, target, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(`${prefix}${v.toFixed(decimals)}${suffix}`),
    })
    return () => controls.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, value])
  return <span ref={ref}>{display}</span>
}

export function StatsGrid() {
  const card4Content = [
    { number: "150M+", text: "leads generated." },
    { number: "500k+", text: "campaigns created." },
    { number: "175+", text: "businesses supercharged." },
  ]

  const total = card4Content.length
  const [step, setStep] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setStep((s) => s + 1), 3000)
    return () => clearInterval(interval)
  }, [])

  const contentIndex = step % total
  const cycle = Math.floor(step / total)
  const currentContent = card4Content[contentIndex]

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={container}
      className="flex flex-col mx-auto my-0 items-center max-w-[1200px] z-10 relative"
    >
      <div className="absolute w-[893px] h-[510px] rounded-[60px] top-[50px] left-1/4 bg-[#4F14881A] max-md:hidden -z-10" />
      <div className="flex gap-20 mb-14 items-end max-md:flex-col max-md:items-center max-md:gap-4 max-md:mb-4">
        <motion.div
          variants={cardVar}
          whileHover={{ scale: 1.05 }}
          transition={{ type: "spring", stiffness: 300, damping: 22 }}
          className="relative flex flex-col justify-center w-[350px] h-[231px] bg-[#701CC0] rounded-[60px] max-md:w-[300px] max-md:h-[250px] max-md:px-5 max-md:py-10 max-sm:w-[260px] max-sm:h-[200px] max-sm:px-8 max-sm:py-8 max-sm:rounded-[30px]"
        >
          <div className="relative z-10 mx-8 max-w-[230px] text-left max-md:mx-0 max-md:max-w-full">
            <div
              className={`text-7xl font-extrabold leading-none text-white max-md:text-4xl ${bricolage.className}`}
            >
              <CountUp value="250%" />
            </div>
            <div
              className={`mt-3 font-light leading-6 text-[#ECF2FDCC] max-sm:text-sm max-sm:leading-5 ${inter.className}`}
            >
              return on investment.
            </div>
          </div>
          <div className="absolute top-1/2 right-[-30px] z-10 -translate-y-1/2 w-[60px] h-[60px] md:w-[108px] md:h-[108px] bg-[#010205] shadow-[0px_30.08px_50.58px_-6.84px_#701CC0] rounded-full flex items-center justify-center">
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            >
              <TrendingUp className="w-6 h-6 md:w-12 md:h-12 text-white" />
            </motion.div>
          </div>
        </motion.div>
        <motion.div
          variants={cardVar}
          whileHover={{ scale: 1.05 }}
          transition={{ type: "spring", stiffness: 300, damping: 22 }}
          className="relative flex flex-col w-[409px] h-[338px] bg-[#18042A] rounded-[60px] max-md:w-[300px] max-md:h-[250px] max-md:px-5 max-md:py-10 max-sm:w-[260px] max-sm:h-[200px] max-sm:px-8 max-sm:py-8 max-sm:rounded-[30px]"
        >
          {/* moving particle backdrop (clipped to the rounded card) */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[60px] max-sm:rounded-[30px]">
            <div className="cta-stars" />
            <div className="cta-stars cta-stars--2" />
          </div>
          <div className="relative z-10 flex flex-col justify-center mx-12 my-auto w-[310px] h-[219px] max-md:mx-0 max-md:my-0 max-md:h-auto max-md:w-full">
            <div
              className={`text-7xl font-extrabold leading-none text-white max-md:text-4xl ${bricolage.className}`}
            >
              <span className="font-extrabold text-[#701CC0]">$</span>
              <CountUp value="15M+" />
            </div>
            <div
              className={`mt-4 font-light leading-6 text-[#9BAFC3] text-left max-sm:text-sm max-sm:leading-5 ${inter.className}`}
            >
              contract-value profits generated for our clients.
            </div>
          </div>
        </motion.div>
      </div>
      <div className="flex gap-16 items-center max-md:flex-col max-md:gap-4">
        <motion.div
          variants={cardVar}
          whileHover={{ scale: 1.05 }}
          transition={{ type: "spring", stiffness: 300, damping: 22 }}
          className="px-10 py-10 w-[687px] h-[283px] bg-[#18042A] rounded-[60px] max-md:w-[300px] max-md:h-[250px] max-md:px-5 max-md:py-10 max-sm:w-[260px] max-sm:h-[200px] max-sm:px-8 max-sm:py-8 max-sm:rounded-[30px] overflow-hidden relative z-10"
        >
          <div className="absolute top-[2px] left-[50] w-[285px] h-[285px] opacity-80 blur-[50px] rotate-[60deg] rounded-full bg-gradient-to-t from-[#18042A] to-[#701CC0] -z-10 max-md:hidden" />
          {/* moving particle backdrop */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[60px] max-sm:rounded-[30px]">
            <div className="cta-stars" />
            <div className="cta-stars cta-stars--2" />
          </div>
          <div
            className={`relative z-10 text-5xl tracking-tight leading-none text-white max-md:text-2xl ${bricolage.className}`}
          >
            <h2 className="inline">Scale Your Business</h2>
          </div>
          <div className="relative z-10 w-full h-full">
            <svg
              className="absolute top-[3px] left-[150px] w-[494px] h-[192px] max-md:w-[217px] max-md:h-[84px] max-md:top-[86px] max-md:left-[63px] max-sm:w-[160px] max-sm:h-[100px] max-sm:top-[52px] max-sm:left-[68px]"
              viewBox="0 0 494 192"
              fill="none"
            >
              <motion.path
                d="M2 197.753C2 197.753 87.0628 51.3311 106.103 43.5771C125.143 35.8231 154.297 147.99 185.417 145.749C216.538 143.508 241.305 102.858 262.253 95.0195C283.201 87.181 305.148 155.589 340.328 171.701C375.509 187.813 405.98 27.1956 422.206 13.6668C444.378 -25.043 494 43.5771 494 43.5771"
                stroke="#701CC0"
                strokeWidth="3"
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0.4 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 2.8, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
              />
            </svg>
            <svg
              className="absolute top-[59px] left-[218px] w-[427px] h-[136px] max-md:w-[200px] max-md:h-[80px] max-md:top-[96px] max-md:left-[77px] max-sm:w-[160px] max-sm:h-[100px] max-sm:top-[59px] max-sm:left-[68px]"
              viewBox="0 0 427 136"
              fill="none"
            >
              <motion.path
                d="M2 138.739C2 138.739 18.2855 129.95 71.3182 86.8338C124.351 43.7175 126.821 2.09479 144.045 2.09479C161.27 2.09479 188.851 72.6125 214.5 72.6125C240.149 72.6125 244.843 28.2965 286.091 34.3125C327.339 40.3286 335.345 81.7308 355.409 93.1642C375.474 104.598 427 48.5492 427 48.5492"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0.4 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 3.4, delay: 0.3, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
              />
            </svg>
          </div>
        </motion.div>
        <motion.div
          variants={cardVar}
          whileHover={{ scale: 1.05 }}
          transition={{ type: "spring", stiffness: 300, damping: 22 }}
          className="relative flex flex-col w-[328px] h-[319px] bg-[#701CC0] rounded-[60px] md:mt-16 max-md:w-[300px] max-md:h-[300px] max-md:px-5 max-md:py-10 max-sm:w-[260px] max-sm:h-[250px] max-sm:px-8 max-sm:py-8 max-sm:rounded-[30px]"
        >
          <div className="flex flex-1 flex-col justify-center mx-12 mt-8 w-[250px] max-md:mx-4 max-md:mt-4 max-md:h-auto max-md:w-full max-sm:mx-2">
            <motion.div
              key={`num-${step}`}
              initial={{ opacity: 0, x: 28 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className={`text-7xl font-extrabold leading-none text-white max-md:text-4xl max-sm:text-3xl ${bricolage.className}`}
            >
              <CountUp value={currentContent.number} />
            </motion.div>
            <motion.div
              key={`txt-${step}`}
              initial={{ opacity: 0, x: 28 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
              className={`mt-6 text-base font-light leading-6 max-w-[210px] text-[#ECF2FDCC] max-md:mt-6 max-sm:mt-4 max-md:max-w-[180px] max-sm:max-w-[160px] max-sm:text-sm max-sm:leading-5 ${inter.className}`}
            >
              {currentContent.text}
            </motion.div>
          </div>
          {/* progress bar fills continuously across all three slides, then resets */}
          <div className="mx-12 mt-auto mb-8 max-md:mx-6 max-sm:mx-4 max-md:mb-6 max-sm:mb-4">
            <div className="h-1 w-full bg-[rgba(255,255,255,0.2)]">
              <motion.div
                key={`bar-${cycle}`}
                initial={{ width: "0%" }}
                animate={{ width: `${((contentIndex + 1) / total) * 100}%` }}
                transition={{ duration: 3, ease: "linear" }}
                className="h-1 bg-white"
              />
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}
