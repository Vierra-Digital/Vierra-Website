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
    <ambientLight intensity={2.5} />
    <directionalLight position={[5, 8, 5]} intensity={4} color="#ffffff" />
    <directionalLight position={[-5, 8, -5]} intensity={3} color="#B0E0E6" />
    <directionalLight position={[0, -8, 0]} intensity={2} color="#5B9BD5" />
    <pointLight position={[10, 10, 10]} intensity={2} color="#87CEEB" />
    <pointLight position={[-10, -10, -10]} intensity={1.5} color="#4169E1" />
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

  // Fix materials and handle texture errors
  useEffect(() => {
    if (!gltf.scene) return

    // Create uniform Vierra purple texture
    const createGradientTexture = () => {
      const size = 512
      const canvas = document.createElement("canvas")
      canvas.width = size
      canvas.height = size
      const context = canvas.getContext("2d")
      
      if (!context) return null
      
      // Solid Vierra purple color
      context.fillStyle = "#701CC0" // Vierra purple
      context.fillRect(0, 0, size, size)
      
      const texture = new THREE.CanvasTexture(canvas)
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      texture.minFilter = THREE.LinearFilter
      texture.magFilter = THREE.LinearFilter
      texture.needsUpdate = true
      return texture
    }

    // Traverse the scene and fix materials
    const fixMaterials = () => {
      const gradientTexture = createGradientTexture()
      
      gltf.scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          // Ensure smooth geometry on ALL sides
          if (child.geometry) {
            // Force smooth normals for all faces
            child.geometry.computeVertexNormals()
            child.geometry.normalizeNormals()
            
            // Ensure all faces use smooth shading
            if (child.geometry.attributes.normal) {
              child.geometry.attributes.normal.needsUpdate = true
            }
          }
          
          if (child.material) {
            // If material is an array, process each material
            const materials = Array.isArray(child.material)
              ? child.material
              : [child.material]

            materials.forEach((material) => {
              if (material instanceof THREE.MeshStandardMaterial) {
                // Check if texture is a blob URL or failed to load
                let hasValidTexture = false
                if (material.map) {
                  try {
                    const imageSrc = material.map.image?.src || ""
                    hasValidTexture = imageSrc && 
                      !imageSrc.startsWith("blob:") &&
                      material.map.image.complete &&
                      !material.map.image.error
                  } catch {
                    hasValidTexture = false
                  }
                }

                if (!hasValidTexture && gradientTexture) {
                  // Remove invalid texture
                  if (material.map) {
                    try {
                      material.map.dispose()
                    } catch {
                      // Ignore disposal errors
                    }
                  }
                  
                  // Apply uniform Vierra purple texture
                  material.map = gradientTexture
                  material.color = new THREE.Color(0x701CC0) // Vierra purple
                  
                  // Smooth, glossy appearance - uniform Vierra purple
                  material.emissive = new THREE.Color(0x701CC0) // Vierra purple glow
                  material.emissiveIntensity = 0.05
                  material.metalness = 0.15
                  material.roughness = 0.1 // Very smooth, highly reflective surface
                  material.side = THREE.DoubleSide // Render both sides for smooth appearance
                  material.flatShading = false // Always use smooth shading
                  
                  // Ensure texture is properly applied
                  material.map.needsUpdate = true
                } else if (hasValidTexture) {
                  // Enhance existing textures with smooth properties
                  material.metalness = 0.1
                  material.roughness = 0.25
                  material.flatShading = false
                  material.side = THREE.DoubleSide
                }
                
                // Always ensure smooth shading
                material.flatShading = false
                material.needsUpdate = true
              }
            })
          }
        }
      })
    }

    // Fix materials immediately and after a short delay to catch async texture loads
    fixMaterials()
    const timeout = setTimeout(fixMaterials, 100)
    const timeout2 = setTimeout(fixMaterials, 500)

    return () => {
      clearTimeout(timeout)
      clearTimeout(timeout2)
    }
  }, [gltf.scene])

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
  const [isCanvasActive, setIsCanvasActive] = useState(false)

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
    if (!canvasWrapperRef.current) return
    if (typeof IntersectionObserver === "undefined") {
      setIsCanvasActive(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsCanvasActive(true)
          observer.disconnect()
        }
      },
      { rootMargin: "200px" }
    )
    observer.observe(canvasWrapperRef.current)
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
            {isCanvasActive ? (
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
            ) : (
              <div className="w-full h-[350px]" />
            )}
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
            {isCanvasActive ? (
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
            ) : (
              <div
                style={{ width: canvasSize.width, height: canvasSize.height }}
              />
            )}
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
        </div>
      </div>
    </div>
  )
}
