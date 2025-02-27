/*
 * © 2025 Darsh Doshi. All rights reserved.
 * Unauthorized use, modification, or distribution of this code is strictly prohibited.
 */

"use client";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { BusinessSolutions } from "@/components/BusinessSection/BusinessSolutions";
import Main from "@/components/ServicesSection/Main";
import TestimonialsSection from "@/components/TestimonialSection/Testimonials";
import TeamSection from "@/components/TeamSection/Team";
import { FooterSection } from "@/components/FooterSection/MainComponent";
const bricolage = Bricolage_Grotesque({ subsets: ["latin"] });
const inter = Inter({ subsets: ["latin"] });

export default function Home() {
  return (
    <>
      <div className="min-h-screen bg-[#18042A] text-white relative overflow-hidden z-0">
        {/* Vertical Lines */}
        {Array.from({ length: 7 }).map((_, index) => (
          <motion.div
            key={index}
            className="absolute top-0 h-full border-l border-white opacity-5 -z-10"
            style={{ left: `${(index + 1) * (100 / 8)}%` }}
            initial={{ height: 0, opacity: 0 }}
            animate={{
              height: "100%",
              opacity: 0.05,
              x: [0, 10, 0],
            }}
            transition={{
              duration: 3,
              delay: index * 0.2,
              ease: "easeInOut",
              x: {
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
              },
            }}
          />
        ))}

        {/* Header */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0, y: -20 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
          }}
        >
          <Header />
        </motion.div>

        {/* Hero Section */}
        <main className="relative px-6 max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10">
          {/* Ellipses */}
          <motion.div
            initial={{ x: 0, y: 0 }}
            animate={{ x: [0, 10, 0], y: [0, 10, 0] }}
            transition={{
              duration: 5,
              repeat: Infinity,
              repeatType: "loop",
              ease: "easeInOut",
            }}
            className="absolute top-[7%] left-[10%] w-[470px] h-[470px] max-w-[475px] max-h-[475px] opacity-80 blur-[20px] rotate-[60deg] rounded-full bg-gradient-to-l from-[#701CC0] to-[#18042A] -z-20"
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
            className="absolute -bottom-[32%] -right-[3%] w-[545px] h-[545px] max-w-[550px] max-h-[550px] opacity-80 blur-[20px] rotate-[60deg] rounded-full bg-gradient-to-l from-[#701CC0] to-[#18042A] -z-20"
          />

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
            className="max-w-2xl"
          >
            <motion.h1
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 },
              }}
              className={`text-5xl md:text-6xl font-bold leading-tight mb-6 text-[#EFF3FF] ${bricolage.className}`}
            >
              Generate More Leads For Your Business
            </motion.h1>

            <motion.p
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 },
              }}
              className={`text-[#9BAFC3] text-lg mb-10 ${inter.className}`}
            >
              Scale your practice effortlessly. Fill out your schedules and
              eliminate no-shows.
            </motion.p>

            <motion.div
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 },
              }}
              className={`flex flex-col sm:flex-row items-center gap-4 ${inter.className}`}
            >
              <Button
                variant="secondary"
                className="flex items-center gap-2 bg-[#701CC0] hover:bg-[#8F42FF] text-white rounded-full px-8 py-7 shadow-[0px_4px_15.9px_0px_#701CC0B8] transform transition-transform duration-300 hover:scale-105"
              >
                Free Audit Call
                <ArrowUpRight className="w-4 h-4" />
              </Button>
              <Button
                variant="link"
                className="text-white text-[16px] relative group hover:text-[#8F42FF] pl-2"
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
            <motion.div
              initial={{ y: 0 }}
              animate={{ y: [0, -10, 0] }}
              transition={{
                duration: 2,
                repeat: Infinity,
                repeatType: "loop",
                ease: "easeInOut",
              }}
            >
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

        {/* Partners Section */}
        <section className="w-full py-16">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-col md:flex-row items-center gap-12">
              <h2
                className={`text-white text-xl font-medium whitespace-nowrap ${bricolage.className}`}
              >
                Trusted By Our Partners
              </h2>
              <div className="flex flex-wrap md:flex-nowrap justify-center items-center gap-12 md:gap-24 w-full">
                <Image
                  src="/assets/Partners/Isenberg.png"
                  alt="Partner Logo"
                  width={112}
                  height={24}
                />
                <Image
                  src="/assets/Partners/Athena.png"
                  alt="Partner Logo"
                  width={175}
                  height={24}
                />
                <Image
                  src="/assets/Partners/Harvard.png"
                  alt="Partner Logo"
                  width={109}
                  height={32}
                />
                <Image
                  src="/assets/Partners/NationalAcademy.png"
                  alt="Partner Logo"
                  width={123}
                  height={48}
                />
              </div>
            </div>
          </div>
        </section>
      </div>
      <BusinessSolutions />
      <Main />
      <TestimonialsSection />
      <TeamSection />
      <FooterSection />
    </>
  );
}
