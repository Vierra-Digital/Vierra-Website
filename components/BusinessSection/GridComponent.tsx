import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

const gridLayout = [
  [false, false, true, false, false, false],
  [true, false, false, true, true, false],
  [false, true, true, true, false, true],
  [true, false, false, true, false, false],
  [false, false, true, true, true, false],
  [false, true, false, false, false, false],
];

{/*

const titlesMap = {
  "2-2": "Instagram",
  "3-0": "Facebook",
  "1-4": "GoogleAnalytics",
  "2-5": "SEO",
  "4-2": "LinkedIn",
  "4-4": "Email",
};

*/}

const animationSets = [
  
  {
    source: "2-2", // Instagram
    targets: ["0-2", "3-3"], // Placeholder
    paths: [
      "M250,200 L250,60",
      "M250,290 L250,335 C250,343 258,350 266,350 L310,350"
    ],
    colors: ["#9966ff", "#ff5996"],
  },
 
  {
    source: "2-2", // Instagram
    targets: ["3-0", "4-2"], // Facebook, LinkedIn
    paths: [
      "M240,290 L240,340 C240,348 232,355 224,355 L93,355",
      "M255,290 L255,425",
    ],
    colors: ["#F50478", "#1877F2"],
  },

  {
    source: "1-0", // Placeholder
    targets: ["2-1", "1-3"], // Placeholder
    paths: [
      "M93,150 L138,150 C144,150 150,156 150,165 L150,210",
      "M93,135 L310,135",
     
    ],
    colors: ["#F50478", "#1877F2"],
  },
  {
    source: "4-4", // Email
    targets: ["2-5", "1-4"], // SEO, Google Analytics
    paths: [
      "M460,426 L460,270 C460,262 468,255 476,255 L512,255",
      "M445,426 L445,175",
    ],
    colors: ["#E93948", "#FFC600"],
  },

  {
    source: "4-4", // Email
    targets: ["2-3", "5-1"], // Placeholder
    paths: [
      "M455,426 L455,275 C455,255 450,250 440,250 L395,250",
      "M455,500 L455,555 C455,560 450,565 440,565 L190,565"

    ],
    colors: ["#E93948", "#FFC600"],
  },


];

