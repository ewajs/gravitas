# Flight model verification

Step 1.1 was verified locally on 2026-11-06. It adds engine dynamics and changes
the viewport pose origin to the centre of mass. The game does not run the flight
model yet, so there is no flight to playtest; that starts with step 1.2.

## Environment and results

- MacBook Pro (`MacBookPro18,1`), Apple M1 Pro, 32 GiB RAM, macOS 15.7.9.
- Node 24.21.0; pinned Playwright 1.64.1.
- `npm run check`: format, lint, types, and 35 unit tests passed.
- `npm run build`: game and TypeDoc developer docs built with link/documentation
  validation. The existing Vite advisory for the renderer chunk over 500 kB remains.
- `npm run test:e2e`: all 13 tests passed on forced WebGL 2.
- `npm run test:e2e:webgpu`: all 13 tests passed, including the actual WebGPU
  backend and rendered-content assertions.
- `git diff --check` passed.

## What is covered

Physics references are calculated independently of the integrator. The [flight
model](../FLIGHT.md#reference-cases) lists them, including:

- ballistic motion and the rocket equation with its position integral
- shared-tank mass flow with simultaneous main thrust and attitude torque
- attitude propellant cost per axis and through the rate controller (`I × Δω`)
- burnout inside a step for main and attitude demand: exactly zero fuel afterwards
  (a 500-case sweep), then no thrust or torque
- conservation of torque-free energy and world angular momentum
- fourth-order convergence against exact constant-rate rotation

A viewport unit test measures the artwork's vertex bounds to confirm that level
feet rest on the pad when the centre of mass is 1.5 m up, and that rotation pivots
about it. Browser suites confirm that the production scene, pose changes, camera,
lifecycle, and both locales still render after the origin change.

## Not covered

- Flight is not playable: no fixed-step runtime, input, instruments, or ground
  contact. The vehicle would pass through the surface plane if stepped.
- Vehicle values are reasoned from worked examples, not playtested. Tuning is M3.
- Results are deterministic within one JavaScript engine; there is no
  cross-platform bit-equality check, by design (ADR 0002).
