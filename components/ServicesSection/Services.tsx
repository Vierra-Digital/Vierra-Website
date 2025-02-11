"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bricolage_Grotesque } from "next/font/google";
import { SectionTitle } from "../SectionTitle";
import Image from "next/image";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"] });

interface Service {
  id: string;
  name: string;
  image: string;
}

const services: Service[] = [
  { id: "01", name: "Marketing", image: "/assets/Objects/object1.png" },
  { id: "02", name: "Startups", image: "/assets/Objects/object2.png" },
  { id: "03", name: "Healthcare", image: "/assets/Objects/object3.png" },
  { id: "04", name: "Enterprise", image: "/assets/Objects/object4.png" },
];

const morphVariants = {
  initial: {
    opacity: 0,
    scale: 0.8,
    rotate: -180,
    filter: "brightness(0.5) blur(10px)",
  },
  animate: {
    opacity: 1,
    scale: 1,
    rotate: 0,
    filter: "brightness(1) blur(0px)",
    transition: {
      duration: 0.6,
      ease: "easeInOut",
    },
  },
  exit: {
    opacity: 0,
    scale: 0.8,
    rotate: 180,
    filter: "brightness(1.5) blur(20px)",
    transition: {
      duration: 0.4,
      ease: "easeOut",
    },
  },
};

export function Services() {
  const [activeService, setActiveService] = useState("02");

  return (
    <div className="w-full max-w-[1174px] px-4 md:px-6 lg:px-0" id="services">
      <SectionTitle title="Services" />

      {/* Main Card */}
      <div
        className={`relative w-full h-auto md:h-[773px] bg-[#18042A] rounded-[30px] md:rounded-tr-[60px] md:rounded-br-[60px] md:rounded-tl-[0px] md:rounded-bl-[0px] z-0 ${bricolage.className}`}
      >
        {/* Enhanced 3D Object Animation */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeService}
            className="z-10 relative md:absolute md:right-[15%] md:top-1/3 md:-translate-y-[40%] md:translate-x-1/2 py-8 md:py-0"
          >
            {/* Main Image with Effects */}
            <motion.div
              variants={morphVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="flex justify-center"
            >
              <Image
                src={
                  services.find((service) => service.id === activeService)
                    ?.image || ""
                }
                alt="3D Object"
                priority
                quality={100}
                width={727}
                height={727}
                className="object-contain relative z-10 max-sm:w-[80%] max-md:w-full max-w-[727px]"
                style={{
                  filter: "drop-shadow(0px 20px 20px rgba(112, 28, 192, 0.3))",
                }}
              />
            </motion.div>
          </motion.div>
        </AnimatePresence>

        {/* Ellipse */}
        <div className="hidden md:block absolute top-[165px] left-[415px] w-[540px] h-[540px] opacity-50 blur-[10px] rotate-[60deg] rounded-full bg-gradient-to-t from-[#18042A] to-[#701CC0] -z-10" />

        {/* Services List */}
        <div className="px-4 md:ml-40 md:mr-20 py-8 md:py-20">
          {services.map((service) => {
            const isActive = service.id === activeService;

            return (
              <div
                key={service.id}
                onClick={() => setActiveService(service.id)}
                className={`flex items-center cursor-pointer transition-opacity duration-300 
                  border-b py-8 ${
                    isActive
                      ? "border-[#701CC0] opacity-100"
                      : "border-[#A4A4A433] hover:opacity-60"
                  }
                `}
              >
                {/* Service Number */}
                <div
                  className={`flex items-center justify-center h-[40px] md:h-[52px] rounded-full
                    ${
                      isActive
                        ? "w-[56px] md:w-[70px] ml-2 md:ml-4 bg-[#701CC0] opacity-100"
                        : "w-[50px] md:w-[63px] bg-transparent opacity-40 border-[1.5px] border-[#E4E4E4]"
                    }`}
                >
                  <span className="text-lg md:text-[24px] text-white font-light">
                    {service.id}
                  </span>
                </div>

                {/* Service Name */}
                <span
                  className={`ml-4 md:ml-6 max-md:text-2xl md:text-[48px] ${
                    isActive
                      ? "font-normal text-white"
                      : "font-light text-[#FFFFFF66]"
                  }`}
                >
                  {service.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
