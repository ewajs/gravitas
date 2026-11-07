import { expect, it } from 'vitest';
import { rateControlTorque, stepFlight, type FlightState } from '@gravitas/engine';
import { ATTITUDE, CENTER_OF_MASS_HEIGHT, ENVIRONMENT, LANDER } from './lander';
import { INITIAL_POSE } from './fixture';

it('provides a coherent first-lander preset and a supported flight step', () => {
  const wetMass = LANDER.dryMass + LANDER.fuelCapacity;
  expect(wetMass).toBe(1500);
  expect((-ENVIRONMENT.gravity.y * wetMass) / LANDER.maxThrust).toBeCloseTo(0.54, 12);
  expect(LANDER.maxThrust / LANDER.exhaustVelocity).toBe(1.5);
  expect(INITIAL_POSE.position.y).toBe(CENTER_OF_MASS_HEIGHT);
  const state: FlightState = {
    ...INITIAL_POSE,
    fuelMass: LANDER.fuelCapacity,
    velocity: { x: 0, y: 0, z: 0 },
    angularVelocity: { x: 0, y: 0, z: 0 },
  };
  const bodyTorque = rateControlTorque(
    state.angularVelocity,
    { x: 1, y: 0, z: 0 },
    LANDER,
    ATTITUDE,
  );
  const next = stepFlight(state, { throttle: 1, bodyTorque }, LANDER, ENVIRONMENT, 1 / 60);
  expect(next.velocity.y).toBeGreaterThan(0);
  expect(next.angularVelocity.x).toBeCloseTo(0.5 / 60, 12);
  // Main engine 1.5 kg/s plus a saturated 900 N m pitch couple: 900 / (0.9 * 2800) kg/s.
  expect(next.fuelMass).toBeCloseTo(300 - (1.5 + 900 / 2520) / 60, 10);
});
