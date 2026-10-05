// Parts of the whole-body figure (Mannequin.tsx) and its extent.

export type BodyArea = 'head' | 'trunk' | 'pelvis' | 'thigh' | 'knee' | 'leg' | 'foot' | 'shoulder' | 'upper_arm' | 'forearm' | 'hand'
export type BodySide = 'right' | 'left' | 'centre'

// Encloses the figure, for framing the whole-body view (metres, +Y up, +Z front). The top leaves
// room over the head (1.77) for the toolbar, which wraps to two rows on phones.
export const BODY_BOUNDS = { min: [-0.34, 0, -0.17], max: [0.34, 2.0, 0.17] } as const
