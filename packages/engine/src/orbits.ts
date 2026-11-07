import type { Vector3 } from './pose';
import type { FlightState } from './flight';
import {
  bodyFixedToInertial,
  inertialToBodyFixed,
  validateBody,
  type CelestialBody,
} from './frames';
import {
  cross,
  dot,
  magnitude,
  modulo,
  multiplyQuaternions,
  rotationAbout,
  scale,
  signedAngle,
  subtract,
} from './math';
import { bodyToWorld } from './orientation';
import { coastAttitude } from './rotation';
import { bounded, finite, nonNegative, positive, unitQuaternion, vector } from './validation';

// Two-body orbits around a CelestialBody, in its inertial frame (ADR 0018): the
// equator is the body-fixed XZ plane, north is +Y, and longitudes count east
// from +X. Internally the textbook frame is used, with z north:
// (x, y, z)_textbook = (X, −Z, Y). Elements never depend on the frame a flight
// uses; `orbitOf` converts first.

/** The six numbers that fix a conic orbit and a place on it. Angles in radians. */
export interface OrbitalElements {
  /** Distance from the body's centre at the closest point, in metres. */
  readonly periapsis: number;
  /** 0 circular, below 1 elliptical, 1 parabolic, above 1 hyperbolic (escaping). */
  readonly eccentricity: number;
  /** Tilt from the equator in [0, π]; above π/2 is retrograde (against the spin). */
  readonly inclination: number;
  /**
   * Longitude where the orbit crosses the equator heading north, in [0, 2π),
   * measured east from inertial +X. 0 for an equatorial orbit, where it is undefined.
   */
  readonly ascendingNode: number;
  /**
   * Angle from the ascending node to periapsis in the direction of motion, in
   * [0, 2π). For an equatorial orbit it is measured from +X instead; for a
   * circular one it is 0.
   */
  readonly argumentOfPeriapsis: number;
  /**
   * Angle from periapsis to the vehicle in the direction of motion: [0, 2π) when
   * bound, (−π, π) when escaping (negative while approaching). A circular orbit
   * measures it from the node (or from +X when also equatorial).
   */
  readonly trueAnomaly: number;
}

/** Elements plus the quantities instruments and time warp need. */
export interface Orbit extends OrbitalElements {
  /** Metres; negative when escaping on a hyperbola, Infinity for a parabola. */
  readonly semiMajorAxis: number;
  /** Farthest distance from the centre in metres; Infinity when escaping. */
  readonly apoapsis: number;
  /** Seconds for one revolution; Infinity when escaping. */
  readonly period: number;
  /** v²/2 − μ/r in joules per kilogram: negative bound, zero or positive escaping. */
  readonly specificEnergy: number;
  /** Seconds until the next periapsis; undefined if circular or already past it while escaping. */
  readonly timeToPeriapsis: number | undefined;
  /** Seconds until the next apoapsis; undefined if circular or escaping. */
  readonly timeToApoapsis: number | undefined;
}

/** Which frame a flight state is in when asking about its orbit (see ADR 0018). */
export type OrbitFrame = 'body-fixed' | 'inertial';

/** Position and velocity in metres and metres per second. */
export interface OrbitalState {
  readonly position: Vector3;
  readonly velocity: Vector3;
}

// Below this, an eccentricity is circular and a node is undefined (equatorial).
const CIRCULAR = 1e-10;
const EQUATORIAL = 1e-11;
// Within this of 1, time of flight uses the parabolic (Barker) form.
const PARABOLIC = 1e-9;
const TWO_PI = 2 * Math.PI;
const X: Vector3 = { x: 1, y: 0, z: 0 };

const toTextbook = (v: Vector3): Vector3 => ({ x: v.x, y: -v.z, z: v.y });
const fromTextbook = (v: Vector3): Vector3 => ({ x: v.x, y: v.z, z: -v.y });

/**
 * The orbit through an inertial position and velocity around a body with
 * gravitational parameter μ (m³/s²).
 */
