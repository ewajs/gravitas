# @gravitas/viewport

Three.js presentation library. It owns its canvas, following orbit camera,
procedural artwork, pose interpolation, resize observer, and GPU resources. The
host owns simulation state, vehicle poses, frame scheduling, and localization.

```ts
import { Viewport } from '@gravitas/viewport';

const viewport = new Viewport({
  container,
  label: 'A lunar lander and its landing pad.', // Supplied by host localization.
  centerOfMassHeight: 1.5, // Metres above the artwork's level feet; from the host's vehicle.
  cameraOffset: { x: -6, y: 12, z: 3 }, // Optional start relative to the centre of mass.
  backend: 'auto', // Or 'webgl2' to explicitly select the fallback backend.
});
viewport.setVehiclePose(startPose);
await viewport.init();

// Each animation frame, after the host's fixed-step simulation:
viewport.setVehiclePose(currentTickPose, previousTickPose);
viewport.render(remainderFraction); // Blend in [0, 1]; the host schedules frames.

console.log(viewport.backend); // Actual 'webgpu' or 'webgl2', never an assumption.
await viewport.dispose();
```

## Poses and interpolation

Poses are metres in a right-handed Y-up world, with normalized body-to-world
quaternions. A pose locates the vehicle's **centre of mass**, matching engine
flight state. The illustrative vehicle faces -Z and is authored from the centre of
its feet's contact plane. Viewport offsets it by the required, positive
`centerOfMassHeight`, so rotations pivot about the centre of mass. The host owns
that physical value; the mesh dimensions are artwork, not physical parameters.

`setVehiclePose(current, previous?)` validates and copies both poses without
mutating caller data. `render(alpha)` draws the vehicle at `alpha` between them:
position linearly, orientation along the shortest arc (q and −q are the same
rotation). Pass the last two completed fixed-step ticks and the accumulator
remainder, so the picture moves smoothly at any display rate. The vehicle is then
drawn less than one tick behind the physics. With a single pose, or `alpha = 1`,
the current pose is drawn as-is. `alpha` outside [0, 1] throws `RangeError`.
Import `VehiclePose` directly from `@gravitas/engine`.

## Camera

The orbit camera follows the drawn centre of mass: each frame, camera and target
move together, preserving the player's orbit angle and zoom (4–30 m). Pointer drag
orbits and the wheel zooms; panning is disabled because following would undo it.
`cameraOffset` sets the opening view and must lie within the zoom limits. The
camera stays above the target's horizon. A designed chase camera is planned (1.3).

## Lifecycle

`setLabel(text)` changes the canvas accessibility description before or after
initialization, without resetting the camera. The app calls it after a successful
locale change. Like `setVehiclePose`, it rejects calls after disposal.

`init()` initializes once, compiles the scene's materials, and then attaches the
canvas. Failures reject the promise. `render()` returns false before initialization,
after disposal, or for a zero-size host; device loss/errors surface on the next frame.
An application should display a useful failure message and stop its frame loop.

`dispose()` immediately detaches the canvas, observers, and input handlers, then
waits for pending initialization and releases resources. Repeated calls are safe.
Disposing while `init()` is pending makes initialization reject with `AbortError`;
handle that promise as well as awaiting disposal. Create a new instance to remount.

Frame scheduling deliberately belongs to the host; see
[the application integration](https://github.com/ewajs/gravitas/blob/main/apps/game/src/main.ts).
WebGPU and forced WebGL use one `WebGPURenderer` implementation and compatible
materials. No renderer, mutable scene, or physical state is exposed publicly.
