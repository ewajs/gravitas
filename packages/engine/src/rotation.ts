import type { Quaternion, Vector3 } from './pose';
import { addScaled, addScaledQuaternion, magnitude, normalizeQuaternion } from './math';

// Rigid-body rotation shared by stepFlight (with torque, every tick) and
// coastAttitude (torque-free, on rails), so the two can never disagree.

const ZERO: Vector3 = { x: 0, y: 0, z: 0 };

/**
 * Rate of change of a body-to-world quaternion turning at body rates `w`
 * (radians per second): q-dot = ½ q ⊗ [w, 0]. Uses `q` as given, unnormalized,
 * as an integration stage needs.
 */
export function quaternionRate(q: Quaternion, w: Vector3): Quaternion {
  return {
    x: (q.w * w.x + q.y * w.z - q.z * w.y) / 2,
    y: (q.w * w.y + q.z * w.x - q.x * w.z) / 2,
    z: (q.w * w.z + q.x * w.y - q.y * w.x) / 2,
    w: -(q.x * w.x + q.y * w.y + q.z * w.z) / 2,
  };
}

/**
 * Euler's equations about principal body axes: angular acceleration in radians
 * per second squared from I ẇ = torque − w × (I w), with gyroscopic coupling.
 */
export function angularAcceleration(w: Vector3, inertia: Vector3, torque: Vector3): Vector3 {
  const i = inertia;
  return {
    x: (torque.x + (i.y - i.z) * w.y * w.z) / i.x,
    y: (torque.y + (i.z - i.x) * w.z * w.x) / i.y,
    z: (torque.z + (i.x - i.y) * w.x * w.y) / i.z,
  };
}

/**
 * Torque-free rotation for `dt` seconds: Euler's equations and the quaternion rate,
 * by RK4 in steps short enough that the body turns at most 0.01 rad per step (and
 * at most 1 s). Orientation and rates are inertial.
 */
export function coastAttitude(
  orientation: Quaternion,
  angularVelocity: Vector3,
  inertia: Vector3,
  dt: number,
): { readonly orientation: Quaternion; readonly angularVelocity: Vector3 } {
  const rate = magnitude(angularVelocity);
  if (rate === 0 || dt === 0) {
    return { orientation: { ...orientation }, angularVelocity: { ...angularVelocity } };
  }
  const steps = Math.ceil(dt / Math.min(1, 0.01 / rate));
  const h = dt / steps;
  const slope = (q: Quaternion, w: Vector3) => ({
    q: quaternionRate(q, w),
    w: angularAcceleration(w, inertia, ZERO),
  });
  let q = orientation;
  let w = angularVelocity;
  for (let n = 0; n < steps; n++) {
    const k1 = slope(q, w);
    const k2 = slope(addScaledQuaternion(q, k1.q, h / 2), addScaled(w, k1.w, h / 2));
    const k3 = slope(addScaledQuaternion(q, k2.q, h / 2), addScaled(w, k2.w, h / 2));
    const k4 = slope(addScaledQuaternion(q, k3.q, h), addScaled(w, k3.w, h));
    // The RK4 average, (k1 + 2 k2 + 2 k3 + k4) / 6, as in stepFlight.
    const dq = addScaledQuaternion(
      addScaledQuaternion(addScaledQuaternion(k1.q, k2.q, 2), k3.q, 2),
      k4.q,
      1,
    );
    const dw = addScaled(addScaled(addScaled(k1.w, k2.w, 2), k3.w, 2), k4.w, 1);
    q = normalizeQuaternion(addScaledQuaternion(q, dq, h / 6));
    w = addScaled(w, dw, h / 6);
  }
  return { orientation: q, angularVelocity: w };
}
