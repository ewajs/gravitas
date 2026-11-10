import { describe, expect, it } from 'vitest';
import {
  rateControlTorque,
  stepFlight,
  type FlightEnvironment,
  type FlightState,
} from '@gravitas/engine';
import { DESCENT_VEHICLE } from './descent-vehicle';
import { FIRST_LANDER } from './lander';
import { ENVIRONMENT, SURFACE_GRAVITY } from './scenario';
import {
  deltaV,
  fullMassFlow,
  hoverThrottle,
  legContacts,
  validateDefinition,
  type VehicleDefinition,
} from './vehicle';

const upright = { x: 0, y: 0, z: 0, w: 1 };
const still = { x: 0, y: 0, z: 0 };

function resting(vehicle: VehicleDefinition): FlightState {
  return {
    position: { x: 0, y: vehicle.model.centerOfMassHeight, z: 0 },
    orientation: upright,
    fuelMass: vehicle.parameters.fuelCapacity,
    velocity: still,
    angularVelocity: still,
  };
}

describe('the first lander', () => {
  const { parameters: lander, attitude } = FIRST_LANDER;

  it('keeps the opening’s numbers', () => {
    const wetMass = lander.dryMass + lander.fuelCapacity;
    expect(wetMass).toBe(1500);
    expect(hoverThrottle(FIRST_LANDER, lander.fuelCapacity, SURFACE_GRAVITY)).toBeCloseTo(0.54, 12);
    expect(fullMassFlow(FIRST_LANDER)).toBe(1.5);
    expect(deltaV(FIRST_LANDER)).toBeCloseTo(3000 * Math.log(1.25), 9);
  });

  it('flies a supported step', () => {
    const state = resting(FIRST_LANDER);
    const bodyTorque = rateControlTorque(
      state.angularVelocity,
      { x: 1, y: 0, z: 0 },
      lander,
      attitude,
    );
    const next = stepFlight(state, { throttle: 1, bodyTorque }, lander, ENVIRONMENT, 1 / 60);
    expect(next.velocity.y).toBeGreaterThan(0);
    expect(next.angularVelocity.x).toBeCloseTo(0.5 / 60, 12);
    // Main engine 1.5 kg/s plus a saturated 900 N m pitch couple: 900 / (0.9 * 2800) kg/s.
    expect(next.fuelMass).toBeCloseTo(300 - (1.5 + 900 / 2520) / 60, 10);
  });
});

describe('vehicle definitions', () => {
  it('accept both vehicles', () => {
    expect(() => validateDefinition(FIRST_LANDER)).not.toThrow();
    expect(() => validateDefinition(DESCENT_VEHICLE)).not.toThrow();
    expect(legContacts(DESCENT_VEHICLE).map((leg) => leg.id)).toEqual([
      'foot-left-front',
      'foot-left-back',
      'foot-right-front',
      'foot-right-back',
    ]);
  });

  it('reject a vehicle whose parts disagree', () => {
    const base = FIRST_LANDER;
    const bad: VehicleDefinition[] = [
      { ...base, id: '' },
      { ...base, parameters: { ...base.parameters, maxThrust: 0 } },
      { ...base, attitude: { ...base.attitude, responseTime: 0.001 } },
      { ...base, model: { ...base.model, finishes: {} } },
      // Three legs drawn for four.
      { ...base, model: { ...base.model, legs: base.model.legs.slice(0, 3) } },
      // The model rests higher than the legs hold the centre of mass.
      { ...base, model: { ...base.model, centerOfMassHeight: 1.6 } },
      // A foot drawn away from its leg.
      {
        ...base,
        model: {
          ...base.model,
          legs: base.model.legs.map((leg, n) =>
            n === 2 ? { ...leg, foot: { ...leg.foot, x: leg.foot.x + 0.1 } } : leg,
          ),
        },
      },
      // Fewer than three legs.
      {
        ...base,
        parameters: {
          ...base.parameters,
          contacts: base.parameters.contacts!.filter(
            (point) => point.id !== 'foot-left-front' && point.id !== 'foot-left-back',
          ),
        },
        model: { ...base.model, legs: base.model.legs.slice(2) },
      },
    ];
    for (const vehicle of bad) expect(() => validateDefinition(vehicle)).toThrow(RangeError);
  });
});

describe('the descent vehicle', () => {
  const vehicle = DESCENT_VEHICLE.parameters;

  it('carries about 2 km/s, burning 5 kg/s for six minutes at full thrust', () => {
    expect(deltaV(DESCENT_VEHICLE)).toBeCloseTo(3000 * Math.log(3900 / 2000), 9);
    expect(deltaV(DESCENT_VEHICLE)).toBeGreaterThan(2000);
    expect(deltaV(DESCENT_VEHICLE)).toBeLessThan(2010);
    expect(fullMassFlow(DESCENT_VEHICLE)).toBe(5);
    expect(vehicle.fuelCapacity / fullMassFlow(DESCENT_VEHICLE)).toBe(380);
  });

  it('hovers at 42% throttle full and 22% nearly empty, in lunar gravity', () => {
    expect(hoverThrottle(DESCENT_VEHICLE, vehicle.fuelCapacity, SURFACE_GRAVITY)).toBeCloseTo(
      0.4212,
      4,
    );
    expect(hoverThrottle(DESCENT_VEHICLE, 0, SURFACE_GRAVITY)).toBeCloseTo(0.216, 4);
    // Flying it: at hover throttle, the vertical speed barely changes in a second.
    let state: FlightState = { ...resting(DESCENT_VEHICLE), position: { x: 0, y: 500, z: 0 } };
    const throttle = hoverThrottle(DESCENT_VEHICLE, state.fuelMass, SURFACE_GRAVITY);
    for (let n = 0; n < 60; n++) {
      state = stepFlight(state, { throttle, bodyTorque: still }, vehicle, ENVIRONMENT, 1 / 60);
    }
    // Mass falls 5 × 0.42 kg/s while thrust holds: a slight climb, under 1 mm/s.
    expect(Math.abs(state.velocity.y)).toBeLessThan(0.001);
    expect(state.fuelMass).toBeCloseTo(vehicle.fuelCapacity - 5 * throttle, 6);
  });

  it('gains the rocket equation’s velocity burning the whole tank in free space', () => {
    const space: FlightEnvironment = { gravity: { kind: 'uniform', acceleration: still } };
    let state: FlightState = { ...resting(DESCENT_VEHICLE), position: { x: 0, y: 1e6, z: 0 } };
    let ticks = 0;
    while (state.fuelMass > 0 && ticks < 400 * 60) {
      state = stepFlight(state, { throttle: 1, bodyTorque: still }, vehicle, space, 1 / 60);
      ticks++;
    }
    // Six minutes and twenty seconds, give or take the last tick's rounding.
    expect(Math.abs(ticks - 380 * 60)).toBeLessThanOrEqual(1);
    expect(state.velocity.y).toBeCloseTo(deltaV(DESCENT_VEHICLE), 1);
  });

  it('stands wider than it is tall at the centre of mass: tips past about 48°', () => {
    const foot = legContacts(DESCENT_VEHICLE)[0]!.position;
    const tipping = Math.atan(Math.abs(foot.x) / -foot.y);
    expect((tipping * 180) / Math.PI).toBeCloseTo(47.7, 1);
  });
});
