"use client"

// The onboarding walkthrough's per-step hero. Each step maps to a photoscanned
// PBR model from Poly Haven (CC0 — see public/assets/models/ATTRIBUTION.md),
// lit almost entirely by a real studio HDRI for photographic reflections, with
// filmic tone mapping and a soft contact shadow, gently auto-rotating. Materials
// stay fully opaque except for the brief crossfade when the step changes (kept
// transparent only mid-transition so metals/reflections render crisp at rest).
import { Suspense, useMemo, useRef } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { Environment, ContactShadows, useGLTF } from "@react-three/drei"
import * as THREE from "three"

const MODELS = [
  "/assets/models/pbr-call/scene.gltf", // 1 · Discovery Call (magnifying glass)
  "/assets/models/pbr-setup/scene.gltf", // 2 · Setup & Integrations (toolbox)
  "/assets/models/pbr-campaign/scene.gltf", // 3 · Campaign Build (megaphone)
  "/assets/models/pbr-launch/scene.gltf", // 4 · Launch & Scale (dartboard)
]
MODELS.forEach((m) => useGLTF.preload(m))

const TARGET = 2.5 // longest bounding-box edge, in world units

// Clone the loaded model, center it at the origin, and scale so its longest edge
// is TARGET (kills the "scale is broken" problem for arbitrary source models).
// Materials are kept as-authored (PBR) — just cloned so we can fade them.
function usePbrModel(url: string) {
  const { scene } = useGLTF(url)
  return useMemo(() => {
    const root = scene.clone(true)
    const box = new THREE.Box3().setFromObject(root)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const s = TARGET / Math.max(size.x, size.y, size.z || 1)
    root.position.set(-center.x, -center.y, -center.z)
    const mats: THREE.MeshStandardMaterial[] = []
    root.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      const cloned = list.map((src) => {
        const m = (src as THREE.MeshStandardMaterial).clone()
        m.envMapIntensity = 1.0
        return m
      })
      mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0]
      mats.push(...cloned)
    })
    return { root, s, mats }
  }, [scene])
}

function StepModel({ url, active }: { url: string; active: boolean }) {
  const { root, s, mats } = usePbrModel(url)
  const grp = useRef<THREE.Group>(null!)
  const cur = useRef(0) // eased 0→1 presence

  useFrame((_, dt) => {
    cur.current += ((active ? 1 : 0) - cur.current) * Math.min(1, dt * 4.5)
    const o = cur.current
    const fading = o < 0.985 // only transparent mid-transition; opaque at rest
    for (const m of mats) {
      if (m.transparent !== fading) {
        m.transparent = fading
        m.needsUpdate = true
      }
      m.opacity = fading ? o : 1
    }
    const g = grp.current
    if (!g) return
    g.visible = o > 0.01
    g.scale.setScalar(s * (0.93 + o * 0.07))
  })

  return (
    <group ref={grp} scale={s}>
      <primitive object={root} />
    </group>
  )
}

function Scene({ step, paused }: { step: number; paused: boolean }) {
  const spin = useRef<THREE.Group>(null!)
  useFrame((_, dt) => {
    if (spin.current && !paused) spin.current.rotation.y += dt * 0.32
  })
  return (
    <>
      {/* Light the scene from the HDRI; one soft key adds a little sculpting. */}
      <ambientLight intensity={0.08} />
      <directionalLight position={[4, 6, 5]} intensity={0.7} />
      <Suspense fallback={null}>
        <group ref={spin}>
          {MODELS.map((u, i) => (
            <StepModel key={u} url={u} active={i === step} />
          ))}
        </group>
        <Environment files="/assets/hdri/studio.hdr" environmentIntensity={1.25} />
      </Suspense>
      <ContactShadows position={[0, -1.5, 0]} opacity={0.5} scale={9} blur={2.6} far={4} resolution={1024} color="#050008" />
    </>
  )
}

export default function OnboardingModels3D({
  step,
  paused = false,
  active = true,
}: {
  step: number
  paused?: boolean
  active?: boolean
}) {
  return (
    <Canvas
      camera={{ position: [0, 0.3, 5.6], fov: 40 }}
      dpr={[1, 2]}
      frameloop={active ? "always" : "never"}
      gl={{ alpha: true, antialias: true }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.0
      }}
      style={{ background: "transparent" }}
    >
      <Scene step={step} paused={paused} />
    </Canvas>
  )
}
