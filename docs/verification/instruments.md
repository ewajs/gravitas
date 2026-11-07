# Chase camera and instrument verification

Step 1.3 was verified locally on 2026-11-06. It adds a heading-following chase
camera, a landing radar and instrument cluster, surface depth cues, and an
opening that faces the pad. Owner visual review closes M1.

## Environment and results

- MacBook Pro (`MacBookPro18,1`), Apple M1 Pro, 32 GiB RAM, macOS 15.7.9.
- Node 24.21.0; pinned Playwright 1.64.1.
- `npm run check`: format, lint, types, and 66 unit tests passed.
- `npm run build`: game and TypeDoc developer docs built with validation. The
  existing Vite advisory for the renderer chunk over 500 kB remains.
- `npm run test:e2e`: all 18 tests passed on forced WebGL 2.
- `npm run test:e2e:webgpu`: all 18 tests passed, including actual WebGPU backend
  and rendered-content assertions.
- The flight spec repeated three times on WebGPU: 15/15. An earlier three-times
  repeat on both backends found one timing failure in the throttle-ramp check on
  WebGL 2; that check was made event-driven. A later repeat run was stopped
  externally; one clean WebGL 2 flight-spec run and the full suite passed afterwards.
- `git diff --check` passed.

## Frame rate

Measured on this machine, mid-flight, 3 s of `requestAnimationFrame` counts:

| Project / renderer                       | main (1.2) | this step |
| ---------------------------------------- | ---------- | --------- |
| webgpu: Apple M1 Pro (Metal), hardware   | 60.3 fps   | 60.3 fps  |
| webgl2: SwiftShader (software, headless) | 22.0 fps   | 15.3 fps  |

Removing the rock and crater scatter restores the software path to about 19 fps;
the ground marker costs about 1 fps there. The forced-WebGL test project uses
Chromium's software renderer, not this Mac's GPU, so it is not a player-device
figure. At these rates some frames exceed the five-step catch-up limit, and the
simulation runs slower than real time, as designed. Browser flight tests therefore
poll for outcomes instead of assuming real-time progress. Measured budgets on named
devices are M3 work.

## What is covered

Unit:

- `headingAngle`: pure yaw, invariance under tilt about any horizontal axis, q/−q
  equivalence, forward-vector convention. `bodyToWorld` axis mappings.
- Chase rig: starts behind the heading at the default distance and elevation; a
  90° yaw is eased, not snapped, and settles behind the new heading; translation is
  exact; a player orbit is left alone, then eases back after the delay while zoom
  is kept; exact inversion holds the last heading. Elevation schedule endpoints;
  short-way angle easing across ±π.
- Telemetry: heading-frame projection; the opening shows the pad 30 m ahead and
  2 m/s drift toward it; pitch forward leans to +y and roll left to −x by sin(tilt);
  hover throttle at current mass.
- Radar geometry: forward drawn up, right drawn right, proportional within the
  rim, clamped on the rim with direction kept.

Browser:

- Production radar: the opening pad and drift markers sit at the expected points;
  held W moves the lean dot up; held Q (yaw left) swings the pad marker right. The
  hover mark is present.
- Chase framing (fixture): after a 20 m climb, the vehicle stays well inside the
  frame both immediately and after easing; inversion about the centre of mass is
  visible.
- Wheel zoom survives a language switch, past the chase return delay, with the
  scene unchanged.
- Narrow layouts in both locales: header, actions, phase message, instruments, and
  the fuel, throttle, and vertical-speed values all stay within 375 × 667.
- All 1.2 flight, focus, hidden-tab, help, and contact checks still pass.

Screenshots of the opening, mid-flight radar after a yaw, touchdown, and narrow
layouts were reviewed. That review led to: orbiting the centre of mass instead of
a lowered look-at point (which pushed the lander off screen), a lens shift, flat
non-overlapping craters instead of tori, a near plane of 0.5 m against decal
z-fighting, a bolder pad ring, a blue ground marker, and a camera reset on restart.

## Not covered

- No human playtest by the implementer. Flight feel, easing constants, radar
  scales, and framing need the owner's review.
- Software-renderer frame rate fell from 22 to 15 fps; hardware was unaffected on
  the one GPU measured. No other devices were measured.
- No contact physics or landing verdict (M2).