export function orbitFromState(state: OrbitalState, gravitationalParameter: number): Orbit {
  vector(state.position, 'position');
  vector(state.velocity, 'velocity');
  positive(gravitationalParameter, 'gravitationalParameter');
  const mu = gravitationalParameter;
  const r = toTextbook(state.position);
  const v = toTextbook(state.velocity);
  const radius = magnitude(r);
  positive(radius, 'distance from the centre');
  const h = cross(r, v);
  const hMagnitude = magnitude(h);
  positive(hMagnitude, 'angular momentum (a straight-line fall has no orbital plane)');
  const hHat = scale(h, 1 / hMagnitude);
  const speedSquared = dot(v, v);
  // e = ((v² − μ/r) r − (r·v) v) / μ, pointing at periapsis.
  const eVector = scale(
    subtract(scale(r, speedSquared - mu / radius), scale(v, dot(r, v))),
    1 / mu,
  );
  const e = magnitude(eVector);
  const energy = speedSquared / 2 - mu / radius;
  const p = (hMagnitude * hMagnitude) / mu;
  const node = { x: -h.y, y: h.x, z: 0 }; // north × h
  const nodeLength = magnitude(node);
  const equatorial = nodeLength < EQUATORIAL * hMagnitude;
  const circular = e < CIRCULAR;
  const reference = equatorial ? X : scale(node, 1 / nodeLength);
  const ascendingNode = equatorial ? 0 : modulo(Math.atan2(node.y, node.x), TWO_PI);
  const argumentOfPeriapsis = circular ? 0 : modulo(signedAngle(reference, eVector, hHat), TWO_PI);
  const fromPeriapsis = signedAngle(circular ? reference : eVector, r, hHat);
  const trueAnomaly = e < 1 ? modulo(fromPeriapsis, TWO_PI) : fromPeriapsis;
  const elements: OrbitalElements = {
    periapsis: p / (1 + e),
    eccentricity: circular ? 0 : e,
    // atan2 keeps precision near 0 and π, where acos cannot resolve below ~1e-8.
    inclination: Math.atan2(Math.hypot(h.x, h.y), h.z),
    ascendingNode,
    argumentOfPeriapsis,
    trueAnomaly,
  };
  return withTiming(elements, mu, energy);
}

/** Inertial position and velocity on an orbit, the inverse of {@link orbitFromState}. */
export function stateFromOrbit(
  elements: OrbitalElements,
  gravitationalParameter: number,
): OrbitalState {
  validateElements(elements);
  positive(gravitationalParameter, 'gravitationalParameter');
  const { eccentricity: e, trueAnomaly: nu } = elements;
  const p = elements.periapsis * (1 + e);
  const r = p / (1 + e * Math.cos(nu));
  const speed = Math.sqrt(gravitationalParameter / p);
  // Perifocal frame (x toward periapsis, z along h), then node, tilt, and periapsis turns.
  const position = { x: r * Math.cos(nu), y: r * Math.sin(nu), z: 0 };
  const velocity = { x: -speed * Math.sin(nu), y: speed * (e + Math.cos(nu)), z: 0 };
  // Perifocal to textbook axes: turn by ω about z, tilt by i about x, turn by Ω about z.
  const turn = multiplyQuaternions(
    rotationAbout('z', elements.ascendingNode),
    multiplyQuaternions(
      rotationAbout('x', elements.inclination),
      rotationAbout('z', elements.argumentOfPeriapsis),
    ),
  );
  return {
    position: fromTextbook(bodyToWorld(turn, position)),
    velocity: fromTextbook(bodyToWorld(turn, velocity)),
  };
}

/**
 * Where an unpowered vehicle will be `dt` seconds later on its two-body orbit:
 * Kepler's problem solved with universal variables, valid for circles, ellipses,
 * parabolas, and hyperbolas alike. Inertial coordinates; `dt` must not be negative.
 */
