import { Bounds, OrbitControls, useBounds, useGLTF } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { Suspense, useCallback, useEffect, useMemo, useRef } from 'react'
import { Box3, Group, Mesh, MeshBasicMaterial, type Object3D, type PerspectiveCamera, Vector3 } from 'three'
import { meshesOf } from '../data/connections'
import type { Muscle } from '../data/muscles'
import type { DistantSource, PainSources } from '../search/painSearch'
import { classifyArmRegion, computeArmLandmarks, trunkRegion } from './armRegions'
import { highlightNodes } from './highlight'
import { applyLayerVisibility, type LayerVisibility } from './layers'
import { BODY_BOUNDS, type BodyArea, type BodySide } from './body'
import { Mannequin } from './Mannequin'
import { type Classify, PainMarker, type PainPoint, PainPicker } from './PainPicker'
import { classifyRegion, computeLandmarks, legCentreAt } from './regions'
import { computeTrunkLandmarks } from './trunkRegions'

// Relative to the page (base './' in vite.config.ts), so the models load under the GitHub Pages path too.
const MODELS = `${import.meta.env.BASE_URL}models`
const LOWER_LIMB_URL = `${MODELS}/lower-limb.glb`
const UPPER_LIMB_URL = `${MODELS}/upper-limb.glb`
const TRUNK_URL = `${MODELS}/trunk.glb`
const ATTACHMENTS_URL = `${MODELS}/attachments.glb`

// Default view: from the front, slightly from the outer side of the right leg.
const DEFAULT_DIRECTION = new Vector3(-0.35, 0.15, 1).normalize()
const FIT_MARGIN = 1.1
// Keeps some of the leg in view when focusing on a small muscle.
const MIN_FOCUS_DISTANCE = 0.3

// --source-local and --source-distant from design-brief.md, in sRGB.
const LOCAL_COLOR = '#f29000'
const DISTANT_COLOR = '#9260da'

// Fits height and width separately, so the tall, narrow leg fills a portrait phone screen.
// (drei's Bounds fits the largest dimension to both, which leaves the leg small on phones.)
function fitDistance(size: Vector3, camera: PerspectiveCamera): number {
  const tanHalfVertical = Math.tan((camera.fov * Math.PI) / 360)
  const depth = Math.max(size.x, size.z)
  const forHeight = size.y / 2 / tanHalfVertical
  const forWidth = depth / 2 / (tanHalfVertical * camera.aspect)
  return FIT_MARGIN * Math.max(forHeight, forWidth) + depth / 2
}

// What the model colours:
// - muscle: the muscle as it is (others dimmed), with its attachments, and its connected muscles.
// - sources: local and distant pain sources, with the tendons and fascia on their chains.
// - chain: the first `lit` steps of a chain (refs as in chainSteps); the rest is dimmed.
export type Emphasis =
  | { kind: 'muscle'; muscle: Muscle; connected: DistantSource[] }
  | { kind: 'sources'; sources: PainSources }
  | { kind: 'chain'; steps: string[]; lit: number }

// What the camera frames: all `meshes` (plus attachment patches), seen from the side that `aim`
// lies on relative to the bones, or from the current direction with keepDirection (e.g. areas
// framed by their bones). A new object moves the camera, even with the same content.
export type Focus = { meshes: string[]; attachmentMeshes: string[]; aim: string[]; keepDirection?: boolean }

type NodeColors = Map<string, string | null>

function emphasisColors(emphasis: Emphasis | null): NodeColors | null {
  if (!emphasis) return null
  const colors: NodeColors = new Map()
  const set = (ref: string, color: string | null) => {
    for (const mesh of meshesOf(ref)) colors.set(mesh, color)
  }

  if (emphasis.kind === 'muscle') {
    for (const { refs } of emphasis.connected) for (const ref of refs) if (ref.startsWith('structure:')) set(ref, null)
    for (const { muscle } of emphasis.connected) set(`muscle:${muscle.id}`, DISTANT_COLOR)
    for (const mesh of emphasis.muscle.meshes) colors.set(mesh, null)
  } else if (emphasis.kind === 'sources') {
    const { local, distant } = emphasis.sources
    if (local.length === 0 && distant.length === 0) return null
    for (const { refs } of distant) for (const ref of refs) if (ref.startsWith('structure:')) set(ref, null)
    for (const { muscle } of distant) set(`muscle:${muscle.id}`, DISTANT_COLOR)
    for (const muscle of local) set(`muscle:${muscle.id}`, LOCAL_COLOR)
  } else {
    // Pain chains run through tendons and fascia and end at the distant muscle.
    for (const ref of emphasis.steps.slice(0, emphasis.lit)) {
      if (ref.startsWith('structure:')) set(ref, null)
      else if (ref.startsWith('muscle:')) set(ref, DISTANT_COLOR)
    }
  }
  return colors
}

