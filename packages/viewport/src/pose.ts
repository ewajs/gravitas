import type { VehiclePose } from '@gravitas/engine';

/** Rejects invalid poses before any visual transform is changed. */
export function assertPose(pose: VehiclePose): void {
  const p = pose.position;
  const q = pose.orientation;
  if (![p.x, p.y, p.z, q.x, q.y, q.z, q.w].every(Number.isFinite)) {
    throw new RangeError('Vehicle pose must contain finite numbers');
  }
  const normalizationTolerance = 1e-6;
  if (Math.abs(Math.hypot(q.x, q.y, q.z, q.w) - 1) > normalizationTolerance) {
    throw new RangeError('Vehicle orientation must be a normalized quaternion');
  }
}
