import { describe, expect, it } from 'vitest';
import { ATTITUDE, ENVIRONMENT, LANDER } from './lander';
import { START_STATE } from './scenario';
import { FIXED_STEP, FlightSession, MAX_STEPS_PER_FRAME, type PilotInput } from './session';
import { footClearance } from './telemetry';

const idle: PilotInput = { rates: { x: 0, y: 0, z: 0 }, throttleChange: 0 };
const flying = (start = START_STATE) => {
  const session = new FlightSession({
    start,
    vehicle: LANDER,
    attitude: ATTITUDE,
    environment: ENVIRONMENT,
    clearance: footClearance,
  });
  session.start();
  return session;
};
const run = (session: FlightSession, frame: number, seconds: number, input = idle) => {
  for (let n = 0; n < Math.round(seconds / frame); n++) session.advance(frame, input);
};

describe('fixed-step runtime', () => {
  it('produces identical physics at 30 Hz and 144 Hz display rates', () => {
    // Held pitch and throttle-up change both rotation and lever every tick.
    const input: PilotInput = { rates: { x: -1, y: 0, z: 0.5 }, throttleChange: 1 };
    const slow = flying();
    const fast = flying();
    run(slow, 1 / 30, 2, input);
    run(fast, 1 / 144, 2, input);
    // Half a step more on each keeps rounding away from a tick boundary.
    slow.advance(FIXED_STEP / 2, input);
    fast.advance(FIXED_STEP / 2, input);
    expect(slow.ticks).toBe(120);
    expect(fast.ticks).toBe(120);
    expect(fast.state).toEqual(slow.state);
    expect(fast.previous).toEqual(slow.previous);
    expect(fast.throttle).toBe(slow.throttle);
    expect(slow.alpha).toBeCloseTo(0.5, 6);
    expect(fast.alpha).toBeCloseTo(0.5, 6);
    expect(slow.discardedSeconds).toBe(0);
  });

  it('runs at most a bounded number of steps per frame and accounts for discarded time', () => {
    const session = flying();
    expect(session.advance(1, idle)).toBe(MAX_STEPS_PER_FRAME);
    const simulated = session.ticks * FIXED_STEP;
    const kept = session.alpha * FIXED_STEP;
    expect(session.discardedSeconds).toBeGreaterThan(0.85);
    expect(simulated + session.discardedSeconds + kept).toBeCloseTo(1, 12);
    expect(kept).toBeLessThan(FIXED_STEP);
  });

  it('ignores non-positive or non-finite elapsed time', () => {
    const session = flying();
    for (const elapsed of [0, -1, Number.NaN]) expect(session.advance(elapsed, idle)).toBe(0);
    expect(session.state).toBe(START_STATE);
  });

  it('advances only while flying; pause keeps the sub-step remainder', () => {
    const session = new FlightSession({
      start: START_STATE,
      vehicle: LANDER,
      attitude: ATTITUDE,
      environment: ENVIRONMENT,
      clearance: footClearance,
    });
    expect(session.phase).toBe('ready');
    expect(session.advance(1, idle)).toBe(0);
    session.start();
    session.advance(FIXED_STEP * 3.5, idle);
    const paused = session.state;
    session.pause();
    expect(session.phase).toBe('paused');
    expect(session.advance(10, idle)).toBe(0);
    expect(session.state).toBe(paused);
    expect(session.alpha).toBeCloseTo(0.5, 9);
    session.resume();
    expect(session.advance(FIXED_STEP / 2, idle)).toBe(1);
  });

  it('restarts to the scenario start with lever, clock, and history reset', () => {
    const session = flying();
    run(session, FIXED_STEP, 1, { ...idle, throttleChange: 1 });
    session.advance(1, idle);
    session.restart();
    expect(session.phase).toBe('ready');
    expect(session.state).toBe(START_STATE);
    expect(session.previous).toBe(START_STATE);
    expect([session.throttle, session.ticks, session.alpha, session.discardedSeconds]).toEqual([
      0, 0, 0, 0,
    ]);
  });
});

