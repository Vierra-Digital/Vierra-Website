"use client"
import { motion, AnimatePresence } from "framer-motion"
import { Handshake, Network, Megaphone, BarChart3, type LucideProps } from "lucide-react"
import { ElementType } from "react"

const serviceConfig: Record<string, ElementType<LucideProps>> = {
  "01": Handshake,
  "02": Network,
  "03": Megaphone,
  "04": BarChart3,
}

interface Props {
  selectedId: string | null
  size?: "sm" | "lg"
}

export function ServiceIconDisplay({ selectedId, size = "lg" }: Props) {
  const activeId = selectedId ?? "01"
  const Icon = serviceConfig[activeId] ?? serviceConfig["01"]

  const dim = size === "lg" ? "w-[340px] h-[340px]" : "w-[240px] h-[240px]"
  const iconDim = size === "lg" ? "w-24 h-24" : "w-16 h-16"
  const circleDim = size === "lg" ? "w-52 h-52" : "w-36 h-36"

  return (
    <div className={`relative flex items-center justify-center ${dim}`}>
      {/* Outermost pulse ring */}
      <motion.div
        key={`pulse-${activeId}`}
        className="absolute inset-0 rounded-full border border-[#701CC0]/25"
        animate={{ scale: [1, 1.3], opacity: [0.5, 0] }}
        transition={{
          duration: 2.5,
          repeat: Infinity,
          ease: "easeOut",
          repeatDelay: 0.8,
        }}
      />

      {/* Static outer border ring */}
      <div className="absolute inset-6 rounded-full border border-[#701CC0]/12" />

      {/* Slowly rotating dashed ring */}
      <motion.div
        className="absolute inset-12 rounded-full border border-dashed border-[#701CC0]/20"
        animate={{ rotate: 360 }}
        transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
      />

      {/* Ambient glow blob */}
      <div className="absolute inset-16 rounded-full bg-[#701CC0]/10 blur-2xl" />

      {/* Main icon circle */}
      <div
        className={`relative ${circleDim} rounded-full flex items-center justify-center
          bg-gradient-to-br from-[#701CC0]/25 via-[#4F1488]/20 to-[#18042A]/80
          border border-[#701CC0]/35
          shadow-[inset_0_0_40px_rgba(112,28,192,0.18),0_0_60px_rgba(112,28,192,0.12)]`}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeId}
            initial={{ opacity: 0, scale: 0.55, rotate: -12 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.55, rotate: 12 }}
            transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
            className={`${iconDim} text-white`}
          >
            <Icon className="w-full h-full" strokeWidth={1} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
