# Vehicle definitions verification

Step 5.5a was verified locally on 2026-11-09. Vehicles are plain data: the first
lander became the first definition, unchanged, and the descent vehicle is the
second ([ADR 0023](../decisions/0023-vehicle-definitions.md)).

## Environment and results

- MacBook Pro, Apple M1 Pro, macOS 15; Node 24.21.0; pinned Playwright 1.64.1.
- `npm run check`: format, lint, types, and 286 unit tests passed.
- `npm run test:e2e` (WebGL 2): 94 passed. `npm run test:e2e:webgpu`: 86 passed,
  8 skipped by design.

## The first lander, unchanged

- **Flights.** The opening flown by four scripted pilots (idle, hover, vertical,
  to the pad) and the orbit sandbox (a 10 s pitching burn, then 100× warp):
  10,617 ticks of position, velocity, orientation, rates, propellant, throttle,
  and outcome hash the same on this branch and on `main`.
- **Artwork.** A fingerprint of every mesh in the first lander's artwork (vertex
  positions, world transforms, colour, metalness, roughness, side, and shadows),
  at rest and with the legs compressed by (0.3, 0.1, 0.6, 0) m, is the same built
  from the definition's model as from the old code. The plume's lip stays 1.08 m
  below the centre of mass.

## Unit tests

- `apps/game/src/vehicles.test.ts`: both definitions validate; a definition is
  refused for an empty id, a non-positive thrust, a response faster than a step,
  a model without finishes, three legs drawn for four, a model resting higher
  than the legs hold the centre of mass, a foot drawn 10 cm from its leg, and two
  legs. The first lander keeps 54% hover throttle, 1.5 kg/s, and 0.67 km/s.
- The descent vehicle: delta-v 2,003 m/s by the rocket equation; 5 kg/s at full
  throttle, so the 1,900 kg tank lasts 380 s; hover throttle 42.1% full and 21.6%
  empty in lunar gravity. Flown at hover throttle for a second, its vertical speed
  stays under 1 mm/s; burned dry at full throttle in free space, it ends within
  0.05 m/s of the rocket equation's 2,003 m/s after 380 s. It tips past 47.7°.
- `packages/viewport/src/vehicle-model.test.ts`: a model is refused, naming the
  problem, for a non-positive centre of mass, missing or malformed finishes, an
  unknown finish, a flat box, a two-sided cylinder, a non-finite position, no
  legs, a leg without struts, a negative plume, or a non-finite thruster height.
  Swapping to a three-legged model replaces the artwork, takes three compressions,
  rests its feet on the ground at its own centre of mass, and moves the plume
  (7 m, 0.7 m wide) and the puffs to its bell and quads.
- `packages/viewport/src/Viewport.test.ts`: the viewport refuses an invalid model
  at construction and in `setVehicle`, and takes one leg compression per leg.
- `tests/data/terrain-landing.test.ts`: the descent vehicle, flown by the same
  local-vertical pilot as the first lander, lands level at Tranquility Base from
  300 m (under 1.2 m/s, under 1° of tilt), rests on its own legs, and uses under a
  fifth of its tank.

## Look

The descent vehicle in the terrain sandbox (WebGPU, a temporary local build):
it draws with its bronze stage, white module, and wide legs; its 7 m plume and a
thruster puff show while it burns and pitches; it rests upright on its feet.
Screenshots were checked by eye; the vehicle is not reachable in play until the
mission picker (5.5b).
