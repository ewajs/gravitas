import { describe, expect, it } from 'vitest';
import {
  classifyTouchdown,
  contactFacts,
  MAX_FLIGHT_STEP,
  NO_TOUCHDOWN,
  stepFlight,
  toRadians,
  updateTouchdown,
  type ContactFact,
  type ContactPoint,
  type FlightEnvironment,
  type FlightState,
  type TouchdownLimits,
  type TouchdownRecord,
  type VehicleParameters,
} from './index';

const limits: TouchdownLimits = {
  maxVerticalSpeed: 2,
  maxHorizontalSpeed: 1,
  maxTilt: toRadians(10),
  maxLegImpactSpeed: 5,
  maxRestingTilt: toRadians(60),
  settleTime: 1,
  restSpeed: 0.1,
  restAngularSpeed: 0.05,
  airborneReset: 1,
};
const settled = (touchdown: TouchdownRecord['touchdown']): TouchdownRecord => ({
  ...NO_TOUCHDOWN,
  touchdown,
  peakLegImpact: touchdown?.verticalSpeed ?? 0,
  settledFor: 1,
});
const at = (verticalSpeed: number, horizontalSpeed: number, tiltDegrees: number) => ({
  verticalSpeed,
  horizontalSpeed,
  tilt: toRadians(tiltDegrees),
});

describe('touchdown classification boundaries', () => {
  it('passes values exactly at each limit and fails just beyond', () => {
    expect(classifyTouchdown(settled(at(2, 1, 10)), limits).status).toBe('landed');
    expect(classifyTouchdown(settled(at(2.01, 1, 10)), limits)).toMatchObject({
      status: 'rough',
      exceeded: ['verticalSpeed'],
    });
    expect(classifyTouchdown(settled(at(1, 1.01, 10.1)), limits)).toMatchObject({
      status: 'rough',
      exceeded: ['horizontalSpeed', 'tilt'],
    });
  });

  it('waits for the settle time before judging a clean touchdown', () => {
    const almost = { ...settled(at(1, 0, 0)), settledFor: 0.99 };
    expect(classifyTouchdown(almost, limits).status).toBe('touching');
    expect(classifyTouchdown({ ...almost, settledFor: 1 }, limits).status).toBe('landed');
  });

  it('crashes at once, preferring hull contact, then leg impact, then tipping', () => {
    const base = { ...NO_TOUCHDOWN, touchdown: at(6, 0, 0), settledFor: 0 };
    expect(
      classifyTouchdown(
        { ...base, hullContact: 'engine-bell', peakLegImpact: 6, tipped: true },
        limits,
      ),
    ).toMatchObject({ status: 'crashed', cause: 'hull' });
    expect(classifyTouchdown({ ...base, peakLegImpact: 5.01, tipped: true }, limits)).toMatchObject(
      { status: 'crashed', cause: 'impact' },
    );
    expect(classifyTouchdown({ ...base, peakLegImpact: 5, tipped: true }, limits)).toMatchObject({
      status: 'crashed',
      cause: 'tipped',
    });
  });

  it('is airborne before any leg touches and after a hop', () => {
    expect(classifyTouchdown(NO_TOUCHDOWN, limits).status).toBe('airborne');
    expect(classifyTouchdown({ ...settled(at(1, 0, 0)), airborneFor: 0.2 }, limits).status).toBe(
      'airborne',
    );
  });
});