export function propagateKepler(
  state: OrbitalState,
  gravitationalParameter: number,
  dt: number,
): OrbitalState {
  vector(state.position, 'position');
  vector(state.velocity, 'velocity');
  positive(gravitationalParameter, 'gravitationalParameter');
  nonNegative(dt, 'dt');
  const mu = gravitationalParameter;
  const sqrtMu = Math.sqrt(mu);
  const r0 = magnitude(state.position);
  positive(r0, 'distance from the centre');
  const radialSpeed = dot(state.position, state.velocity) / r0;
  // α = 1/a: positive bound, zero parabolic, negative escaping.
  const alpha = 2 / r0 - dot(state.velocity, state.velocity) / mu;
  let t = dt;
  let upper = Infinity;
  if (alpha > 0) {
    // Whole revolutions change nothing; one revolution spans χ = 2π/√α.
    const period = TWO_PI / Math.sqrt(mu * alpha ** 3);
    t = dt % period;
    upper = TWO_PI / Math.sqrt(alpha);
  }
  if (t === 0) return { position: { ...state.position }, velocity: { ...state.velocity } };
  const a1 = (r0 * radialSpeed) / sqrtMu;
  const a2 = 1 - alpha * r0;
  // Kepler's equation in the universal anomaly χ: F(χ) = √μ·t at the answer. F
  // rises monotonically (dF/dχ = r > 0), so a bracket plus Newton always converges.
  const timeOf = (chi: number) => {
    const z = alpha * chi * chi;
    return a1 * chi * chi * stumpffC(z) + a2 * chi ** 3 * stumpffS(z) + r0 * chi;
  };
  const target = sqrtMu * t;
  let lower = 0;
  if (!Number.isFinite(upper)) {
    upper = Math.max(target / r0, 1e-6);
    while (timeOf(upper) < target) upper *= 2;
  }
  let chi = Math.min(upper, Math.max(lower, alpha > 0 ? sqrtMu * alpha * t : target / r0));
  for (let n = 0; n < 200; n++) {
    const z = alpha * chi * chi;
    const c = stumpffC(z);
    const s = stumpffS(z);
    const f = a1 * chi * chi * c + a2 * chi ** 3 * s + r0 * chi - target;
    if (f === 0) break;
    if (f > 0) upper = chi;
    else lower = chi;
    const slope = a1 * chi * (1 - z * s) + a2 * chi * chi * c + r0;
    let next = chi - f / slope;
    // Newton converges in a few steps; bisect only if it leaves the bracket.
    if (next < lower || next > upper) next = (lower + upper) / 2;
    const step = Math.abs(next - chi);
    chi = next;
    if (step <= 4 * Number.EPSILON * Math.abs(chi)) break;
  }
  // Lagrange coefficients: r = f r0 + g v0, v = ḟ r0 + ġ v0.
  const z = alpha * chi * chi;
  const c = stumpffC(z);
  const s = stumpffS(z);
  const f = 1 - ((chi * chi) / r0) * c;
  const g = t - (chi ** 3 * s) / sqrtMu;
  const position = {
    x: f * state.position.x + g * state.velocity.x,
    y: f * state.position.y + g * state.velocity.y,
    z: f * state.position.z + g * state.velocity.z,
  };
  const r = magnitude(position);
  const fDot = (sqrtMu / (r * r0)) * (alpha * chi ** 3 * s - chi);
  const gDot = 1 - ((chi * chi) / r) * c;
  return {
    position,
    velocity: {
      x: fDot * state.position.x + gDot * state.velocity.x,
      y: fDot * state.position.y + gDot * state.velocity.y,
      z: fDot * state.position.z + gDot * state.velocity.z,
    },
  };
}

/**
 * Seconds until the orbit next descends through `radius` metres from the centre;
 * undefined if it never does (the whole orbit is above, or below, or it is
 * circular, or an escape is already outbound).
 */
export function timeToRadius(
  orbit: Orbit,
  gravitationalParameter: number,
  radius: number,
): number | undefined {
  positive(radius, 'radius');
  const e = orbit.eccentricity;
  if (e === 0 || radius <= orbit.periapsis || radius >= orbit.apoapsis) return undefined;
  const p = orbit.periapsis * (1 + e);
  const descending = -Math.acos(Math.max(-1, Math.min(1, (p / radius - 1) / e)));
  const gap =
    timeSincePeriapsis(e, p, gravitationalParameter, descending) -
    timeSincePeriapsis(e, p, gravitationalParameter, orbit.trueAnomaly);
  if (e < 1) return modulo(gap, orbit.period);
  return gap >= 0 ? gap : undefined;
}

/** The orbit of a flight state in either frame, `time` seconds after the frames coincided. */
export function orbitOf(
  state: FlightState,
  body: CelestialBody,
  frame: OrbitFrame,
  time: number,
): Orbit {
  validateBody(body);
  const inertial = frame === 'inertial' ? state : bodyFixedToInertial(state, body, time);
  return orbitFromState(inertial, body.gravitationalParameter);
}

/**
 * Seconds until a flight state, coasting, next descends through `altitude` metres
 * above the body's reference sphere; undefined if it never does.
 */
export function timeToAltitude(
  state: FlightState,
  body: CelestialBody,
  frame: OrbitFrame,
  time: number,
  altitude: number,
): number | undefined {
  finite(altitude, 'altitude');
  return timeToRadius(
    orbitOf(state, body, frame, time),
    body.gravitationalParameter,
    body.radius + altitude,
  );
}

/**
 * Coasts a flight state `dt` seconds without thrust or torque, exactly: the
 * centre of mass follows its Kepler orbit and the body keeps turning by Euler's
 * torque-free equations. `time` is seconds since the frames coincided at the
 * start of the step. Fuel is unchanged. The basis of on-rails time warp.
 */
