// Models behind the manual's interactive explorers. Each runs the real Gravitas
// engine where the game does, next to the closed-form math the pages teach, so a
// reader can see the two agree. Pure functions; no DOM.
import {
  contactFacts,
  MAX_FLIGHT_STEP,
  rateControlTorque,
  stepFlight,
  type ContactPoint,
  type FlightState,
  type VehicleParameters,
} from '@gravitas/engine';
import { ATTITUDE, CONTACTS, LANDER } from '../../../apps/game/src/lander';

/** A plotted point. */
export type Point = readonly [x: number, y: number];

const ZERO = { x: 0, y: 0, z: 0 } as const;
const UPRIGHT = { x: 0, y: 0, z: 0, w: 1 } as const;

const state = (changes: Partial<FlightState>): FlightState => ({
  position: ZERO,
  orientation: UPRIGHT,
  velocity: ZERO,
  angularVelocity: ZERO,
  fuelMass: 0,
  ...changes,
});

/** Gravity presets in m/s², for comparing worlds. */
export const GRAVITY = { moon: 1.62, mars: 3.71, earth: 9.81 } as const;

// ---------------------------------------------------------------- free fall

export interface FreeFall {
  /** Seconds until the ground, from h(t) = h₀ + v₀t − ½gt² = 0. */
  readonly impactTime: number;
  /** Speed at the ground, √(v₀² + 2gh₀). */
  readonly impactSpeed: number;
  /** Height from the formula, sampled to impact. */
  readonly formula: readonly Point[];
  /** Height from the engine, stepped at 60 Hz. */
  readonly engine: readonly Point[];
  /** Vertical velocity from the formula (positive up). */
  readonly velocity: readonly Point[];
}

/** Unpowered fall from height h₀ (m) with initial vertical speed v₀ (m/s, + up). */
export function freeFall(h0: number, v0: number, g: number): FreeFall {
  const impactTime = (v0 + Math.sqrt(v0 * v0 + 2 * g * h0)) / g;
  const impactSpeed = Math.sqrt(v0 * v0 + 2 * g * h0);
  const samples = 60;
  const formula: Point[] = [];
  const velocity: Point[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = (impactTime * i) / samples;
    formula.push([t, Math.max(0, h0 + v0 * t - 0.5 * g * t * t)]);
    velocity.push([t, v0 - g * t]);
  }
  const engine: Point[] = [[0, h0]];
  let s = state({ position: { x: 0, y: h0, z: 0 }, velocity: { x: 0, y: v0, z: 0 } });
  const environment = { gravity: { x: 0, y: -g, z: 0 } };
  const vehicle = { ...LANDER, contacts: [] };
  const every = Math.max(1, Math.round(impactTime / MAX_FLIGHT_STEP / 30));
  for (let n = 1; s.position.y > 0 && n < 60 * 600; n++) {
    s = stepFlight(s, { throttle: 0, bodyTorque: ZERO }, vehicle, environment, MAX_FLIGHT_STEP);
    if (n % every === 0 || s.position.y <= 0) {
      engine.push([n * MAX_FLIGHT_STEP, Math.max(0, s.position.y)]);
    }
  }
  return { impactTime, impactSpeed, formula, engine, velocity };
}

// ---------------------------------------------------------------- rockets

export interface Rocket {
  readonly mass: number;
  readonly thrust: number;
  /** Throttle needed to hover at this mass and tilt (may exceed 1). */
  readonly hoverThrottle: number;
  /** Vertical and horizontal acceleration at the start, m/s². */
  readonly vertical: number;
  readonly horizontal: number;
  /** Seconds of burn at this throttle until the loaded fuel is gone. */
  readonly burnTime: number;
  /** Ideal velocity change from the rocket equation, vₑ ln(m₀/m₁), m/s. */
  readonly deltaV: number;
  /** Vertical speed over time from rest, until burnout or 60 s: formula and engine. */
  readonly formula: readonly Point[];
  readonly engine: readonly Point[];
}

/**
 * The game's lander burning at a constant throttle and tilt, from rest, under
 * lunar gravity. The formula is the rocket equation with gravity:
 * v(t) = (F cos θ / ṁ) ln(m₀ / (m₀ − ṁt)) − g t.
 */
