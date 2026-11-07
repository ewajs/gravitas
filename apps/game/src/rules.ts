import type { TouchdownLimits } from '@gravitas/engine';

const degrees = (value: number) => (value * Math.PI) / 180;

/**
 * Landing rules for the first descent. A clean landing touches down at most
 * 2 m/s down and 1 m/s sideways, within 10° of upright, then sits still on all
 * four legs for 1 s. Any hull contact, a leg striking faster than 5 m/s, or
 * tilting past 60° on the ground is a crash. Tunable after playtesting.
 */
export const LANDING_LIMITS: TouchdownLimits = {
  maxVerticalSpeed: 2,
  maxHorizontalSpeed: 1,
  maxTilt: degrees(10),
  maxLegImpactSpeed: 5,
  maxRestingTilt: degrees(60),
  settleTime: 1,
  restSpeed: 0.1,
  restAngularSpeed: 0.05,
  airborneReset: 1,
};

/** A landing counts as on the pad when the centre of mass is over the pad's surface. */
export const PAD_RADIUS = 3.8;
