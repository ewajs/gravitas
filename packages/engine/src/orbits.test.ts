import { describe, expect, it } from 'vitest';
import {
  bodyFixedEnvironment,
  bodyFixedToInertial,
  coastOnRails,
  conjugate,
  inertialEnvironment,
  inertialToBodyFixed,
  magnitude,
  MAX_FLIGHT_STEP,
  MOON,
  multiplyQuaternions,
  normalizeQuaternion,
  orbitFromState,
  orbitOf,
  propagateKepler,
  stateFromOrbit,
  stepFlight,
  timeToAltitude,
  timeToRadius,
  toRadians,
  type FlightEnvironment,
  type FlightState,
  type OrbitalElements,
  type OrbitalState,
  type Quaternion,
  type VehicleParameters,
  type Vector3,
} from './index';

// Independent references: vis-viva and Kepler's third law for sizes and periods,
// the radial parabola for escape, RK4 integration of the same flight (5.1's
// verified dynamics) for propagation, and round trips for the elements.

const mu = MOON.gravitationalParameter;
const R = MOON.radius;
const zero = { x: 0, y: 0, z: 0 };
const vehicle: VehicleParameters = {
  dryMass: 1200,
  fuelCapacity: 300,
  maxThrust: 4500,
  exhaustVelocity: 3000,
  inertia: { x: 1800, y: 1200, z: 1800 },
  maxTorque: { x: 900, y: 600, z: 900 },
  attitudeLeverArm: { x: 1.2, y: 0.8, z: 1.2 },
  attitudeExhaustVelocity: 2500,
};
const coast = { throttle: 0, bodyTorque: zero };
const distance = (a: Vector3, b: Vector3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const angleBetween = (a: Quaternion, b: Quaternion) => {
  const d = multiplyQuaternions(conjugate(a), b);
  return 2 * Math.asin(Math.min(1, Math.hypot(d.x, d.y, d.z)));
};
const flight = (s: OrbitalState, changes: Partial<FlightState> = {}): FlightState => ({
  ...s,
  orientation: { x: 0, y: 0, z: 0, w: 1 },
  angularVelocity: zero,
  fuelMass: 0,
  ...changes,
});
const integrate = (s: FlightState, environment: FlightEnvironment, seconds: number) => {
  const steps = Math.floor(seconds / MAX_FLIGHT_STEP + 1e-9);
  for (let n = 0; n < steps; n++) s = stepFlight(s, coast, vehicle, environment, MAX_FLIGHT_STEP);
  const rest = seconds - steps * MAX_FLIGHT_STEP;
  return rest > 1e-12 ? stepFlight(s, coast, vehicle, environment, rest) : s;
};
// A 15 × 100 km descent orbit, inclined 30°, starting at apoapsis.
const descent: OrbitalElements = {
  periapsis: R + 15_000,
  eccentricity: (100_000 - 15_000) / (2 * R + 115_000),
  inclination: toRadians(30),
  ascendingNode: toRadians(40),
  argumentOfPeriapsis: toRadians(70),
  trueAnomaly: Math.PI,
};

describe('orbital elements', () => {
  it('measures the 15 × 100 km descent orbit by vis-viva and Kepler', () => {
    const orbit = orbitFromState(stateFromOrbit(descent, mu), mu);
    const a = R + 57_500;
    expect(orbit.periapsis - R).toBeCloseTo(15_000, 4);
    expect(orbit.apoapsis - R).toBeCloseTo(100_000, 4);
    expect(orbit.semiMajorAxis).toBeCloseTo(a, 4);
    expect(orbit.period).toBeCloseTo(2 * Math.PI * Math.sqrt(a ** 3 / mu), 6);
    expect(orbit.period / 60).toBeCloseTo(113.7, 1);
    expect(orbit.specificEnergy).toBeCloseTo(-mu / (2 * a), 4);
    // At apoapsis: half a period to periapsis, a full one to the next apoapsis.
    expect(orbit.timeToPeriapsis).toBeCloseTo(orbit.period / 2, 6);
    // Exactly at apoapsis, rounding puts the next one either now or a period away.
    const toApoapsis = orbit.timeToApoapsis!;
    expect(Math.min(toApoapsis, orbit.period - toApoapsis)).toBeCloseTo(0, 4);
  });

  it('round-trips elements through position and velocity, special cases included', () => {
    const cases: OrbitalElements[] = [
      descent,
      { ...descent, trueAnomaly: 0.3 },
      { ...descent, inclination: Math.PI / 2, trueAnomaly: 4 }, // polar
      { ...descent, inclination: toRadians(150), trueAnomaly: 2 }, // retrograde
      // Equatorial: no node; periapsis measured from +X.
      { ...descent, inclination: 0, ascendingNode: 0, argumentOfPeriapsis: 1.2 },
      { ...descent, inclination: Math.PI, ascendingNode: 0, argumentOfPeriapsis: 5.5 },
      // Circular: no periapsis; the anomaly counts from the node.
      { ...descent, eccentricity: 0, argumentOfPeriapsis: 0, trueAnomaly: 2.5 },
      // Circular and equatorial: the anomaly counts from +X.
      { ...descent, eccentricity: 0, inclination: 0, ascendingNode: 0, argumentOfPeriapsis: 0 },
      // Escaping on a hyperbola, approaching and leaving.
      { ...descent, eccentricity: 1.4, trueAnomaly: -1.2 },
      { ...descent, eccentricity: 1.4, trueAnomaly: 1.0 },
    ];
    for (const elements of cases) {
      const orbit = orbitFromState(stateFromOrbit(elements, mu), mu);
      expect(orbit.periapsis).toBeCloseTo(elements.periapsis, 4);
      expect(orbit.eccentricity).toBeCloseTo(elements.eccentricity, 12);
      expect(orbit.inclination).toBeCloseTo(elements.inclination, 10);
      for (const angle of ['ascendingNode', 'argumentOfPeriapsis', 'trueAnomaly'] as const) {
        // Compare angles on the circle, so 2π and 0 agree.
        const gap = orbit[angle] - elements[angle];
        expect(Math.sin(gap)).toBeCloseTo(0, 9);
        expect(Math.cos(gap)).toBeCloseTo(1, 9);
      }
    }
  });

  it('agrees on the orbit whether the state is given Moon-fixed or inertial', () => {
    const inertial = flight(stateFromOrbit(descent, mu));
    const time = 5_000;
    const fixed = inertialToBodyFixed(inertial, MOON, time);
    const a = orbitOf(inertial, MOON, 'inertial', time);
    const b = orbitOf(fixed, MOON, 'body-fixed', time);
    expect(b.periapsis).toBeCloseTo(a.periapsis, 5);
    expect(b.eccentricity).toBeCloseTo(a.eccentricity, 12);
    expect(b.ascendingNode).toBeCloseTo(a.ascendingNode, 10);
    expect(b.trueAnomaly).toBeCloseTo(a.trueAnomaly, 10);
  });

  it('rejects a straight-down fall, which has no orbital plane, and bad elements', () => {
    const fall = { position: { x: R + 1000, y: 0, z: 0 }, velocity: { x: -10, y: 0, z: 0 } };
    expect(() => orbitFromState(fall, mu)).toThrow(RangeError);
    expect(() => stateFromOrbit({ ...descent, eccentricity: 2, trueAnomaly: 2.2 }, mu)).toThrow(
      RangeError,
    );
    expect(() => stateFromOrbit({ ...descent, inclination: 4 }, mu)).toThrow(RangeError);
  });
});

describe('Kepler propagation', () => {
  it('matches RK4 integration around the descent orbit', () => {
    const start = stateFromOrbit(descent, mu);
    for (const seconds of [60, 1_800, 3_407]) {
      const kepler = propagateKepler(start, mu, seconds);
      const rk4 = integrate(flight(start), inertialEnvironment(MOON), seconds);
      expect(distance(kepler.position, rk4.position)).toBeLessThan(1e-3);
      expect(distance(kepler.velocity, rk4.velocity)).toBeLessThan(1e-6);
    }
  });

  it('matches RK4 on an escape hyperbola and the radial parabola at escape speed', () => {
    const hyperbola = stateFromOrbit({ ...descent, eccentricity: 1.3, trueAnomaly: -0.5 }, mu);
    const kepler = propagateKepler(hyperbola, mu, 900);
    const rk4 = integrate(flight(hyperbola), inertialEnvironment(MOON), 900);
    expect(distance(kepler.position, rk4.position)).toBeLessThan(1e-3);

    // Nearly radial at escape speed: a parabola whose radius follows (r0^1.5 + 1.5√(2μ)t)^(2/3).
    const r0 = R + 100_000;
    const escape = Math.sqrt((2 * mu) / r0);
    const sideways = 1e-6; // just enough angular momentum to define the orbit
    const radial = {
      position: { x: r0, y: 0, z: 0 },
      velocity: { x: escape * Math.sqrt(1 - sideways ** 2), y: 0, z: -escape * sideways },
    };
    const end = propagateKepler(radial, mu, 600);
    const expected = (r0 ** 1.5 + 1.5 * Math.sqrt(2 * mu) * 600) ** (2 / 3);
    expect(magnitude(end.position) / expected).toBeCloseTo(1, 9);
  });

  it('returns to the same place after whole periods, and is exact at zero time', () => {
    const start = stateFromOrbit(descent, mu);
    const period = orbitFromState(start, mu).period;
    const later = propagateKepler(start, mu, 25 * period + 1_000);
    const once = propagateKepler(start, mu, 1_000);
    expect(distance(later.position, once.position)).toBeLessThan(1e-3);
    expect(propagateKepler(start, mu, 0)).toEqual(start);
    expect(() => propagateKepler(start, mu, -1)).toThrow(RangeError);
  });
});

describe('time to periapsis, apoapsis, and an altitude', () => {
  const start = stateFromOrbit({ ...descent, trueAnomaly: 2 }, mu);
  const orbit = orbitFromState(start, mu);

  it('arrives at periapsis and apoapsis when predicted', () => {
    const atPeriapsis = propagateKepler(start, mu, orbit.timeToPeriapsis!);
    const atApoapsis = propagateKepler(start, mu, orbit.timeToApoapsis!);
    expect(magnitude(atPeriapsis.position)).toBeCloseTo(orbit.periapsis, 4);
    expect(magnitude(atApoapsis.position)).toBeCloseTo(orbit.apoapsis, 4);
  });

  it('finds the next descent through an altitude, and none above apoapsis or below periapsis', () => {
    const seconds = timeToRadius(orbit, mu, R + 40_000)!;
    const there = propagateKepler(start, mu, seconds);
    expect(magnitude(there.position) - R).toBeCloseTo(40_000, 4);
    // Descending: the radius is shrinking there.
    expect(
      there.position.x * there.velocity.x +
        there.position.y * there.velocity.y +
        there.position.z * there.velocity.z,
    ).toBeLessThan(0);
    // Nothing earlier: sample the way there.
    for (let t = 0; t < seconds; t += 10) {
      const p = propagateKepler(start, mu, t);
      const r = magnitude(p.position);
      const falling =
        p.position.x * p.velocity.x + p.position.y * p.velocity.y + p.position.z * p.velocity.z < 0;
      expect(falling && r < R + 40_000).toBe(false);
    }
    expect(timeToRadius(orbit, mu, R + 150_000)).toBeUndefined();
    expect(timeToRadius(orbit, mu, R + 10_000)).toBeUndefined();
    const circle = orbitFromState(stateFromOrbit({ ...descent, eccentricity: 0 }, mu), mu);
    expect(timeToRadius(circle, mu, R + 10_000)).toBeUndefined();
  });

  it('wraps flight states in either frame', () => {
    const fixed = inertialToBodyFixed(flight(start), MOON, 300);
    const seconds = timeToAltitude(fixed, MOON, 'body-fixed', 300, 40_000)!;
    expect(seconds).toBeCloseTo(timeToRadius(orbit, mu, R + 40_000)!, 6);
  });
});

describe('coasting on rails', () => {
  const start = flight(stateFromOrbit(descent, mu), {
    orientation: normalizeQuaternion({ x: 0.2, y: -0.3, z: 0.1, w: 0.9 }),
    // About 0.08°/s: slow enough to warp, still turning.
    angularVelocity: { x: 0.001, y: -0.0008, z: 0.0006 },
    fuelMass: 120,
  });

  it('matches RK4 coasting in inertial space, spin included', () => {
    const seconds = 1_200;
    const rails = coastOnRails(start, vehicle.inertia, MOON, 'inertial', 0, seconds);
    const rk4 = integrate(start, inertialEnvironment(MOON), seconds);
    expect(distance(rails.position, rk4.position)).toBeLessThan(1e-3);
    expect(distance(rails.velocity, rk4.velocity)).toBeLessThan(1e-6);
    expect(angleBetween(rails.orientation, rk4.orientation)).toBeLessThan(1e-9);
    expect(distance(rails.angularVelocity, rk4.angularVelocity)).toBeLessThan(1e-12);
    expect(rails.fuelMass).toBe(120);
  });

  it('matches RK4 coasting in the Moon-fixed frame', () => {
    const fixed = inertialToBodyFixed(start, MOON, 1_000);
    const seconds = 900;
    const rails = coastOnRails(fixed, vehicle.inertia, MOON, 'body-fixed', 1_000, seconds);
    const rk4 = integrate(fixed, bodyFixedEnvironment(MOON), seconds);
    expect(distance(rails.position, rk4.position)).toBeLessThan(1e-3);
    expect(distance(rails.velocity, rk4.velocity)).toBeLessThan(1e-6);
    expect(angleBetween(rails.orientation, rk4.orientation)).toBeLessThan(1e-8);
    // The same instant seen from inertial space agrees too.
    const seen = bodyFixedToInertial(rails, MOON, 1_000 + seconds);
    expect(distance(seen.position, bodyFixedToInertial(rk4, MOON, 1_900).position)).toBeLessThan(
      1e-3,
    );
  });

  it('keeps a still vehicle exactly still in inertial space', () => {
    const still = { ...start, angularVelocity: zero };
    const rails = coastOnRails(still, vehicle.inertia, MOON, 'inertial', 0, 3_000);
    expect(rails.orientation).toEqual(still.orientation);
    expect(rails.angularVelocity).toEqual(zero);
  });
});