type ModelProps = {
  layers: LayerVisibility
  // Changing this value moves the camera back to the default view.
  resetKey: number
  // false: the whole-body figure is shown and the anatomy is hidden.
  showAnatomy: boolean
  nodeColors: NodeColors | null
  focus: Focus | null
  onPick: (pain: PainPoint) => void
}

// One root for all models, so picking, highlighting and layers work across them.
function combine(...scenes: Object3D[]): Group {
  const root = new Group()
  for (const scene of scenes) root.add(scene)
  return root
}

function isInside(object: Object3D | null, ancestor: Object3D): boolean {
  for (let node = object; node; node = node.parent) if (node === ancestor) return true
  return false
}

function setVisible(object: Object3D, visible: boolean): void {
  object.visible = visible
}

function Model({ layers, resetKey, showAnatomy, nodeColors, focus, onPick }: ModelProps) {
  const { scene: lower } = useGLTF(LOWER_LIMB_URL)
  const { scene: upper } = useGLTF(UPPER_LIMB_URL)
  const { scene: trunk } = useGLTF(TRUNK_URL)
  const { scene: attachments } = useGLTF(ATTACHMENTS_URL)
  const root = useMemo(() => combine(lower, upper, trunk), [lower, upper, trunk])
  const bounds = useBounds()
  const camera = useThree((state) => state.camera) as PerspectiveCamera
  const legLandmarks = useMemo(() => computeLandmarks(lower), [lower])
  const armLandmarks = useMemo(() => computeArmLandmarks(upper), [upper])
  const trunkLandmarks = useMemo(() => computeTrunkLandmarks(trunk), [trunk])
  const { neckY } = trunkLandmarks

  // The part of the body is known from the model the hit belongs to.
  const classify = useCallback<Classify>(
    (point, normal, object) => {
      if (isInside(object, trunk)) return trunkRegion(point, armLandmarks.elbowY, neckY)
      if (isInside(object, upper)) return classifyArmRegion(point, normal, armLandmarks, neckY)
      return classifyRegion(point, normal, legLandmarks)
    },
    [upper, trunk, armLandmarks, legLandmarks, neckY],
  )

  useEffect(() => {
    performance.mark('model-ready')
  }, [])

  useEffect(() => {
    setVisible(root, showAnatomy)
  }, [root, showAnatomy])

  useEffect(() => {
    applyLayerVisibility(root, layers)
  }, [root, layers])

  useEffect(() => {
    highlightNodes(root, nodeColors)
  }, [root, nodeColors])

  // Default view: the whole figure, or all the muscles (not the bones, which reach the spine).
  useEffect(() => {
    const box = new Box3()
    if (showAnatomy) {
      root.traverse((object) => {
        if (object.userData.name === 'Muscles') box.expandByObject(object)
      })
    } else {
      box.set(new Vector3(...BODY_BOUNDS.min), new Vector3(...BODY_BOUNDS.max))
    }
    const center = box.getCenter(new Vector3())
    const distance = fitDistance(box.getSize(new Vector3()), camera)
    bounds
      .refresh(box)
      .clip()
      .moveTo(center.clone().addScaledVector(DEFAULT_DIRECTION, distance))
      .lookAt({ target: center, up: [0, 1, 0] })
  }, [bounds, camera, root, resetKey, showAnatomy])

  // Look at the focus from the side its aim lies on relative to the bones: deep calf muscles
  // from behind, plantar foot muscles from below. Runs once per new focus.
  const focused = useRef<Focus | null>(null)
  useEffect(() => {
    if (!focus || focused.current === focus) return
    focused.current = focus
    const box = new Box3()
    const aimBox = new Box3()
    let inArm = false
    let inTrunk = false
    root.traverse((object) => {
      if (focus.meshes.includes(object.userData.name)) box.expandByObject(object)
      if (focus.aim.includes(object.userData.name)) {
        aimBox.expandByObject(object)
        inArm ||= isInside(object, upper)
        inTrunk ||= isInside(object, trunk)
      }
    })
    attachments.traverse((object) => {
      if (focus.attachmentMeshes.includes(object.userData.name)) box.expandByObject(object)
    })
    const center = box.getCenter(new Vector3())
    const aim = aimBox.getCenter(new Vector3())
    // Trunk muscles are seen from the side they lie on relative to the spine.
    const bones = inTrunk
      ? { x: 0, z: trunkLandmarks.spineZ }
      : legCentreAt(aim.y, inArm ? armLandmarks.boneCentres : legLandmarks.boneCentres)
    const outward = new Vector3(aim.x - bones.x, 0, aim.z - bones.z)
    const inFoot = !inArm && !inTrunk && aim.y < legLandmarks.heelTopY
    const up = inFoot ? (aim.y < legLandmarks.footMidY ? -0.8 : 0.8) : 0.3
    const direction =
      !focus.keepDirection && (outward.lengthSq() > 1e-6 || inFoot)
        ? outward.normalize().add(new Vector3(0, up, 0)).normalize()
        : camera.position.clone().sub(center).normalize()
    const distance = Math.max(fitDistance(box.getSize(new Vector3()), camera), MIN_FOCUS_DISTANCE)
    bounds
      .refresh(box)
      .clip()
      .moveTo(center.clone().addScaledVector(direction, distance))
      .lookAt({ target: center, up: [0, 1, 0] })
  }, [focus, root, upper, trunk, attachments, camera, bounds, legLandmarks, armLandmarks, trunkLandmarks])

  return (
    <>
      <primitive object={root} />
      {showAnatomy && <PainPicker root={root} classify={classify} onPick={onPick} />}
    </>
  )
}

