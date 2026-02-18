import React, { useState, useEffect, useMemo, useCallback } from "react"
import Image from "next/image"
import { motion } from "framer-motion"

const gridLayout = [
  [false, false, true, false, false, false],
  [true, false, false, true, true, false],
  [false, true, true, true, false, true],
  [true, false, false, true, false, false],
  [false, false, true, true, true, false],
  [false, true, false, false, false, false],
]



const animationSets = [
  {
    source: "2-2",
    targets: ["0-2", "3-3"],
    paths: [
      "M250,200 L250,60",
      "M250,290 L250,335 C250,343 258,350 266,350 L310,350",
    ],
    colors: ["#9966ff", "#ff5996"],
  },
  {
    source: "2-2",
    targets: ["3-0", "4-2"],
    paths: [
      "M240,290 L240,340 C240,348 232,355 224,355 L93,355",
      "M255,290 L255,425",
    ],
    colors: ["#F50478", "#1877F2"],
  },
  {
    source: "1-0",
    targets: ["2-1", "1-3"],
    paths: [
      "M93,150 L138,150 C144,150 150,156 150,165 L150,210",
      "M93,135 L310,135",
    ],
    colors: ["#F50478", "#1877F2"],
  },
  {
    source: "4-4",
    targets: ["2-5", "1-4"],
    paths: [
      "M460,426 L460,270 C460,262 468,255 476,255 L512,255",
      "M445,426 L445,175",
    ],
    colors: ["#E93948", "#FFC600"],
  },
  {
    source: "4-4",
    targets: ["2-3", "5-1"],
    paths: [
      "M455,426 L455,275 C455,255 450,250 440,250 L395,250",
      "M455,500 L455,555 C455,560 450,565 440,565 L190,565",
    ],
    colors: ["#E93948", "#FFC600"],
  },
]

