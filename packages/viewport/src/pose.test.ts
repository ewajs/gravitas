import { describe, expect, it } from 'vitest';
import { assertPose, type VehiclePose } from './pose';

const pose: VehiclePose = {
  position: { x: -120, y: 0.01, z: 450 },
  orientation: { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 },
};

describe('presentation pose boundary', () => {
  it('accepts a quarter-turn without modifying frozen caller data', () => {
    Object.freeze(pose.position);
    Object.freeze(pose.orientation);
    Object.freeze(pose);
    expect(() => assertPose(pose)).not.toThrow();
    expect(pose.orientation.y).toBe(Math.SQRT1_2);
  });

  it.each([NaN, Infinity, -Infinity])('rejects non-finite position or orientation: %s', (value) => {
    expect(() => assertPose({ ...pose, position: { ...pose.position, x: value } })).toThrow(
      RangeError,
    );
    expect(() => assertPose({ ...pose, orientation: { ...pose.orientation, w: value } })).toThrow(
      RangeError,
    );
  });

  it.each([0, 2])('rejects a quaternion of length %s rather than silently normalizing it', (w) => {
    expect(() => assertPose({ ...pose, orientation: { x: 0, y: 0, z: 0, w } })).toThrow(
      /normalized/,
    );
  });
});
