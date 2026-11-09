# 0023. Vehicle definitions: one piece of plain data per vehicle

- Status: Implemented in 5.5a. The mission picker (5.5b) is the first to switch
  vehicles at runtime.
- Date: 2026-11-09

## Context

Until M5, the game had one vehicle, and its numbers were constants read
directly by every part of the game: the session, the scripted pilots, telemetry,
the results card, the orbit and terrain sandboxes, and the manual's Learn models.
The viewport drew it from code, with the bell, thruster quads, and legs hard-coded
to match. Landing from orbit (5.5) needs a second, larger vehicle; owner decision
on 2026-11-07: make vehicles data, as the seed of a future vehicle library, but
keep to what two vehicles need.

## Decision

- **One definition per vehicle** (`apps/game/src/vehicle.ts`): an id, the
  engine's `VehicleParameters` (masses, main engine, attitude thrusters, inertia,
  contact points), the rate assist's `AttitudeSettings`, and the viewport's
  `VehicleModel`. `validateDefinition` runs the engine's and the viewport's own
  checks (the engine now exports `validateVehicle` and `validateAttitude`), then
  checks that they agree: at least three legs, level at the centre of mass's
  height below it, one drawn leg per leg contact in the same order and place, and
  each foot pad resting on the contact plane.
- **A scenario carries its vehicle.** `FlightScenario.vehicle` is a definition;
  the session, pilots, telemetry, the report's fuel, altitudes, and the sandboxes'
  starts read it from there. Helpers derive what several places need: leg
  contacts, full-throttle mass flow, delta-v from the rocket equation, and hover
  throttle.
- **The model is plain data** (`@gravitas/viewport/model`, no Three.js): named
  finishes (colour, metalness, roughness); parts that are cylinders (with sides,
  open for a bell), boxes, or spheres at positions from the feet's contact plane;
  a shared foot pad; legs with their struts; the engine's bell, plume radius and
  length; and the thruster quads' radius and height. The viewport validates a
  model, builds it, and moves the plume, its light, and the puffs to it.
  `new Viewport({ vehicle })` replaces `centerOfMassHeight`, and
  `setVehicle(model)` swaps the drawn vehicle at runtime. Leg compression takes one
  value per leg of the current model.
- **The first lander, unchanged.** Its definition reproduces the old constants
  and artwork exactly: scripted flights of the opening and the orbit sandbox
  (10,617 ticks) hash the same as before, and its built artwork matches a
  fingerprint of every vertex, transform, and material taken before the change.
- **The descent vehicle** (`apps/game/src/descent-vehicle.ts`), fictional like
  the first:

  |                               | First lander                     | Descent vehicle                    |
  | ----------------------------- | -------------------------------- | ---------------------------------- |
  | Dry / propellant / wet        | 1,200 / 300 / 1,500 kg           | 2,000 / 1,900 / 3,900 kg           |
  | Main thrust, exhaust velocity | 4.5 kN, 3,000 m/s                | 15 kN, 3,000 m/s                   |
  | Delta-v (rocket equation)     | 0.67 km/s                        | 2.00 km/s                          |
  | Mass flow, full-throttle burn | 1.5 kg/s, 200 s                  | 5 kg/s, 380 s                      |
  | Hover throttle, full → empty  | 54% → 43%                        | 42% → 22%                          |
  | Inertia (X, Y, Z)             | 1,800 / 1,200 / 1,800 kg m²      | 6,000 / 4,200 / 6,000 kg m²        |
  | Max torque, lever arm         | 900 / 600 / 900 N m, 0.9 m       | 2,100 / 1,500 / 2,100 N m, 1.3 m   |
  | Rate assist                   | 30°/s, 0.3 s                     | 22.5°/s, 0.4 s                     |
  | Feet, centre of mass          | ±1.5 m, 1.5 m up (tips past 45°) | ±2.2 m, 2.0 m up (tips past 47.7°) |

  From a 100 km orbit, reaching the ground takes about 1.75 km/s at the least, so
  2 km/s leaves roughly 250 m/s, some two and a half minutes of hovering, to
  choose a spot. Its legs and hull scale the first lander's: about 3 cm of static
  compression per leg at full mass, damping near ζ ≈ 0.7, and an overdamped hull.
  It looks like a larger first lander: a bronze-foil descent stage, a white crew
  module with a window and antenna, and four wide-set legs.

## Alternatives

- **Models in the viewport package, referenced by name:** keeps artwork with the
  renderer, but the game could not see a model's legs to check them against the
  contacts, and adding a vehicle would touch two packages.
- **A model file format (glTF):** real artwork later, but nothing here needs more
  than primitives yet, and it adds loading, licensing, and a pipeline.
- **One generic `Vehicle` type in the engine:** the engine would carry
  presentation data it never uses.
- **A vehicle selector, staging, or an editor:** owner decision on 2026-11-07, not
  now.

## Consequences and revisit conditions

- The game imports only the model's types and checks, through a Three.js-free
  entry point, so the main bundle does not load the renderer.
- A third vehicle is a new definition file and its tests; nothing else changes.
- Throttle realism (response lag, minimum thrust) stays tabled until there are
  several vehicles and missions.
