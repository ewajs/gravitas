import { describe, expect, it } from 'vitest';
import {
  addScaled,
  addScaledQuaternion,
  bodyToWorld,
  clamp,
  conjugate,
  cross,
  dot,
  magnitude,
  modulo,
  multiplyQuaternions,
  normalizeQuaternion,
  rotationAbout,
  scale,
  signedAngle,
  subtract,
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

  it('subtracts and scales vectors, and adds scaled quaternions in all four components', () => {
    expect(subtract({ x: 5, y: 1, z: -2 }, { x: 2, y: 3, z: -2 })).toEqual({ x: 3, y: -2, z: 0 });
    expect(scale({ x: 1, y: -2, z: 0.5 }, 4)).toEqual({ x: 4, y: -8, z: 2 });
    const q = { x: 0.1, y: 0.2, z: 0.3, w: 0.9 };
    expect(addScaledQuaternion(q, { x: 1, y: 0, z: -1, w: 2 }, 0.5)).toEqual({
      x: 0.6,
      y: 0.2,
      z: -0.2,
      w: 1.9,
    });
  });

  it('wraps into [0, divisor) whatever the sign, unlike %', () => {
    expect(modulo(7, 3)).toBe(1);
    expect(modulo(-1, 3)).toBe(2);
    expect(modulo(-7 * Math.PI, 2 * Math.PI)).toBeCloseTo(Math.PI, 12);
    expect(modulo(0, 5)).toBe(0);
  });

  it('measures signed angles about an axis by the right-hand rule', () => {
    const up = { x: 0, y: 0, z: 1 };
    expect(signedAngle({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, up)).toBeCloseTo(
      Math.PI / 2,
      15,
    );
    expect(signedAngle({ x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, up)).toBeCloseTo(
      -Math.PI / 2,
      15,
    );
    expect(signedAngle({ x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }, up)).toBeCloseTo(Math.PI, 15);
  });

  it('composes rotations: b first, then a', () => {
    const a = rotationAbout('z', Math.PI / 2);
    const b = rotationAbout('x', Math.PI / 2);
    // +Y: b turns it to +Z, which a leaves alone. +X: b leaves it, then a turns it to +Y.
    expect(bodyToWorld(multiplyQuaternions(a, b), { x: 0, y: 1, z: 0 })).toEqual(near(0, 0, 1));
    expect(bodyToWorld(multiplyQuaternions(a, b), { x: 1, y: 0, z: 0 })).toEqual(near(0, 1, 0));
  });
});
