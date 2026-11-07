# @gravitas/engine

Pure flight dynamics over plain data, independent of rendering and browser APIs.
It exports the shared `VehiclePose` contract, `stepFlight` for one rigid vehicle,
and `rateControlTorque` for body-rate assistance. The host owns state, time,
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
functions validate their inputs, throw `RangeError` for invalid data, and return
new objects without mutating or aliasing caller data. Viewport separately validates
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

`rateControlTorque` turns normalized rate requests in [−1, 1] into limited body
torque. Zero input brakes rotation; it never auto-levels or cancels velocity.
Equations, parameters, worked examples, and simplifications are in the
[flight model](https://github.com/ewajs/gravitas/blob/main/docs/FLIGHT.md) and
[ADR 0008](https://github.com/ewajs/gravitas/blob/main/docs/decisions/0008-flight-model.md).

## Boundaries and future work

Engine imports no Three.js, Lit, DOM, browser clock, storage, network, or other
workspace. Its TypeScript project has no DOM or ambient Node types. There is no
ground contact, landing classification, scheduler, or input handling: contact is
planned for M2, and the fixed-step runtime and input mapping belong to the app (M1 step 1.2).
