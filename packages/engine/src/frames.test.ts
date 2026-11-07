import { describe, expect, it } from 'vitest';
import {
  bodyFixedToInertial,
  bodyFixedToSurface,
  bodyFixedToSurfaceFrame,
  bodyToWorld,
  inertialToBodyFixed,
  MOON,
  normalizeQuaternion,
  surfaceFrame,
  surfaceFrameToBodyFixed,
  surfaceToBodyFixed,
  toRadians,
  type FlightState,
  type Vector3,
} from './index';

const R = MOON.radius;
const expectVector = (actual: Vector3, expected: Vector3, digits = 6) => {
  for (const axis of ['x', 'y', 'z'] as const)
    expect(actual[axis]).toBeCloseTo(expected[axis], digits);
};
const places = [
  { latitude: 0, longitude: 0, altitude: 0 },
  { latitude: toRadians(26.1), longitude: toRadians(3.6), altitude: -1_200 }, // Apollo 15
  { latitude: toRadians(-43.3), longitude: toRadians(-11.4), altitude: 3_500 }, // Tycho
  { latitude: toRadians(-89.5), longitude: toRadians(170), altitude: 0 },
  { latitude: 0.3, longitude: Math.PI, altitude: 100_000 },
];

describe('surface positions', () => {
  it('places latitude 0, the poles, and longitude 90° east on the right axes', () => {
    expectVector(surfaceToBodyFixed(MOON, { latitude: 0, longitude: 0, altitude: 0 }), {
      x: R,
      y: 0,
      z: 0,
    });
    expectVector(surfaceToBodyFixed(MOON, { latitude: Math.PI / 2, longitude: 1, altitude: 5 }), {
      x: 0,
      y: R + 5,
      z: 0,
    });
    expectVector(surfaceToBodyFixed(MOON, { latitude: 0, longitude: Math.PI / 2, altitude: 0 }), {
      x: 0,
      y: 0,
      z: -R,
    });
  });

  it('round-trips latitude, longitude, and altitude', () => {
    for (const place of places) {
      const back = bodyFixedToSurface(MOON, surfaceToBodyFixed(MOON, place));
      expect(back.latitude).toBeCloseTo(place.latitude, 12);
      expect(back.longitude).toBeCloseTo(place.longitude, 12);
      expect(back.altitude).toBeCloseTo(place.altitude, 6);
    }
  });

  it('rejects latitudes past a pole, the centre, and bad bodies', () => {
    expect(() => surfaceToBodyFixed(MOON, { latitude: 2, longitude: 0, altitude: 0 })).toThrow(
      RangeError,
    );
    expect(() => bodyFixedToSurface(MOON, { x: 0, y: 0, z: 0 })).toThrow(RangeError);
    expect(() =>
      surfaceToBodyFixed({ ...MOON, radius: 0 }, { latitude: 0, longitude: 0, altitude: 0 }),
    ).toThrow(RangeError);
  });
});

describe('surface frames', () => {
  it('points +Y up, +X east, and −Z north at every place', () => {
    for (const place of places) {
      const frame = surfaceFrame(MOON, place);
      const { latitude: lat, longitude: lon } = place;
      // Analytic directions in body-fixed axes (longitude 90° east is −Z).
      const up = {
        x: Math.cos(lat) * Math.cos(lon),
        y: Math.sin(lat),
        z: -Math.cos(lat) * Math.sin(lon),
      };
      const east = { x: -Math.sin(lon), y: 0, z: -Math.cos(lon) };
      const north = {
        x: -Math.sin(lat) * Math.cos(lon),
        y: Math.cos(lat),
        z: Math.sin(lat) * Math.sin(lon),
      };
      expectVector(bodyToWorld(frame.orientation, { x: 0, y: 1, z: 0 }), up, 12);
      expectVector(bodyToWorld(frame.orientation, { x: 1, y: 0, z: 0 }), east, 12);
      expectVector(bodyToWorld(frame.orientation, { x: 0, y: 0, z: -1 }), north, 12);
      expectVector(frame.origin, surfaceToBodyFixed(MOON, place), 6);
    }
  });

  it('round-trips a flight state, leaving body rates and fuel alone', () => {
    const state: FlightState = {
      position: { x: 12, y: 80, z: -30 },
      velocity: { x: 2, y: -4, z: 1 },
      orientation: normalizeQuaternion({ x: 0.1, y: -0.7, z: 0.05, w: 0.7 }),
      angularVelocity: { x: 0.01, y: -0.02, z: 0.03 },
      fuelMass: 60,
    };
    for (const place of places) {
      const frame = surfaceFrame(MOON, place);
      const fixed = surfaceFrameToBodyFixed(state, frame);
      // The site's own up direction carries the 80 m height.
      expect(bodyFixedToSurface(MOON, fixed.position).altitude).toBeCloseTo(place.altitude + 80, 0);
      const back = bodyFixedToSurfaceFrame(fixed, frame);
      expectVector(back.position, state.position, 6);
      expectVector(back.velocity, state.velocity, 12);
      expectVector(back.orientation, state.orientation, 12);
      expect(back.orientation.w).toBeCloseTo(state.orientation.w, 12);
      expect(back.angularVelocity).toBe(state.angularVelocity);
      expect(back.fuelMass).toBe(60);
    }
  });
});

describe('inertial and body-fixed frames', () => {
  const day = 27.321_661 * 86_400;

  it('turns the ground east: a quarter sidereal turn carries longitude 0 to where 90° east was', () => {
    const ground: FlightState = {
      position: { x: R, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      orientation: { x: 0, y: 0, z: 0, w: 1 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      fuelMass: 0,
    };
    const seen = bodyFixedToInertial(ground, MOON, day / 4);
    expectVector(seen.position, { x: 0, y: 0, z: -R }, 3);
    // Moving with the ground: ΩR toward where 180° was, −X.
    expectVector(seen.velocity, { x: -MOON.rotationRate * R, y: 0, z: 0 }, 9);
  });

  it('round-trips at any time, forward or backward', () => {
    const state: FlightState = {
      position: { x: R + 50_000, y: -20_000, z: 300_000 },
      velocity: { x: -900, y: 300, z: 1_200 },
      orientation: normalizeQuaternion({ x: 0.3, y: 0.1, z: -0.2, w: 0.9 }),
      angularVelocity: { x: 0.1, y: 0, z: -0.05 },
      fuelMass: 100,
    };
    for (const time of [0, 5_000, -12_345.6, day * 3.7]) {
      const back = inertialToBodyFixed(bodyFixedToInertial(state, MOON, time), MOON, time);
      expectVector(back.position, state.position, 6);
      expectVector(back.velocity, state.velocity, 9);
      expectVector(back.orientation, state.orientation, 12);
      expect(back.orientation.w).toBeCloseTo(state.orientation.w, 12);
      expect(back.angularVelocity).toBe(state.angularVelocity);
    }
  });
});