export function rocket(
  throttle: number,
  fuel: number,
  tiltDegrees: number,
  g = GRAVITY.moon,
): Rocket {
  const tilt = (tiltDegrees * Math.PI) / 180;
  const mass = LANDER.dryMass + fuel;
  const thrust = throttle * LANDER.maxThrust;
  const flow = thrust / LANDER.exhaustVelocity;
  const burnTime = flow > 0 ? fuel / flow : Infinity;
  const duration = Math.min(60, burnTime);
  const formula: Point[] = [];
  for (let i = 0; i <= 60; i++) {
    const t = (duration * i) / 60;
    const climb =
      flow > 0 ? ((thrust * Math.cos(tilt)) / flow) * Math.log(mass / (mass - flow * t)) : 0;
    formula.push([t, climb - g * t]);
  }
  // The engine flies the same burn with the vehicle held at that tilt (no rotation).
  const orientation = { x: 0, y: 0, z: Math.sin(-tilt / 2), w: Math.cos(-tilt / 2) };
  let s = state({ orientation, fuelMass: fuel });
  const engine: Point[] = [[0, 0]];
  const vehicle = { ...LANDER, contacts: [] };
  const steps = Math.round(duration / MAX_FLIGHT_STEP);
  const every = Math.max(1, Math.round(steps / 30));
  for (let n = 1; n <= steps; n++) {
    s = stepFlight(
      s,
      { throttle, bodyTorque: ZERO },
      vehicle,
      { gravity: { x: 0, y: -g, z: 0 } },
      MAX_FLIGHT_STEP,
    );
    if (n % every === 0 || n === steps) engine.push([n * MAX_FLIGHT_STEP, s.velocity.y]);
  }
  return {
    mass,
    thrust,
    hoverThrottle: (mass * g) / (LANDER.maxThrust * Math.cos(tilt)),
    vertical: (thrust * Math.cos(tilt)) / mass - g,
    horizontal: (thrust * Math.sin(tilt)) / mass,
    burnTime,
    deltaV: LANDER.exhaustVelocity * Math.log(mass / LANDER.dryMass),
    formula,
    engine,
  };
}

// ---------------------------------------------------------------- rotation

export interface RateResponse {
  /** Pitch rate (°/s) over time: the request held, then released. */
  readonly rate: readonly Point[];
  /** Requested rate (°/s) over time. */
  readonly request: readonly Point[];
  /** Pitch angle (°) over time. */
  readonly angle: readonly Point[];
  /** Fuel burned by the attitude thrusters, kg. */
  readonly fuel: number;
  /** Angular acceleration limit, maxTorque / I, in °/s². */
  readonly limit: number;
}

/**
 * The game's rate assist on the pitch axis: request `fraction` of the 30°/s maximum
 * for `hold` seconds, then release, with the given response time. Engine-driven.
 */
export function rateResponse(fraction: number, responseTime: number, hold = 1.5): RateResponse {
  const settings = { ...ATTITUDE, responseTime };
  const vehicle = { ...LANDER, contacts: [] };
  let s = state({ fuelMass: 60 });
  const rate: Point[] = [[0, 0]];
  const request: Point[] = [[0, 0]];
  const angle: Point[] = [[0, 0]];
  const toDegrees = 180 / Math.PI;
  let pitch = 0;
  const total = hold + 2.5;
  for (let n = 1; n * MAX_FLIGHT_STEP <= total + 1e-9; n++) {
    const t = n * MAX_FLIGHT_STEP;
    const wanted = t <= hold ? fraction : 0;
    const bodyTorque = rateControlTorque(
      s.angularVelocity,
      { x: wanted, y: 0, z: 0 },
      vehicle,
      settings,
    );
    s = stepFlight(s, { throttle: 0, bodyTorque }, vehicle, { gravity: ZERO }, MAX_FLIGHT_STEP);
    pitch += s.angularVelocity.x * MAX_FLIGHT_STEP;
    if (n % 3 === 0) {
      rate.push([t, s.angularVelocity.x * toDegrees]);
      request.push([t, wanted * settings.maxRate.x * toDegrees]);
      angle.push([t, pitch * toDegrees]);
    }
  }
  return {
    rate,
    request,
    angle,
    fuel: 60 - s.fuelMass,
    limit: (LANDER.maxTorque.x / LANDER.inertia.x) * toDegrees,
  };
}

// ---------------------------------------------------------------- integration

/** One step of x″ = −ω²x, as [position, velocity]. */
type Oscillator = readonly [x: number, v: number];

const OMEGA = 2 * Math.PI; // One oscillation per second.
const accel = ([x]: Oscillator) => -OMEGA * OMEGA * x;

function eulerStep([x, v]: Oscillator, h: number): Oscillator {
  return [x + v * h, v + accel([x, v]) * h];
}

