// Quick jumps to parts of the body (S7.5, S8.5), also used by the whole-body figure.
// The camera frames these meshes: bones, or for the elbow the small muscles around the joint.
// `view` is the direction to look from on the right side (model frame, +Z front; mirrored for the
// left side); without it the camera keeps its direction. The ids match the figure's body areas (viewer/body.ts).
export const AREAS = [
  { id: 'head', label: 'Pää', meshes: ['Frontal bone', 'Occipital bone', 'Mandible'], view: [-0.35, 0.15, 1] },
  { id: 'neck', label: 'Kaula ja niska', meshes: ['Axis (C2)', 'Cervical vertebrae (C7)', 'Splenius capitis muscle.r'], view: [-0.35, 0.15, 1] },
  { id: 'trunk', label: 'Rintakehä', meshes: ['Manubrium of sternum', 'Xiphoid process', 'Rib (1st)', 'Rib (10th)'], view: [-0.35, 0.15, 1] },
  { id: 'back', label: 'Selkä', meshes: ['Thoracic vertebrae (T1)', 'Lumbar vertebra (L5)', 'Scapula.r.'], view: [-0.3, 0.2, -1] },
  { id: 'abdomen', label: 'Vatsa', meshes: ['Linea alba', 'External abdominal oblique muscle.r'], view: [-0.35, 0.15, 1] },
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
