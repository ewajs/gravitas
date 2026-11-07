import { describe, expect, it } from 'vitest';
import { fly, hoverPilot, idlePilot, padPilot, verticalPilot } from './pilots';
import { LANDING_LIMITS, PAD_RADIUS } from './rules';
import { FIRST_DESCENT, padDistance, START_FUEL } from './scenario';
import { FlightSession } from './session';

// Whole flights through the real session, judged by the real rules. They pin the
// opening's difficulty: retuning physics, fuel, or limits must keep these true.
const session = () => new FlightSession(FIRST_DESCENT);

describe('regression flights of the opening', () => {
  it('a pilot flying to the pad lands cleanly on it with fuel to spare', () => {
    const flight = fly(session(), padPilot);
    expect(flight.outcome.status).toBe('landed');
    expect(padDistance(flight.state.position)).toBeLessThan(1);
    expect(padDistance(flight.state.position)).toBeLessThan(PAD_RADIUS);
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
    const flight = fly(session(), idlePilot);
    // Judged on the first leg contact, before the bell reaches the ground.
    expect(flight.outcome).toMatchObject({ status: 'crashed', cause: 'impact' });
    expect(flight.flightTime).toBeCloseTo(7.8, 0);
  });

  it('hovering without descending runs the tank dry, then crashes', () => {
    const flight = fly(session(), hoverPilot, 300);
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
