import type { FlightState } from '@gravitas/engine';
import { CENTER_OF_MASS_HEIGHT, LANDER } from './lander';

/** Centre of the landing pad's top surface, in world metres. */
export const PAD_POSITION = { x: 0, y: 0, z: 0 } as const;

/** Feet height above the surface when the first descent begins, in metres. */
export const START_ALTITUDE = 80;

/**
 * Opening of the first descent: upright, 30 m from the pad along -X, sinking at
 * 4 m/s and drifting toward the pad at 2 m/s, with a full tank. Left alone, it
 * reaches the surface in about 7.8 s at about 16.6 m/s.
 */
export const START_STATE: FlightState = {
  position: { x: -30, y: START_ALTITUDE + CENTER_OF_MASS_HEIGHT, z: 0 },
  orientation: { x: 0, y: 0, z: 0, w: 1 },
  velocity: { x: 2, y: -4, z: 0 },
  angularVelocity: { x: 0, y: 0, z: 0 },
  fuelMass: LANDER.fuelCapacity,
};

/** Camera start relative to the vehicle: above and behind it, so the pad is ahead and below. */
export const CAMERA_OFFSET = { x: -6, y: 12, z: 3 } as const;
