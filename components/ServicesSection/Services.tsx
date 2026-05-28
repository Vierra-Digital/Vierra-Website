"use client"
import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Bricolage_Grotesque, Figtree } from "next/font/google"
import { ServiceIconDisplay } from "./ServiceIconDisplay"

const bricolage = Bricolage_Grotesque({ subsets: ["latin"] })
const figtree = Figtree({ subsets: ["latin"] })

interface Service {
  id: string
  name: string
  description: string
}

const services: Service[] = [
  {
    id: "01",
    name: "Warm Outreach",
    description:
      "A stagnant business is worse than a dying one. We use warm outreach methods through our connections to drive new leads flowing to your business.",
  },
  {
    id: "02",
    name: "Systems",
    description:
      "You're not getting new clients because you don't have systematic outreach. We build your foundational systems to pinpoint constraints in your growth and maximize organic lead generation.",
  },
  {
    id: "03",
    name: "Targeted Ads",
    description:
      "We use the changing market's trends to push ads that reach an audience that wants your service. Save money by spending on premium ad spend that helps reach your desired audience.",
  },
  {
    id: "04",
    name: "Google Analytics",
    description:
      "Improve your business by making your data work for you. We use results-driven numbers to improve lead generation and increase client longevity.",
  },
]

const descriptionVariants = {
  initial: { opacity: 0, height: 0, y: -10 },
  animate: {
    opacity: 1,
    height: "auto",
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    height: 0,
    y: -10,
    transition: { duration: 0.2, ease: "easeIn" },
  },
}

const ServiceItem = React.memo(function ServiceItem({
  service,
  isOpen,
  toggleService,
}: {
  service: Service
  isOpen: boolean
  toggleService: (id: string) => void
}) {
  return (
    <div>
      <motion.div
        onClick={() => toggleService(service.id)}
        className={`flex items-center cursor-pointer border-b py-6 md:py-8 group ${
          isOpen ? "border-[#701CC0]" : "border-[#A4A4A4]/20"
        }`}
        animate={{
          borderColor: isOpen ? "#701CC0" : "rgba(164, 164, 164, 0.2)",
        }}
        whileHover={{
          borderColor: isOpen ? "#701CC0" : "#FFFFFF",
        }}
        transition={{ duration: 0.3 }}
      >
        <div
          className={`flex items-center justify-center h-[40px] md:h-[52px] w-[56px] md:w-[70px] rounded-full transition-all duration-300 ${
            isOpen
              ? "bg-[#701CC0]"
              : "bg-transparent border-[1.5px] border-white/40 group-hover:border-white"
          }`}
        >
          <span
            className={`text-lg md:text-[24px] font-light transition-opacity duration-300 ${
              isOpen ? "text-white" : "text-white/40 group-hover:text-white"
            }`}
          >
            {service.id}
          </span>
        </div>
        <span
          className={`ml-4 md:ml-6 max-md:text-xl md:text-[48px] transition-all duration-300 ${
            isOpen
              ? "text-white font-normal"
              : "text-white/40 font-light group-hover:text-white"
          }`}
        >
          {service.name}
        </span>
      </motion.div>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            variants={descriptionVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="text-white/80 text-base md:text-lg overflow-hidden"
          >
            <div className={`${figtree.className} mt-4 mb-6 max-w-[580px]`}>
              {service.description}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
})

export function Services() {
  const [openServiceId, setOpenServiceId] = useState<string | null>(services[0].id)

  useEffect(() => {
    const timer = setInterval(() => {
      setOpenServiceId((prevId) => {
        const currentIndex = services.findIndex((s) => s.id === prevId)
        return services[(currentIndex + 1) % services.length].id
      })
    }, 5000)
    return () => clearInterval(timer)
  }, [])

  const toggleService = (serviceId: string) => {
    setOpenServiceId(openServiceId === serviceId ? null : serviceId)
  }

  return (
    <div className="w-full my-20" id="services">
      {/* Narrow screens: card only, no icon */}
      <div
        className={`block lg:hidden relative w-full min-h-[600px] bg-[#18042A]
          rounded-[30px] md:rounded-tr-[60px] md:rounded-br-[60px]
          md:rounded-tl-none md:rounded-bl-none z-0 mx-4 md:mx-0 ${bricolage.className}`}
      >
        <div className="px-6 md:px-12 xl:px-20 py-12 md:py-20">
          {services.map((service) => (
            <ServiceItem
              key={service.id}
              service={service}
              isOpen={openServiceId === service.id}
              toggleService={toggleService}
            />
          ))}
        </div>
      </div>

      {/* Wide screens: equal two-column grid, card left, icon right */}
      <div className="hidden lg:grid lg:grid-cols-2 items-stretch">
        {/* Card — left column */}
        <div
          className={`relative min-h-[773px] bg-[#18042A]
            rounded-tr-[60px] rounded-br-[60px] rounded-tl-none rounded-bl-none
            z-0 ${bricolage.className}`}
        >
          <div className="px-12 xl:px-20 py-20">
            {services.map((service) => (
              <ServiceItem
                key={service.id}
                service={service}
                isOpen={openServiceId === service.id}
                toggleService={toggleService}
              />
            ))}
          </div>
        </div>

        {/* Icon — right column, centered */}
        <div className="flex items-center justify-center">
          <ServiceIconDisplay selectedId={openServiceId} size="lg" />
        </div>
      </div>
    </div>
  )
}
