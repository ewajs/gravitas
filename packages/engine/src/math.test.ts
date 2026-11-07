import { describe, expect, it } from 'vitest';
import {
  addScaled,
  bodyToWorld,
  clamp,
  conjugate,
  cross,
  dot,
  magnitude,
  normalizeQuaternion,
  rotationAbout,
  toDegrees,
  toRadians,
} from './index';

const near = (x: number, y: number, z: number) => ({
  x: expect.closeTo(x, 12),
  y: expect.closeTo(y, 12),
  z: expect.closeTo(z, 12),
});

describe('shared math conventions', () => {
  it('crosses right-handed vectors into an orthogonal result', () => {
    expect(cross({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })).toEqual({ x: 0, y: 0, z: 1 });
    const a = { x: 2, y: -3, z: 0.5 };
    const b = { x: -1, y: 4, z: 7 };
    expect(dot(cross(a, b), a)).toBeCloseTo(0, 12);
    expect(dot(cross(a, b), b)).toBeCloseTo(0, 12);
    expect(magnitude({ x: 3, y: 4, z: 12 })).toBe(13);
    expect(addScaled(a, b, 0.5)).toEqual({ x: 1.5, y: -1, z: 4 });
  });

  it('rotates about an axis by the right-hand rule; the conjugate turns back', () => {
    const quarter = rotationAbout('z', Math.PI / 2);
    // 90° about +Z carries +X to +Y and +Y to −X.
    const turned = bodyToWorld(quarter, { x: 1, y: 2, z: 3 });
    expect(turned).toEqual(near(-2, 1, 3));
    expect(bodyToWorld(conjugate(quarter), turned)).toEqual(near(1, 2, 3));
  });

  it('restores unit length without changing the rotation', () => {
    const q = rotationAbout('y', 1.1);
    const unit = normalizeQuaternion({
      x: q.x * 1.01,
      y: q.y * 1.01,
      z: q.z * 1.01,
      w: q.w * 1.01,
    });
    expect(Math.hypot(unit.x, unit.y, unit.z, unit.w)).toBeCloseTo(1, 15);
    expect(unit.y).toBeCloseTo(q.y, 15);
    expect(unit.w).toBeCloseTo(q.w, 15);
  });

  it('converts angles and limits values to a range', () => {
    expect(toRadians(180)).toBe(Math.PI);
    expect(toDegrees(Math.PI / 2)).toBe(90);
    expect(toDegrees(toRadians(37.5))).toBeCloseTo(37.5, 12);
    expect([clamp(-2, -1, 1), clamp(0.25, -1, 1), clamp(3, -1, 1)]).toEqual([-1, 0.25, 1]);
  });
});
