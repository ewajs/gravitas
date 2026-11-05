import type { VehiclePose } from '@gravitas/viewport';

/** Stationary artwork fixture. This is not a simulation or a physical vehicle definition. */
export const INITIAL_POSE: VehiclePose = {
  position: { x: 0, y: 0, z: 0 },
  orientation: { x: 0, y: 0, z: 0, w: 1 },
};
