import { describe, expect, it } from 'vitest';
import {
  cannon,
  convergence,
  freeFall,
  GRAVITY,
  integrators,
  legDrop,
  MOON,
  niceTicks,
  rateResponse,
  rocket,
} from './models';

const last = <T>(list: readonly T[]) => list[list.length - 1]!;
const slope = (points: readonly (readonly [number, number])[]) => {
  const [x0, y0] = points[1]!;
  const [x1, y1] = points[points.length - 2]!;
  return (y1 - y0) / (x1 - x0);
};

describe('learn models agree with their formulas', () => {
  it("reproduces the game's opening fall: 7.77 s, 16.6 m/s, engine on the formula", () => {
    const fall = freeFall(80, -4, GRAVITY.moon);
    expect(fall.impactTime).toBeCloseTo(7.77, 2);
    expect(fall.impactSpeed).toBeCloseTo(16.59, 2);
    expect(Math.abs(last(fall.engine)[0] - fall.impactTime)).toBeLessThan(1 / 60);
    for (const [t, h] of fall.engine) {
      expect(h).toBeCloseTo(Math.max(0, 80 - 4 * t - 0.81 * t * t), 6);
    }
  });

  it('matches the rocket equation with gravity, and finds hover throttle', () => {
    const burn = rocket(0.8, 60, 0);
    expect(burn.hoverThrottle).toBeCloseTo((1260 * 1.62) / 4500, 12);
    expect(burn.burnTime).toBeCloseTo(60 / 1.2, 9);
    expect(burn.deltaV).toBeCloseTo(3000 * Math.log(1260 / 1200), 9);
    expect(last(burn.engine)[1]).toBeCloseTo(last(burn.formula)[1], 6);
    const leaning = rocket(1, 60, 30);
    expect(leaning.horizontal).toBeCloseTo((4500 * 0.5) / 1260, 12);
    expect(last(leaning.engine)[1]).toBeCloseTo(last(leaning.formula)[1], 6);
  });

  it('shows the rate assist saturating, then settling, and costing fuel', () => {
    const response = rateResponse(1, 0.3);
    expect(response.limit).toBeCloseTo((900 / 1800) * (180 / Math.PI), 9);
    const held = response.rate.filter(([t]) => t <= 1.5);
    // Saturated for about 1 s, then an exponential approach: within 1°/s by release.
    expect(last(held)[1]).toBeGreaterThan(29);
    expect(last(held)[1]).toBeLessThanOrEqual(30);
    expect(Math.abs(last(response.rate)[1])).toBeLessThan(0.5);
    expect(response.fuel).toBeGreaterThan(0);
  });

  it('shows Euler drifting and RK4 converging at fourth order', () => {
    const run = integrators(0.05);
    expect(run.rk4Error).toBeLessThan(5e-3);
    expect(run.eulerError).toBeGreaterThan(100 * run.rk4Error);
    const { euler, rk4 } = convergence();
    expect(slope(euler)).toBeGreaterThan(0.8);
    expect(slope(euler)).toBeLessThan(1.3);
    expect(slope(rk4)).toBeGreaterThan(3.5);
    expect(slope(rk4)).toBeLessThan(4.5);
  });

  it('drops the real lander on its legs: gentle settles, hard strikes the bell', () => {
    const gentle = legDrop(1, 20000, 4000, 25000);
    expect(gentle.bellStrike).toBe(false);
    expect(gentle.bounce).toBeLessThan(0.05);
    expect(gentle.zeta).toBeCloseTo(16000 / (2 * Math.sqrt(80000 * 1260)), 9);
    expect(legDrop(8, 20000, 4000, 25000).bellStrike).toBe(true);
    // Without rebound valving the legs return their stored energy as a hop.
    expect(legDrop(4, 20000, 1000, 0).bounce).toBeGreaterThan(
      legDrop(4, 20000, 1000, 25000).bounce,
    );
  });

  it("fires Newton's cannon: circular speed circles, slower crashes, faster escapes", () => {
    expect(MOON.gravitationalParameter / MOON.radius ** 2).toBeCloseTo(1.62, 2);
    const shot = cannon(Math.sqrt(MOON.gravitationalParameter / (MOON.radius + 100_000)));
    expect(shot.outcome).toBe('orbit');
    const radii = shot.path.map(([x, y]) => Math.hypot(x, y));
    expect(Math.max(...radii) / Math.min(...radii)).toBeLessThan(1.001);
    expect(shot.period).toBeCloseTo(
      (2 * Math.PI * Math.sqrt((MOON.radius + 100_000) ** 3 / MOON.gravitationalParameter)) / 60,
      6,
    );
    expect(cannon(800).outcome).toBe('crash');
    expect(cannon(shot.escape * 1.02).outcome).toBe('escape');
  });

  it('picks round axis ticks', () => {
    expect(niceTicks(0, 80)).toEqual([0, 20, 40, 60, 80]);
    expect(niceTicks(-17, 4)).toEqual([-15, -10, -5, 0]);
    expect(niceTicks(0, 7.77, 5)).toEqual([0, 2, 4, 6]);
  });
});
