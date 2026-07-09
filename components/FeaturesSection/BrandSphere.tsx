"use client"

import { useEffect, useMemo, useRef } from "react"

const LOGOS = [
  "Discord", "Email", "Facebook", "GoHighLevel", "GoogleAnalytics", "GoogleBusiness",
  "Instagram", "LinkedIn", "SEO", "SnapChat", "TikTok", "Twitter", "YouTube",
].map((n) => `/assets/Socials/${n}.png`)

// Double up for a fuller sphere.
const POINTS = [...LOGOS, ...LOGOS]

// Even distribution of n points on a unit sphere.
function fibSphere(n: number): [number, number, number][] {
  const pts: [number, number, number][] = []
  const gr = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2
    const r = Math.sqrt(Math.max(0, 1 - y * y))
    const th = gr * i
    pts.push([Math.cos(th) * r, y, Math.sin(th) * r])
  }
  return pts
}

export default function BrandSphere() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])
  const base = useMemo(() => fibSphere(POINTS.length), [])
  const rot = useRef({ x: -0.25, y: 0 })
  const vel = useRef({ x: 0, y: 0.0032 })
  const pointer = useRef({ active: false, nx: 0, ny: 0 })

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    let raf = 0
    const render = () => {
      const rect = wrap.getBoundingClientRect()
      const R = Math.min(rect.width, rect.height) * 0.42
      // Ease velocity toward target: gentle auto-spin + a small mouse-driven steer.
      const targetY = 0.0032 + (pointer.current.active ? pointer.current.nx * 0.05 : 0)
      const targetX = pointer.current.active ? -pointer.current.ny * 0.05 : 0
      vel.current.y += (targetY - vel.current.y) * 0.06
      vel.current.x += (targetX - vel.current.x) * 0.06
      rot.current.x += vel.current.x
      rot.current.y += vel.current.y

      const cx = Math.cos(rot.current.x), sx = Math.sin(rot.current.x)
      const cy = Math.cos(rot.current.y), sy = Math.sin(rot.current.y)
      for (let i = 0; i < base.length; i++) {
        const el = itemRefs.current[i]
        if (!el) continue
        const [x, y, z] = base[i]
        const x1 = x * cy - z * sy
        const z1 = x * sy + z * cy
        const y2 = y * cx - z1 * sx
        const z2 = y * sx + z1 * cx
        const depth = (z2 + 1) / 2 // 0 (back) .. 1 (front)
        const scale = 0.55 + depth * 0.75
        el.style.transform = `translate(-50%,-50%) translate3d(${x1 * R}px, ${y2 * R}px, 0) scale(${scale})`
        el.style.opacity = String(0.35 + depth * 0.65)
        el.style.zIndex = String(Math.round(depth * 100))
        el.style.filter = depth < 0.5 ? `blur(${(0.5 - depth) * 2.4}px)` : "none"
      }
      raf = requestAnimationFrame(render)
    }
    raf = requestAnimationFrame(render)
    return () => cancelAnimationFrame(raf)
  }, [base])

  const onMove = (e: React.PointerEvent) => {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return
    pointer.current = {
      active: true,
      nx: (e.clientX - rect.left) / rect.width - 0.5,
      ny: (e.clientY - rect.top) / rect.height - 0.5,
    }
  }
  const onLeave = () => {
    pointer.current.active = false
  }

  return (
    <div
      ref={wrapRef}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className="relative h-full w-full cursor-grab select-none"
    >
      {POINTS.map((src, i) => (
        <div
          key={i}
          ref={(el) => {
            itemRefs.current[i] = el
          }}
          className="absolute left-1/2 top-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-b from-white to-[#DCD9EA] shadow-[0_12px_24px_-6px_rgba(0,0,0,0.7),inset_0_2px_2px_rgba(255,255,255,0.95),inset_0_-4px_6px_rgba(0,0,0,0.18)] ring-1 ring-black/10 will-change-transform"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" aria-hidden className="h-6 w-6 object-contain" draggable={false} />
        </div>
      ))}
    </div>
  )
}
