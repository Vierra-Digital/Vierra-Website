"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"] });
const figtree = Figtree({ subsets: ["latin"] });

interface Service {
  id: string;
  name: string;
  description: string;
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

function Model({ isDropdownOpen }: { isDropdownOpen: boolean }) {
  const gltf = useGLTF("/assets/object.glb");
  const [isAnimating, setIsAnimating] = useState(false);

  // Trigger animation when dropdown state changes
  useEffect(() => {
    if (isDropdownOpen !== undefined) {
      setIsAnimating(true);
      const timeout = setTimeout(() => setIsAnimating(false), 500); // Animation duration
      return () => clearTimeout(timeout);
    }
  }, [isDropdownOpen]);

  useFrame((state, delta) => {
    if (isAnimating) {
      // Scale up and move upward
      gltf.scene.scale.lerp(new THREE.Vector3(4.1, 4.1, 4.1), 0.1);
      gltf.scene.position.lerp(new THREE.Vector3(0, 0.5, 0), 0.1);
    } else {
      // Return to original scale and position
      gltf.scene.scale.lerp(new THREE.Vector3(4, 4, 4), 0.1);
      gltf.scene.position.lerp(new THREE.Vector3(0, 0, 0), 0.1);
    }
    gltf.scene.rotation.y += delta / 2; // Continuous rotation
  });

  return (
    <primitive
      object={gltf.scene}
      scale={4}
      position={[0, 0, 0]}
      rotation={[0.2, 0, 0]}
      material={
        new THREE.MeshStandardMaterial({
          metalness: 0.9,
          roughness: 0.5,
          flatShading: false,
        })
      }
    />
  );
}

export function Services() {
  const [openServices, setOpenServices] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    handleResize(); // Set initial value
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggleService = (serviceId: string) => {
    setOpenServices(
      (prev) =>
        prev.includes(serviceId)
          ? prev.filter((id) => id !== serviceId) // close if open
          : [...prev, serviceId] // open if closed
    );
    setIsDropdownOpen((prev) => !prev); // Toggle dropdown state
  };

  return (
    <div
      className="w-full max-w-[1174px] px-4 md:px-6 lg:px-0 my-20"
      id="services"
      ref={containerRef}
    >
      {/* Main Card */}
      <div
        className={`relative w-full min-h-[773px] bg-[#18042A] rounded-[30px] md:rounded-tr-[60px] md:rounded-br-[60px] md:rounded-tl-[0px] md:rounded-bl-[0px] z-0 ${bricolage.className}`}
      >
        {/* 3D Object */}
        <div className="z-10 relative md:absolute md:right-[12%] md:top-1/3 md:-translate-y-[40%] md:translate-x-1/2 py-8 md:py-0">
          <div className="flex justify-center">
            <div>
              <Canvas
                style={{
                  width: isMobile ? 300 : 727,
                  height: isMobile ? 300 : 727,
                }}
                gl={{ antialias: true }}
              >
                <ambientLight intensity={1} />
                <directionalLight position={[2, 2, 2]} intensity={6} />
                <directionalLight position={[-10, -6, -2]} intensity={6} />
                <directionalLight position={[0, -5, 0]} intensity={6} />
                <directionalLight position={[5, 5, 5]} intensity={6} />
                <directionalLight position={[-5, 5, 5]} intensity={6} />
                <directionalLight position={[5, -5, 5]} intensity={6} />
                <directionalLight position={[-5, -5, 5]} intensity={6} />
                <Model isDropdownOpen={isDropdownOpen} />
              </Canvas>
            </div>
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
                  className={`flex items-center cursor-pointer border-b py-8 group ${
                    isOpen ? "border-[#701CC0]" : "border-[#A4A4A4]/20"
                  }`}
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
                    className={`flex items-center justify-center h-[40px] md:h-[52px] w-[56px] md:w-[70px] rounded-full transition-all duration-300 ${
                      isOpen
                        ? "bg-[#701CC0]" // Active state
                        : "bg-transparent border-[1.5px] border-white/40 group-hover:border-white" // Inactive & hover state
                    }`}
                  >
                    <span
                      className={`text-lg md:text-[24px] font-light transition-opacity duration-300 ${
                        isOpen
                          ? "text-white" // Active state
                          : "text-white/40 group-hover:text-white" // Inactive & hover state
                      }`}
                    >
                      {service.id}
                    </span>
                  </div>

                  {/* Service Name */}
                  <span
                    className={`ml-4 md:ml-6 max-md:text-2xl md:text-[48px] transition-all duration-300 ${
                      isOpen
                        ? "text-white font-normal" // Active state
                        : "text-white/40 font-light group-hover:text-white" // Inactive & hover state
                    }`}
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