function GridComponent() {
  const [activeSet, setActiveSet] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationPhase, setAnimationPhase] = useState<
    "drawing" | "showing" | "erasing" | "idle"
  >("idle");
  const [activeNodes, setActiveNodes] = useState<string[]>([]);

  useEffect(() => {
    let targetTimer: NodeJS.Timeout;
    let eraseTimer: NodeJS.Timeout;
    let resetTimer: NodeJS.Timeout;
    let dataFlowInterval: NodeJS.Timer;
    let intervalTimer: ReturnType<typeof setInterval>;

    const runAnimation = () => {
      const currentSet = animationSets[activeSet];

      setIsAnimating(true);
      setAnimationPhase("drawing");
      setActiveNodes([currentSet.source]);

      // Draw the main lines
      targetTimer = setTimeout(() => {
        setActiveNodes([currentSet.source, ...currentSet.targets]);
        setAnimationPhase("showing");

        // Start data flow animation
        let progress = 0;
        dataFlowInterval = setInterval(() => {
          progress = (progress + 0.02) % 1;
        }, 25);
      }, 500);

      eraseTimer = setTimeout(() => {
        setAnimationPhase("erasing");
      }, 2000);

      resetTimer = setTimeout(() => {
        setIsAnimating(false);
        setAnimationPhase("idle");
        setActiveNodes([]);
        setActiveSet((prev) => (prev + 1) % animationSets.length);
      }, 2500);
    };

    const startAnimationLoop = () => {
      runAnimation();
      intervalTimer = setInterval(runAnimation, 3000);
    };

    const stopAnimationLoop = () => {
      clearTimeout(targetTimer);
      clearTimeout(eraseTimer);
      clearTimeout(resetTimer);
      clearInterval(dataFlowInterval as NodeJS.Timeout);
      clearInterval(intervalTimer);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        stopAnimationLoop(); // Clear all timers and intervals
        setActiveSet(0); // Reset to the first animation set
        setAnimationPhase("idle");
        setActiveNodes([]);
        setIsAnimating(false);
        startAnimationLoop(); // Restart the animation loop
      } else {
        stopAnimationLoop(); // Stop the animation when the tab is hidden
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    startAnimationLoop(); // Start the animation loop initially

    return () => {
      stopAnimationLoop(); // Cleanup on component unmount
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [activeSet]);

  const isNodeActive = (key: string) => {
    return activeNodes.includes(key);
  };

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
  );

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
  };

  // Renders SVG
  const renderSVG = (key: string, isActive: boolean) => {
    const svgSize = "w-[25px] h-[25px] sm:w-[40px] sm:h-[40px]";
    const strokeColor = isActive ? "none" : "#D9DEDD";

    switch (key) {
      /*
      case "0-2": // Tax
        return (
          <svg
            className={`${svgSize}`}
            viewBox="0 0 40 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            stroke={strokeColor}
          >
            <path
              d="M19.049.00995851C22.4341.325767 25.7367 1.28014 28.7794 2.83046c3.0426 1.55031 5.756 3.66123 8.0012 6.2142.9142 1.03954.6576 2.61624-.4624 3.42994L20.5259 23.9483c-1.6569 1.2039-3.98.0202-3.98-2.0279V2.40011c0-1.38439 1.1247-2.518749 2.5031-2.39015149z"
              fill={isActive ? "url(#product-icon-tax-Sticky-a)" : "none"}
            ></path>
            <circle
              cx="17.6666"
              cy="24.3334"
              transform="rotate(-90 17.6666 24.3334)"
              fill={isActive ? "#96F" : "none"}
              r="15.6666"
            ></circle>
            <path
              d="M31.099 16.2665l-10.5731 7.6818c-1.6569 1.2038-3.98.0201-3.98-2.028V8.70618c.37-.02614.7436-.03943 1.1202-.03943 5.7019 0 10.6924 3.04605 13.4329 7.59975z"
              fill={isActive ? "url(#product-icon-tax-Sticky-b)" : "none"}
            ></path>
            <defs>
              <linearGradient
                id="product-icon-tax-Sticky-a"
                x1="27.6927"
                y1="-.106484"
                x2="27.6927"
                y2="20.5734"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset=".23665" stopColor="#FF5191"></stop>
                <stop offset="1" stopColor="#E03071"></stop>
              </linearGradient>
              <linearGradient
                id="product-icon-tax-Sticky-b"
                x1="23.3061"
                y1="24.96"
                x2="18.8407"
                y2="7.43349"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#6E00F5"></stop>
                <stop offset="1" stopColor="#9860FE"></stop>
              </linearGradient>
            </defs>
          </svg>
        );

      case "3-3": // Radar
        return (
          <svg
            className={`${svgSize}`}
            viewBox="0 0 40 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            stroke={strokeColor}
          >
            <path
              d="M24.87 4.46a1.26 1.26 0 0 0-1.8.2l-4.6 5.82L3.42 29.45c.27.22.54.45.78.7a9.42 9.42 0 0 1 1.13 1.32l.1.13a9.15 9.15 0 0 1 .8 1.43c.29.62.5 1.28.65 1.95a2.5 2.5 0 0 0 2.45 1.93H38.7a1.27 1.27 0 0 0 1.27-1.3 42.43 42.43 0 0 0-15.1-31.15z"
              fill={isActive ? "#9A66FF" : "none"}
            ></path>
            <path
              d="M27.8 21.98A33.82 33.82 0 0 0 5.95 4.28a1.29 1.29 0 0 0-1.56.98L.1 25.4a2.54 2.54 0 0 0 1.4 2.88 9.48 9.48 0 0 1 2.72 1.87l.17.17c.35.36.67.74.96 1.15l.1.13a9.15 9.15 0 0 1 .8 1.43l20.94-9.31a1.29 1.29 0 0 0 .62-1.74z"
              fill={isActive ? "url(#product-icon-radar-Sticky-a)" : "none"}
            ></path>
            <path
              d="M18.46 10.48l.47.38a33.82 33.82 0 0 1 8.87 11.12 1.29 1.29 0 0 1-.62 1.74L6.25 33.03a9.15 9.15 0 0 0-.8-1.43l-.1-.13-.23-.3c-.23-.3-.47-.58-.74-.85a9.7 9.7 0 0 0-.95-.86l15.03-18.98z"
              fill={isActive ? "url(#product-icon-radar-Sticky-b)" : "none"}
            ></path>
            <defs>
              <linearGradient
                id="product-icon-radar-Sticky-a"
                x1="13.98"
                y1="4.24"
                x2="13.98"
                y2="33.03"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset=".26" stopColor="#FF5091"></stop>
                <stop offset=".91" stopColor="#E03071"></stop>
              </linearGradient>
              <linearGradient
                id="product-icon-radar-Sticky-b"
                x1="15.68"
                y1="10.48"
                x2="15.68"
                y2="33.03"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#6E00F5"></stop>
                <stop offset="1" stopColor="#9860FE"></stop>
              </linearGradient>
            </defs>
          </svg>
        );
        */
      case "3-0": // Facebook
        return (
          <div
            className={`w-[57px] h-[57px] rounded-full ${isActive ? "border-transparent" : "border-[#D9DEDD]"
              } border flex items-center justify-center`}
          >
            {isActive && (
              <img
                src="/assets/Socials/Facebook.png"
                alt="Facebook"
                className="w-[60px] h-[60px] object-contain"
              />
            )}
          </div>
        );
      case "1-4": // Google Analytics
        return (
          <div
            className={`w-[57px] h-[57px] rounded-full ${isActive ? "border-transparent" : "border-[#D9DEDD]"
              } border flex items-center justify-center`}
          >
            {isActive && (
              <img
                src="/assets/Socials/GoogleAnalytics.png"
                alt="GoogleAnalytics"
                className="w-[60px] h-[60px] object-contain"
              />
            )}
          </div>
        );
      case "2-2": // Instagram
        return (
          <div
            className={`w-[57px] h-[57px] rounded-full ${isActive ? "border-transparent" : "border-[#D9DEDD]"
              } border flex items-center justify-center`}
          >
            {isActive && (
              <img
                src="/assets/Socials/Instagram.png"
                alt="Instagram"
                className="w-[60px] h-[60px] object-contain"
              />
            )}
          </div>
        );

      case "2-5": //SEO
        return (
          <div
          className={`w-[57px] h-[57px] rounded-full ${isActive ? "border-transparent" : "border-[#D9DEDD]"
            } border flex items-center justify-center`}
        >
          {isActive && (
            <img
              src="/assets/Socials/SEO.png"
              alt="SEO"
              className="w-[60px] h-[60px] object-contain"
            />
          )}
        </div>
        );
      case "4-2": // LinkedIn
        return (
          <div
            className={`w-[57px] h-[57px] rounded-full ${isActive ? "border-transparent" : "border-[#D9DEDD]"
              } border flex items-center justify-center`}
          >
            {isActive && (
              <img
                src="/assets/Socials/LinkedIn.png"
                alt="LinkedIn"
                className="w-[60px] h-[60px] object-contain"
              />
            )}
          </div>
        );
      case "4-4": // Email
        return (
          <div
            className={`w-[57px] h-[57px] rounded-full ${isActive ? "border-transparent" : "border-[#D9DEDD]"
              } border flex items-center justify-center`}
          >
            {isActive && (
              <img
                src="/assets/Socials/Email.png"
                alt="Email"
                className="w-[60px] h-[60px] object-contain"
              />
            )}
          </div>
        );
      default:
        return (
          <div className="w-[30px] h-[30px] sm:w-[40px] sm:h-[40px] md:w-[57px] md:h-[57px] rounded-full border border-[#D9DEDD]" />
        );
    }
  };

  // Renders Each Cell
  const GridCell = ({
    cellKey,
    isFilled,
    isActive,
  }: {
    cellKey: string;
    isFilled: boolean;
    isActive: boolean;
  }) => {
    if (!isFilled) return null;

    return (
      <motion.div
        key={cellKey}
        aria-label={`Grid cell ${cellKey}`}
        className={`w-full h-full flex flex-col items-center justify-center border border-[#D9DEDD] rounded-lg ${isActive && "shadow-md"
          }`}
        variants={iconVariants}
        initial={false} // Prevent re-initialization
        animate={isActive ? "active" : "inactive"} // Only change when `isActive` changes
      >
        {renderSVG(cellKey, isActive)}
        {/*
        {isActive && (
          <p
            className={`text-[7px] sm:text-xs text-[#18042A] mt-1 font-medium ${inter.className}`}
          >
            {titlesMap[cellKey as keyof typeof titlesMap]}
          </p>
        )}
          */}
      </motion.div>
    );
  };

  const width = 600;
  const height = 600;

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
                      strokeLinecap="round" // Smooth line ends
                      strokeLinejoin="round" // Smooth corners
                      variants={pathVariants}
                      initial="initial"
                      animate={animationPhase}
                      exit="erasing"
                    />
                  );
                })}
              </mask>
              {animationSets[activeSet].paths.map((path, index) => {
                const isLastSet = activeSet === animationSets.length - 1; // Check if it's the last active set
                const isFirstSet = activeSet === 0; // Check if it's the first active set
                const gradientDirection = isFirstSet
                  ? index === 0
                    ? { y1: "1", y2: "0" } // Bottom to top for the first path
                    : { y1: "0", y2: "1" } // Top to bottom for the second path
                  : isLastSet
                    ? { y1: "1", y2: "0" } // Bottom to top for the last set
                    : { y1: "0", y2: "1" }; // Default top to bottom for other sets
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
                );
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
              );
            })}
          </>
        )}
      </svg>

      <div
        className="grid grid-cols-6 gap-x-2 gap-y-3 mx-auto"
        style={{ width: "fit-content" }}
      >
        {gridLayout.map((row, rowIndex) =>
          row.map((isFilled, colIndex) => {
            const key = `${rowIndex}-${colIndex}`;
            const isActive = isNodeActive(key);

            return (
              <div
                key={key}
                className="w-[45px] h-[45px] sm:w-[55px] sm:h-[55px] md:w-[80px] md:h-[80px] flex items-center justify-center z-10"
              >
                <GridCell
                  cellKey={key}
                  isFilled={isFilled}
                  isActive={isActive}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default GridComponent;
