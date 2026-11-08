# @gravitas/viewport

Three.js presentation library. It owns its canvas, chase camera, procedural
artwork and surface detail, a planet with a map view, actuator effects, pose
interpolation, resize observer, and GPU resources. The
host owns simulation state, vehicle poses, frame scheduling, and localization.

```ts
import { Viewport } from '@gravitas/viewport';

const viewport = new Viewport({
  container,
  label: 'A lunar lander and its landing pad.', // Supplied by host localization.
  centerOfMassHeight: 1.5, // Metres above the artwork's level feet; from the host's vehicle.
  backend: 'auto', // Or 'webgl2' to explicitly select the fallback backend.
});
viewport.setVehiclePose(startPose);
await viewport.init();

// Each animation frame, after the host's fixed-step simulation:
viewport.setVehiclePose(currentTickPose, previousTickPose);
viewport.render(remainderFraction); // Blend in [0, 1]; the host schedules frames.

// What the actuators did this tick: plume, light, thruster puffs, dust.
viewport.setActuators({ throttle: 0.6, attitude: { x: -1, y: 0, z: 0 } });

// Presentation of contact: each foot's penetration, in foot order.
viewport.setLegCompression([0.03, 0.03, 0.03, 0.03]);

// After a discontinuity such as a restart:
viewport.setVehiclePose(startPose);
viewport.resetCamera(); // Snap behind the heading instead of easing across the jump.

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

## Chase camera and scene

The camera stays behind the drawn vehicle's heading and level with the horizon,
orbiting its centre of mass. Heading is engine's `headingAngle`, so a host using
the same function (as the game's radar does) keeps its instruments aligned with
the screen.

- Translation follows exactly. Azimuth and elevation ease (0.6 s / 0.8 s time
  constants) on a presentation clock viewport reads itself, so yaw turns and
  altitude changes are smooth at any frame rate.
- Elevation is steep high up (35° from vertical) and flattens near the ground (66°).
  A 12% lens shift draws the vehicle above centre, showing more surface ahead.
- Pointer drag orbits freely; 1.5 s after release the camera eases back. The wheel
  zooms between 6 and 40 m, and zoom is never reset by the chase.
- Panning is disabled. At an exact inversion, where heading is undefined, the
  camera holds its last heading. `resetCamera()` snaps to the default chase
  position.

## Scene accents

`setAccents({ sky, pad, marker, orbit })` colours the scene's non-physical marks:
the background behind the scene (and the map), the pad ring and markings, the ring
and drop line below the vehicle (and its map marker), and the map's orbit line with
its periapsis and apoapsis marks. Each is a CSS `#rrggbb` colour; anything else throws
`RangeError`. Hosts typically pass their interface theme's accents (the game passes
`@gravitas/ui/themes`'s `gravitasTheme.scene`), so viewport never imports UI.
Physical materials (regolith, rock, foil, flame, dust, sunlight) keep their own
colours. Callable before `init()`; changes show on the next frame.

## Planets and the map

`setPlanet({ radius, surfaceMap })` shows a spherical body in place of the flat
landing site (null brings the site back). The colour map is an equirectangular
image URL, longitude −180° at the left edge and north at the top; it loads
asynchronously and the body is grey until then.

```ts
viewport.setPlanet({ radius: 1_737_400, surfaceMap: '/moon/lroc-color-2k.jpg' });
// Every frame, in the host's vehicle-centred world (+Y away from the centre):
viewport.setPlanetPose({ centre, orientation }); // body centre; body-fixed → world rotation
viewport.setSunDirection(towardSun); // any length
viewport.setVehiclePose(current, previous);
// When the orbit changes, in body-fixed metres:
viewport.setOrbitPath({ points, closed: true, periapsis, apoapsis });
viewport.setCameraMode('map'); // or 'chase'; the map needs a planet shown
```

Keep the vehicle near the world origin: Three.js draws in float32, which resolves
only about 0.1 m at a moon's radius but micrometres near the origin. The chase
camera, heading, and the flat site's conventions then still apply, and above 2 km
the chase camera turns toward the horizon. The map is a separate scene in
body-fixed coordinates (north up), with its own camera and orbit controls, a
starfield, and markers for the vehicle, periapsis, and apoapsis
([ADR 0020](https://github.com/ewajs/gravitas/blob/main/docs/decisions/0020-planetary-view.md)).

### Terrain

Pass the engine's terrain to draw real ground instead of a smooth sphere:

```ts
viewport.setPlanet({ radius: MOON.radius, surfaceMap, terrain }); // terrain from createTerrain
```

The chase view then draws the body as tiles on a cube-sphere quadtree: six faces,
each split into quarters while the camera is within 2.5 tile edges, down to tiles
about 10 m across with vertices 33 cm apart. Tiles beyond the horizon or outside
the camera's view are not drawn or refined. A worker meshes them from the same
height function the vehicle touches, leaving out detail narrower than three vertex
spacings; normals come from the drawn surface, and skirts hide cracks between
levels. Altitude for the chase camera is measured above this ground, and the
camera stays at least 1.5 m above it. The map keeps the smooth sphere
([ADR 0022](https://github.com/ewajs/gravitas/blob/main/docs/decisions/0022-terrain-rendering.md)).

## Effects

`setActuators({ throttle, attitude })` shows what the vehicle's actuators did:

- **`throttle`** in [0, 1] drives a two-layer additive plume (up to 4 m long) and a
  warm point light below the bell.
- **`attitude`** is torque per body axis as a fraction of its limit, each in
  [−1, 1]. It lights puffs at the four thruster quads, aimed along each quad's
  exhaust as the torque requires: pitch fires front and back, roll fires left and
  right, yaw fires all four sideways.
- **Dust:** below 12 m with the engine firing, a soft ring of dust spreads on the
  ground beneath the vehicle.

Flames are not tone-mapped, so they keep their colour. Flicker and dust motion use
viewport's presentation clock and stop entirely under `prefers-reduced-motion`.
Pass what the simulation actually applied: zero when the tank is empty.

`setLegCompression` takes four non-negative metres in foot order: left-front,
left-back, right-front, right-back (front is body −Z). It raises each drawn foot
by that amount and re-aims its struts, so feet stay on the ground while the body
sinks. Drawing clamps at 0.6 m.

The scene is illustrative: flat ground at y = 0 with a flush pad at the origin and seeded,
deterministic rocks and crater decals (instanced). A blue ring and drop line mark
the ground straight below the vehicle, using the flat y = 0 plane and the
centre-of-mass height. It is not terrain data or contact geometry.

## Diagnostics

`renderStats` returns `{ drawCalls, triangles }` for the last rendered frame, or
`null` before initialization. `terrainStats` returns `{ drawn, cached, pending,
deepest }` for a planet's terrain tiles, or `null` without one. The game's `?debug`
overlay shows both.

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
