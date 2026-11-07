import { describe, expect, it } from 'vitest';
import {
  bodyFixedEnvironment,
  inertialToBodyFixed,
  magnitude,
  MOON,
  stateFromOrbit,
  toRadians,
  type FlightState,
  type OrbitalElements,
} from '@gravitas/engine';
import { ATTITUDE, LANDER } from './lander';
import { idlePilot } from './pilots';
import { LANDING_LIMITS } from './rules';
import { FIRST_DESCENT } from './scenario';
import {
  FIXED_STEP,
  FlightSession,
  PHYSICS_WARP_LIMIT,
  RAILS_MAX_RATE,
  type FlightScenario,
  type PilotInput,
} from './session';

const idle: PilotInput = { rates: { x: 0, y: 0, z: 0 }, throttleChange: 0 };
const frame = 1 / 60;
const run = (session: FlightSession, frames: number, input = idle) => {
  for (let n = 0; n < frames; n++) session.advance(frame, input);
};
const distance = (a: FlightState['position'], b: FlightState['position']) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

// A 15 × 100 km lunar orbit, starting at apoapsis, flown in the Moon-fixed frame.
const R = MOON.radius;
const elements: OrbitalElements = {
  periapsis: R + 15_000,
  eccentricity: 85_000 / (2 * R + 115_000),
  inclination: toRadians(20),
  ascendingNode: 0.5,
  argumentOfPeriapsis: 1,
  trueAnomaly: Math.PI,
};
const inOrbit = (changes: Partial<FlightState> = {}, railsFloor = 20_000): FlightScenario => ({
  start: inertialToBodyFixed(
    {
      ...stateFromOrbit(elements, MOON.gravitationalParameter),
      orientation: { x: 0, y: 0, z: 0, w: 1 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      fuelMass: 60,
      ...changes,
    },
    MOON,
    0,
  ),
  vehicle: LANDER,
  attitude: ATTITUDE,
  environment: bodyFixedEnvironment(MOON),
  limits: LANDING_LIMITS,
  orbit: { body: MOON, frame: 'body-fixed', railsFloor },
});
const flying = (scenario: FlightScenario) => {
  const session = new FlightSession(scenario);
  session.start();
  return session;
};

describe('physics warp', () => {
  it('flies the same ticks faster: 4× for 1 s equals 1× for 4 s', () => {
    const input: PilotInput = { rates: { x: 0.5, y: 0, z: -0.3 }, throttleChange: 1 };
    const real = flying(FIRST_DESCENT);
    const warped = flying(FIRST_DESCENT);
    expect(warped.requestWarp(4)).toBe(true);
    run(real, 240, input);
    run(warped, 60, input);
    expect(warped.ticks).toBe(240);
    expect(warped.state).toEqual(real.state);
    expect(warped.throttle).toBe(real.throttle);
    expect(warped.time).toBe(real.time);
  });

  it('drops to 1× at first contact, with the same verdict as real time', () => {
    const real = flying(FIRST_DESCENT);
    const warped = flying(FIRST_DESCENT);
    warped.requestWarp(4);
    for (let n = 0; n < 1200 && real.phase === 'flying'; n++) real.advance(frame, idlePilot(real));
    for (let n = 0; n < 1200 && warped.phase === 'flying'; n++)
      warped.advance(frame, idlePilot(warped));
    expect(warped.warp).toBe(1);
    expect(warped.outcome).toEqual(real.outcome);
    expect(warped.flightTime).toBe(real.flightTime);
  });

  it('is the only warp without an orbit', () => {
    const session = flying(FIRST_DESCENT);
    expect(session.railsBlocker).toBe('no-orbit');
    expect(session.requestWarp(10)).toBe(false);
    expect(session.requestWarp(PHYSICS_WARP_LIMIT)).toBe(true);
  });
});

describe('rails warp', () => {
  it('coasts where the physics would have flown', () => {
    const physics = flying(inOrbit());
    const rails = flying(inOrbit());
    expect(rails.requestWarp(100)).toBe(true);
    run(rails, 60); // 1 s of wall time: 100 s simulated
    run(physics, 6000);
    expect(rails.ticks).toBe(0);
    expect(rails.time).toBeCloseTo(100, 9);
    expect(physics.time).toBeCloseTo(100, 9);
    expect(distance(rails.state.position, physics.state.position)).toBeLessThan(1e-3);
    expect(distance(rails.state.velocity, physics.state.velocity)).toBeLessThan(1e-6);
    expect(rails.state.fuelMass).toBe(physics.state.fuelMass);
    // Nothing to blend between: the picture shows the coasted state.
    expect(rails.previous).toBe(rails.state);
    expect(rails.alpha).toBe(0);
  });

  it('drops to 1× on any input and flies that input in the same frame', () => {
    const session = flying(inOrbit());
    session.requestWarp(1000);
    run(session, 10);
    expect(session.warp).toBe(1000);
    session.advance(frame, { rates: { x: 1, y: 0, z: 0 }, throttleChange: 0 });
    expect(session.warp).toBe(1);
    expect(session.ticks).toBe(1);
    expect(session.state.angularVelocity.x).toBeGreaterThan(0);
    session.requestWarp(1000);
    session.advance(frame, { ...idle, throttleSet: 0 });
    expect(session.warp).toBe(1);
  });

  it('needs the lever closed, the spin braked, and height above the floor', () => {
    const lever = flying(inOrbit());
    lever.advance(frame, { ...idle, throttleSet: 0.3 });
    expect(lever.railsBlocker).toBe('throttle');
    expect(lever.requestWarp(10)).toBe(false);
    expect(lever.requestWarp(2)).toBe(true);

    const spinning = flying(inOrbit({ angularVelocity: { x: 0, y: RAILS_MAX_RATE * 1.5, z: 0 } }));
    expect(spinning.railsBlocker).toBe('rotation');
    const slow = flying(inOrbit({ angularVelocity: { x: 0, y: RAILS_MAX_RATE * 0.5, z: 0 } }));
    expect(slow.railsBlocker).toBeUndefined();

    const low = flying(inOrbit({}, 150_000));
    expect(low.railsBlocker).toBe('altitude');

    const ready = new FlightSession(inOrbit());
    expect(ready.railsBlocker).toBe('not-flying');
    expect(ready.requestWarp(4)).toBe(false);
  });

  it('keeps a slow spin turning while it coasts', () => {
    const spin = RAILS_MAX_RATE * 0.5;
    const session = flying(inOrbit({ angularVelocity: { x: 0, y: spin, z: 0 } }));
    session.requestWarp(10);
    run(session, 60);
    // Yaw about body +Y is a principal axis: the spin stays put, and the body turns.
    expect(session.state.angularVelocity.y).toBeCloseTo(spin, 12);
    expect(session.state.fuelMass).toBe(60);
  });

  it('stops exactly at the floor on the way down, then refuses rails', () => {
    const session = flying(inOrbit());
    session.requestWarp(1000);
    let frames = 0;
    while (session.warp === 1000 && frames < 10_000) {
      session.advance(frame, idle);
      frames++;
    }
    expect(session.warp).toBe(1);
    expect(magnitude(session.state.position) - R).toBeCloseTo(20_000, 3);
    // Half an orbit from apoapsis takes about 57 minutes; the floor comes before periapsis.
    expect(session.time).toBeGreaterThan(2_500);
    expect(session.time).toBeLessThan(3_412);
    expect(session.requestWarp(10)).toBe(false);
    expect(session.railsBlocker).toBe('altitude');
  });

  it('resets to 1× on pause and restart, and counts rails time in the flight time', () => {
    const session = flying(inOrbit());
    session.requestWarp(100);
    run(session, 30);
    expect(session.flightTime).toBeCloseTo(50, 9);
    session.pause();
    expect(session.warp).toBe(1);
    expect(session.requestWarp(100)).toBe(false);
    session.resume();
    session.requestWarp(100);
    session.restart();
    expect(session.warp).toBe(1);
    expect(session.time).toBe(0);
    expect(FIXED_STEP).toBeGreaterThan(0);
  });
});
