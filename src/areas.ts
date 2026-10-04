// Quick jumps to parts of the body (S7.5, S8.5), also used by the whole-body figure.
// The camera frames these bones. The ids match the figure's body areas (viewer/Mannequin.tsx).
export const AREAS = [
  { id: 'trunk', label: 'Rintakehä ja selkä', meshes: ['Clavicle.r', 'Scapula.r.', 'Lumbar vertebra (L1)'] },
  { id: 'shoulder', label: 'Olkapää', meshes: ['Clavicle.r', 'Scapula.r.'] },
  { id: 'upper_arm', label: 'Olkavarsi', meshes: ['Humerus.r'] },
  { id: 'forearm', label: 'Kyynärvarsi', meshes: ['Radius.r', 'Ulna.r'] },
  { id: 'hand', label: 'Käsi', meshes: ['Capitate.r', '3rd metacarpal bone.r', 'Distal phalanx of 3d finger.r', 'Distal phalanx of 1st finger.r'] },
  { id: 'pelvis', label: 'Lantio ja lonkka', meshes: ['Hip bone.r', 'Sacrum'] },
  { id: 'thigh', label: 'Reisi', meshes: ['Femur.r'] },
  { id: 'knee', label: 'Polvi', meshes: ['Patella.r'] },
  { id: 'leg', label: 'Sääri', meshes: ['Tibia.r', 'Fibula.r'] },
  { id: 'foot', label: 'Jalkaterä', meshes: ['Calcaneus.r', 'Talus.r', 'First metatarsal bone.r', 'Fifth metatarsal bone.r'] },
] as const
