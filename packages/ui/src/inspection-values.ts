import type { VehiclePose } from '@gravitas/engine';

/** Presentation measurements only: horizontal pad offset and tilt from world +Y. */
export function inspectionValues(pose: VehiclePose, pad: VehiclePose['position']) {
  const { x, z } = pose.orientation;
  // The Y component of body +Y after rotation is 1 - 2(x² + z²).
  const up = Math.max(-1, Math.min(1, 1 - 2 * (x * x + z * z)));
  return {
    offsetMetres: Math.hypot(pose.position.x - pad.x, pose.position.z - pad.z),
    tiltRadians: Math.acos(up),
  };
}
