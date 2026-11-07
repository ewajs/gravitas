import { describe, expect, it } from 'vitest';
import { ATTITUDE, LANDER } from './lander';
import { fly, padPilot, verticalPilot, type Pilot } from './pilots';
import { LANDING_LIMITS, PAD_RADIUS } from './rules';
import { ENVIRONMENT, PAD_POSITION, START_FUEL, START_STATE } from './scenario';
import { FlightSession } from './session';

// Whole flights through the real session, judged by the real rules. They pin the
// opening's difficulty: retuning physics, fuel, or limits must keep these true.
const session = () =>
  new FlightSession({
    start: START_STATE,
    vehicle: LANDER,
    attitude: ATTITUDE,
    environment: ENVIRONMENT,
    limits: LANDING_LIMITS,
  });
const padDistance = (s: FlightSession) =>
  Math.hypot(s.state.position.x - PAD_POSITION.x, s.state.position.z - PAD_POSITION.z);

describe('regression flights of the opening', () => {
  it('a pilot flying to the pad lands cleanly on it with fuel to spare', () => {
    const flight = fly(session(), padPilot);
    expect(flight.outcome.status).toBe('landed');
    expect(padDistance(flight)).toBeLessThan(1);
    expect(padDistance(flight)).toBeLessThan(PAD_RADIUS);
    // About 24 kg used of 60: the opening leaves a human margin, not unlimited fuel.
    expect(flight.state.fuelMass).toBeGreaterThan(START_FUEL * 0.4);
    expect(flight.state.fuelMass).toBeLessThan(START_FUEL * 0.7);
  });

  it('a throttle-only pilot touches down softly but too fast sideways: rough', () => {
    const flight = fly(session(), verticalPilot);
    expect(flight.outcome).toMatchObject({ status: 'rough', exceeded: ['horizontalSpeed'] });
    if (flight.outcome.status !== 'rough') throw new Error('unreachable');
    expect(flight.outcome.touchdown.verticalSpeed).toBeLessThan(LANDING_LIMITS.maxVerticalSpeed);
  });

  it('no input at all crashes: the legs strike at about 16.6 m/s', () => {
    const flight = fly(session(), () => ({ rates: { x: 0, y: 0, z: 0 }, throttleChange: 0 }));
    // Judged on the first leg contact, before the bell reaches the ground.
    expect(flight.outcome).toMatchObject({ status: 'crashed', cause: 'impact' });
    expect(flight.flightTime).toBeCloseTo(7.8, 0);
  });

  it('hovering without descending runs the tank dry, then crashes', () => {
    const hover: Pilot = (s) => {
      const mass = LANDER.dryMass + s.state.fuelMass;
      const hold = (mass * (1.62 + 1.5 * (0 - s.state.velocity.y))) / LANDER.maxThrust;
      return {
        rates: { x: 0, y: 0, z: 0 },
        throttleChange: hold > s.throttle + 0.02 ? 1 : hold < s.throttle - 0.02 ? -1 : 0,
      };
    };
    const flight = fly(session(), hover, 300);
    expect(flight.state.fuelMass).toBe(0);
    expect(flight.outcome.status).toBe('crashed');
  });

  it('flies identically twice: verdicts are deterministic', () => {
    const a = fly(session(), padPilot);
    const b = fly(session(), padPilot);
    expect(b.state).toEqual(a.state);
    expect(b.outcome).toEqual(a.outcome);
  });
});
