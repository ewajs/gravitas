import {
  bodyToWorld,
  headingAngle,
  type FlightState,
  type Quaternion,
  type Vector3,
  type VehiclePose,
} from '@gravitas/engine';
import type { FlightTelemetry, RadarVector } from '@gravitas/ui';
import { ENVIRONMENT, FOOT_CONTACTS, LANDER } from './lander';
import { PAD_POSITION } from './scenario';

/** Height of the lowest foot above the flat surface plane (y = 0), in metres. */
export function footClearance(pose: VehiclePose): number {
  let lowest = Infinity;
  for (const foot of FOOT_CONTACTS) {
    lowest = Math.min(lowest, pose.position.y + bodyToWorld(pose.orientation, foot).y);
  }
  return lowest;
}

/** Angle between body +Y and world +Y in radians, independent of yaw. */
export function tiltRadians(q: Quaternion): number {
  // The world Y component of body +Y is 1 - 2(x² + z²).
  return Math.acos(Math.max(-1, Math.min(1, 1 - 2 * (q.x * q.x + q.z * q.z))));
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
    altitude: footClearance(state),
    verticalSpeed: state.velocity.y,
    horizontalSpeed: Math.hypot(state.velocity.x, state.velocity.z),
    padDistance: Math.hypot(state.position.x - PAD_POSITION.x, state.position.z - PAD_POSITION.z),
    tilt: tiltRadians(q),
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
