# Audio and settings verification

Step 3.2 was verified locally on 2026-11-07 during the owner-approved overnight
run. It adds synthesized sound, mute, and persisted settings.

## Unit coverage

- `audioLevels` (`apps/game/src/audio.test.ts`):
  - silent at idle;
  - engine gain grows with the square root of throttle (0.2 at a quarter, 0.4 at
    full), and the filter brightens with it;
  - thruster hiss starts above a 5% command on any axis, ignoring tiny residual
    torque.
- Settings (`settings.test.ts`):
  - round trip;
  - corrupt JSON, `null`, numbers, and arrays fall back to defaults;
  - foreign values (`locale: 'fr'`, `muted: 'yes'`) fall back field by field,
    keeping valid ones;
  - missing or throwing storage never throws.

## Browser coverage (`tests/browser/settings.spec.ts`, both backends)

- **Persistence:** choose English, mute, and start a flight; a later visit without
  `?lang=` opens in English, muted, without the start card. An explicit `?lang=es-AR`
  still opens in Spanish.
- **Audio state** (mirrored on `#viewport[data-audio]` from the context's own
  `statechange` events):
  - no context before a gesture;
  - `running` after P starts the flight;
  - `suspended` when paused;
  - `muted` after M;
  - `running` again after unmuting and resuming.
- **Review note:** the first version wrote the state right after asking the
  context to resume, and read `suspended` because resume is asynchronous. The
  state now comes from `statechange`.

## Not covered

- What the sound sounds like: headless browsers produce audio without an output
  device, so levels and cues need a human ear.
- Exact cue timing against touchdown frames; the thud fires on the first frame
  whose outcome leaves `airborne`.
