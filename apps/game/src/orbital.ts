import {
  bodyFixedEnvironment,
  bodyFixedToInertial,
  bodyFixedToSurface,
  bodyFixedToSurfaceFrame,
  bodyToWorld,
  conjugate,
  heightAboveTerrain,
  inertialToBodyFixed,
  magnitude,
  MOON,
  multiplyQuaternions,
  normalizeQuaternion,
  orbitOf,
  rotationAbout,
  scale,
  stateFromOrbit,
  surfaceFrame,
  toRadians,
  type FlightState,
  type Orbit,
  type OrbitalElements,
  type Quaternion,
  type Terrain,
  type Vector3,
} from '@gravitas/engine';
import type { OrbitTelemetry } from '@gravitas/ui';
import type { OrbitPath, PlanetPose } from '@gravitas/viewport';
import { ATTITUDE, CENTER_OF_MASS_HEIGHT, LANDER } from './lander';
import { LANDING_LIMITS } from './rules';
import type { FlightScenario } from './session';

// The orbit sandbox (5.3b): the first lander in lunar orbit, to try orbits, time
// warp, and the map before the real level (5.5). It flies in the Moon-fixed frame
// (ADR 0018); the viewport sees a frame centred on the vehicle (ADR 0020).

const mu = MOON.gravitationalParameter;

/**
 * Rails warp stops this high above the mean radius: above the Moon's highest
 * ground, about 10.8 km, with a margin.
 */
export const RAILS_FLOOR = 12_000;

/** A 15 × 100 km orbit inclined 20°, like a descent orbit; the flight starts at apoapsis. */
export const SANDBOX_ORBIT: OrbitalElements = {
  periapsis: MOON.radius + 15_000,
  eccentricity: 85_000 / (2 * MOON.radius + 115_000),
  inclination: toRadians(20),
  ascendingNode: toRadians(30),
  argumentOfPeriapsis: toRadians(200),
  trueAnomaly: Math.PI,
};

/** Unit vector toward the Sun in the Moon's inertial frame: the start is in daylight. */
export const SUN_DIRECTION: Vector3 = sunBehind(SANDBOX_ORBIT);

// The Sun 60° from the zenith, behind the vehicle along its track at the start, so
// the light is low and the terminator comes into view as it orbits.
function sunBehind(elements: OrbitalElements): Vector3 {
  const { position, velocity } = stateFromOrbit(elements, mu);
  const up = scale(position, 1 / magnitude(position));
  const ahead = scale(velocity, 1 / magnitude(velocity));
  const sun = {
    x: 0.5 * up.x - 0.87 * ahead.x,
    y: 0.5 * up.y - 0.87 * ahead.y,
    z: 0.5 * up.z - 0.87 * ahead.z,
  };
  return scale(sun, 1 / magnitude(sun));
}

/**
 * The sandbox's start: on SANDBOX_ORBIT at apoapsis, upright, facing along its
 * track over the ground, with a full tank. Moon-fixed, at time 0.
 */
export function sandboxStart(): FlightState {
  const inertial: FlightState = {
    ...stateFromOrbit(SANDBOX_ORBIT, mu),
    orientation: { x: 0, y: 0, z: 0, w: 1 },
    angularVelocity: { x: 0, y: 0, z: 0 },
    fuelMass: LANDER.fuelCapacity,
  };
  const fixed = inertialToBodyFixed(inertial, MOON, 0);
  const frame = surfaceFrame(MOON, bodyFixedToSurface(MOON, fixed.position));
  const local = bodyFixedToSurfaceFrame(fixed, frame).velocity;
  // Heading h faces (−sin h, 0, −cos h): turn body −Z onto the ground track.
  const heading = Math.atan2(-local.x, -local.z);
  return {
    ...fixed,
    orientation: normalizeQuaternion(
      multiplyQuaternions(frame.orientation, rotationAbout('y', heading)),
    ),
  };
}

/** Everything a flight session needs for the orbit sandbox. */
export const ORBIT_SANDBOX: FlightScenario = {
  start: sandboxStart(),
  vehicle: LANDER,
  attitude: ATTITUDE,
  // No surface yet: the terrain is drawn and touched from 5.4b.
  environment: bodyFixedEnvironment(MOON),
  limits: LANDING_LIMITS,
  orbit: { body: MOON, frame: 'body-fixed', railsFloor: RAILS_FLOOR },
};

