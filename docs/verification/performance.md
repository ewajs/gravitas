# Performance measurements

Step 3.3 adds developer diagnostics and a repeatable frame-rate measurement.
Measured locally on 2026-11-07 during the owner-approved overnight run.

## How to measure

```sh
npm run measure   # builds the game, then flies a workload on each browser project
```

`tests/measure/framerate.spec.ts` opens the production build with `?debug` and starts
a flight. It burns at full throttle for 2.5 s (plume, light, dust near the ground),
fires the attitude thrusters, then coasts for 3 s while the chase camera moves.
It reports the overlay's numbers as a JSON attachment and a `MEASURE` console line.
It never runs in CI or the regular browser suites.

The overlay itself (`?debug`) shows frame rate, frame interval, main-thread work
per frame (p50/p95 over the last 120 frames), draw calls, triangles, phase, tick,
render blend, and simulation time dropped by the catch-up limit. It updates 4 times
a second, never logs, and costs nothing without the switch.

## Results on this machine

MacBook Pro (`MacBookPro18,1`), Apple M1 Pro, 32 GiB RAM, macOS 15.7.9:

| Project | Renderer                         | fps  | Work p50 / p95 | Dropped | Draw calls | Triangles |
| ------- | -------------------------------- | ---- | -------------- | ------- | ---------- | --------- |
| webgpu  | Apple M1 Pro via Metal           | 60.0 | 0.6 / 0.8 ms   | 0.033 s | 45         | 19,501    |
| webgl2  | SwiftShader (software, headless) | 17.1 | 0.8 / 1.1 ms   | 0.267 s | 35         | 19,213    |

Main-thread work is under 1 ms on both. The cost is rasterization, which is why
the software path is slow while hardware holds the display rate. The software
path drops simulation time steadily (frames longer than 83 ms), as designed.

## Findings

- **One-time drop at flight start (hardware).** About 33–50 ms of simulation time
  is dropped once, right after the first key press.
  - Unlocking audio first (pressing M twice before starting) brought it to zero,
    so it comes from creating and starting the `AudioContext` on that gesture.
  - Starting or resuming now resets frame timing, so pre-start wall time is never
    simulated. That cut the drop from 0.050 s to 0.033 s.
  - The remainder is one long frame after the audio graph starts. It is
    imperceptible: physics simply skips two ticks.
- Draw calls stay modest because rocks and craters are instanced.

## Proposed budgets (for owner decision)

Reference device: the M1 Pro above, WebGPU, desktop window at 1000 × 750.

| Metric                              | Proposed budget             | Current                       |
| ----------------------------------- | --------------------------- | ----------------------------- |
| Frame rate                          | display rate (60) sustained | 60.0                          |
| Main-thread work per frame, p95     | ≤ 4 ms                      | 0.8 ms                        |
| Draw calls                          | ≤ 100                       | 45                            |
| Triangles                           | ≤ 100,000                   | 19,501                        |
| Dropped simulation time after start | 0                           | 0 (one-time 0.033 s at start) |

The software renderer is a test environment, not a player target. Its numbers are
recorded only to keep browser tests tolerant of slow frames. Other devices,
including integrated GPUs, phones, and Windows/Linux, are unmeasured; add them to
this table when available.

## After the Glass UI (v0.2.0, 2026-11-07)

`npm run measure` on `main` after step 4.2 (backdrop-blurred panels, self-hosted
fonts), same machine and workload: WebGPU 60.00 fps, main-thread work 0.7 ms p50
and 0.8 ms p95, 0.05 s discarded, 45 draw calls, 19,501 triangles; SwiftShader
WebGL 2 15.19 fps. All proposed budgets still hold on the reference device. The
blur's cost on the test phones is measured in 4.4.

## Phones (pending, 4.4)

The test phones (iPhone 15 Pro, Galaxy A70) are measured on the deployed site
after 4.4 merges, with glass and with solid panels; the procedure is in
[mobile verification](mobile.md#measuring-the-glass-blur-on-a-phone). Glass stays
the default on phones until then.

## After input and phone layout (v0.3.0, 2026-11-07)

`npm run measure` on `main` after steps 4.3–4.4, same machine and workload:
WebGPU 60.00 fps, main-thread work 0.7 ms p50 and 0.8 ms p95, 0.07 s discarded,
45 draw calls, 19,501 triangles; SwiftShader WebGL 2 15.19 fps. Budgets still hold
on the reference device. Phones are measured on device with `?debug`.
