import type { Quaternion, Vector3 } from './pose';

// Plain arithmetic over the shared Vector3 and Quaternion types. The dynamics call
// these in every integration stage, so unlike the simulation functions they do not
// validate (NaN in gives NaN out). Hosts use the same helpers instead of their own
// copies. Reordering an operation here changes simulation results in the last bit.
//
// This file is also the `@gravitas/engine/math` entry point, the one engine module UI
// may call at runtime. Keep it pure arithmetic: anything that simulates, judges, or
// holds state belongs elsewhere, or UI could quietly become a second simulation.

/**
 * Limits `value` to [`min`, `max`]; `min` must not exceed `max`.
 * @group Math
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Converts an angle in degrees to radians, the engine's angle unit.
 * @group Math
 */
export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Converts an angle in radians to degrees, for display.
 * @group Math
 */
export function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * Component-wise sum `a + b`.
 * @group Math
 */
export function add(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

/**
 * Component-wise `a + b × scale`, such as a position advanced by a velocity over a
 * time step.
 * @group Math
 */
export function addScaled(a: Vector3, b: Vector3, scale: number): Vector3 {
  return { x: a.x + b.x * scale, y: a.y + b.y * scale, z: a.z + b.z * scale };
}

/**
 * Dot product `a · b`.
 * @group Math
 */
export function dot(a: Vector3, b: Vector3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/**
 * Cross product `a × b` in the right-handed frame: x × y = z.
 * @group Math
 */
export function cross(a: Vector3, b: Vector3): Vector3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

/**
 * Euclidean length of a vector, such as a speed from a velocity.
 * @group Math
 */
export function magnitude(v: Vector3): number {
  return Math.hypot(v.x, v.y, v.z);
}

/**
 * The unit quaternion for the same rotation. Integration drifts slightly off unit
 * length; dividing by the length restores it.
 * @group Math
 */
export function normalizeQuaternion(q: Quaternion): Quaternion {
  const length = Math.hypot(q.x, q.y, q.z, q.w);
  return { x: q.x / length, y: q.y / length, z: q.z / length, w: q.w / length };
}

/**
 * Conjugate of a quaternion: for a unit quaternion, the opposite rotation, so a
 * body-to-world rotation becomes world-to-body.
 * @group Math
 */
export function conjugate(q: Quaternion): Quaternion {
  return { x: -q.x, y: -q.y, z: -q.z, w: q.w };
}

/**
 * Unit quaternion rotating by `angle` radians about one coordinate axis, following
 * the right-hand rule: a positive angle about +Y turns −Z toward −X.
 * @group Math
 */
export function rotationAbout(axis: 'x' | 'y' | 'z', angle: number): Quaternion {
  return { x: 0, y: 0, z: 0, [axis]: Math.sin(angle / 2), w: Math.cos(angle / 2) };
}

/**
 * Hamilton product `a ⊗ b`: the rotation that applies `b` first, then `a`. For
 * body-to-world quaternions, `frame ⊗ q` re-expresses `q` in another frame.
 * @group Math
 */
export function multiplyQuaternions(a: Quaternion, b: Quaternion): Quaternion {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}
