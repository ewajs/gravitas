# Flight model

**Status:** implemented in engine (step 1.1) and flyable in the game (step 1.2)
with keyboard controls, a fixed-step runtime, and instruments. Surface contact
(step 2.1) lets the lander touch down, bounce, slide, and tip over; landing
verdicts arrive in 2.2. [ADR 0011](decisions/0011-contact-model.md) covers contact. [ADR 0008](decisions/0008-flight-model.md) covers
the model and integrator; [ADR 0009](decisions/0009-flight-runtime.md) covers the
runtime, input, and interpolation.

## State and frames

The app owns one `FlightState`: centre-of-mass position (world m), velocity (world
m/s), body-to-world unit quaternion, angular velocity (body rad/s), and fuel (kg).
Axes follow [ARCHITECTURE.md](ARCHITECTURE.md): world +Y up, body +Y up, body −Z
forward, body +X right. `VehiclePose` is the position/orientation subset, so
viewport and HUD consume flight state directly. The pose origin is the **centre of
mass**, not the feet; the viewport offsets its artwork by the app-supplied
centre-of-mass height (1.5 m for the first lander).

**Heading.** `headingAngle(q)` (engine) is the yaw left after removing the shortest
tilt of body +Y from upright. Zero faces world −Z, positive turns left, and forward
is (−sin h, 0, −cos h). It stays continuous at any tilt short of exactly inverted.
The chase camera sits behind this heading, and the landing radar uses the same
**heading frame**: x to the vehicle's right, y forward. W leans the thrust axis
toward +y (radar up), A toward −x (left).

## Forces and torques

| Effect           | Model                                                                                    |
| ---------------- | ---------------------------------------------------------------------------------------- |
| Gravity          | Uniform world acceleration from the environment; lunar preset −1.62 m/s² on Y            |
| Main engine      | `throttle × maxThrust` along body +Y through the centre of mass, so it creates no torque |
| Attitude control | Per-axis pure couples: torque without net force                                          |
| Mass             | Dry mass plus remaining fuel; current mass sets thrust acceleration                      |
| Rotation         | Euler's equations about constant principal axes, including gyroscopic coupling           |
| Atmosphere       | None                                                                                     |
| Surface contact  | Spring-damper points with friction on legs and hull; see below                           |

**Shared propellant.** Main engine and attitude thrusters draw from one tank.
Main flow is `thrust / exhaustVelocity`. An attitude couple producing torque `T`
about an axis uses total thruster force `|T| / attitudeLeverArm`, so its flow is
`|T| / (attitudeLeverArm × attitudeExhaustVelocity)`. Both torque signs cost
propellant. Continuous torque represents the time average of pulsed firings.

**Exhaustion.** A step whose combined demand would empty the tank splits at the
exact burnout instant: powered flight up to that time, then an unpowered coast.
Afterwards fuel is exactly zero and neither thrust nor torque applies, so
existing rotation continues and cannot be braked.

## Surface contact

Ground is a flat plane at y = 0 (`FlightEnvironment.surface`); the pad is flush with
it. Each contact point `p` (body frame) is checked every RK4 stage:

- World position `x + R·p` and velocity `v + ω × (R·p)`, with `ω` in world axes.
- Penetration `d = max(0, surface height − point height)`.
- Normal force `N = max(0, k·d + c·ḋ)`, where `ḋ` is the rate of penetration. The
  damping `c` is the compression value while sinking in and the rebound value while
  coming out. `N` never pulls.
- Friction `F = −μN · v_t / √(|v_t|² + 0.1²)`. That is full Coulomb friction while
  sliding, scaled smoothly to zero at rest so it never chatters.
- The force acts at the point: it adds `F/m` to linear acceleration and `r × F`
  (in body axes) to Euler's equations.

With a surface present, each step runs as RK4 substeps of at most 1/240 s, because
contact springs are stiff. `contactFacts` reports each point's penetration, push,
approach speed, and slip, for rules and presentation; it decides nothing.

| Points (`apps/game/src/lander.ts`) | k (N/m) | c compress / rebound (N·s/m) | μ   |
| ---------------------------------- | ------- | ---------------------------- | --- |
| 4 feet at (±1.5, −1.5, ±1.5) m     | 20,000  | 4,000 / 25,000               | 0.6 |
| Engine bell lip, 0.42 m above feet | 200,000 | 40,000 / 40,000              | 0.5 |
| 4 descent-stage base corners       | 200,000 | 40,000 / 40,000              | 0.5 |
| 4 ascent-stage roof corners        | 200,000 | 40,000 / 40,000              | 0.5 |
| Antenna tip                        | 200,000 | 40,000 / 40,000              | 0.5 |

Point positions come from the artwork's dimensions, relative to the 1.5 m centre
of mass.

### Worked examples

- **Resting compression:** each leg carries `mg/4`, so `d = mg/4k =
1500 × 1.62 / 80,000 ≈ 3.0 cm` with a full tank.
- **Vertical bounce frequency:** four legs in parallel give `ω = √(4k/m) ≈
7.3 rad/s`. An undamped bounce stays in contact for half a period, `π/ω ≈ 0.43 s`.
  The engine test reproduces this to within one 1/2400 s step.
