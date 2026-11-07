# Flight model

**Status:** implemented in engine (step 1.1) and covered by unit references. No
runtime loop, keyboard input, instruments, or ground contact use it yet; those
are planned for the next M1 step and M2. [ADR 0008](decisions/0008-flight-model.md)
records why this model and integrator were chosen.

## State and frames

The app owns one `FlightState`: centre-of-mass position (world m), velocity (world
m/s), body-to-world unit quaternion, angular velocity (body rad/s), and fuel (kg).
Axes follow [ARCHITECTURE.md](ARCHITECTURE.md): world +Y up, body +Y up, body −Z
forward, body +X right. `VehiclePose` is the position/orientation subset, so
viewport and HUD consume flight state directly. The pose origin is the **centre of
mass**, not the feet; the viewport offsets its artwork by the app-supplied
centre-of-mass height (1.5 m for the first lander).

## Forces and torques

| Effect           | Model                                                                                    |
| ---------------- | ---------------------------------------------------------------------------------------- |
| Gravity          | Uniform world acceleration from the environment; lunar preset −1.62 m/s² on Y            |
| Main engine      | `throttle × maxThrust` along body +Y through the centre of mass, so it creates no torque |
| Attitude control | Per-axis pure couples: torque without net force                                          |
| Mass             | Dry mass plus remaining fuel; current mass sets thrust acceleration                      |
| Rotation         | Euler's equations about constant principal axes, including gyroscopic coupling           |
| Atmosphere       | None                                                                                     |
| Ground/contact   | None in 1.1; the vehicle passes through the surface plane (contact is M2)                |

**Shared propellant.** Main engine and attitude thrusters draw from one tank.
Main flow is `thrust / exhaustVelocity`. An attitude couple producing torque `T`
about an axis uses total thruster force `|T| / attitudeLeverArm`, so its flow is
`|T| / (attitudeLeverArm × attitudeExhaustVelocity)`. Both torque signs cost
propellant. Continuous torque represents the time average of pulsed firings.

**Exhaustion.** A step whose combined demand would empty the tank splits at the
exact burnout instant: powered flight up to that time, then an unpowered coast.
Afterwards fuel is exactly zero and neither thrust nor torque applies, so
existing rotation continues and cannot be braked.

## Controls and attitude assistance

The engine receives `FlightCommand { throttle, bodyTorque }` each fixed step.
Players do not command torque directly. The app turns player inputs into torque
with `rateControlTorque`:

- **Throttle:** a held lever in [0, 1], not a momentary key.
- **Rotation:** three normalized rate requests in [−1, 1] about body X (pitch),
  Y (yaw) and Z (roll). Full input requests `maxRate` (30°/s on each axis for the
  first lander).
- **Assistance law:** per axis, `torque = I × (requestedRate − rate) / responseTime`,
  limited to `maxTorque`. With no input it brakes rotation to zero and holds the
  current attitude. It never levels the vehicle or cancels velocity. Recovering
  from a tilt is the pilot's job.
- **Sign conventions:** a negative X rate tilts the thrust axis forward (toward
  body −Z), so thrust pushes the vehicle forward. A positive Z rate tilts it toward
  −X (left). Yaw spins the vehicle about its thrust axis.

Keyboard bindings, focus handling, and throttle step size are planned for step
1.2, where browser tests can cover them. The `responseTime` must be at least one
maximum step (1/60 s), which keeps the discrete controller from overshooting.

## First lander

Fictional, tunable values in `apps/game/src/lander.ts`. They are not historical
specifications, and playtesting in M3 may change them.

| Parameter                 | Value                       |
| ------------------------- | --------------------------- |
| Dry / fuel / wet mass     | 1,200 / 300 / 1,500 kg      |
| Max main thrust           | 4,500 N                     |
| Main exhaust velocity     | 3,000 m/s                   |
| Principal inertia (X,Y,Z) | 1,800 / 1,200 / 1,800 kg m² |
| Max torque (X,Y,Z)        | 900 / 600 / 900 N m         |
| Attitude lever arm        | 0.9 m on each axis          |
| Attitude exhaust velocity | 2,800 m/s                   |
| Assist max rate / time    | 30°/s / 0.3 s               |
| Centre-of-mass height     | 1.5 m above level feet      |

### Worked examples

These figures follow from the table; unit tests check the underlying formulas
against independently calculated answers.

- **Hover throttle:** `1.62 × 1500 / 4500 = 0.54` when full, falling to 0.432 when
  empty. Holding a fixed throttle slowly climbs as mass drops.
- **Thrust-to-weight:** 1.85 full, 2.31 empty.
- **Full-throttle burn:** 1.5 kg/s, 200 s from a full tank.
- **Main-engine Δv:** `3000 × ln(1500 / 1200) ≈ 669 m/s`.
- **Hover endurance** (main engine only, throttle continuously trimmed):
  `(3000 / 1.62) × ln(1.25) ≈ 413 s`.
- **Attitude authority:** 0.5 rad/s² on every axis, so full pitch rate is reached
  in a little over 1 s.
- **Attitude cost:** a saturated pitch couple burns `900 / (0.9 × 2800) ≈ 0.36 kg/s`,
  about a quarter of the main engine's full flow. Changing pitch rate by Δω costs
  `I × Δω / (arm × ve)`. Starting and stopping a 30°/s pitch therefore uses about
  0.75 kg; a tilt and its recovery about 1.5 kg (0.5% of the tank).

## Integration and limits

`stepFlight` uses classic fourth-order Runge–Kutta at no more than 1/60 s per step,
renormalizing the quaternion after each step. It returns new state, never mutates
inputs, and rejects non-finite or out-of-range state, parameters, or commands with
`RangeError`. Deterministic within one JavaScript engine; no cross-platform
bit-equality promise.

Simplifications, each revisitable when gameplay needs it:

- Inertia and centre of mass stay fixed as propellant burns (20% of wet mass).
- Thrusters respond instantly. There is no throttle lag, minimum impulse, engine
  gimbal, or attitude-thruster translation.
- Attitude thrusters are ideal couples. Their force never translates the vehicle.
- Constant uniform gravity on a flat local surface. No orbits or curvature.

## Reference cases

`packages/engine/src/flight.test.ts` and `apps/game/src/lander.test.ts` check:
ballistic motion; the rocket equation and its position integral; shared-tank mass
flow with simultaneous yaw; hover throttle at two fuel levels; body-to-world thrust
rotation and q/−q equivalence; constant-torque rotation and attitude propellant
cost on each axis; body-axis (not world-axis) angular velocity; torque-free energy
and world angular-momentum conservation; fourth-order convergence; burnout inside
a step for main and attitude demand, with exact zero fuel; rate assistance tracking,
braking, holding attitude, and its `I × Δω` propellant cost; immutability and input
validation.
