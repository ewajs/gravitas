import {
  bodyToWorld,
  headingAngle,
  tiltAngle,
  type FlightState,
  type Quaternion,
  type Vector3,
  type VehiclePose,
} from '@gravitas/engine';
import type { FlightTelemetry, RadarVector } from '@gravitas/ui';
import { FEET, LANDER } from './lander';
import { ENVIRONMENT, PAD_POSITION } from './scenario';

/**
 * Height of the lowest unloaded foot above the flat surface plane (y = 0), in
 * metres. Negative while legs are compressed against the ground.
 */
export function footClearance(pose: VehiclePose): number {
  let lowest = Infinity;
  for (const foot of FEET) {
    lowest = Math.min(lowest, pose.position.y + bodyToWorld(pose.orientation, foot.position).y);
  }
  return lowest;
}

/**
 * Horizontal part of a world vector in the heading frame: x to the vehicle's
 * right, y forward. The chase camera uses the same heading, so +y is screen-up
 * and W (pitch forward) leans toward +y.
 */
export function headingFrame(q: Quaternion, v: Vector3): RadarVector {
  const h = headingAngle(q);
  const cos = Math.cos(h);
  const sin = Math.sin(h);
  return { x: v.x * cos - v.z * sin, y: -v.x * sin - v.z * cos };
}

/** Presentation snapshot for the HUD; never fed back into the simulation. */
export function flightTelemetry(state: FlightState, throttle: number): FlightTelemetry {
  const q = state.orientation;
  const mass = LANDER.dryMass + state.fuelMass;
  return {
    // Compressed legs read as zero altitude, not as a negative height.
    altitude: Math.max(0, footClearance(state)),
    verticalSpeed: state.velocity.y,
    horizontalSpeed: Math.hypot(state.velocity.x, state.velocity.z),
    padDistance: Math.hypot(state.position.x - PAD_POSITION.x, state.position.z - PAD_POSITION.z),
    tilt: tiltAngle(q),
    fuel: state.fuelMass / LANDER.fuelCapacity,
    throttle,
    hoverThrottle: (mass * -ENVIRONMENT.gravity.y) / LANDER.maxThrust,
    lean: headingFrame(q, bodyToWorld(q, { x: 0, y: 1, z: 0 })),
    drift: headingFrame(q, state.velocity),
    pad: headingFrame(q, {
      x: PAD_POSITION.x - state.position.x,
      y: 0,
      z: PAD_POSITION.z - state.position.z,
    }),
  };
}
