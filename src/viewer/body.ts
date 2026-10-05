// Parts of the whole-body figure (Mannequin.tsx) and its extent.

// The ids match the quick-jump areas in areas.ts.
export type BodyArea =
  | 'head'
  | 'neck'
  | 'trunk'
  | 'back'
  | 'abdomen'
  | 'pelvis'
  | 'thigh'
  | 'knee'
  | 'leg'
  | 'foot'
  | 'shoulder'
  | 'upper_arm'
  | 'elbow'
  | 'forearm'
  | 'wrist'
  | 'hand'
export type BodySide = 'right' | 'left' | 'centre'

// Encloses the figure, for framing the whole-body view (metres, +Y up, +Z front). The top leaves
// room over the head (1.71) for the toolbar, which wraps to two rows on phones.
export const BODY_BOUNDS = { min: [-0.34, 0, -0.17], max: [0.34, 1.94, 0.17] } as const
