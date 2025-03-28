import React, { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
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

const imagesMap = {
  "3-0": "/assets/Socials/Connect.png",
  "1-4": "/assets/Socials/GoogleAnalytics.png",
  "2-2": "/assets/Socials/Payments.png",
  "2-5": "/assets/Socials/SEO.png",
  "4-2": "/assets/Socials/Terminal.png",
  "4-4": "/assets/Socials/Email.png",
};

const titlesMap = {
  "3-0": "Connect",
  "1-4": "Analytics",
  "2-2": "Payments",
  "2-5": "SEO",
  "4-2": "Terminal",
  "4-4": "Email",
};

const animationSets = [
  {
    source: "2-2", // Payments
    targets: ["3-0", "4-2"], // Connect, Terminal
    gradients: ["instagramToFacebook", "instagramToLinkedIn"],
    paths: [
      "M240,290 L240,340 C240,348 232,355 224,355 L93,355",
      "M250,290 L250,425",
    ],
  },
  {
    source: "1-4", // Google Analytics
    targets: ["2-5", "4-4"], // SEO, Email
    gradients: ["googleAnalyticsToSeo", "googleAnalyticsToEmail"],
    paths: [
      "M460,175 L460,240 C460,248 468,255 476,255 L512,255",
      "M450,175 L450,426",
    ],
  },
];

const GridComponent = () => {
  const [activeSet, setActiveSet] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationPhase, setAnimationPhase] = useState<
    "drawing" | "showing" | "erasing" | "idle"
  >("idle");
  const [activeNodes, setActiveNodes] = useState<string[]>([]);

  useEffect(() => {
    const runAnimation = () => {
      const currentSet = animationSets[activeSet];

      // Start drawing animation
      setIsAnimating(true);
      setAnimationPhase("drawing");
      setActiveNodes([currentSet.source]);

      // Activate target nodes after line animation is complete
      const targetTimer = setTimeout(() => {
        setActiveNodes([currentSet.source, ...currentSet.targets]);
        setAnimationPhase("showing");
      }, 1000);

      // Start erasing animation after showing for a bit
      const eraseTimer = setTimeout(() => {
        setAnimationPhase("erasing");
      }, 2000);

      // Reset and prepare for next set
      const resetTimer = setTimeout(() => {
        setIsAnimating(false);
        setAnimationPhase("idle");
        setActiveNodes([]);
        setActiveSet((prev) => (prev + 1) % animationSets.length);
      }, 3000);

      return { targetTimer, eraseTimer, resetTimer };
    };

    // Run first animation immediately
    const timers = runAnimation();

    // Set up interval for subsequent animations
    const intervalTimer = setInterval(() => {
      runAnimation();
    }, 5000);

    // Cleanup function
    return () => {
      clearTimeout(timers.targetTimer);
      clearTimeout(timers.eraseTimer);
      clearTimeout(timers.resetTimer);
      clearInterval(intervalTimer);
    };
  }, [activeSet]);

  const isNodeActive = (key: string) => {
    return activeNodes.includes(key);
  };

  const pathVariants = {
    initial: {
      opacity: 0,
      pathLength: 0,
      pathOffset: 0,
    },
    drawing: {
      opacity: 0.7,
      pathLength: 1,
      pathOffset: 0,
      transition: {
        pathLength: { duration: 1, ease: "easeInOut" },
        opacity: { duration: 0.2 },
      },
    },
    showing: {
      opacity: 0.7,
      pathLength: 1,
      pathOffset: 0,
    },
    erasing: {
      opacity: 0.7,
      pathLength: 1,
      pathOffset: 1,
      transition: {
        pathOffset: { duration: 1, ease: "easeInOut" },
        opacity: { duration: 0.8 },
      },
    },
    exit: {
      opacity: 0,
      transition: {
        opacity: { duration: 0.2 },
      },
    },
  };

  const iconVariants = {
    inactive: {
      scale: 1,
      opacity: 1,
      transition: {
        duration: 0.3,
        ease: "easeOut",
      },
    },
    active: {
      opacity: 1,
      transition: {
        duration: 0.3,
        ease: "easeOut",
      },
    },
  };

  return (
    <div className="relative" style={{ width: "fit-content" }}>
      <svg
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
        style={{ minWidth: "100%", minHeight: "100%" }}
        preserveAspectRatio="xMidYMid meet"
        viewBox="0 0 600 600"
      >
        <defs>
          <linearGradient
            id="instagramToFacebook"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
          >
            <stop offset="0.43%" stopColor="#1877F2" />
            <stop offset="96.7%" stopColor="#7AE5E6" />
          </linearGradient>
          <linearGradient
            id="instagramToLinkedIn"
            x1="0"
            y1="295"
            x2="0"
            y2="410"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#6166E8" />
            <stop offset="100%" stopColor="#1AE9EC" />
          </linearGradient>
          <linearGradient
            id="googleAnalyticsToSeo"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
          >
            <stop offset="2.84%" stopColor="#FFC600" />
            <stop offset="65.97%" stopColor="#E93948" />
          </linearGradient>
          <linearGradient
            id="googleAnalyticsToEmail"
            x1="0"
            y1="189"
            x2="0"
            y2="410"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#F77E00" />
            <stop offset="62.81%" stopColor="#E52226" />
          </linearGradient>
        </defs>

        <AnimatePresence>
          {isAnimating &&
            animationSets[activeSet].paths.map((path, index) => (
              <motion.path
                key={`${activeSet}-${index}`}
                d={path}
                stroke={`url(#${animationSets[activeSet].gradients[index]})`}
                strokeWidth="4"
                fill="none"
                strokeLinecap="round"
                variants={pathVariants}
                initial="initial"
                animate={animationPhase}
                exit="exit"
              />
            ))}
        </AnimatePresence>
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
                {isFilled ? (
                  <motion.div
                    className={`w-full h-full flex flex-col items-center justify-center bg-[#F3F3F3] border border-[#D9DEDD] rounded-lg hover:shadow-md hover:bg-white ${
                      isActive && "shadow-md bg-white"
                    }`}
                    variants={iconVariants}
                    initial="inactive"
                    animate={isActive ? "active" : "inactive"}
                  >
                    {imagesMap[key as keyof typeof imagesMap] ? (
                      <>
                        <Image
                          src={imagesMap[key as keyof typeof imagesMap]}
                          alt="Icon"
                          className="w-[25px] h-[25px] sm:w-[40px] sm:h-[40px] object-contain"
                          width={40}
                          height={40}
                        />
                        {isActive && (
                          <p
                            className={`text-[7px] sm:text-xs text-[#18042A] mt-1 font-medium ${inter.className}`}
                          >
                            {titlesMap[key as keyof typeof titlesMap]}
                          </p>
                        )}
                      </>
                    ) : (
                      <div className="w-[30px] h-[30px] sm:w-[40px] sm:h-[40px] md:w-[57px] md:h-[57px] rounded-full border border-[#D9DEDD]" />
                    )}
                  </motion.div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default GridComponent;