function rk4Step(s: Oscillator, h: number): Oscillator {
  const f = ([x, v]: Oscillator): Oscillator => [v, accel([x, v])];
  const add = (a: Oscillator, b: Oscillator, k: number): Oscillator => [
    a[0] + b[0] * k,
    a[1] + b[1] * k,
  ];
  const k1 = f(s);
  const k2 = f(add(s, k1, h / 2));
  const k3 = f(add(s, k2, h / 2));
  const k4 = f(add(s, k3, h));
  return [
    s[0] + (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
    s[1] + (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]),
  ];
}

export interface Integrators {
  readonly exact: readonly Point[];
  readonly euler: readonly Point[];
  readonly rk4: readonly Point[];
  /** State error after `duration` seconds (see stateError). */
  readonly eulerError: number;
  readonly rk4Error: number;
}

/**
 * Distance from the exact state in phase space, √(Δx² + (Δv/ω)²). Position alone
 * misleads: Euler's main error is amplitude growth, invisible where x crosses zero,
 * while phase error is invisible at a peak. The whole state shows both.
 */
function stateError([x, v]: Oscillator, t: number): number {
  return Math.hypot(x - Math.cos(OMEGA * t), (v + OMEGA * Math.sin(OMEGA * t)) / OMEGA);
}

/** A 1 Hz spring, x(0) = 1, integrated with Euler and RK4 at step `h` for `duration` s. */
export function integrators(h: number, duration = 3): Integrators {
  const steps = Math.round(duration / h);
  const exact: Point[] = [];
  for (let i = 0; i <= 120; i++) {
    const t = (duration * i) / 120;
    exact.push([t, Math.cos(OMEGA * t)]);
  }
  const run = (step: typeof eulerStep) => {
    let s: Oscillator = [1, 0];
    const points: Point[] = [[0, 1]];
    for (let n = 1; n <= steps; n++) {
      s = step(s, h);
      points.push([n * h, s[0]]);
    }
    return { points, error: stateError(s, steps * h) };
  };
  const euler = run(eulerStep);
  const rk4 = run(rk4Step);
  return {
    exact,
    euler: euler.points,
    rk4: rk4.points,
    eulerError: euler.error,
    rk4Error: rk4.error,
  };
}

/** State error after one second against step size, on log₁₀ axes, for both methods. */
export function convergence(duration = 1): { euler: Point[]; rk4: Point[] } {
  const euler: Point[] = [];
  const rk4: Point[] = [];
  // Finest step first, so log₁₀(step) ascends like every other plotted series.
  for (const steps of [2048, 1024, 512, 256, 128, 64, 32, 16]) {
    const h = duration / steps;
    let a: Oscillator = [1, 0];
    let b: Oscillator = [1, 0];
    for (let n = 0; n < steps; n++) {
      a = eulerStep(a, h);
      b = rk4Step(b, h);
    }
    // Rounded: Math.log10 can differ in the last bit between Node (page build) and the
    // browser, and identical data keeps server-rendered plots hydrating cleanly.
    const log = (v: number) => Math.round(Math.log10(v) * 1e9) / 1e9;
    euler.push([log(h), log(stateError(a, duration))]);
    rk4.push([log(h), log(Math.max(1e-16, stateError(b, duration)))]);
  }
  return { euler, rk4 };
}

// ---------------------------------------------------------------- contact

export interface LegDrop {
  /** Deepest leg compression, m. */
  readonly maxCompression: number;
  /** Highest the feet rose after first contact, m (0 if they never left). */
  readonly bounce: number;
  /** Whether the engine bell lip (0.42 m above the feet) touched the ground. */
  readonly bellStrike: boolean;
  /** Vertical natural frequency √(4k/m), rad/s, and compression damping ratio. */
  readonly omega: number;
  readonly zeta: number;
  /** Leg compression (m) and vertical velocity (m/s) over time. */
  readonly compression: readonly Point[];
  readonly velocity: readonly Point[];
}

