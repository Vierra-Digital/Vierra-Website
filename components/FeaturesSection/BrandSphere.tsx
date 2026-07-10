"use client"

// Client-only wrapper for the WebGL brand-universe sphere: keeps three.js out of
// the SSR path and freezes the auto-spin under prefers-reduced-motion (drag still
// works). Same default export as before, so FeatureBento needs no change.
import { useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"

const BrandSphere3D = dynamic(() => import("./BrandSphere3D"), {
  ssr: false,
  loading: () => <div aria-hidden className="absolute inset-0" />,
})

export default function BrandSphere() {
  const [reducedMotion, setReducedMotion] = useState(false)
  const [inView, setInView] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReducedMotion(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])

  // Only run the WebGL render loop while the sphere is on screen — saves the GPU
  // (and avoids rendering below the fold on load).
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.05 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full"
      role="img"
      aria-label="A rotating 3D sphere of brand logos across the industries Vierra serves"
    >
      <BrandSphere3D paused={reducedMotion} active={inView} />
    </div>
  )
}
