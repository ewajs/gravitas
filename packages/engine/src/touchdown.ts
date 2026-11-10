import type { ContactFact } from './contact';
import type { FlightState } from './flight';
import type { Vector3 } from './pose';
import { addScaled, dot, magnitude } from './math';
import { tiltAngle, tiltFrom } from './orientation';
import { positive, vector } from './validation';

/** Thresholds a host chooses for judging a touchdown; speeds m/s, angles rad, times s. */
export interface TouchdownLimits {
  /** Largest downward speed at first leg contact for a clean landing. */
  readonly maxVerticalSpeed: number;
  /** Largest horizontal speed at first leg contact for a clean landing. */
  readonly maxHorizontalSpeed: number;
  /** Largest tilt from upright at first leg contact for a clean landing. */
  readonly maxTilt: number;
  /** Any leg striking faster than this (approach speed) is a crash. */
  readonly maxLegImpactSpeed: number;
  /** Tilt beyond this while touching the ground counts as tipped over. */
  readonly maxRestingTilt: number;
  /** All legs loaded and the vehicle still for this long ends the landing. */
  readonly settleTime: number;
  /** Linear speed below which the vehicle counts as still. */
  readonly restSpeed: number;
  /** Angular speed (rad/s) below which the vehicle counts as still. */
  readonly restAngularSpeed: number;
  /** Time with no contact after which a touch-and-go starts a fresh record. */
  readonly airborneReset: number;
}

/** Conditions when a leg first touched, for judging the touchdown afterwards. */
export interface TouchdownSnapshot {
  /** Downward speed in m/s (positive descending). */
  readonly verticalSpeed: number;
  /** Horizontal speed in m/s. */
  readonly horizontalSpeed: number;
  /** Tilt from upright in radians. */
  readonly tilt: number;
}

/** Plain accumulated history of one touchdown; start from NO_TOUCHDOWN. */
export interface TouchdownRecord {
  readonly touchdown: TouchdownSnapshot | null;
  /** Fastest leg approach speed seen while that leg was loaded, m/s. */
  readonly peakLegImpact: number;
  /** First hull point that touched, if any. */
  readonly hullContact: string | null;
  readonly tipped: boolean;
  /** Continuous time settled on all legs, s. */
  readonly settledFor: number;
  /** Continuous time with no contact since the last touch, s. */
  readonly airborneFor: number;
}

/** Empty record for a vehicle that has not touched the ground. */
export const NO_TOUCHDOWN: TouchdownRecord = {
  touchdown: null,
  peakLegImpact: 0,
  hullContact: null,
  tipped: false,
  settledFor: 0,
  airborneFor: 0,
};

/** Which touchdown limit a rough landing exceeded. */
/** Loaded legs that make a stable stance; a vehicle with fewer legs needs them all. */
const STABLE_STANCE = 3;

export type TouchdownCheck = 'verticalSpeed' | 'horizontalSpeed' | 'tilt';

/** Judgement of a record; `landed`, `rough`, and `crashed` are final. */
export type TouchdownOutcome =
  | { readonly status: 'airborne' }
  | { readonly status: 'touching'; readonly touchdown: TouchdownSnapshot | null }
  | { readonly status: 'landed'; readonly touchdown: TouchdownSnapshot }
  | {
      readonly status: 'rough';
      readonly touchdown: TouchdownSnapshot;
      readonly exceeded: readonly TouchdownCheck[];
    }
  | {
      readonly status: 'crashed';
      readonly cause: 'hull' | 'impact' | 'tipped';
      readonly touchdown: TouchdownSnapshot | null;
    };

export function validateLimits(limits: TouchdownLimits): void {
  for (const key of [
    'maxVerticalSpeed',
    'maxHorizontalSpeed',
    'maxTilt',
    'maxLegImpactSpeed',
    'maxRestingTilt',
    'settleTime',
    'restSpeed',
    'restAngularSpeed',
    'airborneReset',
  ] as const) {
    positive(limits[key], key);
  }
}

/** One completed simulation tick: states and contact facts at its start and end. */
export interface TouchdownTick {
  readonly before: FlightState;
  readonly beforeFacts: readonly ContactFact[];
  readonly after: FlightState;
  readonly afterFacts: readonly ContactFact[];
  /**
   * The local vertical as a world unit vector, for a world where "up" is not +Y,
   * such as a body-fixed frame (up is away from the centre). Vertical and
   * horizontal speed and tilt are measured against it; omit it for world +Y.
   */
  readonly up?: Vector3;
}

