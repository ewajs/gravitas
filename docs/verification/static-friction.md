# Static friction verification

Groundwork for 5.5c, verified locally on 2026-11-10. Touching contact points
grip anchors carried in the flight state, so a lander at rest on a slope stays
there ([ADR 0011 amendment](../decisions/0011-contact-model.md)); settling needs
a stable three-leg stance ([ADR 0012 amendment](../decisions/0012-landing-outcomes.md)).

## Environment and results

- MacBook Pro, Apple M1 Pro, macOS 15; Node 24.21.0; pinned Playwright 1.64.1.
- `npm run check`: format, lint, types, and 288 unit tests passed.
- `npm run test:e2e` (WebGL 2): 103 passed. `npm run test:e2e:webgpu`: 95 passed,
  8 skipped by design.

## The opening

Its four scripted flights (idle, hover, vertical, to the pad), compared with
`main`:

- While airborne: bit-identical (466, 5,824, 1,355, and 1,798 ticks hash the same).
- Verdicts and touchdown values: the same (crash on impact at 16.58 m/s and
  14.88 m/s; rough at 0.79 m/s down and 2.00 m/s sideways; landed at 0.63 m/s,
  2 mm from the pad's centre).
- After contact: slides end within 4 cm of where they did, and the vertical
  descent settles four ticks sooner.

## Unit tests

- `packages/engine/src/terrain-contact.test.ts`: on a 10° slope with friction 0.6
  the lander comes to rest under 0.1 mm/s with four anchors and moves under 1 mm
  in the next minute (it crept 1.8 m before); 25° holds and 35° slides (the
  friction angle is 31°); with friction 0.1 it accelerates downhill at
  g (sin θ − μ cos θ).
- `packages/engine/src/contact.test.ts`: at rest on flat ground each leg's anchor
  is under it and the clear bell has none; a 0.1 m/s nudge springs back to
  within 0.1 mm; lifted clear, the state carries no anchors. Sliding at 3 m/s
  still decelerates at μg.
- `tests/data/terrain-landing.test.ts`: both vehicles land at Tranquility Base,
  where the first lander now rests on three legs (loads of 869, 0, 4, and 843 N
  at 15% throttle) and is judged landed; the 40° wall and the orbital-speed
  crash still fail.

## Cost

A resting step on flat ground takes 21 µs instead of 16 µs (M1 Pro, Node).
