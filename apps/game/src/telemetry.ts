import {
  bodyToWorld,
  headingAngle,
  tiltAngle,
  type FlightState,
  type Quaternion,
  type Vector3,
  type VehiclePose,
} from '@gravitas/engine';
import type { FlightTelemetry, OrbitTelemetry, RadarVector } from '@gravitas/ui';
import { FEET, LANDER } from './lander';
import { safeSinkRate } from './rules';
import { PAD_POSITION, padDistance, SURFACE_GRAVITY } from './scenario';

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
  // Compressed legs read as zero altitude, not as a negative height.
  const altitude = Math.max(0, footClearance(state));
  return {
    altitude,
    safeSink: safeSinkRate(altitude),
    verticalSpeed: state.velocity.y,
    horizontalSpeed: Math.hypot(state.velocity.x, state.velocity.z),
    padDistance: padDistance(state.position),
    tilt: tiltAngle(q),
    fuel: state.fuelMass / LANDER.fuelCapacity,
    throttle,
    hoverThrottle: (mass * SURFACE_GRAVITY) / LANDER.maxThrust,
    lean: headingFrame(q, bodyToWorld(q, { x: 0, y: 1, z: 0 })),
    drift: headingFrame(q, state.velocity),
    pad: headingFrame(q, {
      x: PAD_POSITION.x - state.position.x,
      y: 0,
      z: PAD_POSITION.z - state.position.z,
    }),
  };
}

/**
 * Presentation snapshot around a body, from the state in the vehicle-centred
 * frame (+Y away from the centre): speeds are relative to the ground, altitude is
 * the feet over the reference sphere, hover throttle uses local gravity, and the
 * orbit replaces the pad. No safe-sink hint: there is no surface model here yet.
 */
export function orbitalFlightTelemetry(
  local: FlightState,
  throttle: number,
  altitude: number,
  gravity: number,
  orbit: OrbitTelemetry | undefined,
): FlightTelemetry {
  const q = local.orientation;
  const mass = LANDER.dryMass + local.fuelMass;
  return {
    altitude,
    verticalSpeed: local.velocity.y,
    horizontalSpeed: Math.hypot(local.velocity.x, local.velocity.z),
    tilt: tiltAngle(q),
    fuel: local.fuelMass / LANDER.fuelCapacity,
    throttle,
    hoverThrottle: (mass * gravity) / LANDER.maxThrust,
    lean: headingFrame(q, bodyToWorld(q, { x: 0, y: 1, z: 0 })),
    drift: headingFrame(q, local.velocity),
    ...(orbit ? { orbit } : {}),
  };
}
