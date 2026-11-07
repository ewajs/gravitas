import type { TouchdownOutcome } from '@gravitas/engine';
import type { LandingCheck, LandingReport } from '@gravitas/ui';
import { LANDER } from './lander';
import { LANDING_LIMITS, PAD_RADIUS } from './rules';
import { PAD_POSITION } from './scenario';
import type { FlightSession } from './session';

/**
 * Explains a final verdict for the HUD: what happened, each touchdown limit with
 * its value, and how far from the pad. Returns undefined before a verdict.
 */
export function landingReport(session: FlightSession): LandingReport | undefined {
  const outcome: TouchdownOutcome = session.outcome;
  if (outcome.status !== 'landed' && outcome.status !== 'rough' && outcome.status !== 'crashed') {
    return undefined;
  }
  // Judge from the verdict moment: a crash may keep sliding or tumbling afterwards.
  const s = session.verdictState ?? session.state;
  const padDistance = Math.hypot(s.position.x - PAD_POSITION.x, s.position.z - PAD_POSITION.z);
  const checks: LandingCheck[] = [];
  const check = (id: LandingCheck['id'], value: number, limit: number) =>
    checks.push({ id, value, limit, pass: value <= limit });
  if (outcome.touchdown) {
    check('vertical-speed', outcome.touchdown.verticalSpeed, LANDING_LIMITS.maxVerticalSpeed);
    check('horizontal-speed', outcome.touchdown.horizontalSpeed, LANDING_LIMITS.maxHorizontalSpeed);
    check('tilt', outcome.touchdown.tilt, LANDING_LIMITS.maxTilt);
  }
  check('pad-distance', padDistance, PAD_RADIUS);
  const verdict =
    outcome.status === 'landed'
      ? padDistance <= PAD_RADIUS
        ? 'landed'
        : 'landed-off-pad'
      : outcome.status;
  return {
    verdict,
    ...(outcome.status === 'crashed' ? { cause: outcome.cause } : {}),
    checks,
    fuel: s.fuelMass / LANDER.fuelCapacity,
    flightTime: session.flightTime,
  };
}
