"use client"
import React, { useState, useEffect, useRef, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Bricolage_Grotesque, Figtree } from "next/font/google"
import { Canvas, useFrame } from "@react-three/fiber"
import { useGLTF } from "@react-three/drei"
import * as THREE from "three"

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
      "We use the changing market's self-interests to push ads that reach an audience that wants your service. Save money by spending on premium ad spend that helps reach your desired audience.",
  },
  {
    id: "04",
    name: "Google Analytics",
    description:
      "Improve your business by making your data work for you. We use results-driven numbers to improve lead generation and increase client longevity.",
  },
]

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
}

const Lighting = () => (
  <>
    <ambientLight intensity={1.5} />
    <directionalLight position={[2, 2, 2]} intensity={6} />
    <directionalLight position={[-10, -6, -2]} intensity={6} />
    <directionalLight position={[0, -5, 0]} intensity={6} />
    <directionalLight position={[5, 5, 5]} intensity={6} />
    <directionalLight position={[-5, 5, 5]} intensity={6} />
    <directionalLight position={[5, -5, 5]} intensity={6} />
    <directionalLight position={[-5, -5, 5]} intensity={6} />
  </>
)

const getAnimationConfig = (isMobile: boolean) => {
  return {
    modelPosition: [0, 0, 0],
    modelScale: 4,
    modelScaleAnimating: 4.2,
    springStrength: isMobile ? 3 : 5,
    moveSpeed: {
      animating: isMobile ? 0.2 : 0.15,
      idle: isMobile ? 0.08 : 0.05,
    },
    getPositionForId: (id: string | null, services: Service[]) => {
      if (!id) return new THREE.Vector3(0, 0, 0)

      const index = services.findIndex((service) => service.id === id)
      if (index === -1) return new THREE.Vector3(0, 0, 0)

      if (isMobile) {
        const angle = (index / services.length) * Math.PI * 2
        const radius = 0.5
        const x = Math.sin(angle) * radius
        const z = Math.cos(angle) * radius
        return new THREE.Vector3(x, 0, z)
      } else {
        const yOffset = index === services.length - 1 ? 0.4 : 0
        return new THREE.Vector3(0, 1.5 - index + yOffset, 0)
      }
    },
  }
}

