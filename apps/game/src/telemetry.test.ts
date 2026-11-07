import { describe, expect, it } from 'vitest';
import type { FlightState, Quaternion } from '@gravitas/engine';
import { bodyToWorld, flightTelemetry, footClearance, tiltRadians } from './telemetry';
import { START_ALTITUDE, START_STATE } from './scenario';

const upright = { x: 0, y: 0, z: 0, w: 1 };
const aboutZ = (angle: number): Quaternion => ({
  x: 0,
  y: 0,
  z: Math.sin(angle / 2),
  w: Math.cos(angle / 2),
});

describe('presentation geometry', () => {
  it('rotates body vectors into the world', () => {
    // 90° about +Z maps body +X to world +Y and body +Y to world -X.
    const q = aboutZ(Math.PI / 2);
    const x = bodyToWorld(q, { x: 1, y: 0, z: 0 });
    const y = bodyToWorld(q, { x: 0, y: 1, z: 0 });
    expect([x.x, x.y, x.z].map((n) => +n.toFixed(12))).toEqual([0, 1, 0]);
    expect([y.x, y.y, y.z].map((n) => +n.toFixed(12))).toEqual([-1, 0, 0]);
  });

  it('measures altitude from the lowest foot, not the centre of mass', () => {
    const position = { x: 0, y: 10, z: 0 };
    expect(footClearance({ position, orientation: upright })).toBeCloseTo(8.5, 12);
    // Rolled 45°: the lowest foot is 1.5·sin45° + 1.5·cos45° = 2.1213 m below the centre.
    expect(footClearance({ position, orientation: aboutZ(Math.PI / 4) })).toBeCloseTo(
      10 - 3 * Math.SQRT1_2,
      12,
    );
    // On its side: the feet are level with the centre of mass, ±1.5 m.
    expect(footClearance({ position, orientation: aboutZ(Math.PI / 2) })).toBeCloseTo(8.5, 12);
  });

  it('measures tilt from upright, allowing yaw and inverted poses', () => {
    for (const [orientation, angle] of [
      [{ x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 }, 0],
      [{ x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 }, Math.PI / 2],
      [{ x: 0, y: 0, z: 1, w: 0 }, Math.PI],
    ] as const) {
      expect(tiltRadians(orientation)).toBeCloseTo(angle);
    }
  });

  it('builds the HUD snapshot in SI units from the starting state', () => {
    const state: FlightState = { ...START_STATE, fuelMass: 150 };
    expect(flightTelemetry(state, 0.25)).toEqual({
      altitude: START_ALTITUDE,
      verticalSpeed: -4,
      horizontalSpeed: 2,
      padDistance: 30,
      tilt: 0,
      fuel: 0.5,
      throttle: 0.25,
    });
  });
});
