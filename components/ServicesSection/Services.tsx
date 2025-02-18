"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import Image from "next/image";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"] });
const figtree = Figtree({ subsets: ["latin"] });

interface Service {
  id: string;
  name: string;
  description: string; // Add this new field
}

const services: Service[] = [
  {
    id: "01",
    name: "Warm Outreach",
    description:
      "A stagnant business is worse than a dying one. We use warm outreach methods through our current connections to increase new leads flowing to your business.",
  },
  {
    id: "02",
    name: "Systems",
    description:
      "You're not getting new patients because you don't have systematic outreach. We build your foundational systems to pinpoint constraints in your growth and maximize organic lead generation.",
  },
  {
    id: "03",
    name: "Targeted Ads",
    description:
      "We align with the market's self-interests to push ads that reach an audience that wants your practice. Save money by spending on ad spend that helps you reach your desired audience.",
  },
  {
    id: "04",
    name: "Google Analytics",
    description:
      "Improve your business by making your data work for you. We use results-driven numbers to improve your lead generation and increase patient longevity.",
  },
];

const descriptionVariants = {
  initial: {
    opacity: 0,
    height: 0,
    y: -10,
  },
  animate: {
    opacity: 1,
    height: "auto",
    y: 0,
    transition: {
      duration: 0.3,
      ease: "easeOut",
    },
  },
  exit: {
    opacity: 0,
    height: 0,
    y: -10,
    transition: {
      duration: 0.2,
      ease: "easeIn",
    },
  },
};

export function Services() {
  // Change from single activeService to array of open services
  const [openServices, setOpenServices] = useState<string[]>([]);

  // New toggle function
  const toggleService = (serviceId: string) => {
    setOpenServices(
      (prev) =>
        prev.includes(serviceId)
          ? prev.filter((id) => id !== serviceId) // close if open
          : [...prev, serviceId] // open if closed
    );
  };

  return (
    <div
      className="w-full max-w-[1174px] px-4 md:px-6 lg:px-0 my-20"
      id="services"
    >
      {/* Main Card */}
      <div
        className={`relative w-full min-h-[773px] bg-[#18042A] rounded-[30px] md:rounded-tr-[60px] md:rounded-br-[60px] md:rounded-tl-[0px] md:rounded-bl-[0px] z-0 ${bricolage.className}`}
      >
        {/* 3D Object */}
        <div className="z-10 relative md:absolute md:right-[15%] md:top-1/3 md:-translate-y-[40%] md:translate-x-1/2 py-8 md:py-0">
          <div className="flex justify-center">
            <Image
              src="/assets/object.png"
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
          </div>
        </div>

        {/* Ellipse */}

        <motion.div
          initial={{ x: 0, y: 0 }}
          animate={{ x: [0, 15, 0], y: [0, 15, 0] }}
          transition={{
            duration: 5,
            repeat: Infinity,
            repeatType: "loop",
            ease: "easeInOut",
          }}
          className="hidden md:block absolute top-[165px] left-[415px] w-[540px] h-[540px] opacity-50 blur-[10px] rotate-[60deg] rounded-full bg-gradient-to-t from-[#18042A] to-[#701CC0] -z-10"
        />

        {/* Services List */}
        <div className="px-4 md:ml-40 md:mr-20 py-8 md:py-20">
          {services.map((service) => {
            const isOpen = openServices.includes(service.id);

            return (
              <div key={service.id}>
                <motion.div
                  onClick={() => toggleService(service.id)}
                  className={`flex items-center cursor-pointer
                    border-b py-8 group
                    ${isOpen ? "border-[#701CC0]" : "border-[#A4A4A4]/20"}`}
                  animate={{
                    borderColor: isOpen
                      ? "#701CC0"
                      : "rgba(164, 164, 164, 0.2)",
                  }}
                  whileHover={{
                    borderColor: isOpen ? "#701CC0" : "#FFFFFF",
                  }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Service Number */}
                  <div
                    className={`flex items-center justify-center h-[40px] md:h-[52px] w-[56px] md:w-[70px] rounded-full transition-all duration-300
                      ${
                        isOpen
                          ? "bg-[#701CC0]" // Active state
                          : "bg-transparent border-[1.5px] border-white/40 group-hover:border-white" // Inactive & hover state
                      }`}
                  >
                    <span
                      className={`text-lg md:text-[24px] font-light transition-opacity duration-300
                        ${
                          isOpen
                            ? "text-white" // Active state
                            : "text-white/40 group-hover:text-white" // Inactive & hover state
                        }
                      `}
                    >
                      {service.id}
                    </span>
                  </div>

                  {/* Service Name */}
                  <span
                    className={`ml-4 md:ml-6 max-md:text-2xl md:text-[48px] transition-all duration-300
                      ${
                        isOpen
                          ? "text-white font-normal" // Active state
                          : "text-white/40 font-light group-hover:text-white" // Inactive & hover state
                      }
                    `}
                  >
                    {service.name}
                  </span>
                </motion.div>

                {/* Description Text - Animated */}
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      variants={descriptionVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      className="text-white/80 text-lg overflow-hidden"
                    >
                      <div
                        className={`${figtree.className} mt-4 mb-6 max-w-[580px]`}
                      >
                        {service.description}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