const Model = React.memo(function Model({
  selectedId,
  isMobile,
}: {
  selectedId: string | null
  isMobile: boolean
}) {
  const gltf = useGLTF("/assets/object.glb")
  const [isAnimating, setIsAnimating] = useState(false)
  const lastSelectedId = useRef<string | null>(null)
  const animConfig = useMemo(() => getAnimationConfig(isMobile), [isMobile])
  const force = useRef(new THREE.Vector3())

  const targetPosition = animConfig.getPositionForId(selectedId, services)

  useEffect(() => {
    if (selectedId !== lastSelectedId.current) {
      setIsAnimating(true)
      lastSelectedId.current = selectedId
      const timeout = setTimeout(() => setIsAnimating(false), 500)
      return () => clearTimeout(timeout)
    }
  }, [selectedId])

  useFrame((state, delta) => {
    if (!gltf.scene) return

    force.current
      .subVectors(targetPosition, gltf.scene.position)
      .multiplyScalar(animConfig.springStrength)
    const moveSpeed = isAnimating
      ? animConfig.moveSpeed.animating
      : animConfig.moveSpeed.idle
    gltf.scene.position.add(force.current.multiplyScalar(moveSpeed * delta))

    const targetScale = isAnimating
      ? animConfig.modelScaleAnimating
      : animConfig.modelScale
    gltf.scene.scale.lerp(
      new THREE.Vector3(targetScale, targetScale, targetScale),
      0.1
    )

    const targetRotationY = selectedId
      ? (parseInt(selectedId) - 1) * (Math.PI / 2)
      : gltf.scene.rotation.y
    gltf.scene.rotation.y += (targetRotationY - gltf.scene.rotation.y) * 0.05
    gltf.scene.rotation.y += delta / 2
  })

  return (
    <primitive
      object={gltf.scene}
      scale={animConfig.modelScale}
      position={animConfig.modelPosition}
    />
  )
})

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
    <div key={service.id}>
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
  const [openServiceId, setOpenServiceId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasWrapperRef = useRef<HTMLDivElement>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 480, height: 800 })

  useEffect(() => {
    if (!canvasWrapperRef.current) return

    const updateCanvasSize = () => {
      const isMobileView = window.innerWidth <= 768
      const containerWidth = canvasWrapperRef.current
        ? canvasWrapperRef.current.clientWidth
        : 0
      const size = isMobileView
        ? Math.min(Math.max(containerWidth, 280), 350)
        : Math.min(containerWidth, 480)
      setCanvasSize({ width: size, height: isMobileView ? 350 : 800 })
    }

    const observer = new ResizeObserver(updateCanvasSize)
    observer.observe(canvasWrapperRef.current)

    updateCanvasSize()

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setOpenServiceId((prevId) => {
        const currentIndex = services.findIndex(
          (service) => service.id === prevId
        )
        const nextIndex = (currentIndex + 1) % services.length
        return services[nextIndex].id
      })
    }, 5000)

    return () => clearInterval(timer)
  }, [])

  const toggleService = (serviceId: string) => {
    setOpenServiceId(openServiceId === serviceId ? null : serviceId)
  }

  return (
    <div
      className="w-full max-w-[1174px] px-4 md:px-6 lg:px-0 my-20"
      id="services"
      ref={containerRef}
    >
      <div
        className={`relative w-full min-h-[600px] md:min-h-[773px] bg-[#18042A] rounded-[30px] md:rounded-tr-[60px] md:rounded-br-[60px] md:rounded-tl-[0px] md:rounded-bl-[0px] z-0 ${bricolage.className}`}
      >
        <div className="block md:hidden">
          <div
            className="py-8 flex justify-center"
            ref={canvasWrapperRef}
            style={{ minHeight: "350px" }}
          >
            <Canvas
              style={{
                width: canvasSize.width,
                height: canvasSize.height,
                minHeight: "350px",
              }}
              gl={{ antialias: true, alpha: true }}
              camera={{ position: [0, 0, 5], fov: 75 }}
            >
              <Lighting />
              <Model selectedId={openServiceId} isMobile={true} />
            </Canvas>
          </div>
          <div className="px-4 py-4">
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
        <div className="hidden md:block">
          <div
            className="z-10 absolute right-[12%] top-1/3 -translate-y-[40%] translate-x-1/2"
            ref={canvasWrapperRef}
          >
            <Canvas
              style={{
                width: canvasSize.width,
                height: canvasSize.height,
              }}
              gl={{ antialias: true }}
              onPointerOver={() => (document.body.style.cursor = "grab")}
              onPointerOut={() => (document.body.style.cursor = "default")}
            >
              <Lighting />
              <Model selectedId={openServiceId} isMobile={false} />
            </Canvas>
          </div>
          <div className="px-4 md:ml-40 md:mr-20 py-8 md:py-20">
            {services.map((service) => (
              <ServiceItem
                key={service.id}
                service={service}
                isOpen={openServiceId === service.id}
                toggleService={toggleService}
              />
            ))}
          </div>
          <motion.div
            initial={{ x: 0, y: 0 }}
            animate={{ x: [0, 15, 0], y: [0, 15, 0] }}
            transition={{
              duration: 5,
              repeat: Infinity,
              repeatType: "loop",
              ease: "easeInOut",
            }}
            className="absolute top-[165px] left-[415px] w-[540px] h-[540px] opacity-50 blur-[10px] rotate-[60deg] rounded-full bg-gradient-to-t from-[#18042A] to-[#701CC0] -z-10"
          />
        </div>
      </div>
    </div>
  )
}