describe('touchdown record', () => {
  const state: FlightState = {
    position: { x: 0, y: 1.47, z: 0 },
    orientation: { x: 0, y: 0, z: 0, w: 1 },
    velocity: { x: 0.6, y: -0.8, z: 0 },
    angularVelocity: { x: 0, y: 0, z: 0 },
    fuelMass: 100,
  };
  const leg = (id: string, normalForce: number, approachSpeed = 0.8): ContactFact => ({
    id,
    kind: 'leg',
    position: { x: 0, y: 0, z: 0 },
    penetration: normalForce > 0 ? 0.01 : 0,
    normalForce,
    approachSpeed,
    slipSpeed: 0,
  });

  it('captures the first leg contact and the peak leg impact', () => {
    const tick = (after: FlightState, facts: ContactFact[], before = after) => ({
      before,
      beforeFacts: facts.map((fact) => ({ ...fact, normalForce: 0 })),
      after,
      afterFacts: facts,
    });
    const first = updateTouchdown(
      NO_TOUCHDOWN,
      tick({ ...state, velocity: { x: 0, y: -0.2, z: 0 } }, [leg('a', 100), leg('b', 0)], state),
      0.1,
      limits,
    );
    // Speeds from the state before contact, not the braked end of the tick.
    expect(first.touchdown).toEqual({ verticalSpeed: 0.8, horizontalSpeed: 0.6, tilt: 0 });
    const later = updateTouchdown(
      first,
      tick({ ...state, velocity: { x: 0, y: -3, z: 0 } }, [leg('a', 100, 3), leg('b', 100, 2)]),
      0.1,
      limits,
    );
    expect(later.touchdown).toEqual(first.touchdown); // First contact is kept.
    expect(later.peakLegImpact).toBe(3);
  });

  it('starts a fresh record after a touch-and-go clears the ground long enough', () => {
    // 0.125 s ticks sum exactly in binary: seven clear ticks are 0.875 s, eight are 1 s.
    const tick = (facts: ContactFact[]) => ({
      before: state,
      beforeFacts: facts,
      after: state,
      afterFacts: facts,
    });
    let record = updateTouchdown(NO_TOUCHDOWN, tick([leg('a', 100)]), 0.125, limits);
    for (let n = 0; n < 7; n++)
      record = updateTouchdown(record, tick([leg('a', 0)]), 0.125, limits);
    expect(record.touchdown).not.toBeNull();
    record = updateTouchdown(record, tick([leg('a', 0)]), 0.125, limits);
    expect(record.touchdown).toBeNull();
  });
});

describe('touchdowns simulated with the contact model', () => {
  const legPoint = (id: string, x: number, z: number): ContactPoint => ({
    id,
    kind: 'leg',
    position: { x, y: -1.5, z },
    stiffness: 20000,
    damping: 4000,
    reboundDamping: 25000,
    friction: 0.6,
  });
  const vehicle: VehicleParameters = {
    dryMass: 1200,
    fuelCapacity: 300,
    maxThrust: 4500,
    exhaustVelocity: 3000,
    inertia: { x: 1800, y: 1200, z: 1800 },
    maxTorque: { x: 900, y: 600, z: 900 },
    attitudeLeverArm: { x: 0.9, y: 0.9, z: 0.9 },
    attitudeExhaustVelocity: 2800,
    contacts: [
      legPoint('lf', -1.5, -1.5),
      legPoint('lb', -1.5, 1.5),
      legPoint('rf', 1.5, -1.5),
      legPoint('rb', 1.5, 1.5),
      {
        id: 'bell',
        kind: 'hull',
        position: { x: 0, y: -1.08, z: 0 },
        stiffness: 200000,
        damping: 40000,
        reboundDamping: 40000,
        friction: 0.5,
      },
    ],
  };
  const environment: FlightEnvironment = {
    gravity: { kind: 'uniform', acceleration: { x: 0, y: -1.62, z: 0 } },
    surface: { kind: 'flat', height: 0 },
  };
  const drop = (speed: number) => {
    let s: FlightState = {
      position: { x: 0, y: 1.505, z: 0 },
      orientation: { x: 0, y: 0, z: 0, w: 1 },
      velocity: { x: 0, y: -speed, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      fuelMass: 300,
    };
    let record = NO_TOUCHDOWN;
    let facts = contactFacts(s, vehicle.contacts!, environment.surface!);
    for (let n = 0; n < 60 * 6; n++) {
      const before = s;
      const beforeFacts = facts;
      s = stepFlight(
        s,
        { throttle: 0, bodyTorque: { x: 0, y: 0, z: 0 } },
        vehicle,
        environment,
        MAX_FLIGHT_STEP,
      );
      facts = contactFacts(s, vehicle.contacts!, environment.surface!);
      const tick = { before, beforeFacts, after: s, afterFacts: facts };
      record = updateTouchdown(record, tick, MAX_FLIGHT_STEP, limits);
    }
    return classifyTouchdown(record, limits);
  };

  it('lands a 1 m/s touchdown, roughs a 3 m/s one, and crashes a 7 m/s one', () => {
    expect(drop(1).status).toBe('landed');
    expect(drop(3)).toMatchObject({ status: 'rough', exceeded: ['verticalSpeed'] });
    expect(drop(7)).toMatchObject({ status: 'crashed' });
  });
});