/** What the viewport draws for one frame, in a world centred on the vehicle. */
export interface OrbitalScene {
  /** The latest tick's state in the vehicle-centred frame (at the origin, +Y up). */
  readonly current: FlightState;
  /** The tick before, in the same frame, for interpolation. */
  readonly previous: FlightState;
  /** The Moon's centre and body-fixed axes in that frame. */
  readonly planet: PlanetPose;
  /** Toward the Sun in that frame. */
  readonly sun: Vector3;
}

/**
 * The frame centred on the vehicle at `state`, +Y away from the Moon's centre, +X
 * east, −Z north, and both states and the Moon in it, `time` seconds into the
 * flight. Float32 rendering stays steady because the vehicle is at the origin.
 */
export function orbitalScene(
  state: FlightState,
  previous: FlightState,
  time: number,
): OrbitalScene {
  const frame = surfaceFrame(MOON, bodyFixedToSurface(MOON, state.position));
  const toLocal: Quaternion = conjugate(frame.orientation);
  const sunFixed = bodyToWorld(rotationAbout('y', -MOON.rotationRate * time), SUN_DIRECTION);
  return {
    current: bodyFixedToSurfaceFrame(state, frame),
    previous: bodyFixedToSurfaceFrame(previous, frame),
    planet: { centre: bodyToWorld(toLocal, scale(frame.origin, -1)), orientation: toLocal },
    sun: bodyToWorld(toLocal, sunFixed),
  };
}

// The orbit through a Moon-fixed state, or undefined for a fall straight toward
// the centre (no orbital plane), which the engine rejects.
function orbitAt(state: FlightState, time: number): Orbit | undefined {
  try {
    return orbitOf(state, MOON, 'body-fixed', time);
  } catch (error) {
    if (error instanceof RangeError) return undefined;
    throw error;
  }
}

/**
 * Points along the current orbit in Moon-fixed metres, for the map: a closed loop
 * when bound, or the arc out to 10 Moon radii when escaping, with periapsis and
 * apoapsis marks. Undefined without an orbit.
 */
export function orbitPath(state: FlightState, time: number, samples = 256): OrbitPath | undefined {
  const orbit = orbitAt(state, time);
  if (!orbit) return undefined;
  const back = rotationAbout('y', -MOON.rotationRate * time);
  const at = (trueAnomaly: number) =>
    bodyToWorld(back, stateFromOrbit({ ...orbit, trueAnomaly }, mu).position);
  const circular = orbit.eccentricity === 0;
  if (orbit.eccentricity < 1) {
    const points = Array.from({ length: samples }, (_, i) => at((i / samples) * 2 * Math.PI));
    return circular
      ? { points, closed: true }
      : { points, closed: true, periapsis: at(0), apoapsis: at(Math.PI) };
  }
  // Escaping: from 10 radii inbound, through periapsis, to 10 radii outbound.
  const e = orbit.eccentricity;
  const p = orbit.periapsis * (1 + e);
  const reach = Math.acos(Math.max(-1, (p / (10 * MOON.radius) - 1) / e));
  const points = Array.from({ length: samples }, (_, i) =>
    at(-reach + (2 * reach * i) / (samples - 1)),
  );
  return { points, closed: false, periapsis: at(0) };
}

/** The orbit readouts: heights above the mean radius, times, and inertial speed. */
export function orbitTelemetry(state: FlightState, time: number): OrbitTelemetry | undefined {
  const orbit = orbitAt(state, time);
  if (!orbit) return undefined;
  const speed = magnitude(bodyFixedToInertial(state, MOON, time).velocity);
  return {
    apoapsis: orbit.apoapsis - MOON.radius,
    periapsis: orbit.periapsis - MOON.radius,
    speed,
    ...(orbit.timeToApoapsis === undefined ? {} : { timeToApoapsis: orbit.timeToApoapsis }),
    ...(orbit.timeToPeriapsis === undefined ? {} : { timeToPeriapsis: orbit.timeToPeriapsis }),
  };
}

/** Height of the centre of mass above the mean radius, less the feet's offset, in metres. */
export function sphereAltitude(state: FlightState): number {
  return magnitude(state.position) - MOON.radius - CENTER_OF_MASS_HEIGHT;
}

/**
 * The altitude readout: the feet's height above the ground straight below, like a
 * landing radar, or above the mean radius until the terrain has loaded.
 */
export function groundAltitude(state: FlightState, terrain: Terrain | undefined): number {
  return terrain
    ? heightAboveTerrain(terrain, state.position) - CENTER_OF_MASS_HEIGHT
    : sphereAltitude(state);
}

/** Gravity at a Moon-fixed position, in metres per second squared. */
export function localGravity(state: FlightState): number {
  return mu / magnitude(state.position) ** 2;
}
