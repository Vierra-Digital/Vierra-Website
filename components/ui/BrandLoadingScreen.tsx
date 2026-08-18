import React from "react";
import Image from "next/image";
import { m as motion } from "framer-motion";

/**
 * The full-screen branded loading state (dark canvas, drifting grid + starfield, white
 * wordmark, bouncing dots).
 *
 * Shared on purpose: the login screen and the email panel both show this while they boot, and
 * they used to be hand-rolled separately — which meant the logo, sizing and motion drifted apart.
 * Changing it here changes it everywhere.
 */

const GRID_LINES = Array.from({ length: 7 }, (_, i) => i);

/** Animated dark canvas: drifting vertical grid lines, two starfield layers, and a vignette. */
export const BrandAnimatedBackground: React.FC = () => (
  <div className="brand-load-bg" aria-hidden="true">
    {GRID_LINES.map((i) => (
      <motion.div
        key={i}
        className="brand-load-gridline"
        style={{ left: `${((i + 1) * 100) / 8}%` }}
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "100%", opacity: 0.07, x: [0, 10, 0] }}
        transition={{
          duration: 1.1,
          delay: i * 0.06,
          ease: "easeInOut",
          x: { duration: 4, repeat: Infinity, ease: "easeInOut" },
        }}
      />
    ))}
    <div className="brand-load-stars" />
    <div className="brand-load-stars brand-load-stars--2" />
    <div className="brand-load-vignette" />
  </div>
);

export const BrandLoadingStyles: React.FC = () => (
  <style jsx global>{`
    .brand-load-shell {
      position: relative;
      min-height: 100vh;
      min-height: 100dvh;
      overflow: hidden;
      background: #18042a;
    }
    .brand-load-bg {
      position: absolute;
      inset: 0;
      z-index: 0;
      overflow: hidden;
    }
    .brand-load-gridline {
      position: absolute;
      top: 0;
      width: 0;
      border-left: 1px solid #ffffff;
      will-change: height, transform, opacity;
    }
    .brand-load-stars {
      position: absolute;
      inset: -10%;
      background-image:
        radial-gradient(1.5px 1.5px at 25px 35px, rgba(255, 255, 255, 0.9), transparent),
        radial-gradient(1.5px 1.5px at 120px 80px, rgba(255, 255, 255, 0.7), transparent),
        radial-gradient(1px 1px at 70px 160px, rgba(255, 255, 255, 0.8), transparent),
        radial-gradient(1px 1px at 180px 50px, rgba(255, 255, 255, 0.6), transparent),
        radial-gradient(1.5px 1.5px at 200px 140px, rgba(255, 255, 255, 0.85), transparent),
        radial-gradient(1px 1px at 40px 110px, rgba(255, 255, 255, 0.5), transparent);
      background-repeat: repeat;
      background-size: 220px 220px;
      opacity: 0.8;
      animation: brand-load-stars-drift 5s linear infinite;
    }
    .brand-load-stars--2 {
      background-size: 440px 440px;
      opacity: 0.5;
      animation: brand-load-stars-drift-2 9s linear infinite;
    }
    @keyframes brand-load-stars-drift {
      to { background-position: 220px 220px; }
    }
    @keyframes brand-load-stars-drift-2 {
      to { background-position: 440px 440px; }
    }
    .brand-load-vignette {
      position: absolute;
      inset: 0;
      background: radial-gradient(120% 120% at 50% 50%, transparent 55%, rgba(8, 1, 18, 0.65) 100%);
    }
    @media (prefers-reduced-motion: reduce) {
      .brand-load-stars, .brand-load-stars--2 { animation: none; }
    }
  `}</style>
);

/** The three bouncing dots used as the "working…" indicator. */
export const BrandLoadingDots: React.FC<{ className?: string }> = ({ className = "" }) => (
  <div className={`relative z-10 flex items-center gap-1.5 ${className}`}>
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className="h-2 w-2 rounded-full bg-white/70 motion-safe:animate-bounce"
        style={{ animationDelay: `${i * 150}ms` }}
      />
    ))}
  </div>
);

const BrandLoadingScreen: React.FC = () => (
  <div className="brand-load-shell flex flex-col items-center justify-center gap-6">
    <BrandAnimatedBackground />
    <Image
      src="/assets/vierra-logo-black-3.png"
      alt="Vierra"
      width={220}
      height={64}
      className="pointer-events-none relative z-10 h-10 w-auto select-none opacity-95 brightness-0 invert"
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      priority
    />
    <BrandLoadingDots />
    <BrandLoadingStyles />
  </div>
);

export default BrandLoadingScreen;
