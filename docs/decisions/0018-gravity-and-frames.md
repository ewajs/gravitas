# 0018. Central-body gravity, a Moon-fixed rotating frame, and frame conversions

- Status: Implemented in 5.1. The game does not use it yet; 5.2–5.5 build on it.
- Date: 2026-11-07

## Decision

The engine grows from one flat local world to flight anywhere on or around a
spherical body, without changing the opening hop.

- **Gravity is a field the environment chooses.** `FlightEnvironment.gravity` is a
  `GravityField`: `{ kind: 'uniform', acceleration }` (the opening, unchanged) or
  `{ kind: 'central', centre, gravitationalParameter }`, the inverse-square pull
  −μr/r³ of a spherical body. `gravityAcceleration(field, position)` is the one
  function the dynamics, the manual, and later instruments use.
- **Fly where the ground stands still.** Descents and landings integrate in the
  **Moon-fixed frame**, which turns with the Moon. An optional
  `FlightEnvironment.rotation` (`FrameRotation`: angular velocity and a point on
  the axis) adds the Coriolis and centrifugal accelerations and measures
  orientation against the turning axes: q̇ = ½ q ⊗ ω_body − ½ Ω ⊗ q.
  `FlightState.angularVelocity` is now documented as the body's rotation relative
  to inertial space (what gyroscopes measure), so Euler's equations, attitude
  assistance, and every frame share it.
- **Three named frames** of a `CelestialBody` (radius, μ, sidereal spin about +Y):
  - _body-fixed_: centred, turning, +Y north pole, +X latitude 0 longitude 0,
    longitude 90° east along −Z;
  - _inertial_: centred, not turning, matching the body-fixed axes at time 0;
  - _surface_: at a site, +Y up, +X east, −Z north, so a vehicle facing −Z
    faces north and the flat-world conventions (heading, radar, tilt) apply
    unchanged near the site.
- **Conversions.** Pure functions convert latitude, longitude, and altitude to positions and back,
  and whole flight states between frames (`bodyFixedToInertial`,
  `inertialToBodyFixed`, `surfaceFrameToBodyFixed`, `bodyFixedToSurfaceFrame`).
  `bodyFixedEnvironment`, `inertialEnvironment`, and `surfaceEnvironment` give the
  gravity and rotation for flying in each. A flight in a surface frame and the same
  flight in the body-fixed frame are the same physics: the centre lies below the
  site, and the spin axis tilts with latitude.
- **The Moon is data in the engine.** `MOON` holds the IAU mean radius
  (1,737.4 km), GM 4,902.800 km³/s² (GRAIL GL0660B; JPL DE440), and one sidereal
  turn every 27.321661 days. Physical constants of a body are not a mission, so
  they live with the physics; scenarios, sites, and rules stay in the game. The
  manual's Newton's cannon now uses the same constants and gravity function. Its
  own μ was 4,904.87 km³/s², 0.04% above GRAIL's; its speeds and periods move by
  about 0.02%, and the rounded figures on the page do not change.

## Why a rotating frame

The Moon turns once in 27.3 days. That is slow, but the equator still moves at
4.6 m/s in inertial space, more than the 2 m/s sideways limit the opening allows
at touchdown. Integrating in inertial space would mean a moving ground: the
terrain, contact, and pad would all need a time-dependent pose. In the Moon-fixed
frame the ground is still, so contact and terrain (5.4) stay static, and the cost
is two small accelerations and one quaternion term. Orbital elements (5.2) come
from converting to the inertial frame, which is one rotation and one cross
product.

Dropping the spin instead would be simpler and close for a short descent, but it
makes the ground's 4.6 m/s inertial speed disappear and makes a long coast land
in the wrong place. The owner prefers physically honest models (see
[FLIGHT.md](../FLIGHT.md)), and the cost here is small.

## Precision budget

All engine state is float64. At the Moon's radius one unit in the last place is
4 × 10⁻¹⁰ m. Measured with the engine's 60 Hz RK4 on a 100 km circular orbit, one
full 117.8-minute period (424,047 steps) closes to 3.7 µm with a relative energy
error of 3 × 10⁻¹³. Contact needs millimetres, so there is margin of about six
orders of magnitude. Float32 (rendering, or physics libraries like Rapier) has
about 0.1 m resolution at this distance; the viewport will render relative to the
camera when planetary distances reach the screen (5.3).

A step costs about 1.4 µs in Node on the development machine. Real time is cheap.
Time warp at hundreds of times real time is not cheap, so 5.2 decides when to
coast on Kepler's analytic solution instead of integrating.

## Alternatives

- **Inertial integration with a rotating ground:** contact and terrain would need
  moving geometry and its velocity; rejected above.
- **Ignore the Moon's spin:** simpler but wrong by 4.6 m/s at the equator; could be
  a scenario choice later by omitting `rotation`.
- **A provider or plugin for gravity models:** two concrete kinds cover every
  planned step; a union is simpler to read and test. Spherical harmonics (mascons)
  would be a third kind if a scenario needs them.
- **Carry the frame inside `FlightState`:** states would name their frame, at the
  cost of a tag on every snapshot and checks in every helper. The host already
  knows which frame it flies in; the conversions are explicit instead.

## Consequences and revisit conditions

- `FlightEnvironment.gravity` changed shape; every consumer (game, manual, tests)
  moved to `{ kind: 'uniform', acceleration }`. The opening's scripted flights and
  the leg-drop model are bit-identical before and after.
- Flat surfaces are still planes in whatever frame the host flies in; near a site,
  a surface frame plus a flat plane is the current way to land with central
  gravity. A spherical surface and terrain arrive in 5.4.
- Revisit for mascons or third-body gravity if a scenario needs low-orbit accuracy
  over many hours, for libration and axial tilt if landings must match real
  ephemerides, and for frame tagging if hosts start mixing frames by mistake.
