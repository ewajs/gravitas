# Contact model verification

Step 2.1 was verified locally on 2026-11-07 during the owner-approved overnight
run. It replaces the placeholder ground halt with engine surface contact.

## Environment and results

- MacBook Pro (`MacBookPro18,1`), Apple M1 Pro, 32 GiB RAM, macOS 15.7.9.
- Node 24.21.0; pinned Playwright 1.64.1.
- `npm run check`: format, lint, types, and 78 unit tests passed.
- `npm run build`: game and TypeDoc developer docs built with validation.
- `npm run test:e2e`: all 18 tests passed on forced WebGL 2 (SwiftShader).
- `npm run test:e2e:webgpu`: all 18 tests passed on hardware WebGPU.
- `git diff --check` passed.

## Analytic references (`packages/engine/src/contact.test.ts`)

Values measured while writing the tests, against the expected values:

| Case                                 | Measured                  | Expected                     |
| ------------------------------------ | ------------------------- | ---------------------------- |
| Resting leg compression              | 0.030375 m (1e-6)         | `mg/4k` = 0.030375 m         |
| Elastic bounce exit speed            | 1.9999996 m/s             | 2 m/s (energy conserved)     |
| Elastic contact duration             | 0.43042 s                 | `π/√(4k/m)` = 0.43018 s      |
| Sliding speed after 0.5 s from 3 m/s | 2.5144 m/s                | `3 − μg·0.5` = 2.5140 m/s    |
| Released on two feet at 38° / 52°    | returns to 0.0006° / >60° | stable below 45°, tips above |
| Engine bell reached at 2 / 8 m/s     | no / yes                  | lip is 0.42 m above feet     |

The rebound-valving test bounds the exit speed after a 6 m/s hit below 0.3 m/s.
Above the surface, motion matches free flight to 1e-9 m.

## Game-level behavior (`apps/game/src/session.test.ts`)

- **First contact timing:** the unpowered opening first touches down on the tick
  the free-fall formula predicts.
- **Crash without a bounce:** the lander keeps flying through the impact, then
  comes to rest within 0.5 m of standing height. A first tuning bounced it about
  6 m high: the hull spring was underdamped, and the legs returned stored energy.
  Overdamped hull points and separate rebound damping fixed it.
- **Soft landing:** the scripted pilot touches down softer than 1.5 m/s with over
  half the fuel left. With the engine off it settles on all four legs, upright and
  still.

## Browser

- The unpowered impact reads 0.0 m and 0.0 m/s, and still does 1.5 s later. The
  check requires both readings to be zero, so a zero-crossing of a bounce cannot
  pass. Restart returns to 80.0 m.
- The viewport fixture draws a 0.4 m leg compression with feet on the pad, and the
  screenshot was reviewed. A unit test checks strut ends follow the feet.
- All earlier flight, radar, focus, locale, and lifecycle tests pass.

## Not covered

- No human playtest of touchdown feel: leg stiffness, damping, and friction are
  reasoned values.
- No landing verdict (2.2). Rocks are visual only; the lander does not collide
  with them.
- Off-axis and rolling crash shapes are covered by the tip-over references and
  hull points, not by a full crash matrix.
