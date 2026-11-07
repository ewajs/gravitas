import * as THREE from 'three/webgpu';
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

/** Mutable Three.js copy of a validated pose, reused every frame without allocation. */
export interface PoseBuffer {
  readonly position: THREE.Vector3;
  readonly orientation: THREE.Quaternion;
}

export function poseBuffer(): PoseBuffer {
  return { position: new THREE.Vector3(), orientation: new THREE.Quaternion() };
}

export function copyPose(pose: VehiclePose, target: PoseBuffer): void {
  const { x, y, z } = pose.position;
  const q = pose.orientation;
  target.position.set(x, y, z);
  target.orientation.set(q.x, q.y, q.z, q.w);
}

/**
 * Presentation-only blend between two completed simulation ticks: linear position,
 * shortest-arc spherical orientation (q and -q are the same rotation).
 */
export function blendPose(
  previous: PoseBuffer,
  current: PoseBuffer,
  alpha: number,
  target: THREE.Object3D,
): void {
  target.position.lerpVectors(previous.position, current.position, alpha);
  target.quaternion.slerpQuaternions(previous.orientation, current.orientation, alpha);
}
