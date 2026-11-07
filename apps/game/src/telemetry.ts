import type { FlightState, Quaternion, Vector3, VehiclePose } from '@gravitas/engine';
import type { FlightTelemetry } from '@gravitas/ui';
import { FOOT_CONTACTS, LANDER } from './lander';
import { PAD_POSITION } from './scenario';

/** Rotates a body-frame vector into the world by a unit body-to-world quaternion. */
export function bodyToWorld(q: Quaternion, v: Vector3): Vector3 {
  // v' = v + 2w(u × v) + 2u × (u × v), with u the quaternion's vector part.
  const tx = 2 * (q.y * v.z - q.z * v.y);
  const ty = 2 * (q.z * v.x - q.x * v.z);
  const tz = 2 * (q.x * v.y - q.y * v.x);
  return {
    x: v.x + q.w * tx + (q.y * tz - q.z * ty),
    y: v.y + q.w * ty + (q.z * tx - q.x * tz),
    z: v.z + q.w * tz + (q.x * ty - q.y * tx),
  };
}

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

/** Presentation snapshot for the HUD; never fed back into the simulation. */
export function flightTelemetry(state: FlightState, throttle: number): FlightTelemetry {
  return {
    altitude: footClearance(state),
    verticalSpeed: state.velocity.y,
    horizontalSpeed: Math.hypot(state.velocity.x, state.velocity.z),
    padDistance: Math.hypot(state.position.x - PAD_POSITION.x, state.position.z - PAD_POSITION.z),
    tilt: tiltRadians(state.orientation),
    fuel: state.fuelMass / LANDER.fuelCapacity,
    throttle,
  };
}
