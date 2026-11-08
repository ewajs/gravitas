# Orbit sandbox verification

Step 5.3b was verified locally on 2026-11-07. It adds the orbit sandbox
(`?scenario=orbit`), the HUD's orbital readouts, time-warp controls, refusal
notices, and the map toggle. It builds on 5.2's warp
([ADR 0019](../decisions/0019-orbits-and-time-warp.md)) and 5.3a's planetary view
([ADR 0020](../decisions/0020-planetary-view.md)).

## Environment and results

- MacBook Pro, Apple M1 Pro, macOS 15; Node 24.21.0; pinned Playwright 1.64.1.
- `npm run check`: format, lint, types, and 225 unit tests passed.
- `npm run build`: game, TypeDoc developer docs, and the manual built.
- `npm run test:e2e`: all 92 tests passed on forced WebGL 2.
- `npm run test:e2e:webgpu`: 84 passed on hardware WebGPU; 8 skipped by design
  (static pages and files run on one backend only).

## Unit tests (`apps/game/src/orbital.test.ts`, `gamepad.test.ts`)

- **Start:** the sandbox starts upright 100 km up at apoapsis with a full tank,
  facing along its ground track: drift points straight ahead on the radar at
  over 1.5 km/s.
- **Readouts:** apoapsis 100 km and periapsis 15 km. The time to periapsis is half
  of Kepler's period for a = R + 57.5 km, and the orbital speed matches vis-viva at
  apoapsis.
- **Vehicle-centred scene:** the vehicle is at the origin to within a micrometre.
  The previous tick sits one tick's travel behind, the Moon's centre straight
  below at the vehicle's distance, and the Moon's orientation carries the vehicle's
  Moon-fixed position to the origin. The start is in daylight, with the Sun 60°
  from the zenith.
- **Map path:**
  - A bound orbit is a closed loop of 256 points, between periapsis and apoapsis,
    in one plane through the centre, with both marks.
  - An escape is an open arc out to 10 Moon radii, with a periapsis mark only.
  - A fall straight down at a pole, which has no orbital plane, gets no path and
    no readout, not an error.
- **Telemetry:** ground-relative speeds, no pad or safe-sink hint, the orbit
  attached, and hover throttle from local gravity.
- **Gamepad:** D-pad right and left step time warp faster and slower, and Back
  toggles the map, once per press.

## Browser tests (`tests/browser/orbit.spec.ts`, both backends)

- **Readouts and labels:** the subtitle and canvas label name the sandbox.
  Apoapsis reads 100.0 km, periapsis 15.0 km, and altitude 100.0 km. There is no
  pad distance, and the orbital speed is above 1.5 km/s.
- **Warp:**
  - `.` steps 1× → 2× → 4× → 10× → 100×. At 100×, 1.5 s of wall time takes more
    than a minute off the time to periapsis, even on software WebGL. `,` steps back.
  - Holding R drops warp to 1×. With the lever open, a step past 4× is refused with
    "Close the throttle to speed up time further."; after X cuts the engine, 10× is
    accepted.
- **Map and Help:** V and the map button toggle the map (`aria-pressed`). Pausing
  returns to 1×. Help lists "Time: slower / faster" and "Map and orbit".
- **Spanish:** "Órbita lunar · prueba", "100,0 km", and a Mapa button.
- **Opening unchanged:** no warp stepper or map button; `.` and V do nothing; the
  pad distance is shown.
- **Phones:** on the iPhone 15 Pro in Safari (734 × 331) and the Galaxy A70 in
  Chrome (914 × 355), with emulated touch:
  - the stepper fits on screen beside pause, and its faster button works;
  - the radar card shows Ap and Pe, without the orbital speed;
  - the centre corridor stays clear, and nothing overflows;
  - the ⋯ menu's Map entry switches to the map.

Screenshots of the sandbox's chase view and map on desktop and phone sizes were
inspected: Moon horizon and stars, corner readouts, the stepper, Ap and Pe in the
radar card, and the map with the orbit's ellipse and marks.

## Not verified

- **No real phone yet:** the owner's on-device check follows deployment.
- **Draw cost:** `npm run measure` flies the opening, not the sandbox, so the
  sandbox's cost on phones is unmeasured. A measure workload for it is worth adding
  when the descent level arrives.
- **No landing:** there is no surface contact around the Moon yet. Reaching the
  mean radius pauses the flight (unit-tested only through `sphereAltitude`; no
  browser test flies down to it).
