# @gravitas/engine

Pure flight dynamics over plain data, independent of rendering and browser APIs.
It exports the shared `VehiclePose` contract, `stepFlight` for one rigid vehicle
with optional surface contact, `contactFacts`,
`rateControlTorque` for body-rate assistance, the orientation helpers
`bodyToWorld`, `headingAngle`, and `tiltAngle`, and the vector and angle
[math helpers](#math-helpers) the dynamics use. The host owns state, time,
input mapping, and any mission rules.

```ts
import { MAX_FLIGHT_STEP, rateControlTorque, stepFlight, type FlightState } from '@gravitas/engine';

let state: FlightState = {
  position: { x: 0, y: 100, z: 0 }, // Centre of mass, world metres.
  orientation: { x: 0, y: 0, z: 0, w: 1 },
  velocity: { x: 0, y: -2, z: 0 },
  angularVelocity: { x: 0, y: 0, z: 0 },
  fuelMass: 300,
};

// Once per fixed tick: map pilot input to torque, then advance.
const bodyTorque = rateControlTorque(state.angularVelocity, rateInput, vehicle, attitude);
state = stepFlight(state, { throttle: 0.6, bodyTorque }, vehicle, environment, MAX_FLIGHT_STEP);
```

`vehicle` (`VehicleParameters`), `attitude` (`AttitudeSettings`), and
`environment` (`FlightEnvironment`) are host-supplied numbers. Engine contains no
particular vehicle or mission; the game's first lander lives in
`apps/game/src/lander.ts`.

## Pose and state contract

`VehiclePose.position` is the **centre of mass** in metres in a right-handed
world: +Y is up, and the initial ground plane is XZ. Vehicle-local +Y is up, −Z is
forward, and +X is right. The normalized quaternion maps body coordinates to world
coordinates. `FlightState` extends the pose with world velocity, body-axis angular
velocity, and fuel, so presentation consumers can take flight state directly.

The types are readonly, but TypeScript does not freeze runtime objects. Engine
simulation functions validate their inputs, throw `RangeError` for invalid data,
and return new objects without mutating or aliasing caller data. Viewport separately validates
poses at its boundary; the UI assumes valid snapshots. Mutating a shared object
does not notify Lit, so pass a new snapshot when presentation data changes.

## Dynamics

- Uniform gravity; main thrust along body +Y through the centre of mass; current
  mass sets acceleration.
- Euler's rigid-body equations about constant principal axes.
- Main engine and attitude couples draw from one tank. A step that empties it
  splits at the burnout instant, leaving exactly zero fuel. Afterwards there is
  no thrust or torque.
- Classic RK4 with a step in (0, `MAX_FLIGHT_STEP`]. Hosts own the fixed-step
  accumulator and may use smaller steps.

`headingAngle(q)` is the yaw left after removing the shortest tilt from upright
(swing-twist about world Y). Zero faces −Z, positive turns left, and it stays
continuous at any tilt except exactly inverted, where it returns 0. Viewport's
chase camera and the game's radar share it, so screen-up and radar-up agree.

## Surface contact

Give the environment a `surface` (`{ kind: 'flat', height: 0 }`) and the vehicle
`contacts`, and `stepFlight` adds contact forces. Each `ContactPoint` is a body
point with a one-sided spring (`stiffness`), separate compression and rebound
damping, and Coulomb `friction`. `kind` marks legs, which are meant to touch,
and hull points, which mean structure hit the ground. Steps with a surface run as
RK4 substeps of at most `CONTACT_SUBSTEP` (1/240 s).

```ts
const facts = contactFacts(state, vehicle.contacts!, environment.surface!);
// [{ id: 'foot-left-front', kind: 'leg', penetration: 0.03, normalForce: 607, ... }, ...]
```

`contactFacts` reports what each point is doing: penetration, push, approach and
slip speeds, world position. It decides nothing; the host turns facts into
outcomes. All ground knowledge goes through one internal seam, so terrain or a
collision library can supply height and normal later
([ADR 0011](https://github.com/ewajs/gravitas/blob/main/docs/decisions/0011-contact-model.md)).

## Judging a touchdown

```ts
let record = NO_TOUCHDOWN;
// After each tick, with the states and facts at its start and end:
record = updateTouchdown(record, { before, beforeFacts, after, afterFacts }, dt, limits);
const outcome = classifyTouchdown(record, limits);
// { status: 'landed' | 'rough' | 'crashed' | 'touching' | 'airborne', ... }
```

`TouchdownLimits` holds the host's thresholds. Touchdown speed and tilt are read
just before the first leg loads, because contact braking within one tick would
understate an impact. Leg impact uses the larger of each leg's approach speed
before and after the tick. Crashes are immediate (hull contact, then leg impact,
then tipping); `landed` and `rough` wait until the vehicle has been still on all
legs for `settleTime`. Values exactly at a limit pass. The record is plain data,
so it serializes and tests with synthetic facts.

`rateControlTorque` turns normalized rate requests in [−1, 1] into limited body
torque. Zero input brakes rotation; it never auto-levels or cancels velocity.
Equations, parameters, worked examples, and simplifications are in the
[flight model](https://github.com/ewajs/gravitas/blob/main/docs/FLIGHT.md) and
[ADR 0008](https://github.com/ewajs/gravitas/blob/main/docs/decisions/0008-flight-model.md).

## Math helpers

The dynamics use small helpers over the shared `Vector3` and `Quaternion` types,
and hosts use the same ones instead of their own copies: `add`, `addScaled`,
`dot`, `cross`, and `magnitude` for vectors; `normalizeQuaternion`, `conjugate`,
and `rotationAbout` for rotations; and `clamp`, `toRadians`, and `toDegrees` for
numbers. They return new objects but, unlike the simulation functions, do not
validate (NaN in gives NaN out), because they run in every integration stage.
Engine angles are radians; convert degrees only at the edges. The main entry
re-exports them, and `@gravitas/engine/math` exposes them alone for hosts that
should reach arithmetic but no simulation (the UI package uses it).

```ts
import { clamp, rotationAbout, toRadians } from '@gravitas/engine';

const rolled = rotationAbout('z', toRadians(30)); // A 30° roll about +Z (right-hand rule)
const lever = clamp(throttle + change, 0, 1);
```

## Boundaries and future work

Engine imports no Three.js, Lit, DOM, browser clock, storage, network, or other
workspace. Its TypeScript project has no DOM or ambient Node types. There is no
scheduler or input handling; the fixed-step
session and input mapping live in the app
(`apps/game/src/session.ts`, `controls.ts`).