- **Leg damping** on that mode: `ζ = 4c / (2√(4k·m)) ≈ 0.73` while compressing.
  Rebound damping is 6× larger. After deep compression the legs re-extend over
  about `c/k ≈ 1.25 s` instead of launching the lander.
- **Sliding:** on four feet, friction decelerates at `μg ≈ 0.97 m/s²` while sliding.
- **Tip-over:** resting on two feet, the lander falls back below 45° and over above
  it, where the centre of mass passes the line of support:
  `atan(1.5 m / 1.5 m) = 45°`. Tests check 38° (recovers) and 52° (tips).
- **Hard impact:** the bell lip is 0.42 m above the feet. A 2 m/s touchdown never
  reaches it; an 8 m/s one does. The unpowered opening hits at about 16.6 m/s:
  legs bottom out near 0.6 m, the bell strikes, and the lander comes to rest within
  0.5 m of standing height instead of bouncing.

## Controls and attitude assistance

The engine receives `FlightCommand { throttle, bodyTorque }` each fixed step.
Players do not command torque directly. The app turns player inputs into torque
with `rateControlTorque`:

- **Throttle:** a held lever in [0, 1], not a momentary key. Each frame the pilot
  input may move it at a speed in [−1, 1] of `THROTTLE_RATE` (0.5 of full range
  per second; a held key is ±1) or place it at a one-shot position in [0, 1],
  applied at the next tick.
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

The `responseTime` must be at least one maximum step (1/60 s), which keeps the
discrete controller from overshooting.

### Keyboard bindings

Physical key positions (shown here for QWERTY), sampled once per animation frame
and applied to every 60 Hz tick in that frame:

| Keys  | Input                               | Body axis / effect                      |
| ----- | ----------------------------------- | --------------------------------------- |
| W / S | Pitch forward / back                | −X / +X rate: thrust tilts forward/back |
| A / D | Roll left / right                   | +Z / −Z rate: thrust tilts left/right   |
| Q / E | Yaw left / right                    | +Y / −Y rate: nose turns left/right     |
| R / F | Raise / lower throttle while held   | 0.5 of full range per second            |
| Z / X | Full throttle / cut, once per press | Applied at the next tick                |
| P     | Start, pause, or resume             | Immediate; pausing releases held keys   |
| Enter | Restart from the opening            | Immediate; returns to the ready phase   |

Opposite keys cancel. The keyboard is one input source among those the game
merges each frame ([ADR 0016](decisions/0016-input-layer.md)): per axis the
strongest rotation request wins, and the lever follows the source that last began
moving it. Keys from the language selector, the help dialog, or with
Ctrl/Meta/Alt are ignored. Window blur, pause, and restart release all held keys.
Opening help while flying pauses. A hidden tab pauses, and the flight stays
paused until the player resumes.

## Opening scenario

`apps/game/src/scenario.ts`: upright and facing the pad (yawed −90°, so forward is
world +X), feet 80 m above the surface, 30 m from the pad along −X, sinking at
4 m/s and drifting toward the pad at 2 m/s, throttle 0, with **60 kg** of the
300 kg tank loaded (wet mass 1,260 kg, hover throttle 0.45).

Scripted pilots (`apps/game/src/pilots.ts`) use only the player's inputs, held
rate keys and the throttle lever ramp, and fly the opening in regression tests:

| Pilot                                  | Result                    | Fuel used | Time  |
| -------------------------------------- | ------------------------- | --------- | ----- |
| None                                   | Crash: legs hit ~16.6 m/s | 0 kg      | 7.8 s |
| Throttle only, sink at altitude/6      | Rough: 2.0 m/s sideways   | ~17.5 kg  | ~26 s |
| Steers to the pad, sinks at altitude/8 | Landed at pad centre      | ~23.5 kg  | ~31 s |
| Hovers without descending              | Runs dry, then crashes    | 60 kg     | ~97 s |

The flight continues through touchdown, and `apps/game/src/rules.ts` judges it.
See [GAME.md](GAME.md#landing-rules) and
[ADR 0012](decisions/0012-landing-outcomes.md).

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
- Contact is penalty-based: small penetration stands for leg compression and
  structural give. Legs do not break; 2.2 judges structural limits from contact
  facts.

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

`apps/game/src/session.test.ts` checks the runtime: identical states at 30 Hz and
144 Hz frame rates, bounded catch-up with discarded-time accounting, pause, the
throttle ramp and one-shot timing, first-contact timing against the free-fall
formula, a crash coming to rest without bouncing, and the opening's landability
ending at rest on four legs.

`packages/engine/src/contact.test.ts` checks contact against analytic references:
resting compression `mg/4k`, an elastic bounce with equal exit speed lasting
`π/ω`, damped and rebound-valved energy loss, sliding deceleration `μg`, the 45°
tip-over limit, the bell touching only on hard impacts, no effect above the
surface, clear-point facts, and validation.
