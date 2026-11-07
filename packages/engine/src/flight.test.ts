import { describe, expect, it } from 'vitest';
import {
  MAX_FLIGHT_STEP,
  rateControlTorque,
  stepFlight,
  type FlightCommand,
  type FlightState,
  type GravityField,
  type VehicleParameters,
  type Vector3,
} from './index';

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
// Attitude propellant flow for torque T about an axis: |T| / (arm * exhaust velocity).
const attitudeFlow = (axis: 'x' | 'y' | 'z', torque: number) =>
  Math.abs(torque) / (vehicle.attitudeLeverArm[axis] * vehicle.attitudeExhaustVelocity);
const coast: FlightCommand = { throttle: 0, bodyTorque: zero };
const lunarAcceleration = { x: 0, y: -1.62, z: 0 };
const gravity: GravityField = { kind: 'uniform', acceleration: lunarAcceleration };
const weightless: GravityField = { kind: 'uniform', acceleration: zero };
const initial = (changes: Partial<FlightState> = {}): FlightState => ({
  position: { x: 0, y: 100, z: 0 },
  velocity: zero,
  orientation: { x: 0, y: 0, z: 0, w: 1 },
  angularVelocity: zero,
  fuelMass: 300,
  ...changes,
});
function simulate(
  state: FlightState,
  command = coast,
  seconds = 1,
  dt = MAX_FLIGHT_STEP,
  parameters = vehicle,
  acceleration = lunarAcceleration,
): FlightState {
  for (let n = 0; n < Math.round(seconds / dt); n++)
    state = stepFlight(
      state,
      command,
      parameters,
      { gravity: { kind: 'uniform', acceleration } },
      dt,
    );
  return state;
}
function expectVector(actual: Vector3, expected: Vector3, digits = 9) {
  for (const axis of ['x', 'y', 'z'] as const)
    expect(actual[axis]).toBeCloseTo(expected[axis], digits);
}

