# 0019. Orbits and time warp: physics warp, then Kepler rails

- Status: Implemented in 5.2 (engine and session). Controls and instruments
  arrive in 5.3; the game offers no warp yet.
- Date: 2026-11-07

## Decision

A lunar orbit lasts about two hours, so flights around the Moon need time warp.
Owner decisions on 2026-11-07:

- **Two kinds of warp.** At **2× and 4×**, the session runs the same 60 Hz physics
  more times per frame. Thrust, rotation, contact, and judging all work, and the
  ticks are exactly the ones real time would run. At **10×, 100×, and 1000×**, the
  vehicle coasts **on rails**: each frame jumps along its two-body orbit by
  Kepler's solution instead of stepping. `WARP_LEVELS`, `PHYSICS_WARP_LIMIT`, and
  `FlightSession.requestWarp` hold the policy; the game owns it, not the engine.
- **Rails are exact, and so the conditions are strict.** Rails start only while
  flying, around a body (`FlightScenario.orbit`), with the lever closed, the spin
  braked below **0.1°/s** (`RAILS_MAX_RATE`), and the vehicle above the scenario's
  **rails floor**. `railsBlocker` says which condition fails, for the HUD to
  explain. A slow spin is not frozen: it carries on by Euler's torque-free
  equations, stepped at most 1 s or 0.01 rad at a time, so rails change nothing
  that real time would not. The owner declined freezing rotation because it is
  physically wrong.
- **Rails end themselves.** Any input (rotation, lever movement, or a lever
  setting) drops to 1× and is flown in the same frame. The session solves exactly
  when the orbit next descends through the rails floor, coasts precisely that far,
  and drops to 1× there, so no frame can skip into the ground. Physics warp drops
  to 1× at first ground contact, so landings play in real time. Pause and restart
  return to 1×.
- **Engine functions, all pure.** `orbitFromState` and `stateFromOrbit` convert
  between position and velocity and the six classical elements (periapsis
  radius, eccentricity, inclination, ascending node, argument of periapsis, true
  anomaly), with conventions for the circular and equatorial cases.
  `propagateKepler` solves Kepler's problem in universal variables, one code path
  for circles, ellipses, parabolas, and hyperbolas. `timeToRadius` and
  `timeToAltitude` find the next descent through a height. `coastOnRails` combines
  them with `coastAttitude` and the 5.1 frame conversions to coast a whole flight
  state in the Moon-fixed or inertial frame. `orbitOf` gives any state's orbit,
  including the times to periapsis and apoapsis that 5.3's instruments need.
- **Mission time.** The session's `time` adds physics ticks and rails seconds.
  The Moon-fixed and inertial frames coincide at the scenario start, so this is
  the time the frame conversions take.

## Why

Physics warp alone costs one step per simulated 1/60 s. A step costs about
1.4 µs in Node on the development machine and several times that on the Galaxy
A70. That allows about 10× at most, and a half-orbit coast would take 6 minutes.
Kepler's solution costs about 0.5 µs whatever the time span, and a whole rails
frame (Kepler, attitude, and two frame conversions) about 6 µs at 1000×. Rails
match RK4 integration of the same coast to under a millimetre over half an orbit,
because both solve the same two-body problem; rails just do it without truncation
error.

Universal variables rather than separate elliptic and hyperbolic Kepler solvers:
one bracketed Newton iteration, monotonic in the unknown, so it cannot fail to
converge. Classical anomalies are still used for time to an altitude, where
closed forms exist and are exact.

## Alternatives

- **Physics warp only** (owner declined): simplest, but tops out near 10× on phones.
- **Rails only:** no faster-than-real-time thrusting, such as a long burn at 4×.
- **Freeze rotation on rails** (owner declined): common in games, but wrong.
- **Step attitude every 1/60 s on rails:** exact, but the cost grows with the warp
  factor again, and below 0.1°/s the 1 s steps already reach rounding error.
- **Adaptive-step integration for warp:** general, but more code and still a
  per-frame cost that grows with warp. Kepler is exact for the model the engine
  has (a point-mass Moon).

## Consequences and revisit conditions

- Rails are exact only for the model: a point-mass Moon with no third bodies. If
  mascons or Earth's pull arrive (ADR 0018), rails need perturbations or must
  yield to integration.
- The rails floor is a scenario number for now. With terrain (5.4) it must sit
  above the highest ground along the path; the Moon's relief reaches about
  10.8 km above the mean radius.
- A perfectly radial fall has no orbital plane. Rails refuse it by validation;
  in practice the Moon's spin always gives a falling vehicle some sideways speed
  in inertial space.
- The opening's flights are bit-identical; flight time is now ticks × step plus
  rails seconds, the same number when there are no rails.