/**
 * Adds one completed tick to a touchdown record. Pure. Touchdown speeds and tilt
 * come from the state just before the first leg loaded, and leg impact from the
 * approach speed before or after the tick, whichever is larger. Contact forces
 * brake hard within a single tick, so end-of-tick values would understate an
 * impact. A touch-and-go that stays clear of the ground for `airborneReset`
 * starts over, so only the final touchdown counts.
 */
export function updateTouchdown(
  record: TouchdownRecord,
  tick: TouchdownTick,
  dt: number,
  limits: TouchdownLimits,
): TouchdownRecord {
  positive(dt, 'dt');
  validateLimits(limits);
  if (tick.up) {
    vector(tick.up, 'up');
    if (Math.abs(magnitude(tick.up) - 1) > 1e-9) throw new RangeError('up must be a unit vector');
  }
  const touching = tick.afterFacts.filter((fact) => fact.normalForce > 0);
  if (touching.length === 0) {
    const airborneFor = record.airborneFor + dt;
    const fresh = airborneFor >= limits.airborneReset && !record.hullContact && !record.tipped;
    return fresh ? { ...NO_TOUCHDOWN, airborneFor } : { ...record, settledFor: 0, airborneFor };
  }
  const legs = tick.afterFacts.filter((fact) => fact.kind === 'leg');
  const loadedLegs = legs.filter((fact) => fact.normalForce > 0);
  const approachBefore = new Map(tick.beforeFacts.map((fact) => [fact.id, fact.approachSpeed]));
  const impacts = loadedLegs.map((leg) =>
    Math.max(leg.approachSpeed, approachBefore.get(leg.id) ?? 0),
  );
  const { before, after } = tick;
  // A stable stance: on uneven ground, stiff legs stand on three of four.
  const still =
    loadedLegs.length >= Math.min(STABLE_STANCE, legs.length) &&
    legs.length > 0 &&
    magnitude(after.velocity) < limits.restSpeed &&
    magnitude(after.angularVelocity) < limits.restAngularSpeed;
  const hull = touching.find((fact) => fact.kind === 'hull');
  const { up } = tick;
  const tilt = (state: FlightState) =>
    up ? tiltFrom(state.orientation, up) : tiltAngle(state.orientation);
  const snapshot = (): TouchdownSnapshot => {
    if (!up) {
      return {
        verticalSpeed: -before.velocity.y,
        horizontalSpeed: Math.hypot(before.velocity.x, before.velocity.z),
        tilt: tilt(before),
      };
    }
    const vertical = dot(before.velocity, up);
    return {
      verticalSpeed: -vertical,
      horizontalSpeed: magnitude(addScaled(before.velocity, up, -vertical)),
      tilt: tilt(before),
    };
  };
  return {
    touchdown: record.touchdown ?? (loadedLegs.length > 0 ? snapshot() : null),
    peakLegImpact: Math.max(record.peakLegImpact, ...impacts),
    hullContact: record.hullContact ?? hull?.id ?? null,
    tipped: record.tipped || tilt(after) > limits.maxRestingTilt,
    settledFor: still ? record.settledFor + dt : 0,
    airborneFor: 0,
  };
}

/**
 * Judges a record. Crashes are immediate (hull contact, then leg impact, then
 * tipping); otherwise a settled vehicle has landed, or landed rough if its first
 * leg contact exceeded a limit. Values exactly at a limit pass.
 */
export function classifyTouchdown(
  record: TouchdownRecord,
  limits: TouchdownLimits,
): TouchdownOutcome {
  validateLimits(limits);
  const { touchdown } = record;
  if (record.hullContact) return { status: 'crashed', cause: 'hull', touchdown };
  if (record.peakLegImpact > limits.maxLegImpactSpeed) {
    return { status: 'crashed', cause: 'impact', touchdown };
  }
  if (record.tipped) return { status: 'crashed', cause: 'tipped', touchdown };
  // No leg has touched (a hull touch would already be a crash), or the vehicle hopped.
  if (!touchdown || record.airborneFor > 0) return { status: 'airborne' };
  if (record.settledFor < limits.settleTime) return { status: 'touching', touchdown };
  const exceeded: TouchdownCheck[] = [];
  if (touchdown.verticalSpeed > limits.maxVerticalSpeed) exceeded.push('verticalSpeed');
  if (touchdown.horizontalSpeed > limits.maxHorizontalSpeed) exceeded.push('horizontalSpeed');
  if (touchdown.tilt > limits.maxTilt) exceeded.push('tilt');
  return exceeded.length
    ? { status: 'rough', touchdown, exceeded }
    : { status: 'landed', touchdown };
}
