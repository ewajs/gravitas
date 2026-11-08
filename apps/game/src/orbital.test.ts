import { describe, expect, it } from 'vitest';
import {
  add,
  bodyToWorld,
  dot,
  magnitude,
  MOON,
  stateFromOrbit,
  tiltAngle,
  type Vector3,
} from '@gravitas/engine';
import {
  ORBIT_SANDBOX,
  orbitalScene,
  orbitPath,
  orbitTelemetry,
  RAILS_FLOOR,
  SANDBOX_ORBIT,
  sandboxStart,
  sphereAltitude,
} from './orbital';
import { FlightSession, type PilotInput } from './session';
import { headingFrame, orbitalFlightTelemetry } from './telemetry';

const R = MOON.radius;
const mu = MOON.gravitationalParameter;
const idle: PilotInput = { rates: { x: 0, y: 0, z: 0 }, throttleChange: 0 };

describe('the orbit sandbox', () => {
  it('starts upright at apoapsis, 100 km up, facing along its ground track, tank full', () => {
    const start = sandboxStart();
    expect(sphereAltitude(start) + 1.5).toBeCloseTo(100_000, 3);
    const scene = orbitalScene(start, start, 0);
    expect(tiltAngle(scene.current.orientation)).toBeCloseTo(0, 9);
    // Drift points straight ahead on the radar: the lander faces where it is going.
    const drift = headingFrame(scene.current.orientation, scene.current.velocity);
    expect(drift.x).toBeCloseTo(0, 6);
    expect(drift.y).toBeGreaterThan(1500);
    expect(start.fuelMass).toBe(ORBIT_SANDBOX.vehicle.fuelCapacity);
    // Rails are possible all the way round: the periapsis clears the floor.
    expect(SANDBOX_ORBIT.periapsis - R).toBeGreaterThan(RAILS_FLOOR);
  });

  it('reads 100 km by 15 km, half an orbit to periapsis, and the vis-viva speed', () => {
    const orbit = orbitTelemetry(sandboxStart(), 0)!;
    expect(orbit.apoapsis).toBeCloseTo(100_000, 3);
    expect(orbit.periapsis).toBeCloseTo(15_000, 3);
    const a = R + 57_500;
    const period = 2 * Math.PI * Math.sqrt(a ** 3 / mu);
    expect(orbit.timeToPeriapsis).toBeCloseTo(period / 2, 3);
    expect(orbit.speed).toBeCloseTo(Math.sqrt(mu * (2 / (R + 100_000) - 1 / a)), 6);
  });
});

describe('the vehicle-centred scene', () => {
  it('puts the vehicle at the origin, up away from the Moon, and the Moon below', () => {
    const start = sandboxStart();
    const session = new FlightSession(ORBIT_SANDBOX);
    session.start();
    for (let n = 0; n < 30; n++) session.advance(1 / 60, idle);
    const scene = orbitalScene(session.state, session.previous, session.time);
    expect(magnitude(scene.current.position)).toBeLessThan(1e-6);
    // The tick before is about 1.6 km/s × 1/60 s behind.
    expect(magnitude(scene.previous.position)).toBeCloseTo(
      magnitude(session.state.velocity) / 60,
      0,
    );
    const centre = scene.planet.centre;
    expect(centre.x).toBeCloseTo(0, 3);
    expect(centre.z).toBeCloseTo(0, 3);
    expect(-centre.y).toBeCloseTo(magnitude(session.state.position), 3);
    // The Moon's orientation carries the vehicle's Moon-fixed position to the origin.
    const placed: Vector3 = add(
      bodyToWorld(scene.planet.orientation, session.state.position),
      centre,
    );
    expect(magnitude(placed)).toBeLessThan(1e-3);
    // The start is in daylight, with the Sun low behind.
    const sun = orbitalScene(start, start, 0).sun;
    expect(magnitude(sun)).toBeCloseTo(1, 12);
    expect(sun.y).toBeCloseTo(0.5, 2);
  });
});

describe('the map path', () => {
  it('closes a bound orbit between periapsis and apoapsis, and opens an escape', () => {
    const path = orbitPath(sandboxStart(), 0)!;
    expect(path.closed).toBe(true);
    expect(path.points).toHaveLength(256);
    const radii = path.points.map(magnitude);
    expect(Math.min(...radii) - R).toBeGreaterThan(15_000 - 1);
    expect(Math.max(...radii) - R).toBeLessThan(100_000 + 1);
    expect(magnitude(path.periapsis!) - R).toBeCloseTo(15_000, 3);
    expect(magnitude(path.apoapsis!) - R).toBeCloseTo(100_000, 3);
    // All in one plane through the centre.
    const normal = {
      x: path.points[0]!.y * path.points[64]!.z - path.points[0]!.z * path.points[64]!.y,
      y: path.points[0]!.z * path.points[64]!.x - path.points[0]!.x * path.points[64]!.z,
      z: path.points[0]!.x * path.points[64]!.y - path.points[0]!.y * path.points[64]!.x,
    };
    for (const point of path.points) {
      expect(Math.abs(dot(point, normal)) / (magnitude(point) * magnitude(normal))).toBeLessThan(
        1e-9,
      );
    }

    const escape = stateFromOrbit({ ...SANDBOX_ORBIT, eccentricity: 1.5, trueAnomaly: 0.2 }, mu);
    const open = orbitPath({ ...sandboxStart(), ...escape }, 0)!;
    expect(open.closed).toBe(false);
    expect(open.apoapsis).toBeUndefined();
    expect(Math.max(...open.points.map(magnitude)) / R).toBeCloseTo(10, 3);
  });

  it('has no path or readout for a fall straight down, which has no orbital plane', () => {
    // At a pole the Moon's spin adds no sideways speed.
    const fall = {
      ...sandboxStart(),
      position: { x: 0, y: R + 50_000, z: 0 },
      velocity: { x: 0, y: -100, z: 0 },
    };
    expect(orbitPath(fall, 0)).toBeUndefined();
    expect(orbitTelemetry(fall, 0)).toBeUndefined();
  });
});

describe('orbital telemetry', () => {
  it('reads ground-relative speeds, no pad, and the orbit', () => {
    const start = sandboxStart();
    const local = orbitalScene(start, start, 0).current;
    const orbit = orbitTelemetry(start, 0);
    const t = orbitalFlightTelemetry(local, 0, 99_998.5, 1.6, orbit);
    expect(t.altitude).toBe(99_998.5);
    expect(t.verticalSpeed).toBeCloseTo(0, 6);
    expect(t.horizontalSpeed).toBeGreaterThan(1500);
    expect(t.pad).toBeUndefined();
    expect(t.padDistance).toBeUndefined();
    expect(t.safeSink).toBeUndefined();
    expect(t.orbit).toBe(orbit);
    expect(t.hoverThrottle).toBeCloseTo((1500 * 1.6) / 4500, 12);
  });
});
