import { describe, expect, it } from 'vitest';
import { bodyToWorld, headingAngle, type Quaternion } from './index';

const about = (axis: 'x' | 'y' | 'z', angle: number): Quaternion => ({
  x: 0,
  y: 0,
  z: 0,
  [axis]: Math.sin(angle / 2),
  w: Math.cos(angle / 2),
});
// Hamilton product a ⊗ b: apply b first, then a.
const multiply = (a: Quaternion, b: Quaternion): Quaternion => ({
  x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
  y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
  z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
});
const rounded = (v: { x: number; y: number; z: number }) =>
  [v.x, v.y, v.z].map((n) => Math.round(n * 1e12) / 1e12 + 0);

describe('orientation helpers', () => {
  it('rotates body vectors into the world', () => {
    // 90° about +Z maps body +X to world +Y and body +Y to world -X.
    const q = about('z', Math.PI / 2);
    expect(rounded(bodyToWorld(q, { x: 1, y: 0, z: 0 }))).toEqual([0, 1, 0]);
    expect(rounded(bodyToWorld(q, { x: 0, y: 1, z: 0 }))).toEqual([-1, 0, 0]);
    // 90° about +Y turns forward (−Z) to world −X: a left turn.
    expect(rounded(bodyToWorld(about('y', Math.PI / 2), { x: 0, y: 0, z: -1 }))).toEqual([
      -1, 0, 0,
    ]);
  });

  it('reads pure yaw as heading, with forward at (−sin h, 0, −cos h)', () => {
    for (const h of [0, 0.4, -1.2, 2.9]) {
      expect(headingAngle(about('y', h))).toBeCloseTo(h, 12);
      const forward = bodyToWorld(about('y', h), { x: 0, y: 0, z: -1 });
      expect(rounded(forward)).toEqual(rounded({ x: -Math.sin(h), y: 0, z: -Math.cos(h) }));
    }
  });

  it('keeps the heading under any tilt about a horizontal axis', () => {
    // Swing about a horizontal world axis applied after the yaw leaves heading unchanged.
    for (const tiltAxis of ['x', 'z'] as const) {
      for (const tilt of [0.3, -1.2, 1.5, 2.5]) {
        const q = multiply(about(tiltAxis, tilt), about('y', -Math.PI / 2));
        expect(headingAngle(q)).toBeCloseTo(-Math.PI / 2, 12);
      }
    }
  });

  it('treats q and −q as the same heading', () => {
    const q = about('y', 1);
    expect(headingAngle({ x: -q.x, y: -q.y, z: -q.z, w: -q.w })).toBeCloseTo(
      headingAngle(q) - 2 * Math.PI,
      12,
    );
    // Equal modulo a full turn; consumers compare angles on the circle.
    const wrapped = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
    expect(wrapped(headingAngle({ x: -q.x, y: -q.y, z: -q.z, w: -q.w }))).toBeCloseTo(1, 12);
  });
});
