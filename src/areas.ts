// Quick jumps to parts of the body (S7.5, S8.5), also used by the whole-body figure.
// The camera frames these meshes: bones, or for the elbow the small muscles around the joint. The ids match the figure's body areas (viewer/Mannequin.tsx).
export const AREAS = [
  { id: 'neck', label: 'Niska', meshes: ['Axis (C2)', 'Cervical vertebrae (C7)', 'Splenius capitis muscle.r'] },
  { id: 'trunk', label: 'Rintakehä', meshes: ['Manubrium of sternum', 'Xiphoid process', 'Rib (1st)', 'Rib (10th)'] },
  { id: 'back', label: 'Selkä', meshes: ['Thoracic vertebrae (T1)', 'Lumbar vertebra (L5)', 'Scapula.r.'] },
  { id: 'abdomen', label: 'Vatsa', meshes: ['Linea alba', 'External abdominal oblique muscle.r'] },
  { id: 'shoulder', label: 'Olkapää', meshes: ['Clavicle.r', 'Scapula.r.'] },
  { id: 'upper_arm', label: 'Olkavarsi', meshes: ['Humerus.r'] },
  { id: 'elbow', label: 'Kyynärpää', meshes: ['Anconeus muscle.r', 'Supinator.r', 'Humeral head of pronator teres.r'] },
  { id: 'forearm', label: 'Kyynärvarsi', meshes: ['Radius.r', 'Ulna.r'] },
  { id: 'wrist', label: 'Ranne', meshes: ['Scaphoid.r', 'Lunate bone.r', 'Triquetrum.r', 'Pisiform.r'] },
  { id: 'hand', label: 'Käsi', meshes: ['Capitate.r', '3rd metacarpal bone.r', 'Distal phalanx of 3d finger.r', 'Distal phalanx of 1st finger.r'] },
  { id: 'pelvis', label: 'Lantio ja lonkka', meshes: ['Hip bone.r', 'Sacrum'] },
  { id: 'thigh', label: 'Reisi', meshes: ['Femur.r'] },
  { id: 'knee', label: 'Polvi', meshes: ['Patella.r'] },
  { id: 'leg', label: 'Sääri', meshes: ['Tibia.r', 'Fibula.r'] },
  { id: 'foot', label: 'Jalkaterä', meshes: ['Calcaneus.r', 'Talus.r', 'First metatarsal bone.r', 'Fifth metatarsal bone.r'] },
] as const
