# Exports the body surface (skin regions and eyes) from Z-Anatomy's Startup.blend to an intermediate
# glTF for scripts/extract-skin.mjs. Needs Blender's Python module (pip install "bpy==4.5.*", Python 3.11).
# Usage: python scripts/export-skin.py <path/to/Startup.blend> <out.glb>
# Source and licence: public/models/ATTRIBUTION.md

import json
import sys

import bpy
from mathutils import Vector

blend, out = sys.argv[-2:]
bpy.ops.wm.open_mainfile(filepath=blend)

# Z-Anatomy's region groups (empties named "<name>.g") and the figure's body areas (src/viewer/body.ts).
# The nearest listed ancestor decides; everything under the head or neck is the head or neck.
AREAS = {
    'Regions of head.g': 'head',
    'Regions of neck.g': 'neck',
    'Regions of thorax.g': 'trunk',
    'Regions of abdomen.g': 'abdomen',
    'Regions of back.g': 'back',
    'Gluteal region.g': 'pelvis',
    'Femoral region.g': 'thigh',
    'Knee region.g': 'knee',
    'Leg region.g': 'leg',
    'Talocrural region.g': 'foot',
    'Regions of foot.g': 'foot',
    'Brachial region.g': 'upper_arm',
    'Cubital region.g': 'elbow',
    'Antebrachial region.g': 'forearm',
    'Carpal region.g': 'wrist',
    'Regions of hand.g': 'hand',
}
# Regions directly under the limb groups.
DIRECT = {'Hip region': 'pelvis', 'Deltoid region': 'shoulder'}
# Left out: hair, and the perineum, to keep the figure neutral.
SKIP_GROUPS = {'Hairs.g', 'Regions of perineum.g'}
EYES = ['Anterior segment of eyeball.r', 'Anterior segment of eyeball.l', 'Iris.r', 'Iris.l']
REFERENCE = ['Atlas (C1)', 'Axis (C2)', 'Vertebra C3', 'Vertebra C4', 'Vertebra C5', 'Vertebra C6', 'Vertebra C7', 'Vertebra T1', 'Clavicle.r']

for layer_collection in bpy.context.view_layer.layer_collection.children:
    layer_collection.exclude = False


def area_of(o):
    base = o.name.rsplit('.', 1)[0]
    if base in DIRECT:
        return DIRECT[base]
    node = o.parent
    while node:
        if node.name in SKIP_GROUPS:
            return None
        if node.name in AREAS:
            return AREAS[node.name]
        node = node.parent
    return None


parts = {}
for o in bpy.data.objects['Regions of human body.g'].children_recursive:
    if o.type != 'MESH' or o.name.endswith(('.g', '.j', '.t')):
        continue
    area = area_of(o)
    if area:
        parts[o.name] = area
for name in EYES:
    parts[name] = 'head'

bpy.ops.object.select_all(action='DESELECT')
for name, area in parts.items():
    o = bpy.data.objects[name]
    side = 'right' if name.endswith('.r') else 'left' if name.endswith('.l') else 'centre'
    o['area'] = area
    o['side'] = side
    o.hide_set(False)
    o.hide_viewport = False
    o.select_set(True)

bpy.ops.export_scene.gltf(
    filepath=out,
    export_format='GLB',
    use_selection=True,
    export_apply=True,
    export_yup=True,
    export_materials='NONE',
    export_extras=True,
    export_animations=False,
)


# Bounds in the glTF frame (Blender x, z, -y).
def bounds(o):
    corners = [o.matrix_world @ Vector(c) for c in o.bound_box]
    points = [(c.x, c.z, -c.y) for c in corners]
    return [[min(p[i] for p in points) for i in range(3)], [max(p[i] for p in points) for i in range(3)]]


with open(out + '.json', 'w') as f:
    json.dump(
        {
            'parts': parts,
            'eyes': EYES,
            'reference': {name: bounds(bpy.data.objects[name]) for name in REFERENCE},
        },
        f,
        indent=1,
    )
print(f'Exported {len(parts)} parts to {out}')
