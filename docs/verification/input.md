# Input verification

Step 4.3 builds one input layer ([ADR 0016](../decisions/0016-input-layer.md)) and
adds input devices to it, in three stacked PRs. This records how each was checked.

## Environment

- MacBook Pro (`MacBookPro18,1`), Apple M1 Pro, 32 GiB RAM, macOS 15.7.9.
- Node 24.21.0; pinned Playwright 1.64.1 (Chromium).

## 4.3a Input layer (no behaviour change)

Verified locally on 2026-11-07.

- `npm run check`: format, lint, types, and 147 unit tests in 25 files passed.
  New: the merge rule (strongest rotation per axis, cancelling opposites, the
  throttle following the latest source to move it, one-shot settings, clearing)
  and the session's fractional lever speed and arbitrary one-shot position,
  clamped, with non-finite values ignored.
- `npm run build`: game, TypeDoc developer docs, and the manual (dead links fail).
- `npm run test:e2e` (forced WebGL 2) and `npm run test:e2e:webgpu` (hardware
  WebGPU): unchanged tests, all passing; counts are in the PR.

### Bit for bit

A throwaway harness (not committed) ran the real sources under Vitest before the
first change and again after the last, hashing exact float64 bytes:

- **Scripted pilots** (pad, throttle-only, no input, hover until dry) through
  `FlightSession`, one tick per frame, continuing 10 s past each verdict. Per
  tick: the pilot's input, then the state, previous state, lever, ticks, dropped
  time, actuation, outcome, verdict state, flight time, render blend, telemetry,
  and landing report.
- **`fly()`** as the regression tests call it, for the same four pilots.
- **Keyboard flights:** 24 flights from 6 seeds, each at 60 Hz, 30 Hz, 144 Hz,
  and irregular frames with overload spikes. Random key downs and ups (including
  repeats) on W/S/A/D/Q/E/R/F, Z/X one-shot settings, P toggling pause, and
  random clears, through the real `KeyboardControls` on a stand-in window; before
  the change the session sampled the keyboard directly, after it `PilotInputs`
  with the keyboard as its only source. Per frame: the sampled input object
  (including whether `throttleSet` is present) and the whole session.
- **`pilotInput`** for all 256 held-key subsets with no, 0, or 1 one-shot setting.

All 33 scenarios (34,619 ticks over 45,171 frames) match. As a sensitivity check, a
deliberately altered merge (returning `throttleSet: undefined` instead of omitting
it, and a sign-dependent zero for cancelled axes) changed all 24 keyboard
scenarios.
