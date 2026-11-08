# Terrain verification

Step 5.4a was verified locally on 2026-11-08. It adds the engine's terrain (one
height function from NASA's LDEM_4 grid plus seeded craters, boulders, and
roughness), contact on it, the `npm run moon-data` asset pipeline, and the
sandbox's altitude above the ground ([ADR 0021](../decisions/0021-terrain.md)).

## Environment and results

- MacBook Pro, Apple M1 Pro, macOS 15; Node 24.21.0.
- `npm run check`: format, lint, types, and all unit tests passed.
- `npm run moon-data`: downloaded `ldem_4.img` and `ldem_4.lbl` from the PDS
  Geosciences Node; checksum and label fields matched; the written file is
  byte-identical to the source.
- The opening's four scripted flights (9,717 ticks hashed every tick) are
  bit-identical to `main`.

## Unit tests

- **Grid (`terrain.test.ts`, synthetic 1° grid):** heights pass through every
  sample at its cell centre (500 cells); value and normal are continuous across
  the date line; each pole has one height (the pole row's mean) and is level, and
  every approach a metre from the pole agrees to under a millimetre; analytic
  normals match finite differences within 10⁻⁶ rad at 400 spots.
- **Detail:** the same seed gives the same heights in any evaluation order and a
  different seed differs almost everywhere; at infinite resolution the height is
  exactly the grid's; detail stays within a few hundred metres of the grid and
  inside the declared bounds over 20,000 spots; analytic normals match finite
  differences within 0.2° at the 99th percentile; `slope` is the normal's lean.
- **Noise (`noise.test.ts`):** pinned hash values (snapshot), evenly spread over
  [0, 1), and gradient noise whose analytic gradient matches finite differences.
- **Contact (`terrain-contact.test.ts`):**
  - Level terrain at the pole settles a dropped lander exactly as flat ground
    does: height within 10 µm, per-leg penetration within 10 µm.
  - Far above the ground, a step with terrain equals free flight to the bit.
  - A 10° grid slope gives a normal leaning 10°, downhill where expected.
  - On a 10° slope with friction 0.6, the lander rests upright with the legs
    carrying m·g·cos θ, creeping at the speed the regularized friction model
    predicts (about 3 cm/s; see ADR 0021).
  - With friction 0.1 it slides downhill at g (sin θ − μ cos θ).
  - Penetration is measured along the normal below the tangent plane.
- **Game (`apps/game/src/terrain.test.ts`):** the file decodes as little-endian
  half metres; a wrong size is rejected; the Moon's terrain uses the Moon's radius
  and the fixed seed; the altitude readout is height above the ground below once
  the terrain has loaded and the mean-radius altitude before.
- **Shipped data (`tests/data/moon-terrain.test.ts`):** the shipped file's
  SHA-256 is NASA's; its extremes are the label's (+10,504 m just north of the
  equator on the far side, −8,878.5 m in the South Pole–Aitken basin); sampling
  matches the grid at cell centres; Tranquility Base is about 1.9 km below the
  reference and level at grid scale; heights stay within the declared bounds.

## Browser tests

- `tests/browser/orbit.spec.ts` (both backends): the sandbox's altitude reads
  102.0 km once the grid has loaded: the start is 100 km above the mean radius
  over ground about 2 km below it. The rest of the sandbox flow is unchanged.
- `npm run test:e2e` and `npm run test:e2e:webgpu`: full suites passed.

## Measurements

On the M1 Pro in Node, with the real grid:

| Measure                                            | Result            |
| -------------------------------------------------- | ----------------- |
| Full sample (height and normal)                    | about 8 µs        |
| Height at 64 m resolution                          | about 3 µs        |
| Flight step resting on the Moon, 14 contact points | about 160 µs      |
| Flight step 300 m up (one sample)                  | about 12 µs       |
| Flight step in free flight                         | about 6 µs        |
| Building the terrain                               | about 40 ms, once |
| Normal vs finite differences, 3,000 spots          | 99th pct 0.06°    |
| Spots tilting over 10° across 3 m (detail alone)   | about 13%         |

## Not verified

- **Nothing draws the terrain yet:** the sandbox's Moon is still a smooth sphere,
  so the altitude readout and the drawn ground disagree by up to kilometres until
  5.4b. The sandbox has no terrain contact yet.
- **Phones:** sampling cost on the Galaxy A70 class is unmeasured; 5.4b's
  `npm run measure` workload covers it.
- **Cross-browser heights:** only Node (V8) was measured; Safari may differ in
  the last bits (ADR 0021).