describe('pilot input', () => {
  it('ramps the throttle lever per tick and clamps it', () => {
    const session = flying();
    run(session, FIXED_STEP, 1, { ...idle, throttleChange: 1 });
    expect(session.throttle).toBeCloseTo(0.5, 12);
    run(session, FIXED_STEP, 2, { ...idle, throttleChange: 1 });
    expect(session.throttle).toBe(1);
    run(session, FIXED_STEP, 3, { ...idle, throttleChange: -1 });
    expect(session.throttle).toBe(0);
  });

  it('applies a one-shot lever setting once, even when its frame runs no tick', () => {
    const session = flying();
    session.advance(FIXED_STEP / 4, { ...idle, throttleSet: 1 });
    expect(session.ticks).toBe(0);
    session.advance(FIXED_STEP, idle);
    expect(session.throttle).toBe(1);
    session.advance(FIXED_STEP, { ...idle, throttleSet: 0 });
    expect(session.throttle).toBe(0);
  });

  it('discards one-shot settings received outside flight', () => {
    const session = flying();
    session.pause();
    session.advance(FIXED_STEP, { ...idle, throttleSet: 1 });
    session.resume();
    session.advance(FIXED_STEP, idle);
    expect(session.throttle).toBe(0);
  });

  it('feeds held rate requests through attitude assistance', () => {
    const session = flying();
    run(session, FIXED_STEP, 3, { ...idle, rates: { x: -1, y: 0, z: 0 } });
    // Saturated for ~1 s, then a 0.3 s exponential approach: within 1e-3 rad/s by 3 s.
    expect(session.state.angularVelocity.x).toBeCloseTo(-ATTITUDE.maxRate.x, 3);
    run(session, FIXED_STEP, 3);
    expect(Math.abs(session.state.angularVelocity.x)).toBeLessThan(1e-3);
    expect(session.state.fuelMass).toBeLessThan(LANDER.fuelCapacity);
  });
});

describe('placeholder ground halt', () => {
  it('stops at first foot contact with feet on the surface and touchdown velocity kept', () => {
    const session = flying();
    // Unpowered from 80 m at -4 m/s: contact after ~7.77 s at ~-16.6 m/s.
    run(session, FIXED_STEP, 10);
    expect(session.phase).toBe('contact');
    expect(footClearance(session.state)).toBeCloseTo(0, 12);
    expect(session.previous).toBe(session.state);
    const fallTime = (-4 + Math.sqrt(16 + 2 * 1.62 * 80)) / 1.62;
    expect(session.ticks).toBe(Math.ceil(fallTime / FIXED_STEP));
    expect(session.state.velocity.y).toBeCloseTo(-4 - 1.62 * session.ticks * FIXED_STEP, 9);
    const frozen = session.state;
    expect(session.advance(1, idle)).toBe(0);
    expect(session.state).toBe(frozen);
    session.restart();
    expect(session.phase).toBe('ready');
  });
});

describe('opening scenario', () => {
  it('is landable softly by a simple descent-rate pilot with fuel to spare', () => {
    // Pilot commands sink rate proportional to altitude, tracking it with throttle only.
    const session = flying();
    const g = -ENVIRONMENT.gravity.y;
    while (session.phase === 'flying' && session.ticks < 60 * 120) {
      const s = session.state;
      const altitude = footClearance(s);
      const mass = LANDER.dryMass + s.fuelMass;
      const target = -Math.max(0.8, altitude / 6);
      const throttle = (mass * (g + 2 * (target - s.velocity.y))) / LANDER.maxThrust;
      const lever = session.throttle;
      const change = throttle > lever + 0.02 ? 1 : throttle < lever - 0.02 ? -1 : 0;
      session.advance(FIXED_STEP, { ...idle, throttleChange: change });
    }
    expect(session.phase).toBe('contact');
    expect(session.state.velocity.y).toBeGreaterThan(-1.5);
    expect(session.state.fuelMass / LANDER.fuelCapacity).toBeGreaterThan(0.5);
  });
});
