# 0010. Heading-following chase camera and landing radar

- Status: Implemented in 1.3; visuals await owner review.
- Date: 2026-11-06

## Decision

**One heading definition, in engine.** `headingAngle(q)` is the yaw left after
removing the shortest tilt of body +Y from upright (swing-twist about world Y).
It is continuous at every tilt except exactly inverted. The chase camera
(viewport) and the radar (app telemetry) both use it, so radar-up and screen-up
always agree. `bodyToWorld` moved to engine with it; both are pure and have
real consumers in two packages.

**Chase camera in viewport.** A `ChaseRig` keeps the camera behind the drawn
vehicle's heading and level with the horizon, orbiting the centre of mass.

- Translation follows exactly. Azimuth (0.6 s) and elevation (0.8 s) ease
  exponentially on a presentation clock that viewport reads itself, clamped to
  0.1 s per frame. Physics time stays with the host.
- Elevation is steep at altitude (35° from vertical, so the pad ahead stays in
  view) and flattens toward the ground (66°).
- Dragging orbits freely. The rig eases back 1.5 s after the player lets go. Zoom
  (6–40 m) is the player's and is never reset.
- A 12% lens shift (`setViewOffset`) draws the vehicle above centre, showing more
  surface ahead without moving the orbit centre off the vehicle.
- At an exact inversion the rig holds its last heading.
- `resetCamera()` snaps behind the current pose, for discontinuities such as
  restart.
- The 1.2 `cameraOffset` option is removed: the rig derives the framing. The
  package is unpublished at 0.0.0, so nothing else needed it.

**Opening faces the pad**, so the first W press tilts toward it.

**Landing radar in the HUD.** The app adds heading-frame vectors (x right,
y forward) to `FlightTelemetry`: thrust lean (magnitude sin of tilt), horizontal
drift, and pad offset. It also adds `hoverThrottle` for the upright, current-mass
hover setting. The HUD draws a heading-up SVG disc: lean dot (rim = 30°), drift
arrow (rim = 10 m/s), and pad diamond (rim = 60 m, hollow and clamped beyond).
Altitude and vertical speed are the prominent numbers. Fuel and throttle become
bars, with a hover mark on throttle and text values kept beside them.

**Depth cues.** Seeded (deterministic) instanced scatter: 360 rocks and 45 flat,
non-overlapping crater decals kept at least 30 m from the pad. There is a
bolder pad ring, and a blue ring and drop line straight below the vehicle. The
camera near plane moves from 0.1 to 0.5 m for decal depth precision.

## Alternatives

- **North-up follow camera:** calmer, but W would move the lander in different
  screen directions as heading changes. That is the mapping problem this step
  removes.
- **Artificial horizon (attitude ball):** standard for aircraft, but a lander
  pilot's question is "which way am I leaning relative to my drift and the pad?"
  A ball shows pitch and roll, not their relation to drift.
- **Heading from projected forward vector:** simple, but undefined at 90° pitch,
  a reachable attitude. Swing-twist fails only when exactly inverted.
- **Look-at point below the vehicle** to frame the ground: tried first. It moved
  the orbit centre off the vehicle and pushed the lander off screen at altitude.
  The steep elevation plus lens shift replaces it.
- **Terrain textures or heightmaps:** more realism, but a texture/asset pipeline
  and curved-ground questions belong to later work. Instanced primitives give
  motion and scale cues now.

## Consequences and revisit conditions

- Under Chromium's software renderer (SwiftShader) the forced-WebGL test project
  runs at about 15 fps, down from 22 before the scatter. Hardware WebGPU (Apple
  M1 Pro) holds 60 fps. At low frame rates the five-step cap makes the
  simulation run slower than real time, by design. Browser tests poll for
  outcomes instead of assuming real time. M3 sets measured performance budgets.
- Radar scales are fixed. Revisit with playtesting, or when scenarios move far
  beyond 60 m from the pad.
- Hover throttle ignores tilt (vertical thrust falls with cos(tilt)). The mark
  teaches the upright balance point; M3 may add a tilt-aware cue.
- The rig's easing constants and elevations are tunable presentation values. M3
  playtesting may adjust them.
