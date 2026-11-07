import { describe, expect, it } from 'vitest';
import {
  bodyFixedEnvironment,
  bodyFixedToInertial,
  bodyFixedToSurfaceFrame,
  conjugate,
  cross,
  dot,
  gravityAcceleration,
  inertialEnvironment,
  inertialToBodyFixed,
  magnitude,
  MAX_FLIGHT_STEP,
  MOON,
  multiplyQuaternions,
  normalizeQuaternion,
  stepFlight,
  surfaceEnvironment,
  surfaceFrame,
  surfaceFrameToBodyFixed,
  type FlightCommand,
  type FlightEnvironment,
  type FlightState,
  type Quaternion,
  type VehicleParameters,
  type Vector3,
} from './index';

// Independent references: Kepler's laws and the vis-viva equation for two bodies,
// the radial parabolic escape r(t) = (r0^(3/2) + 3/2 sqrt(2 mu) t)^(2/3), and, for
// rotating frames, agreement with the same flight integrated in inertial space.

const zero = { x: 0, y: 0, z: 0 };
const upright = { x: 0, y: 0, z: 0, w: 1 };
const coast: FlightCommand = { throttle: 0, bodyTorque: zero };
const mu = MOON.gravitationalParameter;
const R = MOON.radius;
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
const state = (changes: Partial<FlightState>): FlightState => ({
  position: zero,
  velocity: zero,
  orientation: upright,
  angularVelocity: zero,
  fuelMass: 0,
  ...changes,
});
const fly = (
  s: FlightState,
  environment: FlightEnvironment,
  seconds: number,
  command = coast,
  onStep?: (s: FlightState, time: number) => void,
  dt = MAX_FLIGHT_STEP,
) => {
  const steps = Math.round(seconds / dt);
  for (let n = 1; n <= steps; n++) {
    s = stepFlight(s, command, vehicle, environment, dt);
    onStep?.(s, n * dt);
  }
  return s;
};
const distance = (a: Vector3, b: Vector3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const energy = (s: FlightState) => dot(s.velocity, s.velocity) / 2 - mu / magnitude(s.position);
// Rotation angle between two orientations, in radians. The vector part of the
// relative rotation resolves tiny angles; acos of the dot product cannot below ~1e-8.
const angleBetween = (a: Quaternion, b: Quaternion) => {
  const d = multiplyQuaternions(conjugate(a), b);
  return 2 * Math.asin(Math.min(1, Math.hypot(d.x, d.y, d.z)));
};
const inertial: FlightEnvironment = inertialEnvironment(MOON);

describe('gravity fields', () => {
  it('pulls toward the centre with μ/r², wherever the centre is', () => {
    const centre = { x: 10, y: -R, z: 5 };
    const field = { kind: 'central', centre, gravitationalParameter: mu } as const;
    const g = gravityAcceleration(field, { x: 10, y: 0, z: 5 });
    expect(g.x).toBeCloseTo(0, 18);
    expect(g.z).toBeCloseTo(0, 18);
    expect(g.y).toBeCloseTo(-mu / R ** 2, 12);
    expect(-g.y).toBeCloseTo(1.6242, 4);
    const diagonal = gravityAcceleration(field, { x: 10 + 3e6, y: -R + 4e6, z: 5 });
    expect(magnitude(diagonal)).toBeCloseTo(mu / 25e12, 12);
    expect(diagonal.x / diagonal.y).toBeCloseTo(3 / 4, 12);
  });

  it('gives the same acceleration everywhere when uniform', () => {
    const field = { kind: 'uniform', acceleration: { x: 0, y: -1.62, z: 0 } } as const;
    expect(gravityAcceleration(field, { x: 1e6, y: 3, z: -7 })).toEqual(field.acceleration);
  });
});

describe('two-body orbits in the inertial frame', () => {
  it('flies a circular orbit 100 km up once around in the Kepler period', () => {
    const r = R + 100_000;
    const speed = Math.sqrt(mu / r);
    const period = 2 * Math.PI * Math.sqrt(r ** 3 / mu);
    expect(speed).toBeCloseTo(1633.5, 1);
    expect(period / 60).toBeCloseTo(117.8, 1);
    const start = state({ position: { x: r, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: -speed } });
    let lowest = r;
    let highest = r;
    // Whole steps cover all but a fraction of a step; finish it with one short step.
    const steps = Math.floor(period / MAX_FLIGHT_STEP);
    let s = fly(start, inertial, steps * MAX_FLIGHT_STEP, coast, (s) => {
      lowest = Math.min(lowest, magnitude(s.position));
      highest = Math.max(highest, magnitude(s.position));
    });
    s = stepFlight(s, coast, vehicle, inertial, period - steps * MAX_FLIGHT_STEP);
    expect(distance(s.position, start.position)).toBeLessThan(1e-3);
    expect(distance(s.velocity, start.velocity)).toBeLessThan(1e-5);
    expect(highest - lowest).toBeLessThan(0.01);
  });

  it('keeps energy and angular momentum on a 15 × 100 km descent orbit', () => {
    const periapsis = R + 15_000;
    const apoapsis = R + 100_000;
    const a = (periapsis + apoapsis) / 2;
    // Vis-viva at apoapsis: v² = μ (2/r − 1/a).
    const speed = Math.sqrt(mu * (2 / apoapsis - 1 / a));
    const start = state({
      position: { x: 0, y: 0, z: apoapsis },
      velocity: { x: speed, y: 0, z: 0 },
    });
    const momentum = (s: FlightState) => cross(s.position, s.velocity);
    const e0 = energy(start);
    const h0 = momentum(start);
    expect(e0).toBeCloseTo(-mu / (2 * a), 6);
    const period = 2 * Math.PI * Math.sqrt(a ** 3 / mu);
    let lowest = Infinity;
    let periapsisTime = 0;
    let worstEnergy = 0;
    let worstMomentum = 0;
    fly(start, inertial, period, coast, (s, time) => {
      const r = magnitude(s.position);
      if (r < lowest) [lowest, periapsisTime] = [r, time];
      worstEnergy = Math.max(worstEnergy, Math.abs(energy(s) - e0) / Math.abs(e0));
      worstMomentum = Math.max(worstMomentum, distance(momentum(s), h0) / magnitude(h0));
    });
    expect(lowest - R).toBeCloseTo(15_000, -1);
    // Periapsis comes half a period after apoapsis (Kepler's second law), within a step.
    expect(Math.abs(periapsisTime - period / 2)).toBeLessThan(MAX_FLIGHT_STEP);
    expect(worstEnergy).toBeLessThan(1e-10);
    expect(worstMomentum).toBeLessThan(1e-10);
  });

  it('climbs away at escape speed along the radial parabola', () => {
    const r0 = R + 100_000;
    const escape = Math.sqrt((2 * mu) / r0);
    expect(escape).toBeCloseTo(2310.1, 1);
    const end = fly(
      state({ position: { x: 0, y: r0, z: 0 }, velocity: { x: 0, y: escape, z: 0 } }),
      inertial,
      600,
    );
    const expected = (r0 ** 1.5 + 1.5 * Math.sqrt(2 * mu) * 600) ** (2 / 3);
    expect(end.position.y / expected).toBeCloseTo(1, 10);
    expect(energy(end)).toBeCloseTo(0, 4);
  });
});

describe('flying in the Moon-fixed rotating frame', () => {
  const fixed: FlightEnvironment = bodyFixedEnvironment(MOON);
  const spinning = state({
    position: { x: R + 20_000, y: 3_000, z: -1_000 },
    velocity: { x: -40, y: 25, z: -1_600 },
    orientation: normalizeQuaternion({ x: 0.2, y: -0.4, z: 0.1, w: 0.9 }),
    angularVelocity: { x: 0.05, y: -0.02, z: 0.03 },
    fuelMass: 300,
  });

  // Both frames describe one motion, so after converting they must agree up to
  // integration error, which RK4 shrinks sixteenfold when the step halves.
  const compare = (command: FlightCommand, seconds: number, dt = MAX_FLIGHT_STEP) => {
    const inFixed = fly(spinning, fixed, seconds, command, undefined, dt);
    const start = bodyFixedToInertial(spinning, MOON, 0);
    const inInertial = fly(start, inertial, seconds, command, undefined, dt);
    const converted = bodyFixedToInertial(inFixed, MOON, seconds);
    return {
      position: distance(converted.position, inInertial.position),
      velocity: distance(converted.velocity, inInertial.velocity),
      angle: angleBetween(converted.orientation, inInertial.orientation),
      rates: distance(converted.angularVelocity, inInertial.angularVelocity),
      fuel: converted.fuelMass - inInertial.fuelMass,
    };
  };

  it('agrees with the same coasting tumble integrated in inertial space', () => {
    const gap = compare(coast, 300);
    expect(gap.position).toBeLessThan(1e-6);
    expect(gap.velocity).toBeLessThan(1e-9);
    expect(gap.angle).toBeLessThan(1e-10);
    expect(gap.rates).toBeLessThan(1e-14);
  });

  it('agrees under thrust and torque, converging at fourth order', () => {
    // Thrust follows the orientation, so every rotating-frame term matters here.
    const command: FlightCommand = { throttle: 0.7, bodyTorque: { x: 200, y: -150, z: 80 } };
    const coarse = compare(command, 300);
    const fine = compare(command, 300, MAX_FLIGHT_STEP / 2);
    expect(coarse.position).toBeLessThan(1e-3);
    expect(coarse.velocity).toBeLessThan(1e-5);
    expect(coarse.angle).toBeLessThan(1e-7);
    expect(coarse.fuel).toBe(0);
    expect(coarse.position / fine.position).toBeGreaterThan(12);
    expect(coarse.velocity / fine.velocity).toBeGreaterThan(12);
    expect(coarse.angle / fine.angle).toBeGreaterThan(12);
  });

  it('keeps the Jacobi constant while coasting', () => {
    // In a steadily turning frame, ½v² − μ/r − ½|Ω × r|² is conserved.
    const omega = { x: 0, y: MOON.rotationRate, z: 0 };
    const jacobi = (s: FlightState) => {
      const swirl = cross(omega, s.position);
      return energy(s) - dot(swirl, swirl) / 2;
    };
    const start = { ...spinning, fuelMass: 0 };
    const end = fly(start, fixed, 1200);
    expect(Math.abs(jacobi(end) / jacobi(start) - 1)).toBeLessThan(1e-11);
  });

  it('sees ground-level rest as moving with the surface in inertial space', () => {
    const resting = state({ position: { x: R, y: 0, z: 0 } });
    const seen = bodyFixedToInertial(resting, MOON, 0);
    // The equator turns at ΩR ≈ 4.62 m/s, eastward (body −Z at longitude 0).
    expect(seen.velocity.z).toBeCloseTo(-MOON.rotationRate * R, 12);
    expect(-seen.velocity.z).toBeCloseTo(4.624, 3);
  });

  it('flies the same in a surface frame as in the body-fixed frame', () => {
    const site = surfaceFrame(MOON, { latitude: 0.6, longitude: -1.1, altitude: -2_000 });
    const local = { ...surfaceEnvironment(MOON, site) };
    // Local gravity at the site points straight down, and the spin axis tilts by latitude.
    const g = gravityAcceleration(local.gravity, zero);
    expect(g.x).toBeCloseTo(0, 12);
    expect(g.z).toBeCloseTo(0, 12);
    expect(g.y).toBeCloseTo(-mu / (R - 2_000) ** 2, 12);
    expect(local.rotation!.angularVelocity.x).toBeCloseTo(0, 18);
    expect(local.rotation!.angularVelocity.y).toBeCloseTo(MOON.rotationRate * Math.sin(0.6), 18);
    expect(local.rotation!.angularVelocity.z).toBeCloseTo(-MOON.rotationRate * Math.cos(0.6), 18);

    const hop = state({
      position: { x: 30, y: 500, z: -40 },
      velocity: { x: 12, y: -8, z: 5 },
      orientation: normalizeQuaternion({ x: 0.05, y: 0.3, z: -0.02, w: 0.95 }),
      angularVelocity: { x: 0.01, y: 0.02, z: -0.01 },
      fuelMass: 200,
    });
    const command: FlightCommand = { throttle: 0.5, bodyTorque: { x: 50, y: 0, z: -30 } };
    const inLocal = fly(hop, local, 60, command);
    const inFixed = fly(surfaceFrameToBodyFixed(hop, site), fixed, 60, command);
    const back = bodyFixedToSurfaceFrame(inFixed, site);
    expect(distance(back.position, inLocal.position)).toBeLessThan(1e-5);
    expect(distance(back.velocity, inLocal.velocity)).toBeLessThan(1e-7);
    expect(angleBetween(back.orientation, inLocal.orientation)).toBeLessThan(1e-9);
  });
});

describe('validation', () => {
  it('rejects a position at the centre and non-physical fields or rotations', () => {
    const at = (position: Vector3) => state({ position });
    expect(() => stepFlight(at(zero), coast, vehicle, inertial, MAX_FLIGHT_STEP)).toThrow(
      RangeError,
    );
    const badFields: FlightEnvironment[] = [
      { gravity: { kind: 'central', centre: zero, gravitationalParameter: 0 } },
      { gravity: { kind: 'central', centre: { x: NaN, y: 0, z: 0 }, gravitationalParameter: mu } },
      {
        ...inertial,
        rotation: { angularVelocity: { x: 0, y: Infinity, z: 0 }, axisPoint: zero },
      },
    ];
    for (const environment of badFields) {
      expect(() =>
        stepFlight(at({ x: R, y: 0, z: 0 }), coast, vehicle, environment, MAX_FLIGHT_STEP),
      ).toThrow(RangeError);
    }
    expect(() => inertialToBodyFixed(at({ x: R, y: 0, z: 0 }), MOON, NaN)).toThrow(RangeError);
  });
});