describe('free-flight independent references', () => {
  it('matches ballistic motion while preserving lateral momentum', () => {
    const result = simulate(initial({ velocity: { x: 3, y: -2, z: 4 } }), coast, 10);
    expectVector(result.position, { x: 30, y: -1, z: 40 });
    expectVector(result.velocity, { x: 3, y: -18.2, z: 4 });
    expect(result.fuelMass).toBe(300);
  });

  it('matches the rocket equation and its position integral with mass loss', () => {
    const result = simulate(initial(), { ...coast, throttle: 1 }, 20);
    const time = 20,
      massFlow = 1.5,
      finalMass = 1470;
    const logarithm = Math.log(1500 / finalMass);
    expect(result.fuelMass).toBeCloseTo(270, 9);
    expect(result.velocity.y).toBeCloseTo(3000 * logarithm - 1.62 * time, 9);
    expect(result.position.y).toBeCloseTo(
      100 + 3000 * (time - (finalMass / massFlow) * logarithm) - 0.81 * time ** 2,
      7,
    );
  });

  it.each([300, 30])('uses current mass for hover throttle with %s kg fuel', (fuelMass) => {
    const mass = 1200 + fuelMass;
    const throttle = (mass * 1.62) / 4500;
    const result = stepFlight(
      initial({ fuelMass }),
      { ...coast, throttle },
      vehicle,
      { gravity },
      MAX_FLIGHT_STEP,
    );
    // Holding the initial hover setting produces a tiny climb as fuel burns, not exact hover.
    const flow = (throttle * 4500) / 3000;
    const expected = 3000 * Math.log(mass / (mass - flow / 60)) - 1.62 / 60;
    expect(result.velocity.y).toBeCloseTo(expected, 10);
    expect(result.velocity.y).toBeGreaterThan(0);
  });

  it('rotates body thrust into the world and treats q and -q identically', () => {
    const q = { x: 0, y: 0, z: Math.SQRT1_2, w: Math.SQRT1_2 };
    const command = { ...coast, throttle: 1 };
    const a = simulate(initial({ orientation: q }), command);
    const b = simulate(initial({ orientation: { x: 0, y: 0, z: -q.z, w: -q.w } }), command);
    expect(a.velocity.x).toBeCloseTo(-3000 * Math.log(1500 / 1498.5), 9);
    expectVector(a.velocity, { x: b.velocity.x, y: -1.62, z: 0 });
    expectVector(a.position, b.position);
  });

  it('splits burnout inside a step, then coasts without negative fuel or phantom thrust', () => {
    const fuel = 0.01,
      burn = fuel / 1.5,
      dt = MAX_FLIGHT_STEP;
    const command = { ...coast, throttle: 1 };
    const result = stepFlight(initial({ fuelMass: fuel }), command, vehicle, { gravity }, dt);
    const dv = 3000 * Math.log((1200 + fuel) / 1200);
    const burnDistance = 3000 * (burn - (1200 / 1.5) * Math.log((1200 + fuel) / 1200));
    expect(result.fuelMass).toBe(0);
    expect(result.velocity.y).toBeCloseTo(dv - 1.62 * dt, 9);
    expect(result.position.y).toBeCloseTo(
      100 + burnDistance + dv * (dt - burn) - 0.81 * dt ** 2,
      8,
    );
    const after = simulate(result, command);
    expect(after.fuelMass).toBe(0);
    expect(after.velocity.y).toBeCloseTo(result.velocity.y - 1.62, 9);
  });

  it('handles empty tanks and exhaustion exactly on a tick boundary', () => {
    const everything = { throttle: 1, bodyTorque: { x: 900, y: -600, z: 900 } };
    expect(simulate(initial({ fuelMass: 0 }), everything)).toEqual(
      simulate(initial({ fuelMass: 0 })),
    );
    const result = stepFlight(
      initial({ fuelMass: 1.5 / 60 }),
      { ...coast, throttle: 1 },
      vehicle,
      { gravity },
      MAX_FLIGHT_STEP,
    );
    expect(result.fuelMass).toBe(0);
  });

  it.each(['x', 'y', 'z'] as const)('matches constant principal-axis torque about %s', (axis) => {
    const torque = { ...zero, [axis]: -vehicle.inertia[axis] * 0.5 };
    const result = simulate(initial(), { throttle: 0, bodyTorque: torque }, 2);
    expect(result.angularVelocity[axis]).toBeCloseTo(-1, 10);
    // alpha = -0.5 rad/s², theta = alpha*t²/2 = -1 rad.
    expect(result.orientation[axis]).toBeCloseTo(-Math.sin(0.5), 9);
    expect(result.orientation.w).toBeCloseTo(Math.cos(0.5), 9);
    // Pure couples spend propellant for either torque sign but add no net force.
    expect(result.fuelMass).toBeCloseTo(300 - attitudeFlow(axis, torque[axis]) * 2, 10);
    expectVector(result.velocity, { x: 0, y: -1.62 * 2, z: 0 });
  });

  it('includes attitude propellant in the rocket equation for the shared tank', () => {
    // Yaw about body +Y leaves the thrust axis vertical, so only the mass flow couples.
    const time = 10,
      massFlow = 1.5 + attitudeFlow('y', 600),
      finalMass = 1500 - massFlow * time;
    const result = simulate(initial(), { throttle: 1, bodyTorque: { x: 0, y: 600, z: 0 } }, time);
    expect(result.fuelMass).toBeCloseTo(300 - massFlow * time, 10);
    expect(result.velocity.y).toBeCloseTo((4500 / massFlow) * Math.log(1500 / finalMass) - 16.2, 9);
    expect(result.angularVelocity.y).toBeCloseTo(5, 10);
  });

  it('stops attitude torque when its propellant runs out inside a step', () => {
    const torque = { x: 900, y: 0, z: 0 },
      dt = MAX_FLIGHT_STEP,
      fuel = attitudeFlow('x', 900) * dt * 0.25;
    const command = { throttle: 0, bodyTorque: torque };
    const result = stepFlight(initial({ fuelMass: fuel }), command, vehicle, { gravity }, dt);
    expect(result.fuelMass).toBe(0);
    expect(result.angularVelocity.x).toBeCloseTo((900 / 1800) * dt * 0.25, 12);
    // Without propellant, rotation continues and cannot be braked.
    const later = simulate(result, { throttle: 0, bodyTorque: { x: -900, y: 0, z: 0 } });
    expect(later.angularVelocity.x).toBeCloseTo(result.angularVelocity.x, 12);
  });

  it('leaves exactly zero fuel after every in-step exhaustion', () => {
    for (let n = 1; n <= 500; n++) {
      const throttle = 0.3 + (n % 7) / 10;
      const torque = { x: (n % 5) * 150, y: 0, z: -(n % 3) * 200 };
      const flow = throttle * 1.5 + attitudeFlow('x', torque.x) + attitudeFlow('z', torque.z);
      const fuelMass = (flow * MAX_FLIGHT_STEP * n) / 501;
      const command = { throttle, bodyTorque: torque };
      const result = stepFlight(
        initial({ fuelMass }),
        command,
        vehicle,
        { gravity },
        MAX_FLIGHT_STEP,
      );
      expect(result.fuelMass).toBe(0);
    }
  });

  it('applies angular velocity in body axes, not world axes', () => {
    const state = initial({
      orientation: { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 },
      angularVelocity: { x: 1, y: 0, z: 0 },
    });
    const result = simulate(state);
    // q_y(pi/2) * q_x(1 rad); the negative world-Z term catches reversed multiplication.
    expect(result.orientation.x).toBeCloseTo(Math.SQRT1_2 * Math.sin(0.5), 9);
    expect(result.orientation.y).toBeCloseTo(Math.SQRT1_2 * Math.cos(0.5), 9);
    expect(result.orientation.z).toBeCloseTo(-Math.SQRT1_2 * Math.sin(0.5), 9);
    expect(result.orientation.w).toBeCloseTo(Math.SQRT1_2 * Math.cos(0.5), 9);
  });

  it('conserves torque-free rotational energy and world angular momentum', () => {
    const parameters = { ...vehicle, inertia: { x: 1200, y: 1800, z: 2400 } };
    const start = initial({ angularVelocity: { x: 0.4, y: 0.7, z: -0.2 } });
    const result = simulate(start, coast, 30, MAX_FLIGHT_STEP, parameters, zero);
    const energy = (s: FlightState) =>
      0.5 *
      (1200 * s.angularVelocity.x ** 2 +
        1800 * s.angularVelocity.y ** 2 +
        2400 * s.angularVelocity.z ** 2);
    expect(Math.abs(energy(result) / energy(start) - 1)).toBeLessThan(1e-8);
    const q = result.orientation,
      w = result.angularVelocity;
    const lx = 1200 * w.x,
      ly = 1800 * w.y,
      lz = 2400 * w.z;
    // Independent quaternion rotation of body angular momentum into the inertial frame.
    const world = {
      x:
        (1 - 2 * (q.y * q.y + q.z * q.z)) * lx +
        2 * (q.x * q.y - q.z * q.w) * ly +
        2 * (q.x * q.z + q.y * q.w) * lz,
      y:
        2 * (q.x * q.y + q.z * q.w) * lx +
        (1 - 2 * (q.x * q.x + q.z * q.z)) * ly +
        2 * (q.y * q.z - q.x * q.w) * lz,
      z:
        2 * (q.x * q.z - q.y * q.w) * lx +
        2 * (q.y * q.z + q.x * q.w) * ly +
        (1 - 2 * (q.x * q.x + q.y * q.y)) * lz,
    };
    expectVector(world, { x: 480, y: 1260, z: -480 }, 5);
    expect(Math.hypot(q.x, q.y, q.z, q.w)).toBeCloseTo(1, 14);
  });

  it('converges at fourth order against an analytical constant-rate rotation', () => {
    const state = initial({ angularVelocity: { x: 6, y: 0, z: 0 } });
    const error = (dt: number) => {
      const q = simulate(state, coast, 1, dt).orientation;
      return Math.hypot(q.x - Math.sin(3), q.w - Math.cos(3));
    };
    const coarse = error(1 / 60),
      fine = error(1 / 120);
    // RK4's phase error here is approximately 60*(0.05^5)/120 = 1.56e-7.
    expect(coarse).toBeLessThan(2e-7);
    expect(coarse / fine).toBeGreaterThan(14);
    expect(coarse / fine).toBeLessThan(18);
  });
});

