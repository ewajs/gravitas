# 0022. Terrain rendering: a cube-sphere quadtree meshed in a worker

- Status: Implemented in 5.4b (viewport, terrain sandbox). Contact with the drawn
  ground arrives in 5.4c.
- Date: 2026-11-08

## Decision

With a planet's terrain ([ADR 0021](0021-terrain.md)), the chase view draws the
body as tiles meshed from the engine's height function, so what is drawn is what
the legs touch.

- **A cube-sphere quadtree.** Six cube faces, each a quadtree of square tiles of
  32 × 32 quads. A tangent warp (`tan(s·π/4)`) keeps cells within about 30% of
  each other in angle. Adjacent faces share their edge vertices exactly.
- **Finer near the camera.** A tile splits into quarters while the camera is
  within 2.5 tile edges of it, down to level 18: tiles about 10 m across with
  vertices 33 cm apart on the Moon. A tile is replaced by its quarters only once
  all four are meshed, so there are never holes; until the six face tiles are
  ready, the 5.3a sphere stands in.
- **Only what can be seen.** Tiles beyond the horizon (from the camera's height,
  the lowest ground, and each tile's highest point) or outside the camera's
  frustum are neither drawn nor refined.
- **Meshed in a worker.** A module worker receives the terrain's grid once and
  meshes tiles on request, four at a time, coarse and recently wanted first; the
  arrays are transferred, not copied. Without workers, tiles are meshed on later
  tasks of the main thread. Up to 600 meshes are cached; the least recently used,
  never on the drawn path, are released.
- **Detail the grid can show.** A tile leaves out features narrower than three
  of its vertex spacings, so small craters do not alias into blocks. The finest
  tiles include everything contact uses: under the legs, the drawn surface is
  within 4.8 mm of the engine's height at the 95th percentile, and 5.4 cm at
  worst (across a boulder's crown).
- **Normals from the drawn surface.** Central differences over a grid one vertex
  wider than the tile, so shading matches the geometry (the analytic normals were
  sharper than the mesh and drew stair steps on crater rims) and agrees across
  tile edges. Skirts 5% of a tile's edge deep hide cracks against coarser
  neighbours.
- **Precision.** Each tile's vertices are float32 offsets from its own origin, a
  float64 body-fixed point; tiles sit in one group that the planet pose places in
  the vehicle-centred world. Near the camera, the composed translations are small.
- **The camera and altitude use the ground.** The viewport's altitude (chase
  framing) is height above the terrain below the vehicle, and the chase camera is
  lifted to stay at least 1.5 m above the ground under it.
- **Shared look.** Tiles use the planet's material with NASA's colour map; they
  receive the vehicle's shadow but do not cast shadows.
- **A terrain sandbox.** Owner decision on 2026-11-08: `?scenario=terrain` starts
  the first lander 300 m above Tranquility Base, still, upright, with a full
  tank, in a low morning Sun (12° from the east, like Apollo 11's), so the ground
  can be tried on phones before 5.5. Until 5.4c, reaching the ground pauses.

## Measured

On the M1 Pro (WebGPU, 1280 × 720), with the debug overlay:

| View                        | Tiles drawn | Draw calls | Triangles | Main-thread work p95 |
| --------------------------- | ----------- | ---------- | --------- | -------------------- |
| 100 km up in orbit          | 75          | 114        | 190,681   | 1.2 ms               |
| 76 m above Tranquility Base | 42          | 82         | 108,761   | 0.9 ms               |

Meshing one tile takes 0.5–9 ms in the worker (finest tiles cost most). Both
backends hold 60 fps on this machine.

## Alternatives

- **Geometry clipmaps or a GPU-displaced grid:** fewer draw calls, but the
  height function (craters in 3D cells, a smooth grid) would have to run in
  shaders on both backends, and drawn and touched heights could drift apart.
- **Analytic vertex normals:** exact for the height function, but sharper than a
  mesh can show; shading zigzagged on crater rims.
- **Stitched edges instead of skirts:** no hidden geometry, but neighbours would
  need to agree on levels; skirts are simpler and invisible here.
- **Meshing on the main thread with a time budget:** no worker, but tile bursts
  (descent at orbital speed) would compete with the flight on phones.

## Consequences and revisit conditions

- **Over the 3.3 budget.** The opening's budget is 100 draw calls and 100,000
  triangles. Terrain views exceed it: up to about 115 draw calls and 190,000
  triangles. A planet budget is proposed for the owner in the verification notes;
  the Galaxy A70 measurement decides it.
- Tiles pop to finer detail as they become ready; there is no morphing between
  levels. Revisit if it is distracting on device.
- Dust, the ground ring, and the drop line still assume the flat site; around a
  planet they stay off until contact (5.4c).
