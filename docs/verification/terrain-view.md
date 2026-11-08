# Terrain view verification

Step 5.4b was verified locally on 2026-11-08. The chase view draws the Moon's
terrain as cube-sphere tiles meshed in a worker, and `?scenario=terrain` starts
the first lander 300 m above Tranquility Base
([ADR 0022](../decisions/0022-terrain-rendering.md)).

## Environment and results

- MacBook Pro, Apple M1 Pro, macOS 15; Node 24.21.0; pinned Playwright 1.64.1.
- `npm run check`: format, lint, types, and 264 unit tests passed.
- `npm run test:e2e` (WebGL 2): 93 passed. The new terrain test first failed on
  its altitude pattern (whitespace around the readout); fixed and rerun on both
  backends.
- `npm run test:e2e:webgpu`: the rest passed, 8 skipped by design. The opening's
  language-switch test, which compares screenshots before and after, failed once
  in the full run and once in 4 reruns; it then passed 8 of 8 on this branch and
  8 of 8 on 5.4a. It looks load-sensitive (the machine was running other suites),
  not caused by this step, which does not touch the flat site.
- The opening's measured workload is unchanged: 45 draw calls, 19,501 triangles.

## Unit tests (`packages/viewport/src/terrain-tiles.test.ts`)

- Each cube face is centred on its axis; neighbouring faces meet edge to edge
  (shared edge directions within 10⁻¹⁵).
- A tile's four quarters cover it exactly.
- Every surface triangle faces outward; indices stay within the tile's vertices.
- On level ground, vertices lie on the sphere and normals point straight up.
- Every vertex is at the engine's height for the tile's resolution, within 1 cm
  (float32 offsets from the tile's origin).
- Neighbouring tiles at one level share their edge vertices: no cracks.
- Skirts hang 5% of the tile's edge below every border.
- The quadtree starts from six faces, refines to level 15 or deeper 200 m above
  the ground, and draws nothing beyond the horizon.

## Drawn against touched (`tests/data/moon-terrain.test.ts`)

On the finest tiles (33 cm between vertices) around Tranquility Base, points
spread over the drawn triangles are within 4.8 mm of the engine's height at the
95th percentile and 5.4 cm at worst (across a small boulder's crown).

## Browser tests (`tests/browser/terrain.spec.ts`, both backends)

- `?scenario=terrain` names its scene and subtitle in both languages and reads
  about 300 m of altitude.
- After Start, every wanted tile is meshed; level 15 or finer is drawn near the
  lander, with fewer than 150 tiles.
- Falling at 4× until the ground (which pauses until 5.4c), level 17 or finer is
  drawn.

Screenshots from 300 m and 76 m on both backends were inspected: craters and
boulders with long morning shadows, no seams or cracks, and no stair steps on
crater rims once normals came from the drawn surface.

## Measurements (`npm run measure`)

| Workload                 | Project | fps  | Work p50 / p95 | Draws | Triangles | Tiles |
| ------------------------ | ------- | ---- | -------------- | ----- | --------- | ----- |
| Opening, powered descent | webgpu  | 60.0 | 0.7 / 0.8 ms   | 45    | 19,501    | —     |
| 300 m over the terrain   | webgpu  | 60.0 | 1.0 / 1.2 ms   | 67    | 70,361    | 29    |
| 100 km in orbit          | webgpu  | 60.0 | 1.0 / 1.1 ms   | 99    | 152,281   | 59    |
| 300 m over the terrain   | webgl2  | 12.9 | 1.1 / 1.6 ms   | 62    | 57,561    | 22    |
| 100 km in orbit          | webgl2  | 8.0  | 1.3 / 2.1 ms   | 99    | 152,281   | 59    |

WebGPU is the M1 Pro through Metal; WebGL 2 is SwiftShader (software, headless),
a test environment rather than a player target. Main-thread work stays near 1 ms;
meshing runs in the worker (0.5–9 ms per tile). Interactively at 1280 × 720, a
camera skimming the ground after a crash drew up to 153 calls and 290,000
triangles, the heaviest view seen.

## Proposed planet budget (for owner decision)

The 3.3 budget (100 draw calls, 100,000 triangles) was set for the flat site.
Around a planet, proposed: **150 draw calls, 300,000 triangles, main-thread work
p95 ≤ 4 ms**, to be confirmed or tightened by the Galaxy A70 measurement after
deployment. If the A70 cannot hold it, the split distance (2.5 tile edges) is the
first knob.

## Not verified

- **Phones:** tile meshing and drawing on the Galaxy A70 and iPhone 15 Pro are
  unmeasured until deployment.
- **Popping:** tiles switch to finer detail without morphing; acceptable on the
  desktop, to be judged on devices.
