import { toRadians, type TouchdownLimits } from '@gravitas/engine';

/**
 * Landing rules for the first descent. A clean landing touches down at most
 * 2 m/s down and 1 m/s sideways, within 10° of upright, then sits still on all
 * four legs for 1 s. Any hull contact, a leg striking faster than 5 m/s, or
 * tilting past 60° on the ground is a crash. Tunable after playtesting.
 */
export const LANDING_LIMITS: TouchdownLimits = {
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

/**
 * The HUD's "safe sink" hint, in m/s: sink no faster than an eighth of the
 * altitude per second, and never faster than the touchdown limit near the ground.
 * At full thrust the lander stops from this speed within about a third of the
 * remaining height (from 80 m: 10 m/s, stopped in about 26 m), leaving room to
 * react and to spare fuel. A hint only: landing limits are unchanged.
 */
export function safeSinkRate(altitude: number): number {
  return Math.max(LANDING_LIMITS.maxVerticalSpeed, altitude / 8);
}

/** A landing counts as on the pad when the centre of mass is over the pad's surface. */
export const PAD_RADIUS = 3.8;