describe('body-rate assistance', () => {
  const settings = {
    maxRate: { x: Math.PI / 6, y: Math.PI / 6, z: Math.PI / 6 },
    responseTime: 0.3,
  };
  it('limits torque without clamping angular velocity or teleporting orientation', () => {
    expect(rateControlTorque(zero, { x: 1, y: -1, z: 1 }, vehicle, settings)).toEqual({
      x: 900,
      y: -600,
      z: 900,
    });
    expect(rateControlTorque({ x: 2, y: -2, z: 0 }, zero, vehicle, settings)).toEqual({
      x: -900,
      y: 600,
      z: 0,
    });
  });
  it('tracks rate commands, then brakes to a tilted hold without cancelling translation', () => {
    let s = initial({ velocity: { x: 4, y: 0, z: 0 } });
    const tick = (input: Vector3) => {
      s = stepFlight(
        s,
        { throttle: 0, bodyTorque: rateControlTorque(s.angularVelocity, input, vehicle, settings) },
        vehicle,
        { gravity: weightless },
        MAX_FLIGHT_STEP,
      );
    };
    for (let n = 0; n < 300; n++) tick({ x: 1, y: 0, z: 0 });
    expect(s.angularVelocity.x).toBeCloseTo(Math.PI / 6, 5);
    const spun = s.angularVelocity.x;
    for (let n = 0; n < 300; n++) tick(zero);
    expect(Math.abs(s.angularVelocity.x)).toBeLessThan(1e-6);
    // Monotonic single-axis torque: propellant = I * |rate change| / (arm * exhaust velocity).
    const rateChange = spun + (spun - s.angularVelocity.x);
    expect(s.fuelMass).toBeCloseTo(300 - (1800 * rateChange) / (1.2 * 2500), 10);
    expect(Math.abs(s.orientation.x)).toBeGreaterThan(0.5);
    const held = s.orientation;
    for (let n = 0; n < 60; n++) tick(zero);
    expectVector(s.orientation, held, 6);
    expectVector(s.velocity, { x: 4, y: 0, z: 0 });
  });
});

