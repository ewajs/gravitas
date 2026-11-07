import type { Quaternion, Vector3 } from './pose';

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

/**
 * Heading in radians: the rotation about world +Y left after removing the
 * shortest tilt of body +Y from upright (swing-twist decomposition). Zero faces
 * world −Z; positive turns left (toward −X), so forward is (−sin h, 0, −cos h).
 * Continuous at any tilt short of exactly inverted, where it is undefined and
 * this returns 0; callers needing continuity there should hold their last value.
 */
export function headingAngle(q: Quaternion): number {
  return 2 * Math.atan2(q.y, q.w);
}

/** Angle between body +Y and world +Y in radians, independent of heading. */
export function tiltAngle(q: Quaternion): number {
  // The world Y component of body +Y is 1 − 2(x² + z²).
  return Math.acos(Math.max(-1, Math.min(1, 1 - 2 * (q.x * q.x + q.z * q.z))));
}
