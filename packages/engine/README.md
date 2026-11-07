# @gravitas/engine

Plain simulation data, independent of rendering and browser APIs. The only current
export is `VehiclePose`; dynamics and simulation stepping arrive in M1.

```ts
import type { VehiclePose } from '@gravitas/engine';

const pose: VehiclePose = {
  position: { x: 0, y: 0, z: 0 },
  orientation: { x: 0, y: 0, z: 0, w: 1 },
};
```

## Pose contract

Position is in metres in a right-handed world: +Y is up, and the initial ground
plane is XZ. Vehicle-local +Y is up, -Z is forward, and +X is right. The normalized
quaternion maps body coordinates to world coordinates; the example is an upright
vehicle with no rotation. Position and quaternion components must be finite.

The type is readonly, but TypeScript does not freeze or validate runtime objects.
Consumers must supply valid data. Viewport validates and copies the pose before
changing visual transforms; the UI assumes valid snapshots. Mutating a shared
object does not notify Lit: pass a new snapshot when presentation data changes.

The app owns the current stationary fixture and pad reference. The same pose can
be consumed by viewport and UI through their public APIs. Import `VehiclePose`
directly from engine; there are no compatibility exports in other libraries.

## Boundaries and future work

Engine imports no Three.js, Lit, DOM, browser clock, storage, network, or other
workspace. Its TypeScript project has no DOM or ambient Node types. There are no
runtime exports, integrator, gravity, thrust, fuel model, or contact rules yet.

When simulation arrives, time and controls will be explicit inputs. The app will
own the authoritative session; rendering and UI will consume its results. These
are architectural constraints, not existing engine methods.