export function coastOnRails(
  state: FlightState,
  inertia: Vector3,
  body: CelestialBody,
  frame: OrbitFrame,
  time: number,
  dt: number,
): FlightState {
  validateBody(body);
  unitQuaternion(state.orientation);
  vector(state.angularVelocity, 'angularVelocity');
  for (const axis of ['x', 'y', 'z'] as const) positive(inertia[axis], 'inertia');
  nonNegative(dt, 'dt');
  const inertial = frame === 'inertial' ? state : bodyFixedToInertial(state, body, time);
  const moved = propagateKepler(inertial, body.gravitationalParameter, dt);
  const spun = coastAttitude(inertial.orientation, inertial.angularVelocity, inertia, dt);
  const next: FlightState = { ...inertial, ...moved, ...spun };
  return frame === 'inertial' ? next : inertialToBodyFixed(next, body, time + dt);
}

function withTiming(elements: OrbitalElements, mu: number, energy: number): Orbit {
  const e = elements.eccentricity;
  const p = elements.periapsis * (1 + e);
  const bound = e < 1;
  const semiMajorAxis = e === 1 ? Infinity : p / (1 - e * e);
  const period = bound ? TWO_PI * Math.sqrt(semiMajorAxis ** 3 / mu) : Infinity;
  const now = timeSincePeriapsis(e, p, mu, elements.trueAnomaly);
  let timeToPeriapsis: number | undefined;
  let timeToApoapsis: number | undefined;
  if (bound && e > 0) {
    timeToPeriapsis = modulo(-now, period);
    timeToApoapsis = modulo(period / 2 - now, period);
  } else if (!bound && now < 0) {
    timeToPeriapsis = -now;
  }
  return {
    ...elements,
    semiMajorAxis,
    apoapsis: bound ? p / (1 - e) : Infinity,
    period,
    specificEnergy: energy,
    timeToPeriapsis,
    timeToApoapsis,
  };
}

// Signed seconds since periapsis at true anomaly ν, from Kepler's equation:
// elliptic in (−T/2, T/2], hyperbolic and parabolic (Barker) unbounded.
function timeSincePeriapsis(e: number, p: number, mu: number, nu: number): number {
  if (Math.abs(e - 1) < PARABOLIC) {
    const d = Math.tan(nu / 2);
    return 0.5 * Math.sqrt(p ** 3 / mu) * (d + d ** 3 / 3);
  }
  const a = p / (1 - e * e);
  if (e < 1) {
    const E =
      2 * Math.atan2(Math.sqrt(1 - e) * Math.sin(nu / 2), Math.sqrt(1 + e) * Math.cos(nu / 2));
    return (E - e * Math.sin(E)) / Math.sqrt(mu / a ** 3);
  }
  const H = 2 * Math.atanh(Math.sqrt((e - 1) / (e + 1)) * Math.tan(nu / 2));
  return (e * Math.sinh(H) - H) / Math.sqrt(mu / (-a) ** 3);
}

// Stumpff functions; series near zero, where the closed forms cancel badly.
function stumpffC(z: number): number {
  if (Math.abs(z) < 1e-3) return 1 / 2 - z / 24 + (z * z) / 720 - (z * z * z) / 40_320;
  if (z > 0) return (1 - Math.cos(Math.sqrt(z))) / z;
  return (Math.cosh(Math.sqrt(-z)) - 1) / -z;
}

function stumpffS(z: number): number {
  if (Math.abs(z) < 1e-3) return 1 / 6 - z / 120 + (z * z) / 5_040 - (z * z * z) / 362_880;
  if (z > 0) {
    const root = Math.sqrt(z);
    return (root - Math.sin(root)) / root ** 3;
  }
  const root = Math.sqrt(-z);
  return (Math.sinh(root) - root) / root ** 3;
}

function validateElements(elements: OrbitalElements): void {
  positive(elements.periapsis, 'periapsis');
  nonNegative(elements.eccentricity, 'eccentricity');
  bounded(elements.inclination, 0, Math.PI, 'inclination');
  finite(elements.ascendingNode, 'ascendingNode');
  finite(elements.argumentOfPeriapsis, 'argumentOfPeriapsis');
  finite(elements.trueAnomaly, 'trueAnomaly');
  if (elements.eccentricity >= 1) {
    const limit = Math.acos(-1 / elements.eccentricity);
    if (Math.abs(elements.trueAnomaly) >= limit) {
      throw new RangeError('trueAnomaly is beyond the asymptote of an escape orbit');
    }
  }
}
