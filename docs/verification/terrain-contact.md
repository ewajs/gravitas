# Terrain contact verification

Step 5.4c was verified locally on 2026-11-08. Both sandboxes touch the Moon's
terrain; touchdowns are judged against the local vertical, and a landing without
a pad has its own verdict ([ADR 0012 amendment](../decisions/0012-landing-outcomes.md)).

## Environment and results

- MacBook Pro, Apple M1 Pro, macOS 15; Node 24.21.0; pinned Playwright 1.64.1.
- `npm run check`: format, lint, types, and 270 unit tests passed.
- The opening's four scripted flights (9,717 ticks hashed every tick) are
  bit-identical to `main`: uniform gravity passes no vertical, so the reducer
  takes the same path as before.
- `npm run test:e2e` (WebGL 2): all 94 passed.
- `npm run test:e2e:webgpu`: 86 passed; 8 skipped by design (static pages and
  files run on one backend only).

## Unit tests

- **Engine (`touchdown.test.ts`):** a touchdown seen from a frame turned 70° and
  30°, with `up` turned with it, reads the same vertical speed, horizontal speed,
  and tilt as in the unturned frame; an `up` that is not a unit vector is
  rejected.
- **Report (`report.test.ts`):** without a pad, a safe landing is
  `landed-no-pad`, with the three touchdown checks and no pad distance.
- **Real Moon (`tests/data/terrain-landing.test.ts`)**, flown by a throttle-only
  pilot in the Moon-fixed frame that sinks at a tenth of its height above the
  ground:
  - From 300 m over Tranquility Base, the terrain sandbox lands: about 0.8 m/s
    down, under 0.1 m/s sideways, under 1° of tilt from the local vertical,
    "landed" with no pad, resting on its feet.
  - The same descent from 40 m onto a spot 300 m east, where the lander's
    footprint tilts about 40°, ends crashed or rough.
  - Hitting the ground in the orbit sandbox at 1.6 km/s is a crash.

## Browser tests (`tests/browser/terrain.spec.ts`, both backends)

- Falling unpowered at 4× from 300 m ends in the results card's "Crash".
- With no pad, the card titles a safe landing "¡Aterrizaje!" and, after switching
  the language, "Landed!".

## Not verified

- **Resting on slopes:** with the regularized friction of ADR 0011, a lander on a
  slope creeps slowly downhill (ADR 0021); it is judged once settled, before the
  creep matters, but it is visible if the flight continued.
- **Phones:** contact sampling on the Galaxy A70 class is unmeasured; the owner's
  on-device check follows deployment.
