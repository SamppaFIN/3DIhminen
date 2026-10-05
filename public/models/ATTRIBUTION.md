# Attribution

This folder holds five adapted models, all licensed CC BY-SA 4.0 (see `LICENSE.md`).

## lower-limb.glb

### Source

"Open3DModel - Lower limb - English labels" by Open3D project, Jan Kooloos, RadboudUMC, Eungyeol Lee, LUMC et al, license: CC BY-SA 4.0

- Model page: https://anatomytool.org/node/63936 (version July 2025)
- Downloaded file: https://caskanatomy.info/open3dmodelfiles/lower-limb/lower-limb-glb.zip
  - Last-Modified: 2026-09-02, downloaded 2026-10-03
  - SHA-256 (zip): `82ad6894bec6e77bb2aba970105f6ee7f0f694de93494932eb634fd0150745c7`
  - SHA-256 (lower-limb.glb inside the zip): `001677bac4e8b4f44f3be0c3695b0123bc9fad1df9a2bddceecccf4a6eef01eb`

The Open3D model is based on Z-Anatomy ("Z-Anatomy – The libre 3D atlas of anatomy", CC BY-SA 4.0), which is based on BodyParts3D (© The Database Center for Life Science, CC BY-SA 2.1 JP at the time of derivation; now CC BY 4.0).

### Changes made

`lower-limb.glb` was produced with `scripts/extract-lower-limb.mjs`:

1. Kept the muscles, tendons and bones of the right lower limb, and the connective-tissue structures listed in `src/data/structures.json` (e.g. the iliotibial tract). Nerves, vessels, ligaments, cartilage, bursae and the other fascia were removed.
2. Removed all textures and replaced the materials with three flat colours (muscle, tendon, bone). The source textures are based on "Thoracic walls" by Claudia Krebs et al., UBC, licensed CC BY-NC-SA 4.0, so they are not included.
3. Re-encoded the geometry with meshopt compression instead of Draco.

Node names are unchanged from the source.

## upper-limb.glb

### Source

"Open3DModel - Upper limb - English labels" by Open3D project, Jan Kooloos, RadboudUMC, Eungyeol Lee, LUMC et al, license: CC BY-SA 4.0

- Model page: https://anatomytool.org/content/open3dmodel-upper-limb-english-labels (version July 2025)
- Downloaded file: https://caskanatomy.info/open3dmodelfiles/upper-limb/upper-limb-glb.zip
  - Last-Modified: 2025-07-24, downloaded 2026-10-03
  - SHA-256 (zip): `5af0190a6d7bf47393447ac30021e4f3ba619721c7f3a620c39a895947078432`
  - SHA-256 (upper-limb.glb inside the zip): `e440c84c794239d1850e62b4ede0195d81bcff4f0078c7945528c388ab72fdb4`

Like the lower limb, the Open3D model is based on Z-Anatomy and BodyParts3D.

### Changes made

`upper-limb.glb` was produced with `scripts/extract-upper-limb.mjs`:

1. Kept the muscles, tendons and bones of the right pectoral girdle, arm, forearm and hand, and the connective-tissue structures listed in `src/data/structures.json`. Nerves, vessels, ligaments, cartilage, synovial sheaths and bursae, the bones of the back, and the overlay copies of muscle parts were removed.
2. Merged the source's region groups ("Arm - muscles", "Forearm - bones", ...) into two groups, "Muscles" and "Bones".
3. Removed all textures and replaced the materials with three flat colours (muscle, tendon, bone).
4. Re-encoded the geometry with meshopt compression instead of Draco.

Node names are unchanged from the source.

## trunk.glb

### Source

"Open3DModel - Muscles of thorax, abdomen and back - English labels" by Open3D project, Eungyeol Lee, LUMC, Andreas Herrler, MUMC+ et al, license: CC BY-SA 4.0

- Model page: https://anatomytool.org/content/open3dmodel-muscles-thorax-abdomen-and-back-english-labels (version March 2026)
- Downloaded file: https://caskanatomy.info/open3dviewer/3dmodels/muscles-thorax-abdomen/muscles-thorax-abdomen.glb
  - Last-Modified: 2026-03-18, downloaded 2026-10-05
  - SHA-256: `ece35da4cf9b28315b71f5077e010fac84baa50e792b9ba5277d972accb49f1b`

