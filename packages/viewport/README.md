# @gravitas/viewport

Three.js presentation library. It owns its canvas, inspection camera, procedural
artwork, controls, resize observer, and GPU resources. The host owns vehicle poses,
frame scheduling, localization, and future simulation state.

```ts
import { Viewport } from '@gravitas/viewport';

const viewport = new Viewport({
  container,
  label: 'A lunar lander on a landing pad.', // Supplied by host localization.
  backend: 'auto', // Or 'webgl2' to explicitly select the fallback backend.
});
viewport.setVehiclePose({
  position: { x: 0, y: 0, z: 0 },
  orientation: { x: 0, y: 0, z: 0, w: 1 },
});
await viewport.init();
viewport.render(); // One frame; the host supplies its animation loop.
console.log(viewport.backend); // Actual 'webgpu' or 'webgl2', never an assumption.
await viewport.dispose();
```

Poses are metres in a right-handed Y-up world, with normalized body-to-world
quaternions. The illustrative vehicle faces -Z; its origin is the centre of its
feet's contact plane. The mesh dimensions are artwork, not physical parameters.
Pose data is validated and copied without mutation.

`init()` initializes once, compiles the scene's materials, and then attaches the
canvas. Failures reject the promise. `render()` returns false before initialization,
after disposal, or for a zero-size host; device loss/errors surface on the next frame.
An application should display a useful failure message and stop its frame loop.

`dispose()` immediately detaches the canvas, observers, and input handlers, then
waits for pending initialization and releases resources. Repeated calls are safe.
Disposing while `init()` is pending makes initialization reject with `AbortError`;
handle that promise as well as awaiting disposal. Create a new instance to remount.

The camera supports pointer orbit, wheel zoom, and arrow-key pan while the canvas
is focused. Render after controls change. Frame scheduling deliberately belongs
to the host; see [the application integration](../../apps/game/src/main.ts).

WebGPU and forced WebGL use one `WebGPURenderer` implementation and compatible
materials. No renderer, mutable scene, or physical state is exposed publicly.
