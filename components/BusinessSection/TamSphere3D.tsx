"use client"

// TAM Sort & Mining — a dense WebGL cloud of UNIQUE brand-logo balls (no
// duplicates). On a loop it "sorts by ICP fit": non-matching logos fade out in a
// scattered order across the whole sphere (the market counting down), leaving
// only the ~30% that match, then resets. Auto-rotates and is drag-interactive,
// even mid-animation. No HUD. Loaded client-only.
import { useEffect, useMemo, useRef } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { Billboard, Environment, Lightformer } from "@react-three/drei"
import * as THREE from "three"

// 63 unique brands (colored Simple Icons in public/assets/brands-tam).
const SLUGS = [
  "adidas", "airbnb", "airtable", "asana", "audible", "bose", "coinbase", "coursera", "deliveroo", "dji",
  "doordash", "duolingo", "etsy", "figma", "fila", "fitbit", "garmin", "headspace", "hellofresh", "hubspot",
  "instacart", "intercom", "jbl", "klarna", "lyft", "mailchimp", "mcdonalds", "medium", "monzo", "netflix",
  "newbalance", "nike", "notion", "patreon", "paypal", "peloton", "puma", "redbull", "reebok", "revolut",
  "robinhood", "salesforce", "shopify", "skillshare", "sonos", "spotify", "square", "squarespace", "starbucks",
  "strava", "stripe", "substack", "trello", "twitch", "uber", "udemy", "underarmour", "webflow", "wix",
  "wordpress", "youtube", "zendesk", "zoom",
]

const RADIUS = 2.4
const BALL_R = 0.19
const CYCLE = 7
const scratch = new THREE.Vector3()
const BALL_COLOR = new THREE.Color("#EDE6FB")

// Volumetric distribution: even angular spread (fibonacci) at a randomized
// radius, so logos sit throughout the sphere — inside as well as on the surface.
function fibCloud(n: number): THREE.Vector3[] {
  const pts: THREE.Vector3[] = []
  const gr = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2
    const r = Math.sqrt(Math.max(0, 1 - y * y))
    const th = gr * i
    const rad = RADIUS * (0.3 + 0.7 * Math.cbrt(Math.random()))
    pts.push(new THREE.Vector3(Math.cos(th) * r * rad, y * rad, Math.sin(th) * r * rad))
  }
  return pts
}

const texCache = new Map<string, THREE.CanvasTexture>()
function logoTexture(url: string) {
  if (texCache.has(url)) return texCache.get(url)!
  const size = 128
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = size
  const ctx = canvas.getContext("2d")!
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 2
  const img = new Image()
  img.onload = () => {
    const pad = size * 0.22
    const box = size - 2 * pad
    const sc = Math.min(box / (img.width || size), box / (img.height || size))
    const w = (img.width || size) * sc
    const h = (img.height || size) * sc
    ctx.clearRect(0, 0, size, size)
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
    tex.needsUpdate = true
  }
  img.src = url
  texCache.set(url, tex)
  return tex
}

function TamBall({ slug, position, order, kept }: { slug: string; position: THREE.Vector3; order: number; kept: boolean }) {
  const ref = useRef<THREE.Group>(null!)
  const tex = useMemo(() => logoTexture(`/assets/brands-tam/${slug}.svg`), [slug])
  const cur = useRef(1)
  useFrame((state, dt) => {
    const g = ref.current
    if (!g) return
    g.getWorldPosition(scratch)
    const depth = (scratch.z / RADIUS + 1) / 2
    const c = state.clock.elapsedTime % CYCLE
    let target = 1
    if (!kept) {
      if (c < 1.5) target = 1
      else if (c < 4.5) target = order < (c - 1.5) / 3 ? 0 : 1
      else if (c < 5.8) target = 0
      else target = (c - 5.8) / 1.2
    }
    cur.current += (Math.max(0, Math.min(1, target)) - cur.current) * Math.min(1, dt * 7)
    const o = cur.current
    g.visible = o > 0.02
    g.scale.setScalar((0.55 + depth * 0.55) * o)
    const opacity = (0.5 + depth * 0.45) * o
    const ro = Math.round(depth * 100)
    for (const ch of g.children) {
      const m = (ch as THREE.Mesh).material as THREE.Material | undefined
      if (m) m.opacity = opacity
      ch.renderOrder = ro
    }
  })
  return (
    <Billboard ref={ref} position={position}>
      <mesh>
        <sphereGeometry args={[BALL_R, 20, 20]} />
        <meshStandardMaterial color={BALL_COLOR} roughness={0.8} metalness={0} transparent />
      </mesh>
      <mesh position={[0, 0, BALL_R + 0.004]}>
        <planeGeometry args={[BALL_R * 1.42, BALL_R * 1.42]} />
        <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </Billboard>
  )
}

function Cloud() {
  const group = useRef<THREE.Group>(null!)
  const vel = useRef(0.0016)
  const drag = useRef({ active: false, lastX: 0, lastY: 0 })
  const { gl } = useThree()
  const positions = useMemo(() => fibCloud(SLUGS.length), [])
  // Random (scattered) sort order so logos vanish from all over the sphere.
  const meta = useMemo(
    () => SLUGS.map((slug) => {
      const order = Math.random()
      return { slug, order, kept: order < 0.3 }
    }),
    []
  )

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
      // Orbit on both axes → move the sphere circularly.
      group.current.rotation.y += dx * 0.006
      group.current.rotation.x = THREE.MathUtils.clamp(group.current.rotation.x + dy * 0.006, -0.9, 0.9)
      vel.current = dx * 0.006 * 0.5
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
      vel.current += (0.0016 - vel.current) * 0.02
    }
  })

  return (
    <group ref={group} rotation={[-0.1, 0, 0]}>
      {positions.map((p, i) => (
        <TamBall key={meta[i].slug} slug={meta[i].slug} position={p} order={meta[i].order} kept={meta[i].kept} />
      ))}
    </group>
  )
}

export default function TamSphere3D({ active = true }: { active?: boolean }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 7], fov: 45 }}
      dpr={[1, 1.5]}
      frameloop={active ? "always" : "never"}
      gl={{ alpha: true, antialias: true }}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0.55} />
      <directionalLight position={[2, 4, 6]} intensity={1.2} />
      <directionalLight position={[-4, 0, -3]} intensity={0.5} color="#C9A9FF" />
      <Environment resolution={64} frames={1}>
        <Lightformer form="rect" intensity={1.5} position={[0, 4, 4]} scale={[12, 7, 1]} color="#ffffff" />
        <Lightformer form="rect" intensity={0.9} position={[-6, -2, -2]} scale={[9, 9, 1]} color="#d9c9ff" />
      </Environment>
      <Cloud />
    </Canvas>
  )
}
