"use client"
import React from "react"
import { bricolage, inter } from "@/lib/fonts";
import { motion } from "framer-motion"
import Link from "next/link"
import { Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Header } from "@/components/Header"
import { FooterSection } from "@/components/FooterSection/MainComponent"


export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#18042A] text-white relative overflow-hidden flex flex-col">
      {/* Hide the main page scrollbar (scrolling still works) */}
      <style jsx global>{`
        html { scroll-behavior: smooth; scrollbar-width: none !important; -ms-overflow-style: none !important; }
        html::-webkit-scrollbar { width: 0 !important; height: 0 !important; display: none !important; }
      `}</style>

      {/* Animated gradient blobs — same format as the rest of the site */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute -top-28 left-[6%] h-[440px] w-[440px] rounded-full bg-gradient-to-l from-[#701CC0] to-[#18042A] opacity-70 blur-[70px]"
          animate={{ x: [0, 70, -30, 0], y: [0, 40, 80, 0], scale: [1, 1.12, 0.94, 1] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-44 right-[2%] h-[480px] w-[480px] rounded-full bg-gradient-to-l from-[#701CC0] to-[#18042A] opacity-60 blur-[80px]"
          animate={{ x: [0, -60, 25, 0], y: [0, -35, -70, 0], scale: [1, 0.93, 1.12, 1] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="relative z-20">
        <Header />
      </div>

      <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-20 text-center">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: {
              opacity: 1,
              y: 0,
              transition: { staggerChildren: 0.15, ease: "easeOut" },
            },
          }}
          className="w-full"
        >
          <motion.span
            variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
            className="block text-[11px] font-semibold uppercase tracking-[0.35em] text-[#C99DFF]"
          >
            Page Not Found
          </motion.span>

          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="mt-3 mb-2"
          >
            <h1 className={`text-9xl font-bold leading-none md:text-[12rem] ${bricolage.className}`}>
              <span
                className="inline-block bg-gradient-to-r from-[#8F42FF] via-[#D4A5FF] to-[#8F42FF] bg-clip-text text-transparent"
                style={{
                  backgroundSize: "200% auto",
                  animation: "gradient-horizontal 3s ease infinite",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                404
              </span>
            </h1>
          </motion.div>

          <motion.p
            variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
            className={`mx-auto mt-5 max-w-xl text-base text-white/70 md:text-lg ${inter.className}`}
          >
            The page you&apos;re looking for doesn&apos;t exist or has been moved. Let&apos;s get you back on track.
          </motion.p>

          <motion.div
            variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
            className={`mt-10 flex items-center justify-center ${inter.className}`}
          >
            <Button
              variant="secondary"
              className="flex items-center gap-2 rounded-lg bg-[#701CC0] px-8 py-6 text-white shadow-[0px_4px_15.9px_0px_#701CC0B8] transition-all duration-300 hover:bg-[#8F42FF] hover:shadow-[0_12px_30px_-8px_rgba(112,28,192,0.7)]"
              asChild
            >
              <Link href="/">
                <Home className="h-5 w-5" />
                Go Home
              </Link>
            </Button>
          </motion.div>
        </motion.div>
      </main>

      <div className="relative z-10">
        <FooterSection />
      </div>
    </div>
  )
}
