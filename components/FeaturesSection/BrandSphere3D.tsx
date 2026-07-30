"use client"

// The "Brand Universe" as a true 3D (WebGL) cloud of clay balls, each tinted a
// light pastel of its brand color and carrying that brand's logo. Auto-rotates
// and can be dragged. Rendered with React Three Fiber; loaded client-only via
// BrandSphere.tsx.
import { useEffect, useMemo, useRef } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { Billboard, Environment, Lightformer } from "@react-three/drei"
import * as THREE from "three"

// ⚠️ Representative brands + their brand colors (from the Simple Icons CDN).
// Swap for your real target/client brands; see public/assets/brands/ATTRIBUTION.md.
const BRANDS: { slug: string; color: string }[] = [
  { slug: "nike", color: "#111111" },
  { slug: "adidas", color: "#000000" },
  { slug: "peloton", color: "#181A1D" },
  { slug: "ghost", color: "#15171A" },
  { slug: "headspace", color: "#F47D31" },
  { slug: "strava", color: "#FC4C02" },
  { slug: "fitbit", color: "#00B0B9" },
  { slug: "garmin", color: "#000000" },
  { slug: "underarmour", color: "#1D1D1D" },
  { slug: "reebok", color: "#E41D1B" },
  { slug: "puma", color: "#242B2F" },
  { slug: "newbalance", color: "#CF0A2C" },
  { slug: "uniqlo", color: "#FF0000" },
  { slug: "redbull", color: "#DB0A40" },
  { slug: "starbucks", color: "#006241" },
  { slug: "airbnb", color: "#FF5A5F" },
  { slug: "uber", color: "#000000" },
  { slug: "lyft", color: "#FF00BF" },
  { slug: "doordash", color: "#FF3008" },
  { slug: "instacart", color: "#43B02A" },
  { slug: "hellofresh", color: "#99CC33" },
  { slug: "etsy", color: "#F16521" },
  { slug: "shopify", color: "#7AB55C" },
  { slug: "squarespace", color: "#000000" },
  { slug: "sonos", color: "#000000" },
  { slug: "spotify", color: "#1ED760" },
  { slug: "netflix", color: "#E50914" },
  { slug: "duolingo", color: "#58CC02" },
  { slug: "audible", color: "#F8991C" },
]

const RADIUS = 1.95
const BALL_R = 0.3
const scratch = new THREE.Vector3()
const WHITE = new THREE.Color("#ffffff")

// A light pastel of the brand color for the ball body (keeps logos legible).
function tint(hex: string) {
  return new THREE.Color(hex).lerp(WHITE, 0.8)
}

function fibSphere(n: number): THREE.Vector3[] {
  const pts: THREE.Vector3[] = []
  const gr = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2
    const r = Math.sqrt(Math.max(0, 1 - y * y))
    const th = gr * i
    pts.push(new THREE.Vector3(Math.cos(th) * r * RADIUS, y * RADIUS, Math.sin(th) * r * RADIUS))
  }
  return pts
}

function makeLogoTexture(url: string) {
  const size = 256
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = size
  const ctx = canvas.getContext("2d")!
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  const img = new Image()
  img.onload = () => {
    const pad = size * 0.2
    const box = size - 2 * pad
    const iw = img.width || size
    const ih = img.height || size
    const sc = Math.min(box / iw, box / ih)
    const w = iw * sc
    const h = ih * sc
    ctx.clearRect(0, 0, size, size)
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
    tex.needsUpdate = true
  }
  img.src = url
  return tex
}

function BrandBall({ slug, color, position }: { slug: string; color: string; position: THREE.Vector3 }) {
  const ref = useRef<THREE.Group>(null!)
  const tex = useMemo(() => makeLogoTexture(`/assets/brands/${slug}.svg`), [slug])
  const ballColor = useMemo(() => tint(color), [color])

  useFrame(() => {
    const g = ref.current
    if (!g) return
    g.getWorldPosition(scratch)
    const depth = (scratch.z / RADIUS + 1) / 2
    g.scale.setScalar(0.62 + depth * 0.58)
    const opacity = 0.6 + depth * 0.4
    const ro = Math.round(depth * 100)
    for (const c of g.children) {
      const m = (c as THREE.Mesh).material as THREE.Material | undefined
      if (m) m.opacity = opacity
      c.renderOrder = ro
    }
  })

  return (
    <Billboard ref={ref} position={position}>
      <mesh>
        <sphereGeometry args={[BALL_R, 32, 32]} />
        <meshStandardMaterial color={ballColor} roughness={0.82} metalness={0} transparent />
      </mesh>
      <mesh position={[0, 0, BALL_R + 0.005]}>
        <planeGeometry args={[BALL_R * 1.35, BALL_R * 1.35]} />
        <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </Billboard>
  )
}

function Cloud({ paused }: { paused: boolean }) {
  const group = useRef<THREE.Group>(null!)
  const vel = useRef(0.0024)
  const drag = useRef({ active: false, lastX: 0, lastY: 0 })
  const { gl } = useThree()
  const positions = useMemo(() => fibSphere(BRANDS.length), [])

  useEffect(() => {
    const el = gl.domElement
    const down = (e: PointerEvent) => {
      drag.current = { active: true, lastX: e.clientX, lastY: e.clientY }
    }
    const move = (e: PointerEvent) => {
      if (!drag.current.active || !group.current) return
      const dx = e.clientX - drag.current.lastX
      const dy = e.clientY - drag.current.lastY
      drag.current.lastX = e.clientX
      drag.current.lastY = e.clientY
      group.current.rotation.y += dx * 0.007
      group.current.rotation.x = THREE.MathUtils.clamp(group.current.rotation.x + dy * 0.007, -0.7, 0.7)
      vel.current = dx * 0.007 * 0.6
    }
    const up = () => {
      drag.current.active = false
    }
    el.style.cursor = "grab"
    el.addEventListener("pointerdown", down)
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
    return () => {
      el.removeEventListener("pointerdown", down)
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
  }, [gl])

  useFrame(() => {
    const g = group.current
    if (!g) return
    if (!drag.current.active) {
      g.rotation.y += vel.current
      const idle = paused ? 0 : 0.0024
      vel.current += (idle - vel.current) * 0.02
    }
  })

  return (
    <group ref={group} rotation={[-0.12, 0, 0]}>
      {BRANDS.map((b, i) => (
        <BrandBall key={b.slug} slug={b.slug} color={b.color} position={positions[i]} />
      ))}
    </group>
  )
}

export default function BrandSphere3D({ paused = false, active = true }: { paused?: boolean; active?: boolean }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 6.9], fov: 45 }}
      dpr={[1, 1.5]}
      frameloop={active ? "always" : "never"}
      gl={{ alpha: true, antialias: true }}
      style={{ background: "transparent" }}
    >
      {/* Soft studio environment (baked once) + key + purple rim → clean,
          dimensional clay balls with legible logos. */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[2, 4, 6]} intensity={1.25} />
      <directionalLight position={[-4, 0, -3]} intensity={0.5} color="#C9A9FF" />
      <Environment resolution={64} frames={1}>
        <Lightformer form="rect" intensity={1.5} position={[0, 4, 4]} scale={[12, 7, 1]} color="#ffffff" />
        <Lightformer form="rect" intensity={0.9} position={[-6, -2, -2]} scale={[9, 9, 1]} color="#d9c9ff" />
        <Lightformer form="circle" intensity={1.2} position={[5, 2, -3]} scale={4} color="#ffffff" />
      </Environment>
      <Cloud paused={paused} />
    </Canvas>
  )
}
