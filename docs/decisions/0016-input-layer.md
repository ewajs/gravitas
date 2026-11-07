# 0016. One input layer: sources merged into one pilot input per frame

- Status: Implemented in 4.3a (input layer, keyboard source), 4.3b (gamepad
  source), and 4.3c (touch source).
- Date: 2026-11-07

## Context

Until now the keyboard was the only way to fly: `KeyboardControls` produced the
session's `PilotInput` directly, with a lever that moved only at full speed
(`throttleChange` of −1, 0, or +1) and one-shot settings of only 0 or 1 (Z/X).
Step 4.3 adds a gamepad, with proportional triggers, and touch controls, with an
absolute throttle lever and a proportional stick. The owner decided on 2026-11-07
that the touch controls are a themed UI element that emits plain values, and that
the game maps them to pilot input, as it owns input.

## Decision

**A generalized `PilotInput`.** Rates stay normalized body-axis requests in
[−1, 1]. `throttleChange` becomes any lever speed in [−1, 1], as a fraction of
`THROTTLE_RATE` (0.5 per second), so a half-pressed trigger moves the lever at
half speed. `throttleSet` becomes any one-shot lever position in [0, 1], applied
at the next tick, so a touch lever can place it exactly. The session clamps both
and ignores non-finite values. Held keys still produce exactly −1, 0, and +1, and
Z/X exactly 1 and 0.

**`InputSource`.** Each device is an object with `sample()` (this frame's held
input, consuming one-shot settings), `clear()` (release everything held, on blur,
pause, or restart), and `dispose()`. From 4.3b it also names its `device` and
reports whether its latest sample was deliberate input (`active`), so help can
follow the device in use, and a source that must be polled (a gamepad) has
`poll()`, which the app calls once per frame before sampling, so its commands
never run in the middle of a merge. Discrete commands (`toggle-pause`,
`restart`, `toggle-mute`) go to one app callback that every source shares, so
any device can pause or restart through the same `flightAction` the HUD uses.

**One merge rule, in `PilotInputs`.** Every source is sampled once per frame:

- **Rotation:** per body axis, the strongest request wins. An idle source
  contributes zero and never weakens another; two sources pushing the same way
  never add up to more than either. Equal and opposite requests cancel, as
  opposite keys on one keyboard already do.
- **Throttle:** the source that most recently began moving the lever (a lever
  speed other than zero, or a one-shot setting) controls it while it keeps
  moving it. When it stops, a source still moving the lever takes over. The
  others' lever requests are ignored meanwhile, never summed.
- **Commands:** from any source, immediately.

With the keyboard as the only source, the merged input equals the keyboard's.

## Alternatives

- **Sum all sources and clamp:** simple, but a keyboard key plus a stick would
  rotate no faster than either while still mixing their directions oddly, and a
  touch lever plus a trigger would fight over the lever every frame.
- **Exclusive device switching (only the last-used device counts):** clear, but
  a player resting a thumb on a stick would silently lose the keyboard, and a
  device that drifts slightly would steal control. The per-axis strongest rule
  gives the same result in ordinary use without that hazard.
- **Let the touch element or gamepad produce `PilotInput` itself:** would put
  game control semantics (and the session's types) into the UI library, which
  displays and never simulates.

## Consequences and revisit conditions

- Engine dynamics and the session's arithmetic are unchanged: with integer lever
  speeds the throttle update is the same expression on the same values. Keyboard
  flights and every scripted regression flight were hashed tick by tick before
  and after the change and match bit for bit (see
  [input verification](../verification/input.md)).
- Device-specific tuning (dead zones, response curves, trigger pressure) lives
  in each source's mapping in the app, unit-tested there. Sticks share
  `stickResponse`: a radial dead zone (15% on a gamepad), then `0.5 t + 0.5 t³`,
  gentle near centre and full at the rim.
- The gamepad's A is a new `confirm` command (start, resume, or try again), and
  its Start toggles pause like P. Only standard-mapping pads are read, so button
  positions are known; Xbox names are shown.
- Touch is split at the package boundary: UI's `TouchControls` element draws the
  controls, owns pointers, and emits plain values (lever 0–1, stick x/y, yaw);
  the game's `TouchControlsSource` maps them (an 8% stick dead zone, the lever as
  a one-shot setting). The element shows the lever the session actually applied,
  so a keyboard or gamepad change is visible on it. It is exported from
  `@gravitas/ui` itself: the game is its only consumer and already imports that
  entry point, so a narrower entry point would buy nothing.
- The device in use is the last source with deliberate input, or the first touch
  anywhere; a phone or tablet starts on touch. In Automatic mode the touch
  controls follow it.
- Revisit if a device needs per-tick rather than per-frame sampling (none does:
  browsers deliver input between animation frames), or if replays need recorded
  input, which would record the merged `PilotInput` per tick.
