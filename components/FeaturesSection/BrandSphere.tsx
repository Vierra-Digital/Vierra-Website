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
  const [mounted, setMounted] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReducedMotion(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])

  // Only run the WebGL render loop while the sphere is on screen — saves the GPU.
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.05 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Initialize the WebGL Canvas (heavy three.js boot) only once the sphere is
  // within ~800px of the viewport, then keep it mounted. The generous margin
  // means it's ready before it scrolls into view — no visible pop-in — this just
  // keeps the three.js init off the initial page-load critical path.
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setMounted(true)
          io.disconnect()
        }
      },
      { rootMargin: "800px 0px" }
    )
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
      {mounted && <BrandSphere3D paused={reducedMotion} active={inView} />}
    </div>
  )
}
