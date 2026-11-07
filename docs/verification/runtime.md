# Flight runtime verification

Step 1.2 was verified locally on 2026-11-06. It makes the first descent flyable:
fixed-step session, keyboard input, interpolation, pause/resume/restart, a
following camera, flight readouts, and a placeholder ground halt.

## Environment and results

- MacBook Pro (`MacBookPro18,1`), Apple M1 Pro, 32 GiB RAM, macOS 15.7.9.
- Node 24.21.0; pinned Playwright 1.64.1.
- `npm run check`: format, lint, types, and 53 unit tests passed.
- `npm run build`: game and TypeDoc developer docs built with validation. The
  existing Vite advisory for the renderer chunk over 500 kB remains.
- `npm run test:e2e`: all 17 tests passed on forced WebGL 2.
- `npm run test:e2e:webgpu`: all 17 tests passed, including actual WebGPU backend
  and rendered-content assertions.
- The four time-dependent flight tests were repeated three times on each backend
  (`npx playwright test flight.spec.ts --repeat-each 3`): 24/24 passed.
- `git diff --check` passed.
- Screenshots of the opening, touchdown, and narrow layouts in both locales were
  reviewed; the phase message was moved off the vehicle and the narrow key-hint
  line hidden as a result.

## What is covered

Unit (`apps/game/src/*.test.ts`, `packages/viewport/src/*.test.ts`):

- 30 Hz and 144 Hz frame sequences produce bit-identical state at the same tick,
  with held rotation and throttle changing every tick.
- Overload: a 1 s frame runs 5 steps. Simulated, discarded, and kept time sum to
  the elapsed second.
- Pause, ready, and contact run no ticks. Pause keeps the sub-step remainder.
  Restart resets state, lever, clock, and counters.
- Throttle lever ramp and clamping. One-shot settings apply once, including from
  a frame that runs no tick, and are dropped outside flight.
- The ground halt happens at the tick predicted by the free-fall formula, with
  the foot on the surface and touchdown velocity kept.
- A throttle-only pilot using the held-key ramp lands the opening at about
  −0.8 m/s with 94% fuel. The opening is landable, and generous.
- Key-to-axis signs, foot clearance for rolled poses, tilt, the telemetry snapshot,
  shortest-arc pose blending, and viewport argument validation.

Browser (`tests/browser/flight.spec.ts`, production build under `/gravitas/`):

- Ready waits; P starts. Held R ramps the lever; Z/X set full/cut. Fuel burns.
- P pauses with readouts frozen. Switching language mid-pause keeps the same
  values in each locale's notation. Resume continues; Enter restarts to the opening.
- A held W with a lost keyup (window blur) stops rotating once assistance brakes.
- A hidden tab pauses. After a hidden second, resuming shows no catch-up burst.
- P in the language selector does nothing. Help pauses the flight, keys inside
  it do not act, and Enter activates Close rather than restarting.
- Unpowered descent halts at 0.0 m with about −16.6 m/s shown. P does nothing
  after contact; Restart returns to 80.0 m.

Existing UI and viewport suites cover locale switching with an unchanged camera,
narrow layouts in both locales, lifecycle, fallback, DPR, and context loss. The
viewport fixture now also checks that the camera follows a 20 m climb and that
inversion about the centre of mass is visible.

## Not covered

- No human playtest on this machine. The flight feel, camera framing at altitude,
  and tuning are reviewed in 1.3/M3.
- No contact physics or landing verdict (M2). Off-pad terrain sits 0.17 m below
  the y = 0 halt plane.
- Keyboard only. Narrow layouts are readable but not a supported flight device.
- Real long-task overload in a browser was not induced. Discarded-time accounting
  is unit-tested and not shown to players.
