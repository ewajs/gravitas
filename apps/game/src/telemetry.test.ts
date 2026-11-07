import { describe, expect, it } from 'vitest';
import type { FlightState, Quaternion } from '@gravitas/engine';
import { flightTelemetry, footClearance, headingFrame } from './telemetry';
import { START_ALTITUDE, START_STATE } from './scenario';

const upright = { x: 0, y: 0, z: 0, w: 1 };
const about = (axis: 'x' | 'y' | 'z', angle: number): Quaternion => ({
  x: 0,
  y: 0,
  z: 0,
  [axis]: Math.sin(angle / 2),
  w: Math.cos(angle / 2),
});
const near = (v: { x: number; y: number }) => [v.x, v.y].map((n) => Math.round(n * 1e9) / 1e9 + 0);

describe('presentation geometry', () => {
  it('measures altitude from the lowest foot, not the centre of mass', () => {
    const position = { x: 0, y: 10, z: 0 };
    expect(footClearance({ position, orientation: upright })).toBeCloseTo(8.5, 12);
    // Rolled 45°: the lowest foot is 1.5·sin45° + 1.5·cos45° = 2.1213 m below the centre.
    expect(footClearance({ position, orientation: about('z', Math.PI / 4) })).toBeCloseTo(
      10 - 3 * Math.SQRT1_2,
      12,
    );
    // On its side: the feet are level with the centre of mass, ±1.5 m.
    expect(footClearance({ position, orientation: about('z', Math.PI / 2) })).toBeCloseTo(8.5, 12);
  });

  it('projects world vectors into the heading frame: x right, y forward', () => {
    // Heading 0 faces world −Z; right is world +X.
    expect(near(headingFrame(upright, { x: 3, y: 9, z: -4 }))).toEqual([3, 4]);
    // Yawed 90° left: forward is world −X, right is world −Z.
    const left = about('y', Math.PI / 2);
    expect(near(headingFrame(left, { x: -5, y: 0, z: 0 }))).toEqual([0, 5]);
    expect(near(headingFrame(left, { x: 0, y: 0, z: -2 }))).toEqual([2, 0]);
  });
});

describe('flight telemetry', () => {
  it('starts facing the pad with the drift toward it', () => {
    const state: FlightState = { ...START_STATE, fuelMass: 150 };
    const t = flightTelemetry(state, 0.25);
    expect(t).toMatchObject({
      altitude: START_ALTITUDE,
      verticalSpeed: -4,
      horizontalSpeed: 2,
      padDistance: 30,
      tilt: 0,
      fuel: 0.5,
      throttle: 0.25,
    });
    expect(t.hoverThrottle).toBeCloseTo((1350 * 1.62) / 4500, 12);
    expect(near(t.pad)).toEqual([0, 30]);
    expect(near(t.drift)).toEqual([0, 2]);
    expect(near(t.lean)).toEqual([0, 0]);
  });

  it('shows pitch-forward lean ahead and roll-left lean to the left, at sin(tilt)', () => {
    // W requests a negative body-X rate; A requests a positive body-Z rate.
    const forward = flightTelemetry({ ...START_STATE, orientation: about('x', -0.3) }, 0).lean;
    expect(near(forward)).toEqual(near({ x: 0, y: Math.sin(0.3) }));
    const leftward = flightTelemetry({ ...START_STATE, orientation: about('z', 0.3) }, 0).lean;
    expect(near(leftward)).toEqual(near({ x: -Math.sin(0.3), y: 0 }));
  });
});
