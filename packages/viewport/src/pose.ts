/** A presentation pose: metres in world space and a normalized body-to-world quaternion. */
export interface VehiclePose {
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
  readonly orientation: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly w: number;
  };
}

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
