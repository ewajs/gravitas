# Effects verification

Step 3.1 was verified locally on 2026-11-07 during the owner-approved overnight
run. It adds actuator effects: engine plume and light, attitude-thruster puffs,
and ground dust.

## Unit coverage (`packages/viewport/src/effects.test.ts`)

- **Plume:** none and no light at zero throttle; full length (4 m) at full
  throttle; half length at half throttle. Steady under reduced motion.
- **Pitch** fires the front and back quads in opposite vertical directions, as
  τ = r × F requires: the front exhaust points down for positive pitch torque.
- **Yaw** fires all four quads sideways; the front exhaust trails toward +X for
  positive yaw torque.
- **Dust** appears only below 12 m while the engine fires, at the vehicle's
  ground point, with opacity scaling with throttle and proximity.
- `Viewport.setActuators` rejects throttle outside [0, 1] and attitude values
  outside [−1, 1].
- **Session:** `actuation` reports what the last tick applied, and zero while
  paused, before start, or with an empty tank.

## Browser coverage

- With the fixture 4 m up, very bright pixels (the flame core) increase when
  throttle is applied and fall back when it is cut.
- **Reduced motion:** at a steady 80% burn with settled framing, two frames
  0.4 s apart differ normally (flicker, dust swell) and are identical under
  `prefers-reduced-motion: reduce`.
- Both full suites pass (counts in the PR).

## Review notes

- The first version used tone-mapped materials, which washed the flame to pale
  grey and hid it from a colour-threshold test. Flames now opt out of tone
  mapping, and the test counts very bright pixels instead of a hue.
- The first dust was a hard-edged annulus that read as a plate on the ground. It
  is now a disc with a radial opacity fade (a small TSL expression).
- A real lunar descent plume is faint in vacuum. This one is deliberately
  visible but restrained, for throttle feedback.
- Not covered: human review of the look; no audio yet (3.2).
