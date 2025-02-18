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
        {[178, 358, 538, 718, 898, 1078, 1258].map((left, index) => (
          <motion.div
            key={index}
            className="absolute top-0 h-full border-l border-white opacity-5"
            style={{ left: `${left}px` }}
            initial={{ height: 0, opacity: 0 }}
            animate={{
              height: "100%",
              opacity: 0.05,
              x: [0, 10, 0], // Subtle horizontal movement
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

        {/* Ellipse Purple gradient effects */}
        <motion.div
          initial={{ x: 0, y: 0 }}
          animate={{ x: [0, 10, 0], y: [0, 10, 0] }}
          transition={{
            duration: 5,
            repeat: Infinity,
            repeatType: "loop",
            ease: "easeInOut",
          }}
          className="absolute top-[157px] left-[200px] w-[470px] h-[470px] opacity-80 blur-[20px] rotate-[60deg] rounded-full bg-gradient-to-t from-[#18042A] to-[#701CC0] -z-10"
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
          className="absolute bottom-[0px] right-[20px] w-[549px] h-[549px] opacity-80 blur-[20px] rotate-[60deg] rounded-full bg-gradient-to-t from-[#18042A] to-[#701CC0] -z-10"
        />

        {/* Header */}
        <Header />

        {/* Hero Section */}
        <main className="relative z-10 px-6 max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10">
          <div className="max-w-2xl">
            <h1
              className={`text-5xl md:text-6xl font-bold leading-tight mb-6 text-[#EFF3FF] ${bricolage.className}`}
            >
              Generate More Leads For Your Business
            </h1>
            <p className={`text-[#9BAFC3] text-lg mb-10 ${inter.className}`}>
              Scale your practice effortlessly. Fill out your schedules and
              eliminate no-shows.
            </p>
            <div
              className={`flex flex-col sm:flex-row items-center gap-4 ${inter.className}`}
            >
              <Button
                variant="secondary"
                className="flex items-center gap-2 bg-[#701CC0] hover:bg-[#8F42FF] text-white rounded-full px-8 py-7 shadow-[0px_4px_15.9px_0px_#701CC0B8]"
              >
                Free Audit Call
                <ArrowUpRight className="w-4 h-4" />
              </Button>
              <Button
                variant="link"
                className="text-white text-[16px] underline hover:text-[#8F42FF] pl-2"
              >
                What We Do
              </Button>
            </div>
          </div>
          <div className="flex-shrink-0">
            <Image
              src="/assets/image1.png"
              alt="Vierra"
              width={750}
              height={685}
              priority
              quality={100}
            />
          </div>
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
