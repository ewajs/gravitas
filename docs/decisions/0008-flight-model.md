# 0008. Rigid-body flight model, RK4, and rate-command assistance

- Status: Implemented in 1.1.
- Date: 2026-11-06

## Decision

Model the lander as one rigid body with a centre-of-mass origin. Main thrust acts
along body +Y through the centre of mass. Attitude control is a torque about
constant principal axes, with gyroscopic coupling from Euler's equations. The
[flight model](../FLIGHT.md) documents equations, parameters, and worked examples.

**Integrator:** classic RK4 at a fixed step of at most 1/60 s, renormalizing the
quaternion after each step. Fuel decreases linearly within a step because actuator
flow is constant there. A step that empties the tank splits at the burnout instant
into a powered interval and a coast, and sets fuel to exactly zero.

**Attitude assistance:** proportional rate command per body axis, limited to the
vehicle's torque limits. Zero input brakes rotation and holds attitude. It never
auto-levels or cancels translation. The controller is a separate pure function;
`stepFlight` receives only physical torque, so assistance stays distinct from
physics and can be replaced or bypassed.

**Attitude propellant:** attitude thrusters are ideal per-axis couples drawing
from the main tank. Flow is `|torque| / (lever arm × exhaust velocity)`. With
empty tanks, neither thrust nor torque is available.

**Pose origin:** `VehiclePose.position` is the centre of mass, the point dynamics
naturally integrate. The app owns the centre-of-mass height; viewport takes it
as a constructor option and offsets its artwork. Contact geometry is deferred to M2.

## Alternatives

- **Semi-implicit Euler** is simpler and symplectic, but first order. Its error in
  the coupled rotation/thrust/mass system is large at 60 Hz, and convergence tests
  would only show slow first-order convergence. Integrating the attitude with
  quaternion exponentials would add special-case code for little gain. RK4 is
  standard, easy to review, and testable against exact references to 1e-9 here.
- **Physics library (Rapier etc.)** would provide rigid-body integration, but not
  rocket mass flow, rate assistance, or exact burnout handling. It is still a
  candidate for M2 contact if a hand-written contact model proves inadequate
  ([ADR 0002](0002-simulation-and-runtime.md)).
- **Attitude hold or auto-levelling assistance** would make the first flight easier,
  but it hides the momentum the game wants to teach. Rate command with braking
  is a middle ground. A stronger assist level can be added later as a separate
  controller, without changing dynamics.
- **Free attitude control** (the earlier draft) made empty tanks still flyable
  rotationally. The owner chose to make rotation cost propellant. A shared tank
  gives players one gauge; separate attitude tanks are a vehicle-design option
  for later vehicles.
- **Feet-plane pose origin** matched the artwork, but would put an offset in every
  rotation computed by dynamics, interpolation, and instruments.

## Consequences and revisit conditions

- The engine validates every input on each step. That costs little at 60 Hz and
  catches host errors close to their cause. Revisit if profiling shows it matters.
- Constant inertia and centre of mass are tolerable at 20% mass loss. Revisit
  for staging, large tanks, or visible centre-of-mass migration.
- Continuous attitude torque ignores minimum impulse bits and pulse quantization.
  Revisit if M3 playtesting wants a crisper thruster feel.
- Determinism holds within one JavaScript engine for identical inputs, not across
  platforms (ADR 0002).
- Orbital propagation, long time warp, or high-speed contact need new decisions.
