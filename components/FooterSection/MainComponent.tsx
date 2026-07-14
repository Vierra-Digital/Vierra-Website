import React, { useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Bricolage_Grotesque, Inter, Figtree } from "next/font/google";
import { ArrowUpRight } from "lucide-react";
import CheckItem from "./CheckItem";
import Footer from "./Footer";
import { Modal } from "@/components/Modal";
import { track } from "@/lib/track";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"] });
const inter = Inter({ subsets: ["latin"] });
const figtree = Figtree({ subsets: ["latin"] });

const checks = ["Discovery & Bottlenecks", "LTV Evaluation", "Fill Sales Calendar"];

export function FooterSection() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Cursor-interactive 3D logo (happystack-style): the V shifts/glides toward
  // the pointer as it moves over the panel, eased with a spring.
  const pointerX = useMotionValue(0.5);
  const pointerY = useMotionValue(0.5);
  const springCfg = { stiffness: 70, damping: 20, mass: 0.9 };
  const vMoveX = useSpring(useTransform(pointerX, [0, 1], [-55, 55]), springCfg);
  const vMoveY = useSpring(useTransform(pointerY, [0, 1], [-44, 44]), springCfg);
  const handlePointerMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const cx = (e.clientX - r.left) / r.width;
    const cy = (e.clientY - r.top) / r.height;
    // Only react when the cursor is actually over the V (its bottom-right corner);
    // anywhere else leaves it parked at center.
    if (cx > 0.45 && cx < 0.74 && cy > 0.55) {
      pointerX.set((cx - 0.45) / 0.29);
      pointerY.set((cy - 0.55) / 0.45);
    } else {
      pointerX.set(0.5);
      pointerY.set(0.5);
    }
  };
  const resetPointer = () => {
    pointerX.set(0.5);
    pointerY.set(0.5);
  };

  return (
    <>
      <div className="relative overflow-hidden bg-[#18042A]">
        {/* Concentric rings spanning the CTA box + footer together (desktop) */}
        <div aria-hidden className="pointer-events-none absolute inset-0 z-0 hidden md:block">
          {[925, 1185, 1434].map((size, i) => (
            <div
              key={i}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.58px] border-[#701CC04D]"
              style={{ width: size, height: size }}
            />
          ))}
        </div>
      <div className="relative z-20 mx-auto max-sm:my-6 max-w-full md:px-32 max-sm:py-10 md:pb-32 pointer-events-none">
        <div
          onMouseMove={handlePointerMove}
          onMouseLeave={resetPointer}
          className="flex gap-5 md:gap-0 max-md:flex-col rounded-[60px] relative z-10 overflow-hidden bg-[radial-gradient(125%_125%_at_25%_15%,#34125F_0%,#1C0838_55%,#120426_100%)] pointer-events-auto"
        >
          {/* Dark "space" backdrop: a continuously drifting starfield + a floating
              3D logo over the left two-thirds (happystack-style). */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 z-0 hidden w-[69%] overflow-hidden md:block [perspective:900px]"
          >
            <div className="cta-stars" />
            <div className="cta-stars cta-stars--2" />
            <motion.div className="absolute bottom-[4%] right-[1%]" style={{ x: vMoveX, y: vMoveY }}>
              <motion.div
                animate={{ y: [0, -12, 0] }}
                transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/assets/vierra-v-3d.svg"
                  alt=""
                  draggable={false}
                  className="w-[230px] lg:w-[320px] h-auto select-none drop-shadow-[0_16px_30px_rgba(0,0,0,0.5)]"
                />
              </motion.div>
            </motion.div>
          </div>
          <div className="relative z-10 flex flex-col w-[69%] max-md:w-full px-20 max-md:px-8 max-sm:px-5">
            <div className="flex flex-col items-start mt-20 max-md:mt-10 max-sm:text-center">
              <div className={`${bricolage.className} text-5xl font-semibold tracking-wide text-white leading-[68px] max-md:text-4xl max-md:leading-[54px] max-sm:text-3xl max-sm:leading-10`}>
                Want To{" "}
                <span
                  className="bg-clip-text text-transparent bg-[length:200%_auto]"
                  style={{
                    // Bold flowing purple gradient (violet -> fuchsia -> light
                    // pink -> purple). The bright fuchsia/pink keep it popping on
                    // the dark-purple panel even though it's on-brand.
                    backgroundImage:
                      "linear-gradient(90deg, #8B5CF6, #D946EF 25%, #F0ABFC 50%, #A855F7 75%, #8B5CF6)",
                    animation: "vierra-bold-flow 4s linear infinite",
                  }}
                >
                  Explode
                </span>{" "}
                Profits?
              </div>
              <div className={`${bricolage.className} mt-14 text-3xl font-light tracking-wide leading-none text-white opacity-80 max-md:text-2xl max-sm:text-xl`}>
                Claim your free evaluation call. Discover how you can elevate your business and double your MRR.
              </div>
              <div className={`flex gap-5 mt-12 max-sm:flex-col max-sm:mx-auto ${inter.className}`}>
                <button
                  className="group flex items-center justify-center gap-2 px-8 py-4 text-sm font-bold tracking-wide text-[#3B0A66] bg-white rounded-lg shadow-[0_6px_18px_-8px_rgba(0,0,0,0.3)] transition-transform duration-300 ease-out hover:-translate-y-0.5 max-sm:w-full"
                  onClick={() => { track("cta_click", { location: "footer" }); setIsModalOpen(true); }}
                >
                  Let&apos;s Talk
                  <ArrowUpRight className="w-5 h-5 arrow-bob" />
                </button>
              </div>
            </div>
          </div>
          <div className="relative z-10 flex flex-col w-[31%] max-md:w-full">
            <div className="px-16 py-20 h-full md:rounded-r-[60px] max-sm:rounded-b-[60px] bg-[#510B9463] max-md:px-8 max-md:py-10 max-md:mt-10">
              <div className={`${bricolage.className} text-5xl font-bold tracking-tighter leading-tight text-white`}>+$25,000</div>
              <div className={`${inter.className} mt-2 text-lg font-light tracking-normal leading-7 text-white text-opacity-80`}>
                On average, claim $25,000 of free client LTV per month from closed leads.
              </div>
              <div className="mt-10">
                <div className={`${bricolage.className} text-5xl font-medium tracking-tighter leading-tight text-white`}>+150 Waitlisted</div>
                <div className={`${inter.className} mt-2 text-lg font-light tracking-normal leading-7 text-white text-opacity-80`}>
                  Focus drives results. If we work together, you get our full attention.
                </div>
              </div>
              <div className={`${figtree.className} mt-10`}>
                {checks.map((text, index) => (
                  <CheckItem key={index} text={text} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
        <div className="relative z-10 -mt-52">
          <Footer bare />
        </div>
      </div>
      {isModalOpen && <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />}
    </>
  );
}
