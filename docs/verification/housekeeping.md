# Housekeeping verification

Step 4.1 was verified locally on 2026-11-07. It gives the engine one home for
vector, quaternion, clamp, and angle math, names repeated game helpers once,
splits the flight HUD into focused modules, and tidies the Learn models. No
behaviour change is intended, so verification compares the new build with the
previous one rather than with new references.

## Environment and results

- MacBook Pro (`MacBookPro18,1`), Apple M1 Pro, 32 GiB RAM, macOS 15.7.9.
- Node 24.21.0; pinned Playwright 1.64.1.
- `npm run check`: format, lint, types, and 119 unit tests in 22 files passed.
- `npm run build`: game, TypeDoc developer docs (warnings are errors), and the
  manual (dead links fail) built.
- `npm run test:e2e`: all 30 tests passed on the forced-WebGL 2 project, as they
  did before the first change.
- `npm run test:e2e:webgpu`: 25 tests passed on hardware WebGPU; the 5 static
  manual and Learn page tests run only on the WebGL 2 project by design.
- `git diff --check` passed.

## Simulation, bit for bit

A throwaway harness (not committed) bundled the real TypeScript sources and ran
them under Node before the first change and again after the last. Per tick, it
hashed the complete state as exact float64 bytes, so even a sign of zero counts:

- **Session flights** through `FlightSession` and the game's rules: the pad,
  throttle-only, hover-until-dry, and no-input pilots; three seeded random
  keyboard pilots; the pad pilot at 30 Hz and 144 Hz frames; and irregular
  frames with overload. Each continued 10–20 s past its verdict. Hashed per tick:
  state, previous state, lever, tick count, dropped time, actuation, outcome, and
  verdict state, plus the telemetry, foot clearance, audio levels, report, and
  contact facts derived from them.
- **`fly()`** as the regression tests call it.
- **Engine-only integrations** with contact: resting, sliding, elastic and
  damped bounces, valved rebound, tip-over from 38°, 45°, and 52°, bell strikes,
  the game's lander tumbling onto every hull point, an assisted powered landing
  that runs dry, free flight, torque-free rotation, a tilted burn, and 500
  in-step exhaustions; touchdown judging over simulated drops; and 4,000 random
  orientation and rate-assist samples.

All 43 scenarios (69,030 hashed ticks) match, with identical final states. As a
sensitivity check, regrouping one addition in the engine's derivative changed 10
scenarios from their first powered-touchdown tick. The hover and no-input pilots
that moved from the tests into `pilots.ts` fly with bit-identical inputs and
states to the inline originals (5,825 and 467 ticks).

The code wrote clamps in two operation orders. Over special values (signed
zeros, infinities, NaN) they agree on every range except [+0, −0], which
JavaScript counts as min ≤ max; no call site can produce that range.

## Learn models

- Free fall, rockets, legs, the spring integrators, Newton's cannon, and axis
  ticks are bit-identical at every explorer slider position. The spring and the
  cannon now share one RK4 with the same operation order.
- The rate-assist explorer converts with the shared `toDegrees` (× 180 ÷ π
  instead of × (180/π)). 16,289 of 185,440 values over all 380 slider positions
  differ by 1 ulp. No shown value or 0.1 px plot coordinate changes in either
  language, and server and browser compute the same expression, so hydration
  stays deterministic.
- The built manual's 25 pages match the previous build apart from content-hashed
  asset names.

## Flight HUD output

The previous and new production builds were captured in 144 states: 24 HUD
states in both locales at 1000 × 750, 375 × 667, and 800 × 420. The states cover
ready with the start card; two telemetry snapshots, including edge values and a
clamped pad; flying; paused; muted; a locale error; a pending locale; loading;
failed; no telemetry; eight results reports (every verdict and crash cause, and
values just past their limits); complete without a report; no manual link; and
help open over three of them.

- Normalized shadow DOM (comments removed, whitespace runs collapsed), ARIA
  snapshot, text, all 81 CSS rules in order, and every screenshot are identical.
  The raw DOM differs only in template indentation and one Lit marker comment
  before the help dialog.
- The browser suites ran unchanged.

## Not covered

- The harness and capture scripts were throwaway tools and are not in the
  repository; this record and the PR describe what they checked.
- No playtest: nothing a player sees or does is meant to change.
