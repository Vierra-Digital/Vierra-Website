"use client"
import React from "react"
import { Bricolage_Grotesque, Inter } from "next/font/google"
import { motion } from "framer-motion"
import Link from "next/link"
import { Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Header } from "@/components/Header"
import { FooterSection } from "@/components/FooterSection/MainComponent"

const bricolage = Bricolage_Grotesque({ subsets: ["latin"] })
const inter = Inter({ subsets: ["latin"] })

export default function Custom404() {
  return (
    <div className="min-h-screen bg-[#18042A] text-white relative overflow-hidden">
      
      <motion.div
        initial={{ x: 0, y: 0 }}
        animate={{ x: [0, 10, 0], y: [0, 10, 0] }}
        transition={{
          duration: 5,
          repeat: Infinity,
          repeatType: "loop",
          ease: "easeInOut",
        }}
        className="fixed top-[7%] left-[10%] w-[470px] h-[470px] max-w-[475px] max-h-[475px] opacity-80 blur-[20px] rotate-[60deg] rounded-full bg-gradient-to-l from-[#701CC0] to-[#18042A] -z-10 pointer-events-none"
      />
      <motion.div
        initial={{ x: 0, y: 0 }}
        animate={{ x: [0, 10, 0], y: [0, 10, 0] }}
        transition={{
          duration: 5,
          repeat: Infinity,
          repeatType: "loop",
          ease: "easeInOut",
        }}
        className="fixed -bottom-[32%] -right-[3%] w-[545px] h-[545px] max-w-[550px] max-h-[550px] opacity-80 blur-[20px] rotate-[60deg] rounded-full bg-gradient-to-l from-[#701CC0] to-[#18042A] -z-10 pointer-events-none"
      />

      
      {Array.from({ length: 7 }).map((_, index) => (
        <motion.div
          key={index}
          className="fixed top-0 h-full border-l border-white opacity-5 -z-10 pointer-events-none"
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

      <Header />

      <main className="relative px-6 max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[calc(100vh-200px)] py-20">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: {
              opacity: 1,
              y: 0,
              transition: { staggerChildren: 0.2, ease: "easeOut" },
            },
          }}
          className="text-center max-w-3xl"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="mb-8"
          >
            <h1
              className={`text-9xl md:text-[12rem] font-bold leading-none mb-4 ${bricolage.className}`}
            >
              <span
                className="inline-block bg-gradient-to-r from-[#8F42FF] via-[#B366FF] via-[#D4A5FF] via-[#B366FF] to-[#8F42FF] bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient"
                style={{
                  backgroundSize: "200% auto",
                  animation: "gradient-horizontal 3s ease infinite",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  filter: "brightness(1.2)",
                }}
              >
                404
              </span>
            </h1>
          </motion.div>

          <motion.h2
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0 },
            }}
            className={`text-4xl md:text-5xl font-bold leading-tight mb-6 text-[#EFF3FF] ${bricolage.className}`}
          >
            Page Not Found
          </motion.h2>

          <motion.p
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0 },
            }}
            className={`text-[#9BAFC3] text-lg md:text-xl mb-10 max-w-2xl mx-auto ${inter.className}`}
          >
            The page you&apos;re looking for doesn&apos;t exist or has been moved. 
            Let&apos;s get you back on track.
          </motion.p>

          <motion.div
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0 },
            }}
            className={`flex items-center justify-center ${inter.className}`}
          >
            <Button
              variant="secondary"
              className="flex items-center gap-2 bg-[#701CC0] hover:bg-[#8F42FF] text-white rounded-full px-8 py-7 shadow-[0px_4px_15.9px_0px_#701CC0B8] transform transition-transform duration-300 hover:scale-105"
              asChild
            >
              <Link href="/">
                <Home className="w-5 h-5" />
                Go Home
              </Link>
            </Button>
          </motion.div>
        </motion.div>
      </main>

      <FooterSection />
    </div>
  )
}

