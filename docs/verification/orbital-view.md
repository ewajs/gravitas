# Orbital view verification

Step 5.3a was verified locally on 2026-11-07. It adds the planetary view to the
viewport ([ADR 0020](../decisions/0020-planetary-view.md)). The game does not use
it until 5.3b, so players see no change yet.

## Environment and results

- MacBook Pro, Apple M1 Pro, macOS 15; Node 24.21.0; pinned Playwright 1.64.1.
- `npm run check`: format, lint, types, and unit tests passed.
- `npm run build`: game, TypeDoc developer docs, and the manual built.
- `tests/browser/viewport.spec.ts`: all 11 tests passed on forced WebGL 2 and on
  hardware WebGPU.

## The planet and the map

The new browser test mounts the fixture viewport, then:

- **Flat site:** grey ground fills more than 80% of the frame, and the map is
  refused.
- **Planet shown:** the Moon is 100 km below at latitude 0, longitude 0, lit from
  the side. The chase camera eases toward the horizon until the Moon fills 30–70%
  of the frame, with the starry sky above.
- **Map:** shows the Moon and the orbit line in the orbit accent.
- **Planet hidden:** the flat site and the lit lander return.

Screenshots of both views on both backends were inspected. They show the textured
Moon with its terminator, the curved horizon with stars, and the orbit as a tilted
ellipse, hidden where it passes behind the Moon, with the vehicle dot and the
periapsis and apoapsis rings.

Two problems found while writing the test, both fixed:

- WebGPU does not draw `LineLoop`. Closed orbits now repeat their first point.
- The map scene had no background, so the canvas cleared to transparent. It now
  shares the sky colour.

## The opening is unchanged

The fixture flew two poses: on the ground, and 30 m up with tilt and yaw. Each
frame was captured on `main`'s viewport and on this branch, on both backends.
After a 4 s wait, frames differed by up to 350 scattered edge pixels, and so did
two runs of the same build. The chase camera's easing runs on wall-clock time, so
it was still settling. After a 12 s wait, all four frame pairs are identical,
with zero differing pixels.

## Unit tests

- **`planet.test.ts`:** Three.js's sphere UVs put the map's longitude 0 at
  body-fixed +X, 90° east at −Z, 90° west at +Z, and 45° north at the expected
  height. Stars are seeded and lie on the unit sphere. The vehicle's map position
  is its offset from the centre rotated into body-fixed axes. Closed orbits repeat
  their first point.
- **`Viewport.test.ts`:** planet radius, pose, sun direction, and orbit-path
  validation, and the map available only while a planet is shown.
- **`chase.test.ts`:** the polar angle is unchanged up to 2 km and reaches the
  orbit framing by 10 km.

## Not verified

- No phone check yet: the game shows no planet until 5.3b.
- Draw cost around a planet adds a 32,768-triangle sphere and 2,400 stars. It will
  be measured on the sandbox in 5.3b with `npm run measure`.
