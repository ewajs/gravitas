# 0021. Terrain: one height function from NASA's grid and seeded detail

- Status: Implemented in 5.4a (engine, data, sandbox altitude). Drawn and touched
  in the game from 5.4b.
- Date: 2026-11-08

## Decision

A body's ground is one pure function of direction from its centre, in the
engine (`createTerrain`, `terrainHeight`, `sampleTerrain`). Contact, normals,
the altitude readout, and from 5.4b the rendered mesh all come from it, so what
is drawn is what the legs touch.

- **Measured shape: LOLA LDEM_4 only.** Owner decision on 2026-11-07: NASA's
  LDEM_4 grid (4 samples per degree, about 7.6 km apart at the equator,
  1440 × 720 16-bit heights in half metres above 1,737.4 km, 2 MB) and nothing
  finer, so no tiles to stream. `npm run moon-data` downloads it from NASA's PDS
  Geosciences Node, checks the pinned SHA-256 and the label's layout, and writes
  it unchanged to `apps/game/public/moon/ldem-4.bin`; provenance and terms are in
  [docs/assets.md](../assets.md). It barely compresses (gzip saves 8%, row
  deltas 28%), so it ships raw.
- **Sampled smoothly.** Bicubic Catmull–Rom interpolation in latitude and
  longitude passes through every sample and has a continuous slope. Longitude
  wraps; rows past a pole continue on the far side. Within half a cell of each
  pole the height eases to that pole row's mean, so the pole has one height and
  is level, whichever way it is approached.
- **Everything finer is generated from one static seed.** Owner decision on
  2026-11-07; the game's seed is `0x6c756e61`. Three families of detail are added
  to the grid:
  - _Craters_, simple bowls with a rounded rim and an ejecta blanket fading to
    nothing at twice the radius, in eleven layers from 1.4–2.9 km down to
    1.4–2.8 m across. Equal odds per layer make the cumulative count grow as D⁻²,
    the small-crater equilibrium. Most are old and shallow (a tenth of their
    diameter or less); a few fresh ones are a fifth of it deep.
  - _Boulders_, rounded bumps 1.4–11 m across and 0.6–1.2 times their radius
    tall, sparse and small everywhere, gathered in fields set by a 300 m noise.
  - _Rolling roughness_, 13 octaves of gradient noise from 4 km down to 1 m with
    amplitude growing as wavelength^0.9, scaled from 0.6× on flat ground (maria)
    to 1.8× on steep ground (highlands), measured from the grid's own slope.
- **No projection in the detail.** Craters and boulders are placed in 3D cells
  of the body-fixed frame: a cell's random centre that lies within a thin shell
  around the sphere becomes a feature at its projection. Density is the same
  everywhere, with no seams, polar pinching, or cube-face edges. A feature reaches
  at most 0.35 cells and the shell is 0.3 cells thick, so each point looks at
  only the 2 × 2 × 2 nearest cells per layer.
- **Exact slopes.** Every piece returns its analytic gradient, including the
  ruggedness map's (a second smooth map), so the normal is the true normal of
  the height function: within 0.11° of finite differences at the 99th
  percentile on the real Moon, and the rim is rounded so normals turn
  continuously. `slope` is the normal's lean from the local vertical.
- **Deterministic per browser.** Hashing is integer-only (`Math.imul`), so the
  lattice is identical everywhere, and a seed gives the same heights on every run
  and in any order. Safari and Chrome may differ in the last bits of `atan2`
  and `pow`, so heights can differ by far less than a millimetre between
  browsers. Owner decision on 2026-11-08: that is enough until replays exist.
- **Coarse detail on request.** A `resolution` argument band-limits the detail
  for drawing far ground in 5.4b; contact always uses everything, at resolution 0. At infinite resolution the height is exactly the grid's. Amended after
  5.4c: features fade in smoothly as their size grows from the resolution to
  twice it (boulders, steep-sided, from 1.5 times that), roughness octaves
  likewise by wavelength, and crater rims round off over half the resolution
  either side of the crest. A hard cutoff switched whole layers of craters on at
  once and drew rims sharper than a grid can follow; the height now changes by
  under a hundredth of the resolution per 2% step of it. At resolution 0 the
  ground is bit-identical to before.
- **Contact on terrain.** `Surface` gains `{ kind: 'terrain', terrain }`, valid
  when the world frame is the body-fixed frame centred on the body. Each step,
  `stepFlight` samples the ground once under each contact point and holds that
  tangent plane through the step's substeps; penetration is the depth below it
  along its normal. Sampling happens only when the ground below the centre of
  mass is within the contacts' reach plus the step's travel, allowing the ground
  nearby to rise up to 4 m per metre (`TERRAIN_SLOPE_BOUND`); higher up a step
  is the same as free flight, to the bit. Flat ground is unchanged: the opening's
  flights are bit-identical.
- **The altitude readout** is the feet's height above the ground straight below,
  like a landing radar. Owner decision on 2026-11-08: apoapsis and periapsis stay
  measured from the mean radius, as is standard; a warning when periapsis is
  below the highest ground under the orbit comes with the descent level (5.5).

## Measured costs

On an M1 Pro in Node: a full sample (height and normal) takes about 8 µs, and
3 µs at 64 m resolution. A flight step resting on the real Moon with the first
lander's 14 contact points takes about 160 µs; at 300 m up, 12 µs (one sample);
in free flight, 6 µs. Building the terrain (validation and the ruggedness map)
takes about 40 ms once. Phones are slower; 5.4b measures them.

## Alternatives

- **Streaming LDEM_16/64 tiles near the vehicle:** real detail down to 470 m, but
  tiles, caching, and gigabytes of source for a gain the seeded detail mostly
  provides. The owner judged it overengineering.
- **Detail on a cube-sphere or latitude–longitude grid:** cheaper lookups, but
  seams at face edges and distortion near poles or corners.
- **Pure fractal noise for everything:** no craters, and craters are what the Moon
  looks like at every scale.
- **Sampling the terrain at every RK stage:** exact, but 16 samples per contact
  per tick; the per-step tangent plane moves the contact by under a millimetre at
  landing speeds.

## Consequences and revisit conditions

- **Creep on slopes.** Friction is regularized below 0.1 m/s of slip
  ([ADR 0011](0011-contact-model.md)), so a lander resting on a slope creeps
  downhill slowly instead of sticking: about 3 cm/s on 10° with friction 0.6.
  Flat ground hides this. Fixed on 2026-11-10 with static friction: per-contact
  anchors in the flight state (the ADR 0011 amendment).
- **Roughness.** On the real Moon, about 13% of random spots tilt more than 10°
  across 3 m from the detail alone. The constants are tuned by eye and by these
  statistics; 5.4b and 5.5 may retune them.
- **The slope bound is not a proof.** Ground that rises faster than 4 m per metre
  toward a contact for a whole step would be found a step late, with a deeper
  first contact. Stacked features can be that steep only over centimetres.
- `maximumHeight` and `minimumHeight` are generous bounds (about ±1 km beyond
  the grid's extremes), used only to skip sampling far from the ground.
