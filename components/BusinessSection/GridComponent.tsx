import React, { useState, useEffect, useId, useMemo } from "react";
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
    paths: [
      "M240,290 L240,340 C240,348 232,355 224,355 L93,355",
      "M250,290 L250,425",
    ],
    colors: ["#1877F2", "#7AE5E6"],
  },
  {
    source: "1-4", // Google Analytics
    targets: ["2-5", "4-4"], // SEO, Email
    paths: [
      "M460,175 L460,240 C460,248 468,255 476,255 L512,255",
      "M450,175 L450,426",
    ],
    colors: ["#F77E00", "#E52226"],
  },
];

function App() {
  const [activeSet, setActiveSet] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationPhase, setAnimationPhase] = useState<
    "drawing" | "showing" | "erasing" | "idle"
  >("idle");
  const [activeNodes, setActiveNodes] = useState<string[]>([]);
  const [dataFlowPositions, setDataFlowPositions] = useState<number[]>([0, 0]);
  const gradientId = useId(); // Unique and stable gradient ID

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
      setDataFlowPositions([0, 0]);

      // Draw the main lines
      targetTimer = setTimeout(() => {
        setActiveNodes([currentSet.source, ...currentSet.targets]);
        setAnimationPhase("showing");

        // Start data flow animation
        let progress = 0;
        dataFlowInterval = setInterval(() => {
          progress = (progress + 0.02) % 1;
          setDataFlowPositions([progress, progress]);
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
      intervalTimer = setInterval(() => {
        runAnimation();
      }, 3000);
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
        pathOffset: 0,
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
      scale: 1,
      backgroundColor: "#F3F3F3",
      transition: {
        duration: 0.15,
        ease: "easeOut",
      },
    },
    active: {
      scale: 1,
      backgroundColor: "#FFFFFF",
      transition: {
        backgroundColor: {
          duration: 0.25,
          ease: "easeInOut",
        },
        duration: 0.15,
        ease: "easeOut",
      },
    },
  };

  // Renders SVG
  const renderSVG = (key: string, isActive: boolean) => {
    const svgSize = "w-[25px] h-[25px] sm:w-[40px] sm:h-[40px]";
    const strokeColor = isActive ? "none" : "#D9DEDD";

    switch (key) {
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
      case "1-4": // Google Analytics
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`${svgSize}`}
            viewBox="0 0 40 40"
            version="1.1"
            fill="none"
            stroke={strokeColor}
          >
            <g id="surface1">
              <path
                style={{
                  fillRule: "nonzero",
                  fill: isActive ? "rgb(99.607843%,77.254903%,0%)" : "none",
                  fillOpacity: 1,
                }}
                d="M 19.945312 -0.03125 C 20.066406 -0.0273438 20.066406 -0.0273438 20.183594 -0.0273438 C 21.476562 -0.0273438 22.71875 0.0429688 23.984375 0.3125 C 24.066406 0.328125 24.148438 0.347656 24.230469 0.363281 C 25.871094 0.722656 27.667969 1.222656 29.113281 2.109375 C 29.582031 2.382812 30.003906 2.386719 30.539062 2.378906 C 30.628906 2.382812 30.71875 2.382812 30.808594 2.382812 C 31.1875 2.382812 31.5625 2.382812 31.9375 2.382812 C 34.53125 2.378906 34.53125 2.378906 35.625 3.359375 C 36.289062 4.035156 36.574219 4.957031 36.566406 5.890625 C 36.5625 6.011719 36.558594 6.136719 36.558594 6.257812 C 36.488281 8.273438 36.488281 8.273438 37.382812 10.007812 C 37.59375 10.273438 37.746094 10.574219 37.898438 10.875 C 37.949219 10.964844 37.949219 10.964844 37.996094 11.058594 C 38.808594 12.648438 39.355469 14.382812 39.710938 16.128906 C 39.722656 16.183594 39.734375 16.242188 39.746094 16.296875 C 39.964844 17.445312 40.027344 18.578125 40.023438 19.746094 C 40.023438 19.972656 40.027344 20.203125 40.027344 20.433594 C 40.03125 21.476562 39.9375 22.484375 39.765625 23.515625 C 39.742188 23.648438 39.742188 23.648438 39.722656 23.785156 C 39.683594 23.988281 39.644531 24.1875 39.601562 24.390625 C 39.582031 24.460938 39.566406 24.535156 39.550781 24.609375 C 38.742188 28.082031 37 31.265625 34.53125 33.828125 C 34.480469 33.878906 34.433594 33.929688 34.382812 33.984375 C 33.667969 34.726562 32.941406 35.410156 32.109375 36.015625 C 32.019531 36.082031 31.929688 36.148438 31.839844 36.214844 C 31.199219 36.6875 30.535156 37.109375 29.84375 37.5 C 29.789062 37.53125 29.734375 37.5625 29.675781 37.59375 C 27.867188 38.613281 25.902344 39.296875 23.871094 39.710938 C 23.816406 39.722656 23.757812 39.734375 23.703125 39.746094 C 22.488281 39.976562 21.285156 40.03125 20.054688 40.03125 C 19.933594 40.027344 19.933594 40.027344 19.816406 40.027344 C 18.523438 40.027344 17.28125 39.957031 16.015625 39.6875 C 15.933594 39.671875 15.851562 39.652344 15.769531 39.636719 C 12.152344 38.847656 8.839844 37.101562 6.171875 34.53125 C 6.121094 34.480469 6.070312 34.433594 6.015625 34.382812 C 5.273438 33.667969 4.589844 32.941406 3.984375 32.109375 C 3.917969 32.019531 3.851562 31.929688 3.785156 31.839844 C 3.3125 31.199219 2.894531 30.535156 2.5 29.84375 C 2.472656 29.792969 2.441406 29.746094 2.414062 29.695312 C 0.726562 26.746094 -0.0390625 23.402344 -0.0234375 20.03125 C -0.0234375 19.949219 -0.0234375 19.871094 -0.0234375 19.789062 C -0.0195312 18.648438 0 17.527344 0.234375 16.40625 C 0.25 16.332031 0.265625 16.253906 0.28125 16.175781 C 1.070312 12.394531 2.785156 8.960938 5.46875 6.171875 C 5.519531 6.121094 5.566406 6.070312 5.617188 6.015625 C 6.332031 5.273438 7.058594 4.589844 7.890625 3.984375 C 7.980469 3.917969 8.070312 3.851562 8.160156 3.785156 C 8.800781 3.3125 9.464844 2.890625 10.15625 2.5 C 10.210938 2.46875 10.265625 2.4375 10.324219 2.40625 C 12.132812 1.386719 14.097656 0.703125 16.128906 0.289062 C 16.183594 0.277344 16.242188 0.265625 16.296875 0.253906 C 17.511719 0.0234375 18.714844 -0.03125 19.945312 -0.03125 Z M 19.945312 -0.03125"
              />
              <path
                style={{
                  fillRule: "nonzero",
                  fill: isActive
                    ? "rgb(36.078432%,33.333334%,37.254903%)"
                    : "none",
                  fillOpacity: 1,
                }}
                d="M 19.945312 -0.03125 C 20.066406 -0.0273438 20.066406 -0.0273438 20.183594 -0.0273438 C 21.476562 -0.0273438 22.71875 0.0429688 23.984375 0.3125 C 24.066406 0.328125 24.148438 0.347656 24.230469 0.363281 C 26.125 0.777344 27.882812 1.46875 29.609375 2.34375 C 29.609375 2.371094 29.609375 2.394531 29.609375 2.421875 C 29.511719 2.421875 29.511719 2.421875 29.410156 2.425781 C 29.160156 2.425781 28.910156 2.433594 28.660156 2.4375 C 28.550781 2.441406 28.445312 2.441406 28.335938 2.441406 C 27.230469 2.457031 26.269531 2.660156 25.453125 3.445312 C 24.71875 4.230469 24.507812 5.023438 24.507812 6.078125 C 24.503906 6.164062 24.503906 6.246094 24.503906 6.328125 C 24.5 6.601562 24.5 6.871094 24.5 7.140625 C 24.496094 7.328125 24.496094 7.519531 24.496094 7.707031 C 24.492188 8.199219 24.488281 8.695312 24.484375 9.1875 C 24.480469 9.695312 24.476562 10.199219 24.472656 10.703125 C 24.464844 11.691406 24.460938 12.683594 24.453125 13.671875 C 24.40625 13.671875 24.355469 13.671875 24.308594 13.671875 C 23.136719 13.675781 21.964844 13.679688 20.796875 13.6875 C 20.230469 13.6875 19.664062 13.691406 19.097656 13.691406 C 18.605469 13.695312 18.109375 13.695312 17.617188 13.699219 C 17.355469 13.703125 17.09375 13.703125 16.832031 13.703125 C 16.539062 13.703125 16.25 13.703125 15.957031 13.707031 C 15.871094 13.707031 15.785156 13.707031 15.695312 13.707031 C 14.804688 13.71875 13.996094 14.046875 13.363281 14.683594 C 12.746094 15.421875 12.519531 16.210938 12.527344 17.160156 C 12.527344 17.253906 12.523438 17.347656 12.523438 17.445312 C 12.523438 17.699219 12.523438 17.953125 12.523438 18.207031 C 12.523438 18.472656 12.519531 18.742188 12.519531 19.007812 C 12.515625 19.511719 12.515625 20.015625 12.515625 20.519531 C 12.515625 21.09375 12.511719 21.667969 12.507812 22.242188 C 12.503906 23.421875 12.5 24.601562 12.5 25.78125 C 12.457031 25.78125 12.414062 25.78125 12.371094 25.78125 C 11.316406 25.785156 10.261719 25.792969 9.210938 25.800781 C 8.699219 25.804688 8.191406 25.804688 7.679688 25.808594 C 7.191406 25.808594 6.699219 25.8125 6.207031 25.816406 C 6.019531 25.820312 5.832031 25.820312 5.644531 25.820312 C 5.382812 25.820312 5.117188 25.824219 4.855469 25.824219 C 4.738281 25.824219 4.738281 25.824219 4.621094 25.824219 C 3.757812 25.835938 3.015625 26.085938 2.34375 26.640625 C 2.109375 26.914062 1.914062 27.199219 1.71875 27.5 C 1.640625 27.605469 1.5625 27.707031 1.484375 27.8125 C 0.820312 26.078125 0.316406 24.34375 0.078125 22.5 C 0.0703125 22.449219 0.0664062 22.394531 0.0585938 22.34375 C 0.00390625 21.894531 -0.0117188 21.453125 -0.015625 21.003906 C -0.015625 20.894531 -0.015625 20.894531 -0.015625 20.78125 C -0.0351562 17.695312 -0.0351562 17.695312 0.234375 16.40625 C 0.25 16.332031 0.265625 16.253906 0.28125 16.175781 C 1.070312 12.394531 2.785156 8.960938 5.46875 6.171875 C 5.519531 6.121094 5.566406 6.070312 5.617188 6.015625 C 6.332031 5.273438 7.058594 4.589844 7.890625 3.984375 C 7.980469 3.917969 8.070312 3.851562 8.160156 3.785156 C 8.800781 3.3125 9.464844 2.890625 10.15625 2.5 C 10.210938 2.46875 10.265625 2.4375 10.324219 2.40625 C 12.132812 1.386719 14.097656 0.703125 16.128906 0.289062 C 16.183594 0.277344 16.242188 0.265625 16.296875 0.253906 C 17.511719 0.0234375 18.714844 -0.03125 19.945312 -0.03125 Z M 19.945312 -0.03125"
              />
              <path
                style={{
                  stroke: "none",
                  fillRule: "nonzero",
                  fill: isActive ? "rgb(93.333334%,45.490196%,0%)" : "none",
                  fillOpacity: 1,
                }}
                d="M 36.484375 8.671875 C 36.75 8.9375 36.933594 9.179688 37.117188 9.496094 C 37.164062 9.574219 37.164062 9.574219 37.210938 9.652344 C 37.308594 9.820312 37.402344 9.988281 37.5 10.15625 C 37.53125 10.210938 37.5625 10.269531 37.597656 10.328125 C 38.613281 12.132812 39.296875 14.097656 39.710938 16.128906 C 39.722656 16.183594 39.734375 16.242188 39.746094 16.296875 C 39.964844 17.445312 40.027344 18.578125 40.023438 19.746094 C 40.023438 19.972656 40.027344 20.203125 40.027344 20.433594 C 40.03125 21.476562 39.9375 22.484375 39.765625 23.515625 C 39.742188 23.648438 39.742188 23.648438 39.722656 23.785156 C 39.683594 23.988281 39.644531 24.1875 39.601562 24.390625 C 39.574219 24.5 39.574219 24.5 39.550781 24.609375 C 38.742188 28.082031 37 31.265625 34.53125 33.828125 C 34.480469 33.878906 34.433594 33.929688 34.382812 33.984375 C 33.667969 34.726562 32.941406 35.410156 32.109375 36.015625 C 32.019531 36.082031 31.929688 36.148438 31.839844 36.214844 C 31.199219 36.6875 30.535156 37.109375 29.84375 37.5 C 29.789062 37.53125 29.734375 37.5625 29.675781 37.59375 C 27.867188 38.613281 25.902344 39.296875 23.871094 39.710938 C 23.816406 39.722656 23.757812 39.734375 23.703125 39.746094 C 22.488281 39.976562 21.285156 40.03125 20.054688 40.03125 C 19.933594 40.027344 19.933594 40.027344 19.816406 40.027344 C 18.523438 40.027344 17.28125 39.957031 16.015625 39.6875 C 15.933594 39.671875 15.851562 39.652344 15.769531 39.636719 C 13.9375 39.234375 12.21875 38.582031 10.546875 37.734375 C 10.546875 37.707031 10.546875 37.683594 10.546875 37.65625 C 15.160156 37.65625 19.777344 37.65625 24.53125 37.65625 C 24.53125 29.765625 24.53125 21.878906 24.53125 13.75 C 24.894531 14.0625 25.238281 14.367188 25.574219 14.707031 C 25.644531 14.773438 25.644531 14.773438 25.714844 14.847656 C 25.871094 15 26.023438 15.15625 26.179688 15.3125 C 26.292969 15.425781 26.40625 15.539062 26.519531 15.652344 C 26.824219 15.957031 27.125 16.257812 27.429688 16.5625 C 27.714844 16.847656 28 17.132812 28.28125 17.414062 C 29.113281 18.246094 29.945312 19.078125 30.777344 19.914062 C 32.632812 21.773438 34.492188 23.632812 36.40625 25.546875 C 36.433594 19.976562 36.457031 14.410156 36.484375 8.671875 Z M 36.484375 8.671875"
              />
              <path
                style={{
                  stroke: "none",
                  fillRule: "nonzero",
                  fill: isActive ? "rgb(96.470588%,49.411765%,0%)" : "none",
                  fillOpacity: 1,
                }}
                d="M 27.90625 2.398438 C 28 2.398438 28 2.398438 28.09375 2.398438 C 28.296875 2.394531 28.5 2.394531 28.703125 2.394531 C 28.84375 2.394531 28.984375 2.394531 29.128906 2.394531 C 29.425781 2.394531 29.722656 2.394531 30.023438 2.394531 C 30.402344 2.394531 30.78125 2.390625 31.160156 2.386719 C 31.453125 2.386719 31.746094 2.386719 32.039062 2.386719 C 32.179688 2.386719 32.320312 2.386719 32.457031 2.382812 C 33.683594 2.375 34.675781 2.507812 35.625 3.359375 C 36.371094 4.121094 36.574219 5.121094 36.570312 6.152344 C 36.570312 6.238281 36.570312 6.238281 36.570312 6.324219 C 36.570312 6.515625 36.570312 6.707031 36.570312 6.898438 C 36.566406 7.035156 36.566406 7.175781 36.566406 7.3125 C 36.566406 7.6875 36.566406 8.0625 36.5625 8.4375 C 36.5625 8.671875 36.5625 8.902344 36.5625 9.136719 C 36.558594 10.226562 36.550781 11.320312 36.546875 12.410156 C 36.542969 12.878906 36.542969 13.34375 36.539062 13.8125 C 36.535156 14.691406 36.53125 15.570312 36.527344 16.449219 C 36.523438 17.449219 36.519531 18.453125 36.511719 19.453125 C 36.503906 21.511719 36.496094 23.566406 36.484375 25.625 C 36.121094 25.320312 35.777344 25.003906 35.441406 24.667969 C 35.371094 24.601562 35.371094 24.601562 35.300781 24.527344 C 35.144531 24.375 34.992188 24.21875 34.835938 24.0625 C 34.722656 23.949219 34.609375 23.835938 34.496094 23.722656 C 34.191406 23.417969 33.890625 23.117188 33.585938 22.8125 C 33.300781 22.527344 33.015625 22.242188 32.734375 21.960938 C 31.902344 21.128906 31.070312 20.296875 30.238281 19.460938 C 27.453125 16.671875 27.453125 16.671875 24.609375 13.828125 C 24.582031 21.691406 24.558594 29.554688 24.53125 37.65625 C 24.503906 37.65625 24.480469 37.65625 24.453125 37.65625 C 24.449219 33.539062 24.445312 29.421875 24.441406 25.304688 C 24.441406 24.820312 24.441406 24.332031 24.441406 23.847656 C 24.441406 23.75 24.441406 23.652344 24.441406 23.554688 C 24.4375 21.988281 24.4375 20.421875 24.433594 18.851562 C 24.433594 17.246094 24.429688 15.636719 24.429688 14.03125 C 24.429688 13.039062 24.429688 12.046875 24.429688 11.054688 C 24.425781 10.375 24.425781 9.695312 24.425781 9.011719 C 24.425781 8.621094 24.425781 8.230469 24.425781 7.835938 C 24.425781 7.476562 24.425781 7.117188 24.425781 6.757812 C 24.425781 6.628906 24.425781 6.496094 24.425781 6.367188 C 24.417969 5.179688 24.613281 4.242188 25.441406 3.339844 C 26.109375 2.707031 26.996094 2.398438 27.90625 2.398438 Z M 27.90625 2.398438"
              />
              <path
                style={{
                  fillRule: "nonzero",
                  fill: isActive
                    ? "rgb(36.078432%,33.333334%,37.254903%)"
                    : "none",
                  fillOpacity: 1,
                }}
                d="M 36.484375 8.671875 C 36.75 8.9375 36.933594 9.179688 37.117188 9.496094 C 37.148438 9.546875 37.179688 9.597656 37.210938 9.652344 C 37.308594 9.820312 37.402344 9.988281 37.5 10.15625 C 37.53125 10.210938 37.5625 10.269531 37.597656 10.328125 C 38.613281 12.132812 39.296875 14.097656 39.710938 16.128906 C 39.730469 16.210938 39.730469 16.210938 39.746094 16.296875 C 39.964844 17.445312 40.027344 18.578125 40.023438 19.746094 C 40.023438 19.972656 40.027344 20.203125 40.027344 20.433594 C 40.03125 21.476562 39.9375 22.484375 39.765625 23.515625 C 39.75 23.605469 39.734375 23.691406 39.722656 23.785156 C 39.683594 23.988281 39.644531 24.1875 39.601562 24.390625 C 39.582031 24.460938 39.566406 24.535156 39.550781 24.609375 C 39.023438 26.882812 38.085938 29.507812 36.5625 31.328125 C 36.535156 31.328125 36.511719 31.328125 36.484375 31.328125 C 36.484375 23.851562 36.484375 16.375 36.484375 8.671875 Z M 36.484375 8.671875"
              />
              <path
                style={{
                  fillRule: "nonzero",
                  fill: isActive
                    ? "rgb(35.686275%,32.941177%,37.254903%)"
                    : "none",
                  fillOpacity: 1,
                }}
                d="M 10.546875 37.65625 C 16.785156 37.65625 23.023438 37.65625 29.453125 37.65625 C 27.574219 39.066406 24.785156 39.628906 22.5 39.921875 C 22.449219 39.929688 22.394531 39.933594 22.339844 39.941406 C 21.898438 39.996094 21.464844 40.015625 21.019531 40.019531 C 20.945312 40.019531 20.875 40.019531 20.796875 40.019531 C 19.179688 40.035156 17.605469 40.023438 16.015625 39.6875 C 15.894531 39.660156 15.894531 39.660156 15.769531 39.636719 C 13.9375 39.234375 12.21875 38.582031 10.546875 37.734375 C 10.546875 37.707031 10.546875 37.683594 10.546875 37.65625 Z M 10.546875 37.65625"
              />
            </g>
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
      case "2-5": // SEO
        return (
          <svg
            className={`${svgSize}`}
            viewBox="0 0 40 40"
            fill="none"
            stroke={strokeColor}
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop
                  offset="0%"
                  style={{
                    stopColor: isActive ? "#FBC02D" : "none",
                    stopOpacity: "1",
                  }}
                />
                <stop
                  offset="100%"
                  style={{
                    stopColor: isActive ? "#E53935" : "none",
                    stopOpacity: "1",
                  }}
                />
              </linearGradient>
            </defs>
            <circle
              cx="20"
              cy="20"
              r="20"
              fill={isActive ? "url(#grad1)" : "none"}
            />
            <text
              x="50%"
              y="55%"
              fontFamily="Arial, sans-serif"
              fontSize="14"
              fontWeight="bold"
              fill={isActive ? "white" : "#D9DEDD"}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              SEO
            </text>
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
      case "4-4": // Email
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`${svgSize}`}
            viewBox="0 0 40 40"
            fill="none"
            stroke={strokeColor}
          >
            <path
              fill={isActive ? "#e52226" : "none"}
              d="M19.97 1.62h.2A17.63 17.63 0 0 1 31.4 5.65a16.52 16.52 0 0 1 3.23 3.42 16.3 16.3 0 0 1 2.23 4.13l.08.2a19.35 19.35 0 0 1-.54 14.5 18.01 18.01 0 0 1-2.27 3.66l-.1.14c-.6.75-1.28 1.41-1.96 2.08-.15.15-.3.29-.43.44-.17.16-.17.16-.34.24-.17.06-.17.06-.22.3-.16.06-.16.06-.3.08V35l-.15.02c-.2.07-.27.14-.4.3-.24.15-.24.15-.47.23l-.2.15c-.2.16-.2.16-.43.24l-.37.2c-.79.41-1.57.82-2.42 1.12-.3.09-.3.09-.5.32l-.44.05c-.3.04-.59.12-.88.19l-.18.04-.44.1v.16l-.24-.07h-.39l-.08.23-.15-.05c-.33-.04-.62.04-.94.13v.08h-.55l-.08-.08H19.9c-.79.02-1.55 0-2.33-.11-.39-.05-.39-.05-.76.03l-.08-.16-.38-.1c-.07 0-.15-.02-.23-.04l-.27-.06c-1.63-.38-3.1-1-4.59-1.75l-.28-.13-.19-.1-.15-.08-.2-.16c-.19-.16-.19-.16-.43-.23-.23-.16-.23-.16-.4-.32-.14-.17-.14-.17-.38-.23l-.16-.15-.15-.08-.24-.24-.15-.08c-.14-.12-.27-.25-.4-.39l-.39-.38-.34-.34-.22-.22c-.46-.45-.88-.9-1.27-1.41l-.12-.15h-.16l-.02-.12c-.07-.23-.18-.4-.32-.6l-.15-.2-.13-.17h-.16c0-.05-.02-.1-.03-.14-.07-.27-.22-.5-.36-.74a18.36 18.36 0 0 1-1.4-2.95h-.16v-.39l-.16-.08-.05-.5c-.04-.34-.13-.67-.22-1l-.1-.4L2.3 24a13.7 13.7 0 0 1-.36-3.84l-.15-.08c0-.06.02-.13.04-.2.04-.27.04-.27.03-.58 0-.28.04-.51.08-.78l.09-.7.02-.2c.03-.25.05-.5.05-.76s.07-.45.16-.69l.14-.62c.2-.88.44-1.73.76-2.57l.08-.18c.17-.45.17-.45.34-.53.06-.14.06-.14.1-.31.14-.42.33-.8.53-1.18l.08-.15.3-.42c.1-.13.1-.13.09-.29L5 9.61l.08-.23.31-.32c.33-.4.33-.4.55-.86l.16-.13c.19-.15.33-.28.48-.46.29-.34.59-.65.9-.97l.16-.16c.38-.37.77-.71 1.18-1.04.17-.13.17-.13.32-.28.28-.2.57-.37.86-.55l.23-.15c.55-.34 1.1-.65 1.68-.95.32-.16.32-.16.59-.38.13-.06.13-.06.3-.11l.87-.3c.87-.3 1.73-.58 2.63-.76l.21-.05a17.4 17.4 0 0 1 3.46-.3Zm0 0"
            />
            <path
              fill={isActive ? "#fefcfc" : "none"}
              d="M13.03 12.71h13.39c.62 0 1.1.17 1.63.5-.4.47-.83.91-1.27 1.35l-.38.38c-.66.66-.66.66-1 .95-.47.4-.9.86-1.34 1.3-.99 1-.99 1-1.33 1.29-.47.4-.9.85-1.33 1.29-1.07 1.08-1.07 1.08-1.56 1.48-.7-.32-1.23-1-1.77-1.54-.26-.26-.52-.52-.8-.76-.42-.36-.8-.77-1.2-1.16a18.6 18.6 0 0 0-1-.93c-.34-.3-.66-.65-.98-.98-.26-.26-.52-.52-.8-.76-.37-.32-.7-.66-1.05-1l-.19-.19-.34-.34a17.5 17.5 0 0 0-.38-.39c.55-.34 1.04-.49 1.7-.49Zm0 0"
            />
            <path
              fill={isActive ? "#fefcfc" : "none"}
              d="M16.64 20.63a2 2 0 0 1 .66.49 260.7 260.7 0 0 0 .41.42c.47.47.92.93 1.43 1.35l.16.13c.2.13.37.16.61.15.34-.09.55-.35.8-.6l.3-.3.16-.16a16.09 16.09 0 0 0 1.48-1.4c.28.1.43.25.62.48.35.4.72.77 1.1 1.14.22.22.44.45.65.7a19.41 19.41 0 0 0 1.37 1.43c.37.36.73.7 1.16 1l.1.09v.15c-.33.17-.64.18-1 .18H12.54c-.3 0-.55-.04-.83-.18.12-.3.34-.52.58-.75l.12-.13c.1-.08.18-.17.27-.26l.4-.4c.7-.7.7-.7 1.05-1 .44-.37.84-.79 1.26-1.2l.44-.44.28-.28.13-.13c.22-.22.22-.22.4-.48Zm0 0"
            />
            <path
              fill={isActive ? "#fefcfc" : "none"}
              d="M10.4 14.6c.15 0 .15 0 .33.18a11.35 11.35 0 0 1 .4.4l.18.2.43.43.22.22c.35.35.7.7 1.1 1.02.35.32.69.68 1.03 1.02.32.34.66.65 1.01.96.16.13.3.27.45.42-.1.23-.21.39-.39.57l-.14.14-.15.15-.16.15-.33.33-.5.5-.33.33-.14.15c-.3.29-.6.56-.92.84-.2.18-.4.36-.58.55l-.12.12-.34.35-.24.24-.59.58c-.15-.3-.24-.5-.24-.84V18.1l.01-3.5Zm0 0"
            />
            <path
              fill={isActive ? "#fefcfc" : "none"}
              d="m28.98 14.69.01 3.65v1.69L29 21.5V23.86c-.02.23-.08.4-.17.6-.32-.21-.59-.42-.86-.69l-.1-.1-.36-.36-.24-.24-.52-.52-.65-.66-.51-.5-.24-.25c-1.24-1.23-1.24-1.23-1.44-1.69l.13-.11c.57-.5 1.1-1.04 1.63-1.57.95-.96.95-.96 1.44-1.38.41-.37.8-.78 1.18-1.18l.2-.2.19-.19c.15-.13.15-.13.3-.13Zm0 0"
            />
          </svg>
        );
      default:
        return null;
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
        className={`w-full h-full flex flex-col items-center justify-center border border-[#D9DEDD] rounded-lg hover:shadow-md ${
          isActive && "shadow-md"
        }`}
        variants={iconVariants}
        initial="inactive"
        animate={isActive ? "active" : "inactive"}
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

  return (
    <div className="relative" style={{ width: "fit-content" }}>
      <svg
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
        style={{ minWidth: "100%", minHeight: "100%" }}
        preserveAspectRatio="xMidYMid meet"
        viewBox="0 0 600 600"
      >
        <AnimatePresence>
          {isAnimating &&
            animationSets[activeSet].paths.map((path, index) => {
              return (
                <React.Fragment key={`${activeSet}-${index}`}>
                  {/* Main static line */}
                  <motion.path
                    d={path}
                    stroke={animationSets[activeSet].colors[0]}
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round" // Smooth line ends
                    strokeLinejoin="round" // Smooth corners
                    variants={pathVariants}
                    initial="initial"
                    animate={animationPhase}
                    exit="erasing"
                  />

                  <defs>
                    <linearGradient
                      id={gradientId}
                      gradientUnits="userSpaceOnUse"
                    >
                      <stop
                        offset="0%"
                        stopColor={animationSets[activeSet].colors[0]}
                      />
                      <stop
                        offset="40%"
                        stopColor={animationSets[activeSet].colors[1]}
                      />
                      <stop
                        offset="60%"
                        stopColor={animationSets[activeSet].colors[1]}
                      />
                      <stop
                        offset="100%"
                        stopColor={animationSets[activeSet].colors[0]}
                      />
                    </linearGradient>
                  </defs>

                  {/* Data flow animation - smaller moving line */}
                  {animationPhase === "showing" && (
                    <motion.path
                      d={path}
                      stroke={`url(#${gradientId})`}
                      strokeWidth="2"
                      fill="none"
                      strokeLinecap="round" // Smooth line ends
                      strokeLinejoin="round" // Smooth corners
                      strokeDasharray="240,180"
                      strokeDashoffset={-dataFlowPositions[index] * 400}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.8 }}
                      exit={{ opacity: 0 }}
                      transition={{
                        strokeDashoffset: {
                          repeat: Number.POSITIVE_INFINITY,
                          duration: 1,
                          ease: "linear",
                        },
                      }}
                    />
                  )}
                </React.Fragment>
              );
            })}
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

export default App;
