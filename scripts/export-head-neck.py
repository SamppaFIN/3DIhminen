# Exports the head and neck from Z-Anatomy's Startup.blend to an intermediate glTF for
# scripts/extract-head-neck.mjs. Needs Blender's Python module (pip install "bpy==4.5.*", Python 3.11).
# Usage: python scripts/export-head-neck.py <path/to/Startup.blend> <out.glb>
# Source and licence: public/models/ATTRIBUTION.md

import json
import re
import sys

import bpy
from mathutils import Vector

blend, out = sys.argv[-2:]
bpy.ops.wm.open_mainfile(filepath=blend)

# Right-side muscles of these groups (Z-Anatomy groups are empties named "<name>.g").
MUSCLE_GROUPS = [
    'Masticatory muscles.g',
    'Facial muscles.g',
    'Epicranius muscle.g',
    'Muscles of neck.g',
    'Suprahyoid muscles.g',
    'Digastric muscle.g',
    'Infrahyoid muscles.g',
    'Suboccipital muscles.g',
]
# Groups under "Muscles of neck.g" that are left out: internal structures nobody points at as a pain spot.
SKIP_GROUPS = {'Laryngeal muscles.g', 'Pharyngeal muscles.g'}
# Bones of the skull, both sides, and the cartilages the infrahyoid muscles attach to.
BONE_GROUPS = ['Bones of cranium.g', 'Extracranial bones of head.g', 'Anterior teeth.g', 'Posterior teeth.g']
EXTRA_BONES = {'Thyroid cartilage', 'Cricoid cartilage'}
# Children of bones that are not bones: sinuses, ethmoid cells and attachment markers (".o", ".e", ".j").
NOT_BONE = re.compile(r'^(Sinus of|.* cells of ethmoid)|\.(o|e|i)\d*[lr]?$|\.j$|\.g$')
# Reference bones for aligning the model to the Open3D models (see extract-head-neck.mjs).
REFERENCE = ['Atlas (C1)', 'Axis (C2)', 'Vertebra C3', 'Vertebra C4', 'Vertebra C5', 'Vertebra C6', 'Vertebra C7', 'Vertebra T1', 'Clavicle.r']

for layer_collection in bpy.context.view_layer.layer_collection.children:
    layer_collection.exclude = False


def meshes_under(group_name, right_only):
    group = bpy.data.objects[group_name]
    for child in group.children:
        if child.name in SKIP_GROUPS:
            continue
        if child.type == 'MESH' and not NOT_BONE.search(child.name):
            if not right_only or child.name.endswith('.r') or not child.name.endswith('.l'):
                yield child


muscles = {o.name: o for g in MUSCLE_GROUPS for o in meshes_under(g, True)}
bones = {o.name: o for g in BONE_GROUPS for o in meshes_under(g, False)}
bones.update({name: bpy.data.objects[name] for name in EXTRA_BONES})

bpy.ops.object.select_all(action='DESELECT')
for o in [*muscles.values(), *bones.values()]:
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
            'muscles': sorted(muscles),
            'bones': sorted(bones),
            'reference': {name: bounds(bpy.data.objects[name]) for name in REFERENCE},
        },
        f,
        indent=1,
    )
print(f'Exported {len(muscles)} muscles and {len(bones)} bones to {out}')