/** The game's lander dropping upright onto flat ground at `speed` with custom legs. */
export function legDrop(
  speed: number,
  stiffness: number,
  damping: number,
  reboundDamping: number,
): LegDrop {
  const legs: ContactPoint[] = CONTACTS.map((point) =>
    point.kind === 'leg' ? { ...point, stiffness, damping, reboundDamping } : point,
  );
  const vehicle: VehicleParameters = { ...LANDER, contacts: legs };
  const environment = {
    gravity: { x: 0, y: -GRAVITY.moon, z: 0 },
    surface: { kind: 'flat', height: 0 } as const,
  };
  const mass = LANDER.dryMass + 60;
  let s = state({
    position: { x: 0, y: 1.5 + 0.02, z: 0 },
    velocity: { x: 0, y: -speed, z: 0 },
    fuelMass: 60,
  });
  const compression: Point[] = [];
  const velocity: Point[] = [];
  let maxCompression = 0;
  let bounce = 0;
  let touched = false;
  let bellStrike = false;
  for (let n = 0; n <= 60 * 4; n++) {
    const facts = contactFacts(s, legs, environment.surface);
    const leg = facts.find((fact) => fact.kind === 'leg')!;
    touched ||= leg.normalForce > 0;
    maxCompression = Math.max(maxCompression, leg.penetration);
    if (touched) bounce = Math.max(bounce, s.position.y - 1.5);
    bellStrike ||= facts.some((fact) => fact.id === 'engine-bell' && fact.normalForce > 0);
    if (n % 2 === 0) {
      compression.push([n * MAX_FLIGHT_STEP, leg.penetration]);
      velocity.push([n * MAX_FLIGHT_STEP, s.velocity.y]);
    }
    s = stepFlight(s, { throttle: 0, bodyTorque: ZERO }, vehicle, environment, MAX_FLIGHT_STEP);
  }
  const omega = Math.sqrt((4 * stiffness) / mass);
  return {
    maxCompression,
    bounce,
    bellStrike,
    omega,
    zeta: (4 * damping) / (2 * Math.sqrt(4 * stiffness * mass)),
    compression,
    velocity,
  };
}

// ---------------------------------------------------------------- orbits preview

/** The Moon: radius (m) and gravitational parameter μ = GM (m³/s²). */
export const MOON = { radius: 1_737_400, mu: 4.9048695e12 } as const;

export interface Cannon {
  readonly outcome: 'crash' | 'orbit' | 'escape';
  /** Path in kilometres, Moon centred at the origin. */
  readonly path: readonly Point[];
  /** Circular and escape speeds at the launch radius, m/s. */
  readonly circular: number;
  readonly escape: number;
  /** Orbital period in minutes for a closed orbit, else undefined. */
  readonly period: number | undefined;
}

/**
 * Newton's cannon on the Moon: a horizontal shot from `altitude` metres at `speed`
 * m/s, under inverse-square gravity, integrated with RK4 (no atmosphere to stop it).
 */
export function cannon(speed: number, altitude = 100_000): Cannon {
  const r0 = MOON.radius + altitude;
  const circular = Math.sqrt(MOON.mu / r0);
  const escape = Math.sqrt((2 * MOON.mu) / r0);
  const energy = (speed * speed) / 2 - MOON.mu / r0;
  const a = energy < 0 ? -MOON.mu / (2 * energy) : Infinity;
  const period = energy < 0 ? (2 * Math.PI * Math.sqrt(a ** 3 / MOON.mu)) / 60 : undefined;
  type S = readonly [number, number, number, number];
  const f = ([x, y, vx, vy]: S): S => {
    const r3 = Math.hypot(x, y) ** 3;
    return [vx, vy, (-MOON.mu * x) / r3, (-MOON.mu * y) / r3];
  };
  const add = (p: S, d: S, k: number): S => [
    p[0] + d[0] * k,
    p[1] + d[1] * k,
    p[2] + d[2] * k,
    p[3] + d[3] * k,
  ];
  let s: S = [0, r0, speed, 0];
  const h = 5;
  const limit = period ? Math.min(period * 60 * 1.02, 6 * 3600) : 3 * 3600;
  const path: Point[] = [[0, r0 / 1000]];
  let outcome: Cannon['outcome'] = energy >= 0 ? 'escape' : 'orbit';
  for (let t = 0; t < limit; t += h) {
    const k1 = f(s);
    const k2 = f(add(s, k1, h / 2));
    const k3 = f(add(s, k2, h / 2));
    const k4 = f(add(s, k3, h));
    s = [0, 1, 2, 3].map(
      (i) => s[i]! + (h / 6) * (k1[i]! + 2 * k2[i]! + 2 * k3[i]! + k4[i]!),
    ) as unknown as S;
    if (Math.round(t / h) % 6 === 0) path.push([s[0] / 1000, s[1] / 1000]);
    if (Math.hypot(s[0], s[1]) <= MOON.radius) {
      outcome = 'crash';
      path.push([s[0] / 1000, s[1] / 1000]);
      break;
    }
  }
  return { outcome, path, circular, escape, period: outcome === 'orbit' ? period : undefined };
}

// ---------------------------------------------------------------- axes

/** "Nice" round tick values covering [min, max] with about `count` ticks. */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!(max > min)) return [min];
  const raw = (max - min) / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((m) => m >= raw)!;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) {
    ticks.push(Math.round(v / step) * step);
  }
  return ticks;
}
