import { BackSide, Mesh, MeshBasicMaterial, type Object3D } from 'three'
import { LAYERED_GROUPS, type LayerVisibility, layerOf } from './layers'

// A halo behind the tendons and fascia, so they read as a layer of their own when they are the
// outermost layer shown (the muscles hidden or peeled). Each mesh of the layer gets a child that
// draws its back faces pushed out along the normals in see-through amber. The push is done in view
// space, because the models are quantized: their local units are not metres.

// Thickness of the halo (metres) and its colour, a deeper version of --tendon. Normal blending, not
// additive: an additive glow turns white against the light background and disappears.
const THICKNESS = 0.002
const COLOR = '#d99a2b'
const OPACITY = 0.55

const material = new MeshBasicMaterial({
  name: 'halo',
  color: COLOR,
  transparent: true,
  opacity: OPACITY,
  depthWrite: false,
  side: BackSide,
})
material.onBeforeCompile = (shader) => {
  shader.uniforms.haloThickness = { value: THICKNESS }
  shader.vertexShader = `uniform float haloThickness;\n${shader.vertexShader}`.replace(
    '#include <project_vertex>',
    `vec4 mvPosition = modelViewMatrix * vec4( transformed, 1.0 );
mvPosition.xyz += normalize( normalMatrix * normal ) * haloThickness;
gl_Position = projectionMatrix * mvPosition;`,
  )
}
material.customProgramCacheKey = () => 'connective-halo'

export const isHalo = (object: Object3D) => object.userData.isHalo === true

// Whether the tendons and fascia are the outermost layer shown.
export function connectiveInFront(layers: LayerVisibility): boolean {
  return layers.connective && !layers.superficial && !layers.deep
}

function haloOf(mesh: Mesh): Mesh {
  let halo: Mesh | undefined = mesh.userData.halo
  if (!halo) {
    halo = new Mesh(mesh.geometry, material)
    halo.userData.isHalo = true
    // Never picked: taps and the peel's surface ray go to the structure itself.
    halo.raycast = () => {}
    mesh.add(halo)
    mesh.userData.halo = halo
  }
  return halo
}

export function setConnectiveGlow(root: Object3D, on: boolean): void {
  root.traverse((group) => {
    if (!LAYERED_GROUPS.has(group.userData.name)) return
    for (const part of group.children) {
      if (layerOf(part, group) !== 'connective') continue
      const meshes: Mesh[] = []
      part.traverse((object) => {
        if (object instanceof Mesh && !isHalo(object)) meshes.push(object)
      })
      for (const mesh of meshes) {
        // Created only when first needed; afterwards only shown or hidden.
        if (on) haloOf(mesh).visible = true
        else if (mesh.userData.halo) mesh.userData.halo.visible = false
      }
    }
  })
}
