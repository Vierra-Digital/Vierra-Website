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

const titlesMap = {
  "0-2": "Tax",
  "2-2": "Payments",
  "3-3": "Radar",
  "3-0": "Connect",
  "1-4": "Capital",
  "2-5": "Treasury",
  "4-2": "Terminal",
  "4-4": "Issuing",
};

const animationSets = [
  {
    source: "2-2", // Payments
    targets: ["0-2", "3-3"], // Tax, Radar
    paths: [
      "M250,200 L250,60",
      "M250,290 L250,335 C250,343 258,350 266,350 L310,350",
    ],
    colors: ["#9966ff", "#ff5996"],
  },
  {
    source: "2-2", // Payments
    targets: ["3-0", "4-2"], // Connect, Terminal
    paths: [
      "M240,290 L240,340 C240,348 232,355 224,355 L93,355",
      "M250,290 L250,425",
    ],
    colors: ["#9966FF", "#11EFE3"],
  },
  {
    source: "4-4", // Issuing
    targets: ["2-5", "1-4"], // Treasury, Capital
    paths: [
      "M460,426 L460,270 C460,262 468,255 476,255 L512,255",
      "M450,426 L450,175",
    ],
    colors: ["#0073e6", "#ff80ff"],
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
      case "3-0": // Connect
        return (
          <svg
            className={`${svgSize}`}
            viewBox="0 0 40 40"
            fill="none"
            stroke={strokeColor}
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12.47.01a13.01 13.01 0 0 0 .5 25.99h10.55c1.37 0 2.48-1.1 2.48-2.48V13.01a12.99 12.99 0 0 0-13.53-13z"
              fill={isActive ? "url(#product-icon-connect-Sticky-a)" : "none"}
            />
            <path
              d="M27.53 39.99a13.01 13.01 0 0 0-.5-25.99H16.48A2.48 2.48 0 0 0 14 16.48v10.51a12.99 12.99 0 0 0 13.53 13z"
              fill={isActive ? "#0073E6" : "none"}
            />
            <path
              d="M26 14v9.52A2.48 2.48 0 0 1 23.52 26H14v-9.52A2.48 2.48 0 0 1 16.32 14l.16-.01H26z"
              fill={isActive ? "url(#product-icon-connect-Sticky-b)" : "none"}
            />
            {isActive && (
              <defs>
                <linearGradient
                  id="product-icon-connect-Sticky-a"
                  x1="13"
                  y1="1.71"
                  x2="13"
                  y2="15.25"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#11EFE3" />
                  <stop offset=".33" stopColor="#15E8E2" />
                  <stop offset=".74" stopColor="#1FD3E0" />
                  <stop offset="1" stopColor="#21CFE0" />
                </linearGradient>
                <linearGradient
                  id="product-icon-connect-Sticky-b"
                  x1="20"
                  y1="15.72"
                  x2="20"
                  y2="27.24"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#00299C" />
                  <stop offset="1" stopColor="#0073E6" />
                </linearGradient>
              </defs>
            )}
          </svg>
        );
      case "1-4": // Capital
        return (
          <svg
            className={`${svgSize}`}
            viewBox="0 0 40 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            stroke={strokeColor}
          >
            <path
              d="M23.95 14.05l-9.74 2.12-12.18 2.52A2.59 2.59 0 0 0 0 21.22v16.26A2.5 2.5 0 0 0 2.54 40H27V16.57a2.55 2.55 0 0 0-3.05-2.52z"
              fill={isActive ? "url(#product-icon-capital-Sticky-a)" : "none"}
            ></path>
            <path
              d="M36.85.05l-21.82 4.6A2.57 2.57 0 0 0 13 7.15V40h24.46c1.42-.2 2.54-1.3 2.54-2.7V2.55c0-1.6-1.52-2.8-3.15-2.5z"
              fill={isActive ? "url(#product-icon-capital-Sticky-b)" : "none"}
            ></path>
            <path
              d="M23.95 14.05c1.63-.3 3.05.9 3.05 2.52V40H13V16.42l1.21-.25 9.74-2.12z"
              fill={isActive ? "url(#product-icon-capital-Sticky-c)" : "none"}
            ></path>
            <defs>
              <linearGradient
                id="product-icon-capital-Sticky-a"
                x1="13.52"
                y1="36.35"
                x2="13.52"
                y2="18.21"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#00D0E1"></stop>
                <stop offset="1" stopColor="#00F5E7"></stop>
              </linearGradient>
              <linearGradient
                id="product-icon-capital-Sticky-b"
                x1="26.46"
                x2="26.46"
                y2="40"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#00D924"></stop>
                <stop offset="1" stopColor="#00D924"></stop>
              </linearGradient>
              <linearGradient
                id="product-icon-capital-Sticky-c"
                x1="19.93"
                y1="40"
                x2="19.93"
                y2="14"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#00D722"></stop>
                <stop offset=".85" stopColor="#00BD01"></stop>
              </linearGradient>
            </defs>
          </svg>
        );
      case "2-2": // Payments
        return (
          <svg
            className={`${svgSize}`}
            viewBox="0 0 40 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            stroke={strokeColor}
          >
            <path
              d="M34.61 11.28a2.56 2.56 0 0 0-1.22-1.04L8.54.2A2.57 2.57 0 0 0 5 2.6V15c0 1.05.64 2 1.61 2.4l6.44 2.6 21.56 8.72c.26-.4.4-.88.39-1.36V12.64c0-.48-.13-.96-.39-1.37z"
              fill={isActive ? "url(#product-icon-payments-Sticky-a)" : "none"}
            />
            <path
              d="M34.63 11.28L13.06 20l-6.45 2.6A2.58 2.58 0 0 0 5 25v12.42a2.58 2.58 0 0 0 3.54 2.39L33.4 29.76c.5-.21.93-.57 1.21-1.04.26-.41.4-.88.39-1.36V12.64c0-.48-.12-.95-.37-1.36z"
              fill={isActive ? "#96F" : "none"}
            />
            <path
              d="M34.62 11.28l.1.17c.18.37.28.77.28 1.19v-.03 14.75c0 .48-.13.95-.39 1.36L13.06 20l21.56-8.72z"
              fill={isActive ? "url(#product-icon-payments-Sticky-b)" : "none"}
            />
            {isActive && (
              <defs>
                <linearGradient
                  id="product-icon-payments-Sticky-a"
                  x1="20"
                  y1="4.13"
                  x2="20"
                  y2="21.13"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#11EFE3" />
                  <stop offset="1" stopColor="#21CFE0" />
                </linearGradient>
                <linearGradient
                  id="product-icon-payments-Sticky-b"
                  x1="35"
                  y1="11.28"
                  x2="35"
                  y2="28.72"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#0048E5" />
                  <stop offset="1" stopColor="#9B66FF" />
                </linearGradient>
              </defs>
            )}
          </svg>
        );
      case "2-5": //Treasury
        return (
          <svg
            className={`${svgSize}`}
            viewBox="0 0 40 40"
            fill="none"
            stroke={strokeColor}
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M29 14.5c0-.36-.07-.71-.22-1.04l-3.92-8.94A2.52 2.52 0 0 0 22.56 3H2.52A2.54 2.54 0 0 0 0 5.56v17.88A2.54 2.54 0 0 0 2.52 26h20.04c1 0 1.9-.6 2.3-1.52l3.92-8.94c.15-.33.22-.68.22-1.04z"
              fill={isActive ? "url(#product-icon-banking-Sticky-a)" : "none"}
            ></path>
            <path
              d="M11 25.5c0 .36.07.71.22 1.04l3.92 8.94c.4.93 1.3 1.52 2.3 1.52h20.04c1.4 0 2.52-1.14 2.52-2.56V16.56A2.54 2.54 0 0 0 37.48 14H17.44c-1 0-1.9.6-2.3 1.52l-3.92 8.94c-.15.33-.22.68-.22 1.04z"
              fill={isActive ? "#00D924" : "none"}
            ></path>
            <path
              d="M28.95 14a2.59 2.59 0 0 1-.17 1.54l-3.92 8.94c-.4.93-1.3 1.52-2.3 1.52H11.05a2.59 2.59 0 0 1 .17-1.54l3.92-8.94c.4-.93 1.3-1.52 2.3-1.52h11.51z"
              fill={isActive ? "url(#product-icon-banking-Sticky-b)" : "none"}
            ></path>
            <defs>
              <linearGradient
                id="product-icon-banking-Sticky-a"
                x1="14.5"
                y1="6.13"
                x2="14.5"
                y2="28.22"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#11EFE3"></stop>
                <stop offset=".35" stopColor="#14E8E2"></stop>
                <stop offset=".86" stopColor="#1ED6E1"></stop>
                <stop offset="1" stopColor="#21CFE0"></stop>
              </linearGradient>
              <linearGradient
                id="product-icon-banking-Sticky-b"
                x1="25.31"
                y1="29.5"
                x2="25.31"
                y2="9"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#00D924"></stop>
                <stop offset="1" stopColor="#00A600"></stop>
              </linearGradient>
            </defs>
          </svg>
        );
      case "4-2": // Terminal
        return (
          <svg
            className={`${svgSize}`}
            viewBox="0 0 40 40"
            fill="none"
            stroke={strokeColor}
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M36.98 14.05l-6.31 1.36L9.33 20l-7.35 1.58A2.52 2.52 0 0 0 0 24.05v13.42C0 38.87 1.12 40 2.5 40h35c1.38 0 2.5-1.13 2.5-2.53V16.53c0-.77-.34-1.49-.93-1.97a2.48 2.48 0 0 0-2.09-.5z"
              fill={isActive ? "#9B66FF" : "none"}
            />
            <path
              d="M28.59 0H11.58A2.54 2.54 0 0 0 9 2.5v25c0 1.38 1.15 2.5 2.58 2.5h16.84A2.54 2.54 0 0 0 31 27.5v-25A2.5 2.5 0 0 0 28.59 0z"
              fill={isActive ? "url(#product-icon-terminal-Sticky-a)" : "none"}
            />
            <path
              d="M31 15.34V27.5c0 1.38-1.15 2.5-2.58 2.5H11.58A2.54 2.54 0 0 1 9 27.5v-7.43l.33-.07 21.34-4.59.33-.07z"
              fill={isActive ? "url(#product-icon-terminal-Sticky-b)" : "none"}
            />
            {isActive && (
              <defs>
                <linearGradient
                  id="product-icon-terminal-Sticky-a"
                  x1="20"
                  y1="1.97"
                  x2="20"
                  y2="17.6"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#11EFE3" />
                  <stop offset=".33" stopColor="#15E8E2" />
                  <stop offset=".74" stopColor="#1FD3E0" />
                  <stop offset="1" stopColor="#21CFE0" />
                </linearGradient>
                <linearGradient
                  id="product-icon-terminal-Sticky-b"
                  x1="31"
                  y1="22.67"
                  x2="5.34"
                  y2="22.67"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#0048E5" />
                  <stop offset=".64" stopColor="#625AF5" />
                  <stop offset="1" stopColor="#8A62FC" />
                </linearGradient>
              </defs>
            )}
          </svg>
        );
      case "4-4": // Issuing
        return (
          <svg
            className={`${svgSize}`}
            viewBox="0 0 40 40"
            fill="none"
            stroke={strokeColor}
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M7.62 26.48l-.02-.03a2.44 2.44 0 0 1-.7-1.48 2.49 2.49 0 0 1 .11-1.05c.05-.28.13-.54.24-.77l.08-.17L14.67 10h21.85A2.52 2.52 0 0 1 39 12.37l.01.16v22.92A2.52 2.52 0 0 1 36.67 38l-.16.01H19a2.5 2.5 0 0 0 .64-1.97c-.07-.66-.43-1.09-.95-1.47l-.15-.1-10.62-7.73-.14-.1v-.01l.14.1a2.52 2.52 0 0 1-.27-.21l-.03-.03z"
              fill={isActive ? "url(#product-icon-issuing-Sticky-a)" : "none"}
            ></path>
            <path
              d="M22.05 2.1c.7-.15 1.41 0 1.99.41l6.56 4.72a2.5 2.5 0 0 1 .92 2.8V10l-8.5 26-.05.2-.03.08-.03.09-.15.32-.02.04-.19.29-.03.04a2.9 2.9 0 0 1-.23.25l-.03.02a2.24 2.24 0 0 1-.58.4l-.03.03c-.1.05-.2.1-.31.13h-.05l-.33.08h-.05a2.3 2.3 0 0 1-.36.03H3.53A2.53 2.53 0 0 1 1 35.45v-22.9C1 11.14 2.13 10 3.53 10H16.6l3.8-6.7a2.5 2.5 0 0 1 1.46-1.15l.18-.05z"
              fill={isActive ? "#0073E6" : "none"}
            ></path>
            <path
              d="M31.38 10l-8.37 26-.02.1-.02.1-.03.08-.03.09-.07.16-.08.16-.02.04-.1.15-.09.14-.03.04-.11.13-.12.12-.03.02c-.08.09-.17.16-.26.23l-.15.1-.17.08-.03.02-.15.07-.16.06h-.05l-.16.05-.1.01.1-.1c.4-.51.59-1.17.51-1.82-.07-.66-.43-1.09-.95-1.47l-.15-.1-10.62-7.73-.14-.1a2.54 2.54 0 0 1-.26-.26l-.04-.05a2.48 2.48 0 0 1-.12-.14l-.02-.04-.03-.04a2.43 2.43 0 0 1-.17-.3l-.03-.06a2.5 2.5 0 0 1-.15-.42l-.01-.07-.02-.1-.01-.06a2.51 2.51 0 0 1 .05-1.01l.02-.09a2.5 2.5 0 0 1 .04-.1c.03-.25.1-.5.21-.74l.1-.17L16.66 10h14.71z"
              fill={isActive ? "url(#product-icon-issuing-Sticky-b)" : "none"}
            ></path>
            <defs>
              <linearGradient
                id="product-icon-issuing-Sticky-a"
                x1="22.92"
                y1="11.68"
                x2="22.92"
                y2="39.68"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset=".1" stopColor="#FF80FF"></stop>
                <stop offset=".39" stopColor="#FF7BF9"></stop>
                <stop offset=".77" stopColor="#FF6EEA"></stop>
                <stop offset="1" stopColor="#FF62DC"></stop>
              </linearGradient>
              <linearGradient
                id="product-icon-issuing-Sticky-b"
                x1="31.38"
                y1="27.93"
                x2="11.62"
                y2="27.93"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#0073E6"></stop>
                <stop offset="1" stopColor="#00299C"></stop>
              </linearGradient>
            </defs>
          </svg>
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
        className={`w-full h-full flex flex-col items-center justify-center border border-[#D9DEDD] rounded-lg ${
          isActive && "shadow-md"
        }`}
        variants={iconVariants}
        initial={false} // Prevent re-initialization
        animate={isActive ? "active" : "inactive"} // Only change when `isActive` changes
      >
        {renderSVG(cellKey, isActive)}
        {isActive && (
          <p
            className={`text-[7px] sm:text-xs text-[#18042A] mt-1 font-medium ${inter.className}`}
          >
            {titlesMap[cellKey as keyof typeof titlesMap]}
          </p>
        )}
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
                      strokeWidth="1.5"
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