function showOnly(root: Object3D, nodeNames: string[] | null): void {
  for (const node of root.children) node.visible = !!nodeNames?.includes(node.userData.name)
}

// Origin (red) and insertion (blue) patches of the selected muscle, drawn on top of everything:
// the muscle itself would otherwise cover its own attachments.
function Attachments({ nodeNames }: { nodeNames: string[] | null }) {
  const { scene } = useGLTF(ATTACHMENTS_URL)
  const material = useMemo(() => new MeshBasicMaterial({ vertexColors: true, depthTest: false, transparent: true }), [])

  useEffect(() => {
    scene.traverse((object) => {
      if (!(object instanceof Mesh)) return
      object.material = material
      object.renderOrder = 2
    })
  }, [scene, material])

  useEffect(() => {
    showOnly(scene, nodeNames)
  }, [scene, nodeNames])

  return <primitive object={scene} />
}

type ViewerProps = Omit<ModelProps, 'nodeColors'> & {
  painPoint: PainPoint | null
  emphasis: Emphasis | null
  onSelectBodyArea: (area: BodyArea, side: BodySide) => void
}

export function Viewer({ painPoint, emphasis, onSelectBodyArea, ...modelProps }: ViewerProps) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const nodeColors = useMemo(() => emphasisColors(emphasis), [emphasis])
  const attachmentNodes = emphasis?.kind === 'muscle' ? (emphasis.muscle.attachmentMeshes ?? null) : null

  return (
    <Canvas camera={{ fov: 35, position: [0, 0.3, 1.5] }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[1, 2, 2]} intensity={1.5} />
      <directionalLight position={[-1, 1, -2]} intensity={0.8} />
      <OrbitControls makeDefault />
      <Suspense fallback={null}>
        <Bounds maxDuration={reducedMotion ? 0.01 : 0.4}>
          <Model {...modelProps} nodeColors={nodeColors} />
        </Bounds>
        <Attachments nodeNames={attachmentNodes} />
      </Suspense>
      <Mannequin visible={!modelProps.showAnatomy} onSelect={onSelectBodyArea} />
      {painPoint && <PainMarker point={painPoint.point} normal={painPoint.normal} />}
    </Canvas>
  )
}