function GridComponent() {
  const [activeSet, setActiveSet] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const [animationPhase, setAnimationPhase] = useState<
    "drawing" | "showing" | "erasing" | "idle"
  >("idle")
  const [activeNodes, setActiveNodes] = useState<string[]>([])
  const iconCursorRef = React.useRef(0)
  const [cellIconMap, setCellIconMap] = useState<Record<string, number>>({})
  const usedIconsRef = React.useRef<Set<number>>(new Set())

  type IconEntry = { src: string; alt: string; gradient: string }
  const socialIcons = useMemo<IconEntry[]>(() => [
    { src: "/assets/Socials/Discord.png", alt: "Discord", gradient: "linear-gradient(135deg,#EEF0FF,#F2EFFF)" },
    { src: "/assets/Socials/Email.png", alt: "Email", gradient: "linear-gradient(135deg,#EAFBF1,#F0FFFB)" },
    { src: "/assets/Socials/Facebook.png", alt: "Facebook", gradient: "linear-gradient(135deg,#EAF2FF,#F5E9FF)" },
    { src: "/assets/Socials/GoHighLevel.png", alt: "GoHighLevel", gradient: "linear-gradient(135deg,#EAF8FF,#EFFFF7)" },
    { src: "/assets/Socials/GoogleAnalytics.png", alt: "Google Analytics", gradient: "linear-gradient(135deg,#FFF4E6,#FFF9E6)" },
    { src: "/assets/Socials/GoogleBusiness.png", alt: "Google Business", gradient: "linear-gradient(135deg,#E6F3FF,#EAF0FF)" },
    { src: "/assets/Socials/Instagram.png", alt: "Instagram", gradient: "linear-gradient(135deg,#FFE6F2,#FFF0E6)" },
    { src: "/assets/Socials/LinkedIn.png", alt: "LinkedIn", gradient: "linear-gradient(135deg,#E6F0FF,#EAF7FF)" },
    { src: "/assets/Socials/SEO.png", alt: "SEO", gradient: "linear-gradient(135deg,#F2F6FF,#F6F2FF)" },
    { src: "/assets/Socials/SnapChat.png", alt: "Snapchat", gradient: "linear-gradient(135deg,#FFFDE6,#FFFCEB)" },
    { src: "/assets/Socials/TikTok.png", alt: "TikTok", gradient: "linear-gradient(135deg,#FDECF0,#EAFBFB)" },
    { src: "/assets/Socials/Twitter.png", alt: "Twitter", gradient: "linear-gradient(135deg,#E7F6FF,#F0FBFF)" },
    { src: "/assets/Socials/YouTube.png", alt: "YouTube", gradient: "linear-gradient(135deg,#FFECEC,#FFF6F6)" },
  ], [])

  const getIconIndexByAlt = useCallback((alt: string) => socialIcons.findIndex((i) => i.alt === alt), [socialIcons])

  const assignIconToKey = useCallback((key: string) => {
    setCellIconMap((prev) => {
      if (prev[key] !== undefined) return prev
      
      const total = socialIcons.length
      if (usedIconsRef.current.size >= total) {
        usedIconsRef.current.clear()
        iconCursorRef.current = 0
      }
      let probe = iconCursorRef.current
      let attempts = 0
      while (usedIconsRef.current.has(probe % total) && attempts < total) {
        probe++
        attempts++
      }
      
      const assigned = probe % total
      usedIconsRef.current.add(assigned)
      iconCursorRef.current = (assigned + 1) % total
      return { ...prev, [key]: assigned }
    })
  }, [socialIcons])

  useEffect(() => {
    let targetTimer: NodeJS.Timeout
    let eraseTimer: NodeJS.Timeout
    let resetTimer: NodeJS.Timeout
    let intervalTimer: ReturnType<typeof setInterval>

    const runAnimation = () => {
      const currentSet = animationSets[activeSet]

      setIsAnimating(true)
      setAnimationPhase("drawing")
      setActiveNodes([currentSet.source])
      assignIconToKey(currentSet.source)

      targetTimer = setTimeout(() => {
        setActiveNodes([currentSet.source, ...currentSet.targets])
          currentSet.targets.forEach(assignIconToKey)
        setAnimationPhase("showing")
      }, 500)

      eraseTimer = setTimeout(() => {
        setAnimationPhase("erasing")
      }, 4000)

      resetTimer = setTimeout(() => {
        setIsAnimating(false)
        setAnimationPhase("idle")
        setActiveNodes([])
        setActiveSet((prev) => {
          const next = (prev + 1) % animationSets.length
          if (next === 0) {
            setCellIconMap({})
            iconCursorRef.current = 0
            usedIconsRef.current.clear()
          }
          return next
        })
      }, 5000)
    }

    const startAnimationLoop = () => {
      runAnimation()
      intervalTimer = setInterval(runAnimation, 5500)
    }

    const stopAnimationLoop = () => {
      clearTimeout(targetTimer)
      clearTimeout(eraseTimer)
      clearTimeout(resetTimer)
      clearInterval(intervalTimer)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        stopAnimationLoop()
        setActiveSet(0)
        setAnimationPhase("idle")
        setActiveNodes([])
        setIsAnimating(false)
        startAnimationLoop()
      } else {
        stopAnimationLoop()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    startAnimationLoop()

    return () => {
      stopAnimationLoop()
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [assignIconToKey, getIconIndexByAlt, activeSet])

  const isNodeActive = (key: string) => {
    return activeNodes.includes(key)
  }

  const pathVariants = useMemo(
    () => ({
      initial: {
        opacity: 0,
        pathLength: 0,
        pathOffset: 0,
      },
      drawing: {
        opacity: 1,
        pathLength: 1,
        transition: {
          pathLength: { duration: 0.5, ease: "easeInOut" },
          opacity: { duration: 0.1 },
        },
      },
      showing: {
        opacity: 1,
        pathLength: 1,
        pathOffset: 0,
      },
      erasing: {
        opacity: 1,
        pathLength: 1,
        pathOffset: 1,
        transition: {
          pathOffset: { duration: 0.5, ease: "easeInOut" },
          opacity: { duration: 0.4 },
        },
      },
      exit: {
        opacity: 0,
        transition: {
          opacity: { duration: 0.1 },
        },
      },
    }),
    []
  )

  const iconVariants = {
    inactive: {
      backgroundColor: "#F3F3F3",
      transition: {
        duration: 0.3,
        ease: "easeOut",
      },
    },
    active: {
      backgroundColor: "#FFFFFF",
      transition: {
        backgroundColor: {
          duration: 2.5,
          ease: "easeInOut",
        },
        duration: 0.3,
        ease: "easeOut",
      },
    },
  }
  const renderSVG = (key: string, isActive: boolean, cellIconMap: Record<string, number>) => {
    switch (key) {
      case "3-0":
        return (
          <div
            className={`w-[30px] h-[30px] sm:w-[40px] sm:h-[40px] md:w-[57px] md:h-[57px] rounded-full flex items-center justify-center`}
          >
            {isActive && (
              <motion.div
                whileHover={{ scale: 1.15, rotate: 5 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
              <Image
                src="/assets/Socials/Facebook.png"
                alt="Facebook"
                width={56}
                height={56}
                className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 object-contain"
              />
              </motion.div>
            )}
          </div>
        )
      case "1-4":
        return (
          <div
            className={`w-[30px] h-[30px] sm:w-[40px] sm:h-[40px] md:w-[57px] md:h-[57px] rounded-full flex items-center justify-center`}
          >
            {isActive && (
              <motion.div
                whileHover={{ scale: 1.15, rotate: 5 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
              <Image
                src="/assets/Socials/GoogleAnalytics.png"
                alt="GoogleAnalytics"
                width={56}
                height={56}
                className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 object-contain"
              />
              </motion.div>
            )}
          </div>
        )
      case "2-2":
        return (
          <div
            className={`w-[30px] h-[30px] sm:w-[40px] sm:h-[40px] md:w-[57px] md:h-[57px] rounded-full flex items-center justify-center`}
          >
            {isActive && (
              <motion.div
                whileHover={{ scale: 1.15, rotate: 5 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
              <Image
                src="/assets/Socials/Instagram.png"
                alt="Instagram"
                width={56}
                height={56}
                className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 object-contain"
              />
              </motion.div>
            )}
          </div>
        )

      case "2-5":
        return (
          <div
            className={`w-[30px] h-[30px] sm:w-[40px] sm:h-[40px] md:w-[57px] md:h-[57px] rounded-full flex items-center justify-center`}
          >
            {isActive && (
              <motion.div
                whileHover={{ scale: 1.15, rotate: 5 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
              <Image
                src="/assets/Socials/SEO.png"
                alt="SEO"
                width={56}
                height={56}
                className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 object-contain"
              />
              </motion.div>
            )}
          </div>
        )
      case "0-0":
        return (
          <div className={`w-[30px] h-[30px] sm:w-[40px] sm:h-[40px] md:w-[57px] md:h-[57px] rounded-full flex items-center justify-center`}>
            {isActive && (
              <motion.div
                whileHover={{ scale: 1.15, rotate: 5 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
              <Image src="/assets/Socials/TikTok.png" alt="TikTok" width={56} height={56} className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 object-contain" />
              </motion.div>
            )}
          </div>
        )
      case "0-5":
        return (
          <div className={`w-[30px] h-[30px] sm:w-[40px] sm:h-[40px] md:w-[57px] md:h-[57px] rounded-full flex items-center justify-center`}>
            {isActive && (
              <motion.div
                whileHover={{ scale: 1.15, rotate: 5 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
              <Image src="/assets/Socials/Twitter.png" alt="Twitter" width={56} height={56} className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 object-contain" />
              </motion.div>
            )}
          </div>
        )
      case "5-0":
        return (
          <div className={`w-[30px] h-[30px] sm:w-[40px] sm:h-[40px] md:w-[57px] md:h-[57px] rounded-full flex items-center justify-center`}>
            {isActive && (
              <motion.div
                whileHover={{ scale: 1.15, rotate: 5 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
              <Image src="/assets/Socials/YouTube.png" alt="YouTube" width={56} height={56} className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 object-contain" />
              </motion.div>
            )}
          </div>
        )
      case "1-0":
        return (
          <div className={`w-[30px] h-[30px] sm:w-[40px] sm:h-[40px] md:w-[57px] md:h-[57px] rounded-full flex items-center justify-center`}>
            {isActive && (
              <motion.div
                whileHover={{ scale: 1.15, rotate: 5 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
              <Image src="/assets/Socials/SnapChat.png" alt="SnapChat" width={56} height={56} className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 object-contain" />
              </motion.div>
            )}
          </div>
        )
      case "1-5":
        return (
          <div className={`w-[30px] h-[30px] sm:w-[40px] sm:h-[40px] md:w-[57px] md:h-[57px] rounded-full flex items-center justify-center`}>
            {isActive && (
              <motion.div
                whileHover={{ scale: 1.15, rotate: 5 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
              <Image src="/assets/Socials/Discord.png" alt="Discord" width={56} height={56} className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 object-contain" />
              </motion.div>
            )}
          </div>
        )
      case "5-5":
        return (
          <div className={`w-[30px] h-[30px] sm:w-[40px] sm:h-[40px] md:w-[57px] md:h-[57px] rounded-full flex items-center justify-center`}>
            {isActive && (
              <motion.div
                whileHover={{ scale: 1.15, rotate: 5 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
              <Image src="/assets/Socials/GoogleBusiness.png" alt="Google Business" width={56} height={56} className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 object-contain" />
              </motion.div>
            )}
          </div>
        )
      case "4-2":
        return (
          <div
            className={`w-[30px] h-[30px] sm:w-[40px] sm:h-[40px] md:w-[57px] md:h-[57px] rounded-full ${
              isActive ? "border-transparent" : "border-[#D9DEDD]"
            } border flex items-center justify-center`}
          >
            {isActive && (
              <motion.div
                whileHover={{ scale: 1.15, rotate: 5 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
              <Image
                src="/assets/Socials/LinkedIn.png"
                alt="LinkedIn"
                width={56}
                height={56}
                className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 object-contain"
              />
              </motion.div>
            )}
          </div>
        )
      case "4-4":
        return (
          <div
            className={`w-[30px] h-[30px] sm:w-[40px] sm:h-[40px] md:w-[57px] md:h-[57px] rounded-full ${
              isActive ? "border-transparent" : "border-[#D9DEDD]"
            } border flex items-center justify-center`}
          >
            {isActive && (
              <motion.div
                whileHover={{ scale: 1.15, rotate: 5 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
              <Image
                src="/assets/Socials/Email.png"
                alt="Email"
                width={56}
                height={56}
                className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 object-contain"
              />
              </motion.div>
            )}
          </div>
        )
      default:
        if (isActive && cellIconMap[key] !== undefined) {
          return (
            <motion.div
              whileHover={{ scale: 1.15, rotate: 5 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <Image
                src={socialIcons[cellIconMap[key]].src}
                alt={socialIcons[cellIconMap[key]].alt}
                width={56}
                height={56}
                className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 object-contain"
              />
            </motion.div>
          )
        }
        return (
          <div className="w-[30px] h-[30px] sm:w-[40px] sm:h-[40px] md:w-[57px] md:h-[57px] rounded-full border border-[#D9DEDD]" />
        )
    }
  }
  const GridCell = ({
    cellKey,
    isFilled,
    isActive,
    cellIconMap,
    socialIcons,
  }: {
    cellKey: string
    isFilled: boolean
    isActive: boolean
    cellIconMap: Record<string, number>
    socialIcons: IconEntry[]
  }) => {
    if (!isFilled) return null
    const getBackground = () => {
      if (!isActive) return "#F7F7F8"
      if (cellKey === "3-0") return "linear-gradient(135deg,#EAF2FF,#F5E9FF)"
      if (cellKey === "2-2") return "linear-gradient(135deg,#FFE6F2,#FFF0E6)"
      if (cellKey === "4-2") return "linear-gradient(135deg,#E6F0FF,#EAF7FF)"
      if (cellKey === "1-4") return "linear-gradient(135deg,#FFF4E6,#FFF9E6)"
      if (cellKey === "5-5") return "linear-gradient(135deg,#E6F3FF,#EAF0FF)"
      if (cellKey === "4-4") return "linear-gradient(135deg,#EAFBF1,#F0FFFB)"
      if (cellKey === "2-5") return "linear-gradient(135deg,#F2F6FF,#F6F2FF)"
      if (cellKey === "0-0") return "linear-gradient(135deg,#FDECF0,#EAFBFB)"
      if (cellKey === "0-5") return "linear-gradient(135deg,#E7F6FF,#F0FBFF)"
      if (cellKey === "5-0") return "linear-gradient(135deg,#FFECEC,#FFF6F6)"
      if (cellKey === "1-0") return "linear-gradient(135deg,#FFFDE6,#FFFCEB)"
      if (cellKey === "1-5") return "linear-gradient(135deg,#EEF0FF,#F2EFFF)"
      if (cellKey === "3-5") return "linear-gradient(135deg,#EAF8FF,#EFFFF7)"
      if (cellIconMap[cellKey] !== undefined) {
        const iconIndex = cellIconMap[cellKey]
        return socialIcons[iconIndex]?.gradient || "#F7F7F8"
      }
      
      return "#F7F7F8"
    }

    return (
      <motion.div
        key={cellKey}
        role="gridcell"
        aria-label={`Grid cell ${cellKey}`}
        className={`w-full h-full flex flex-col items-center justify-center rounded-lg ${isActive ? "shadow-md" : ""}`}
        style={{
          background: getBackground(),
        }}
        variants={iconVariants}
        initial={false}
        animate={isActive ? "active" : "inactive"}
      >
        {renderSVG(cellKey, isActive, cellIconMap)}
        
      </motion.div>
    )
  }

  const width = 600
  const height = 600

  return (
    <div className="relative" style={{ width: "fit-content" }}>
      <svg
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
        style={{ minWidth: "100%", minHeight: "100%" }}
        preserveAspectRatio="xMidYMid meet"
        viewBox={`0 0 ${width} ${height}`}
      >
        {isAnimating && (
          <>
            <defs>
              <mask id="curveMask">
                {animationSets[activeSet].paths.map((path, index) => {
                  return (
                    <motion.path
                      key={`${activeSet}-${index}`}
                      d={path}
                      stroke="white"
                      strokeWidth="5"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      variants={pathVariants}
                      initial="initial"
                      animate={animationPhase}
                      exit="erasing"
                    />
                  )
                })}
              </mask>
              {animationSets[activeSet].paths.map((path, index) => {
                const isLastSet = activeSet === animationSets.length - 1
                const isFirstSet = activeSet === 0
                const gradientDirection = isFirstSet
                  ? index === 0
                    ? { y1: "1", y2: "0" }
                    : { y1: "0", y2: "1" }
                  : isLastSet
                  ? { y1: "1", y2: "0" }
                  : { y1: "0", y2: "1" }
                return (
                  <React.Fragment key={`${activeSet}-${index}`}>
                    <linearGradient
                      id="gradient"
                      x1="0"
                      x2="0"
                      y1={gradientDirection.y1}
                      y2={gradientDirection.y2}
                    >
                      <motion.stop
                        stopColor={animationSets[activeSet].colors[0]}
                        animate={{ offset: ["-150%", "100%"] }}
                        transition={{
                          duration: 3,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      />
                      <motion.stop
                        stopColor={animationSets[activeSet].colors[1]}
                        animate={{ offset: ["-20%", "100%"] }}
                        transition={{
                          duration: 3,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      />
                      <motion.stop
                        stopColor={animationSets[activeSet].colors[1]}
                        animate={{ offset: ["-12%", "108%"] }}
                        transition={{
                          duration: 3,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      />
                      <motion.stop
                        stopColor={animationSets[activeSet].colors[0]}
                        animate={{ offset: ["-8%", "112%"] }}
                        transition={{
                          duration: 3,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      />
                    </linearGradient>
                  </React.Fragment>
                )
              })}
            </defs>
            {animationSets[activeSet].paths.map((path, index) => {
              return (
                <g mask="url(#curveMask)" key={`${activeSet}-${index}`}>
                  <rect
                    x="0"
                    y="0"
                    width={width}
                    height={height}
                    fill={animationSets[activeSet].colors[0]}
                  />
                  <rect
                    x="0"
                    y="0"
                    width={width}
                    height={height}
                    fill="url(#gradient)"
                  />
                </g>
              )
            })}
          </>
        )}
      </svg>

      <div
        role="grid"
        className="grid grid-cols-6 gap-x-2 gap-y-3 mx-auto"
        style={{ width: "fit-content" }}
      >
        {gridLayout.map((row, rowIndex) =>
          row.map((isFilled, colIndex) => {
            const key = `${rowIndex}-${colIndex}`
            const isActive = isNodeActive(key)

            return (
              <div
                key={key}
                className="w-[45px] h-[45px] sm:w-[55px] sm:h-[55px] md:w-[80px] md:h-[80px] flex items-center justify-center z-10"
              >
                <GridCell
                  cellKey={key}
                  isFilled={isFilled}
                  isActive={isActive}
                  cellIconMap={cellIconMap}
                  socialIcons={socialIcons}
                />
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default GridComponent