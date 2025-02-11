"use client";
import { useState } from "react";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { StatsGrid } from "./StatsGrid";
import { motion, AnimatePresence } from "framer-motion";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"] });
const inter = Inter({ subsets: ["latin"] });

interface TabItem {
  id: string;
  title: string;
  content: string;
}

const tabs: TabItem[] = [
  {
    id: "streamline",
    title: "Streamline operations",
    content:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt",
  },
  {
    id: "efficiency",
    title: "Increasing efficiency",
    content:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt",
  },
  {
    id: "costs",
    title: "Reduce costs",
    content:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt",
  },
  {
    id: "insights",
    title: "Data insights",
    content:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt",
  },
];

export function BusinessSolutions() {
  const [activeTab, setActiveTab] = useState("efficiency");

  return (
    <section className="w-full py-20 px-6 bg-white" id="solutions">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-12 mb-16">
          <h2
            className={`text-3xl font-bold text-[#18042A] mb-4 ${bricolage.className}`}
          >
            We offer real-time solution tools for your entire business
          </h2>
          <p className={`text-[#8A9197] text-lg ${inter.className}`}>
            Our comprehensive tools offers small business owners a one-stop-shop
            solution to manage their accounting, sales, marketing, admission
            efforts, CRM, financial models, email campaigns, QuickBooks
            integration, record-keeping, and a range of other crucial business
            functions.
          </p>
        </div>

        {/* Tabs and Image Section */}
        <div className="grid md:grid-cols-2 gap-12 mb-20 place-items-center">
          <div className="space-y-6 relative">
            {tabs.map((tab) => (
              <motion.div
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`block text-left w-full cursor-pointer ${bricolage.className}`}
                initial={false}
              >
                <motion.h3
                  className={`text-5xl mb-6 relative inline-block`}
                  animate={{
                    color: activeTab === tab.id ? "#701CC0" : "#929C9A",
                  }}
                  transition={{
                    duration: 0.5,
                    ease: [0.32, 0.72, 0, 1],
                  }}
                >
                  {tab.title}
                  {activeTab === tab.id && (
                    <>
                      <motion.div
                        className="absolute -inset-x-4 inset-y-0 bg-[#701CC0]/5 rounded-lg -z-10"
                        layoutId="background"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
                      />
                      <motion.div
                        className="absolute bottom-[-12px] left-0 w-full h-[2px]"
                        layoutId="underline"
                        transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
                        style={{
                          background:
                            "linear-gradient(to right, #701CC0 0%, #701CC0 60%, #D9DEDD 60%, #D9DEDD 100%)",
                        }}
                      />
                    </>
                  )}
                </motion.h3>

                <AnimatePresence mode="wait">
                  {activeTab === tab.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{
                        opacity: 1,
                        height: "auto",
                        transition: {
                          height: {
                            duration: 0.4,
                            ease: [0.32, 0.72, 0, 1],
                          },
                          opacity: {
                            duration: 0.25,
                            delay: 0.15,
                          },
                        },
                      }}
                      exit={{
                        opacity: 0,
                        height: 0,
                        transition: {
                          height: {
                            duration: 0.4,
                            ease: [0.32, 0.72, 0, 1],
                          },
                          opacity: {
                            duration: 0.25,
                          },
                        },
                      }}
                    >
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.15 }}
                      >
                        <p className="text-[#646A69] text-[18px] mb-2">
                          {tab.content}
                        </p>
                        <Button
                          variant="link"
                          className="text-[#022C22] text-[18px] hover:text-[#701CC0] p-0"
                        >
                          Learn more
                        </Button>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>

          <div className="relative mx-auto">
            <div className="absolute inset-0 ml-10 md:bg-[#701CC0] translate-y-10 translate-x-8 opacity-40 blur-[80px]" />
            <div className="relative overflow-hidden rounded-[60px]">
              <Image
                src="/assets/client1.jpeg"
                alt="Woman working on laptop"
                width={386}
                height={580}
                quality={100}
                priority
                className="w-[386px] h-[580px] object-cover rounded-[60px]"
              />
            </div>
          </div>
        </div>

        <div className="mt-24">
          <StatsGrid />
        </div>
      </div>
    </section>
  );
}
