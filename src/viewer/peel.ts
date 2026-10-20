import { type Layer, type LayerVisibility, nextPeel } from './layers'

// The bookkeeping of peeling layers by zooming (LayerPeel.tsx), kept pure so it can be tested.

// A layer hidden by zooming, with the camera's distance to its target at that moment.
export type Peeled = { layer: Layer; distance: number }

// Movement in one direction adds up to a step of `size`; a change of direction starts over.
export function accumulate(total: number, delta: number, size: number): { total: number; full: boolean } {
  const sum = (Math.sign(total) === Math.sign(delta) ? total : 0) + delta
  return Math.abs(sum) >= size ? { total: 0, full: true } : { total: sum, full: false }
}

// Drops the layers shown again by hand from the top of the stack.
export function prunePeeled(stack: Peeled[], layers: LayerVisibility): Peeled[] {
  let end = stack.length
  while (end > 0 && layers[stack[end - 1].layer]) end--
  return stack.slice(0, end)
}

// Peels the outermost layer shown, unless it is already on the stack (a second step before the
// first one has rendered).
export function peelNext(
  stack: Peeled[],
  layers: LayerVisibility,
  distance: number,
): { stack: Peeled[]; layers: LayerVisibility } | null {
  const layer = nextPeel(layers)
  if (!layer || stack.some((entry) => entry.layer === layer)) return null
  return { stack: [...stack, { layer, distance }], layers: { ...layers, [layer]: false } }
}

// Puts the innermost peeled layer back and tells where the camera was when it was peeled.
export function restoreNext(
  stack: Peeled[],
  layers: LayerVisibility,
): { stack: Peeled[]; layers: LayerVisibility; distance: number } | null {
  const pruned = prunePeeled(stack, layers)
  const entry = pruned.at(-1)
  if (!entry) return null
  return { stack: pruned.slice(0, -1), layers: { ...layers, [entry.layer]: true }, distance: entry.distance }
}

export function restoreAll(stack: Peeled[], layers: LayerVisibility): LayerVisibility {
  const shown = { ...layers }
  for (const { layer } of stack) shown[layer] = true
  return shown
}
