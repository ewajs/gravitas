# Terrain detail verification

A follow-up to 5.4, verified locally on 2026-11-08. From the owner's review on
desktop and an iPhone 15, flying low in the orbit sandbox: craters popped in
constantly as tiles split, and some crater rims had noisy, jagged edges. Tiles
now draw band-limited detail and grow out of their parent's surface
([ADR 0021](../decisions/0021-terrain.md) and
[ADR 0022](../decisions/0022-terrain-rendering.md) amendments).

## Causes found

- **Popping.** Each tile left out features under three vertex spacings and drew
  the rest whole, so every split switched on a whole layer of craters at half
  the size. Offline renders of one patch at levels 13 and 14 showed the crater
  count doubling at the split.
- **Jagged rims.** A fresh crater's rim crest is narrower than a vertex spacing
  at the levels that draw it, so it fell between vertices and zigzagged
  (screenshots at 1.4 km over Tranquility Base, flying 1 km/s). Craters and
  boulders only two or three vertices across shaded as black specks under the
  12° Sun.

## Environment and results

- MacBook Pro, Apple M1 Pro, macOS 15; Node 24.21.0; pinned Playwright 1.64.1.
- `npm run check`: format, lint, types, and 274 unit tests passed.
- `npm run test:e2e` (WebGL 2): 94 passed. `npm run test:e2e:webgpu`: 86 passed,
  8 skipped by design.
- Contact is unchanged: 40,000 full-detail ground samples (heights, normals,
  slopes over the sphere and a dense patch at Tranquility Base) hash the same on
  this branch and on `main`. The flight code is untouched, so the opening's
  flights are unchanged too.

## Unit tests

- `packages/engine/src/terrain.test.ts`: stepping the resolution from 1,024 m
  down to 1 m in 2% steps at 60 points, the height never moves by a hundredth of
  the resolution in one step. The same test on `main` fails at 0.17.
- `packages/viewport/src/terrain-tiles.test.ts`: a tile's morph targets lie on its
  parent's drawn surface (the parent's vertices and normals, or the midpoints of
  its edges and quad diagonals, within 1 cm); a face tile grows from itself; in the
  quadtree, every tile that replaces its parent starts fully on the parent's
  surface (more than 20 such replacements) and is its own 0.4 s later.
- `tests/data/moon-terrain.test.ts`: at the new finest level (19, 0.16 m between
  vertices), the drawn ground under the legs at Tranquility Base is within 2.5 mm
  of the touched ground at the 95th percentile and 2.3 cm at worst (level 18 was
  4.8 mm and 5.4 cm).

## Look, before and after

Screenshots in WebGPU at 1400 × 900, same scenes on `main` and this branch:

- 1.4 km up at 1 km/s: rims that zigzagged are smooth.
- 260 m and 160 m in free fall over Tranquility Base: as sharp as `main`, with
  more small craters fading in; boulder fields no longer show as black specks.

A distance-based morph (CDLOD) was tried first and dropped: continuous in both
directions, but the ground lost about half a level of sharpness everywhere,
visibly softer than `main` at 160 m.

## Cost

- Meshing a tile in the worker: median 0.7 ms (level 4) to 5.6 ms (level 18),
  30–60% more than before (parent surface samples and one more crater layer).
- `npm run measure` (WebGPU, 60 fps throughout): opening 19,501 triangles at
  0.8 ms main-thread work p95; 300 m over the terrain 80,601 triangles (from
  70,000) at 1.4 ms; in orbit 152,281 triangles at 1.3 ms.
- Buffers: six more floats per vertex; 600 cached tiles take about 41 MB instead
  of 23 MB.

## Known limits

- Merging is not smoothed: climbing away, or as ground falls behind, a parent
  replaces its children at once. It happens away from the camera; revisit if it
  shows on device.
- Neighbouring tiles that split at different moments grow in on their own
  clocks, so for up to 0.4 s their shared edge can differ; skirts hide the gap.
