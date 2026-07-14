"use client"

// Initial Meeting & Evaluation — a true WebGL 3D render (same lighting family as
// the Brand Universe): a floating, studio-lit booking card with the scheduler UI
// on it. It's not static — on a loop a "booked" check badge pops in with an
// expanding ring, as if a meeting is being confirmed. Gently floats (never spins
// edge-on). Loaded client-only.
import { useMemo, useRef } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { Environment, Float, RoundedBox, ContactShadows, Lightformer } from "@react-three/drei"
import * as THREE from "three"

function roundRect(x: CanvasRenderingContext2D, X: number, Y: number, W: number, H: number, R: number) {
  x.beginPath()
  x.moveTo(X + R, Y)
  x.arcTo(X + W, Y, X + W, Y + H, R)
  x.arcTo(X + W, Y + H, X, Y + H, R)
  x.arcTo(X, Y + H, X, Y, R)
  x.arcTo(X, Y, X + W, Y, R)
  x.closePath()
}

function makeCardTexture() {
  const w = 512
  const h = 340
  const c = document.createElement("canvas")
  c.width = w
  c.height = h
  const x = c.getContext("2d")!
  const g = x.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, "#2A1148")
  g.addColorStop(1, "#190733")
  roundRect(x, 0, 0, w, h, 30)
  x.fillStyle = g
  x.fill()
  x.fillStyle = "#ffffff"
  x.font = "bold 30px Inter, Arial, sans-serif"
  x.fillText("Book a call", 34, 58)
  x.fillStyle = "#C99DFF"
  x.font = "22px Inter, Arial, sans-serif"
  x.textAlign = "right"
  x.fillText("Thu, Jul 16", w - 34, 56)
  x.textAlign = "left"
  const slots = ["9:00", "9:30", "10:00", "10:30", "11:00", "11:30"]
  const booked = 3
  const cols = 3
  const cw = 134
  const ch = 66
  const gx = 34
  const gy = 96
  const gap = 18
  slots.forEach((t, i) => {
    const cx = gx + (i % cols) * (cw + gap)
    const cy = gy + Math.floor(i / cols) * (ch + gap)
    roundRect(x, cx, cy, cw, ch, 14)
    if (i === booked) {
      x.fillStyle = "#7A13D0"
      x.fill()
    } else {
      x.fillStyle = "rgba(255,255,255,0.05)"
      x.fill()
      x.strokeStyle = "rgba(255,255,255,0.14)"
      x.lineWidth = 2
      x.stroke()
    }
    x.fillStyle = i === booked ? "#ffffff" : "rgba(255,255,255,0.78)"
    x.font = "22px Inter, Arial, sans-serif"
    x.textAlign = "center"
    x.fillText(t, cx + cw / 2, cy + ch / 2 + 8)
    x.textAlign = "left"
  })
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

function makeCheckTexture() {
  const s = 128
  const c = document.createElement("canvas")
  c.width = s
  c.height = s
  const x = c.getContext("2d")!
  x.strokeStyle = "#ffffff"
  x.lineWidth = 15
  x.lineCap = "round"
  x.lineJoin = "round"
  x.beginPath()
  x.moveTo(s * 0.26, s * 0.52)
  x.lineTo(s * 0.44, s * 0.7)
  x.lineTo(s * 0.76, s * 0.32)
  x.stroke()
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// The looping action: a "booked" check badge pops in with an expanding ring.
function BookedBadge() {
  const grp = useRef<THREE.Group>(null!)
  const ring = useRef<THREE.Mesh>(null!)
  const check = useMemo(makeCheckTexture, [])
  useFrame((state) => {
    const t = state.clock.elapsedTime % 4
    let s = 0
    if (t > 0.8) s = t < 1.2 ? (t - 0.8) / 0.4 : t > 3.4 ? Math.max(0, 1 - (t - 3.4) / 0.4) : 1
    s = Math.max(0, Math.min(1, s))
    const g = grp.current
    if (g) {
      g.visible = s > 0.01
      g.scale.setScalar(0.6 + 0.4 * s)
    }
    const rt = t - 0.9
    const rm = ring.current
    if (rm) {
      const on = rt > 0 && rt < 1
      rm.visible = on
      if (on) {
        rm.scale.setScalar(1 + rt * 4)
        ;(rm.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.55 * (1 - rt))
      }
    }
  })
  return (
    <group position={[1.5, 1.05, 0.34]}>
      <group ref={grp}>
        <mesh>
          <sphereGeometry args={[0.32, 32, 32]} />
          <meshStandardMaterial color="#22C55E" roughness={0.35} metalness={0.1} />
        </mesh>
        <mesh position={[0, 0, 0.33]}>
          <planeGeometry args={[0.4, 0.4]} />
          <meshBasicMaterial map={check} transparent toneMapped={false} />
        </mesh>
      </group>
      <mesh ref={ring}>
        <ringGeometry args={[0.3, 0.36, 40]} />
        <meshBasicMaterial color="#8FF0B0" transparent opacity={0.5} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
    </group>
  )
}

function Scene() {
  const card = useMemo(makeCardTexture, [])
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[3, 5, 4]} intensity={1} />
      <Environment resolution={64} frames={1}>
        <Lightformer form="rect" intensity={1.3} position={[0, 3, 4]} scale={[10, 6, 1]} color="#ffffff" />
        <Lightformer form="rect" intensity={0.7} position={[-5, -1, -2]} scale={[8, 8, 1]} color="#d9c9ff" />
        <Lightformer form="circle" intensity={1} position={[4, 2, -3]} scale={4} color="#ffffff" />
      </Environment>
      <Float speed={2.2} rotationIntensity={0.35} floatIntensity={0.7}>
        <group rotation={[0.06, -0.22, 0]}>
          <RoundedBox args={[3.3, 2.15, 0.14]} radius={0.11} smoothness={4}>
            <meshStandardMaterial color="#20103c" roughness={0.5} metalness={0.15} />
          </RoundedBox>
          <mesh position={[0, 0, 0.075]}>
            <planeGeometry args={[3.24, 2.09]} />
            <meshBasicMaterial map={card} toneMapped={false} />
          </mesh>
          <BookedBadge />
        </group>
      </Float>
      <ContactShadows position={[0, -1.5, 0]} opacity={0.4} scale={8} blur={2.6} far={4} color="#050008" />
    </>
  )
}

export default function MeetingScene3D() {
  return (
    <Canvas camera={{ position: [0, 0, 5.2], fov: 42 }} dpr={[1, 2]} gl={{ alpha: true, antialias: true }} style={{ background: "transparent" }}>
      <Scene />
    </Canvas>
  )
}
