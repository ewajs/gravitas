# 0022. Terrain rendering: a cube-sphere quadtree meshed in a worker

- Status: Implemented in 5.4b (viewport, terrain sandbox). The sandboxes touch the
  drawn ground from 5.4c. Amended after 5.4c: band-limited detail, tiles grow out
  of their parents, and one level finer.
- Date: 2026-11-08

## Decision

With a planet's terrain ([ADR 0021](0021-terrain.md)), the chase view draws the
body as tiles meshed from the engine's height function, so what is drawn is what
the legs touch.

- **A cube-sphere quadtree.** Six cube faces, each a quadtree of square tiles of
  32 × 32 quads. A tangent warp (`tan(s·π/4)`) keeps cells within about 30% of
  each other in angle. Adjacent faces share their edge vertices exactly.
- **Finer near the camera.** A tile splits into quarters while the camera is
  within 2.5 tile edges of it, down to level 19: tiles about 5 m across with
  vertices 16 cm apart on the Moon. A tile is replaced by its quarters only once
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
- **Detail the grid can show.** A tile samples the height at a resolution of two
  vertex spacings (ADR 0021): features fade in from two spacings across to four
  (boulders from three to six) and crater rims round off over a spacing either
  side, so nothing is sharper than the grid can follow. Before, features under
  three spacings were left out and the rest drawn whole: rims zigzagged between
  vertices, and under the low Sun craters and boulders two or three vertices
  across shaded as black specks. The finest tiles draw everything contact uses:
  under the legs, the drawn surface is within 2.5 mm of the engine's height at
  the 95th percentile, and 2.3 cm at worst.
- **Normals from the drawn surface.** Central differences over a grid one vertex
  wider than the tile, so shading matches the geometry (the analytic normals were
  sharper than the mesh and drew stair steps on crater rims) and agrees across
  tile edges. Skirts 5% of a tile's edge deep hide cracks against coarser
  neighbours.
- **Tiles grow out of their parents.** Each vertex also carries the parent
  tile's drawn surface under it: the parent's own vertex, or the midpoint of the
  parent's edge or quad diagonal between them, with the parent's normal. A tile
  that replaces its parent on screen starts on that surface, so nothing pops, and
  grows into its own over 0.4 s (a per-tile uniform in the material's position
  node). Before, a whole layer of smaller craters switched on at each split, which
  flickered constantly flying low and fast.
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
  can be tried on phones before 5.5. From 5.4c the lander touches the ground and
  its touchdowns are judged.

## Measured

On the M1 Pro (WebGPU, 1280 × 720), with the debug overlay:

| View                        | Tiles drawn | Draw calls | Triangles | Main-thread work p95 |
| --------------------------- | ----------- | ---------- | --------- | -------------------- |
| 100 km up in orbit          | 75          | 114        | 190,681   | 1.2 ms               |
| 76 m above Tranquility Base | 42          | 82         | 108,761   | 0.9 ms               |

Meshing one tile takes 0.5–9 ms in the worker (finest tiles cost most). Both
backends hold 60 fps on this machine. With band-limited detail and the parent's
surface (after 5.4c), meshing costs 30–60% more (median 0.7 ms at level 4 to
5.6 ms at level 18), and 300 m over Tranquility Base draws 80,601 triangles
(from 70,000) at 1.4 ms of main-thread work at the 95th percentile.

## Alternatives

- **Geometry clipmaps or a GPU-displaced grid:** fewer draw calls, but the
  height function (craters in 3D cells, a smooth grid) would have to run in
  shaders on both backends, and drawn and touched heights could drift apart.
- **Analytic vertex normals:** exact for the height function, but sharper than a
  mesh can show; shading zigzagged on crater rims.
- **Morphing with distance (CDLOD):** continuous both ways, splitting and merging,
  but a tile's far vertices lie beyond where its parent splits, so they always
  show the parent's surface: on trial the ground lost about half a level of
  sharpness everywhere, and winning it back costs about twice the triangles.
- **Stitched edges instead of skirts:** no hidden geometry, but neighbours would
  need to agree on levels; skirts are simpler and invisible here.
- **Meshing on the main thread with a time budget:** no worker, but tile bursts
  (descent at orbital speed) would compete with the flight on phones.

## Consequences and revisit conditions

- **Over the 3.3 budget.** The opening's budget is 100 draw calls and 100,000
  triangles. Terrain views exceed it: up to about 115 draw calls and 190,000
  triangles. A planet budget is proposed for the owner in the verification notes;
  the Galaxy A70 measurement decides it.
- Merging is not smoothed: climbing away, or as ground falls behind, a parent
  replaces its children at once. It is less visible than splitting (the detail
  lost is far from the camera); revisit if it shows on device.
- Each tile carries six more floats per vertex, so 600 cached tiles take about
  41 MB of buffers instead of 23 MB.
- The ground ring and drop line belong to the flat site and stay off around a
  planet; dust spreads on the terrain from 5.4c.
