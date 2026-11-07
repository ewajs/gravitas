# 0009. Fixed-step flight runtime, input, and interpolation ownership

- Status: Implemented in 1.2. The follow camera and `cameraOffset` are replaced by
  the chase camera in [ADR 0010](0010-chase-camera-and-instruments.md).
- Date: 2026-11-06

## Decision

**Session in the app, pure.** `apps/game/src/session.ts` owns the authoritative
`FlightState`, the previous tick's state, the throttle lever, a time accumulator,
and the phase (`ready`, `flying`, `paused`, `contact`). It reads no clock or DOM.
The browser loop passes elapsed animation-frame time and sampled input, so unit
tests can drive it at any frame rate.

**Clock.** Fixed 1/60 s steps with at most 5 steps per animation frame. Whole
steps beyond that are dropped and summed in `discardedSeconds`; the sub-step
remainder is kept. Pause keeps that remainder, so resuming does not jump. The
app resets its frame timestamp whenever drawing stops (hidden tab, zero-size
host), so wall time while not drawing never becomes simulation time. A hidden
tab pauses the flight; the player resumes explicitly.

**Input.** `KeyboardControls` maps physical keys (`KeyboardEvent.code`) and is
sampled once per frame. Held keys apply to every tick in that frame. One-shot
throttle settings (Z/X) wait for the next tick. Pause and restart act
immediately. Keys from form controls, the help dialog, or with Ctrl/Meta/Alt
are ignored. Enter or Space on a focused button is left to that button. Blur,
pause, and restart clear held keys. The throttle is a lever that moves at 0.5/s
while R/F is held.

**Interpolation in viewport.** `setVehiclePose(current, previous)` plus
`render(alpha)`, where alpha is the accumulator fraction. Viewport blends
position linearly and orientation along the shortest arc, as ARCHITECTURE
assigns. The previous pose is the last completed tick, so the drawn vehicle
trails physics by less than one step, a standard fixed-step tradeoff.

**Camera.** The orbit camera translates with the drawn centre of mass,
preserving the player's orbit and zoom. Panning is disabled because following
would undo it. The app supplies the opening `cameraOffset`. A designed chase
camera is step 1.3.

**HUD.** `InspectionHud` becomes `FlightHud`. The app computes a
`FlightTelemetry` snapshot (altitude from the lowest foot, speeds, pad distance,
tilt, fuel, throttle). It publishes the snapshot at 10 Hz while flying, and at
once on phase changes. The HUD emits a typed `flight-request` (start, pause,
resume, restart). Opening help while flying requests a pause.

**Placeholder ground.** Until M2 contact, the session stops when any foot's
world height reaches y = 0. It lifts the vehicle so the lowest foot rests on
the surface, keeps touchdown velocities for display, and enters `contact`. The
game passes no verdict on the landing.

## Alternatives

- **Interpolate in the app** and pass viewport one blended pose: less viewport
  API, but it contradicts ARCHITECTURE, and every future renderer consumer would
  re-implement slerp. Viewport already owns Three.js math.
- **Extrapolate** from current state instead of interpolating: no visual lag, but
  wrong around discontinuities (contact, restart, sharp torque changes).
- **Auto-resume on a visible tab:** convenient but surprising. A player returning
  to a tab should not find the lander already moving.
- **Variable timestep / per-frame stepping:** couples physics to display rate,
  which ADR 0002 rejects.
- **Keyboard `key` instead of `code`:** follows layout letters, scattering WASD
  on AZERTY/Dvorak. Help shows QWERTY letters for the same physical keys.

## Consequences and revisit conditions

- Five steps per frame covers frame times up to ~83 ms. Beyond that the flight
  runs slower than real time, and the session counts the discarded time. A
  developer diagnostic can surface it in M3.
- The ground halt is not contact physics: no bounce, slide, tip-over, or verdict.
  The off-pad terrain mesh sits 0.17 m below y = 0, so feet stop slightly above
  it. M2 replaces this.
- The orbit-follow camera at altitude gives weak depth cues. Step 1.3 designs
  the chase camera and instruments.
- Keyboard-only flight. Touch controls remain a later decision; narrow layouts
  stay readable but are not a supported flight device.