describe('simulation boundary', () => {
  it('does not mutate or retain mutable aliases to inputs, and repeats deterministically', () => {
    const state = initial();
    for (const value of Object.values(state)) if (typeof value === 'object') Object.freeze(value);
    Object.freeze(state);
    const a = stepFlight(state, coast, vehicle, { gravity }, MAX_FLIGHT_STEP);
    expect(a).toEqual(stepFlight(state, coast, vehicle, { gravity }, MAX_FLIGHT_STEP));
    expect(a.position).not.toBe(state.position);
    expect(a.velocity).not.toBe(state.velocity);
    expect(a.orientation).not.toBe(state.orientation);
    expect(a.angularVelocity).not.toBe(state.angularVelocity);
  });
  it.each([0, -1, 1 / 30, NaN, Infinity])('rejects invalid dt %s', (dt) => {
    expect(() => stepFlight(initial(), coast, vehicle, { gravity }, dt)).toThrow(RangeError);
  });
  it('rejects invalid physical state, parameters, environment, and commands', () => {
    for (const s of [
      initial({ fuelMass: -1 }),
      initial({ fuelMass: 301 }),
      initial({ position: { x: NaN, y: 0, z: 0 } }),
      initial({ angularVelocity: { x: 0, y: Infinity, z: 0 } }),
      initial({ orientation: { x: 0, y: 0, z: 0, w: 2 } }),
    ]) {
      expect(() => stepFlight(s, coast, vehicle, { gravity }, MAX_FLIGHT_STEP)).toThrow(RangeError);
    }
    for (const v of [
      { ...vehicle, dryMass: 0 },
      { ...vehicle, exhaustVelocity: 0 },
      { ...vehicle, inertia: { x: 1, y: 1, z: 3 } },
      { ...vehicle, attitudeLeverArm: { x: 1, y: 0, z: 1 } },
      { ...vehicle, attitudeExhaustVelocity: 0 },
    ]) {
      expect(() => stepFlight(initial(), coast, v, { gravity }, MAX_FLIGHT_STEP)).toThrow(
        RangeError,
      );
    }
    for (const command of [
      { ...coast, throttle: 2 },
      { ...coast, throttle: NaN },
      { ...coast, bodyTorque: { x: 901, y: 0, z: 0 } },
    ]) {
      expect(() => stepFlight(initial(), command, vehicle, { gravity }, MAX_FLIGHT_STEP)).toThrow(
        RangeError,
      );
    }
    expect(() =>
      stepFlight(
        initial(),
        coast,
        vehicle,
        { gravity: { kind: 'uniform', acceleration: { x: Infinity, y: 0, z: 0 } } },
        MAX_FLIGHT_STEP,
      ),
    ).toThrow(RangeError);
    const settings = { maxRate: { x: 1, y: 1, z: 1 }, responseTime: 0.3 };
    expect(() => rateControlTorque(zero, { x: 2, y: 0, z: 0 }, vehicle, settings)).toThrow(
      RangeError,
    );
    expect(() =>
      rateControlTorque(zero, zero, vehicle, { ...settings, responseTime: 0.001 }),
    ).toThrow(RangeError);
  });
});