Like the limb models, the Open3D model is based on Z-Anatomy and BodyParts3D.

### Changes made

`trunk.glb` was produced with `scripts/extract-trunk.mjs`:

1. Kept the right-side muscles of the thorax, abdomen and back that are not already in the limb models, the linea alba and the thoracolumbar fascia, and the ribs, sternum, costal cartilage and the vertebrae C1–T11 (both sides, as in the source). The muscles of the shoulder girdle and the iliopsoas (already in the limb models), the overlay copies of muscle parts, the other bones, the articular structures and the other fascia were removed.
2. Merged the source's groups into two groups, "Muscles" and "Bones".
3. Removed all textures and replaced the materials with three flat colours (muscle, tendon, bone).
4. Simplified the geometry with meshoptimizer (error 0.1 % of each mesh's size) and re-encoded it with meshopt compression instead of Draco.

Node names are unchanged from the source.

## head-neck.glb

### Source

"Z-Anatomy - The libre 3D atlas of anatomy" by Gauthier Kervyn, Marcin Zielinski et al., license: CC BY-SA 4.0. Based on "BodyParts3D - The Database Center for Life Science - CC-BY-SA 2.1 Japan".

- Repository: https://github.com/Z-Anatomy/Models-of-human-anatomy (commit `ded1a55381328f3f242426f0e8e711c5fca62c14`, cloned 2026-10-05)
  - SHA-256 (Z-Anatomy.zip): `e029688545627bd0214b269e1063143abb580aad72b2c2445d6d8a9a0d9da736`
  - SHA-256 (Startup.blend inside the zip): `9f08a17ea0115fed80b2a73ecdf0a1bc2ab2f6956f37c593ce23d513ea35afcd`

The parts of Z-Anatomy adapted from models under non-commercial licences (the inner ear, the kidney) are not included.

### Changes made

`head-neck.glb` was produced in two steps: `scripts/export-head-neck.py` (Blender 4.5) exported the selected objects to glTF without materials, and `scripts/extract-head-neck.mjs` built the final file:

1. Kept the right-side masticatory, facial, epicranial, neck, suprahyoid, infrahyoid and suboccipital muscles, and the bones of the skull, the mandible, the hyoid, the teeth and the thyroid and cricoid cartilages (both sides). All other structures, including the laryngeal and pharyngeal muscles, were removed.
2. Merged the objects into two groups, "Muscles" and "Bones", and aligned them to the Open3D models above with a per-axis scale and offset fitted to the cervical vertebrae, T1 and the clavicle (scale 0.986–0.999, offset under 1 mm).
3. Replaced the materials with three flat colours (muscle, tendon, bone).
4. Simplified the geometry with meshoptimizer (error 0.1 % of each mesh's size) and encoded it with meshopt compression.

Object names are unchanged from the source.

## attachments.glb

### Source

"Open3DModel - Muscle attachments - English labels" by Open3D project, Eungyeol Lee, LUMC, Jan Kooloos, RadboudUMC et al, license: CC BY-SA 4.0

- Model page: https://anatomytool.org/content/open3dmodel-muscle-attachments-english-labels (version March 2026)
- Downloaded file: https://caskanatomy.info/open3dviewer/3dmodels/insertions-and-origins/insertions-and-origins.glb
  - Last-Modified: 2026-06-12, downloaded 2026-10-03
  - SHA-256: `ee4dcc029c54e6989fb2b5b1e60e7671f88f5807eb9cdb253c9195489324213a`

### Changes made

`attachments.glb` was produced with `scripts/extract-attachments.mjs`:

1. Kept only the origin and insertion patches of the muscles listed in `src/data/muscles.json` (`attachmentMeshes`). All bones, textures and other structures were removed.
2. Replaced the materials with one plain material. The patches keep their vertex colours (red = origin, blue = insertion).
3. Re-encoded the geometry with meshopt compression instead of Draco.

Node names are unchanged from the source, including its typos ("Extensor hallucis longus brevis" is the extensor hallucis longus; "Extensor hallucis brevis brevis" is the extensor hallucis brevis).
