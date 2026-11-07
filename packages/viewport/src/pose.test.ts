import { describe, expect, it } from 'vitest';
import type { VehiclePose } from '@gravitas/engine';
import { assertPose } from './pose';

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

describe('presentation blend between completed ticks', () => {
  it('interpolates position linearly and orientation along the shortest arc', async () => {
    const { Object3D } = await import('three/webgpu');
    const { blendPose, copyPose, poseBuffer } = await import('./pose');
    const previous = poseBuffer();
    const current = poseBuffer();
    copyPose(
      { position: { x: 0, y: 10, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } },
      previous,
    );
    // 90° about body Z, stored as the negated quaternion to require shortest-arc handling.
    copyPose(
      {
        position: { x: 4, y: 6, z: -2 },
        orientation: { x: 0, y: 0, z: -Math.SQRT1_2, w: -Math.SQRT1_2 },
      },
      current,
    );
    const target = new Object3D();
    blendPose(previous, current, 0.25, target);
    expect(target.position.toArray()).toEqual([1, 9, -0.5]);
    // A quarter of 90° is 22.5°: |q| = (0, 0, sin 11.25°, cos 11.25°) up to sign.
    const angle = (22.5 * Math.PI) / 180;
    expect(Math.abs(target.quaternion.z)).toBeCloseTo(Math.sin(angle / 2), 12);
    expect(Math.abs(target.quaternion.w)).toBeCloseTo(Math.cos(angle / 2), 12);
    blendPose(previous, current, 1, target);
    expect(target.position.toArray()).toEqual([4, 6, -2]);
  });
});
