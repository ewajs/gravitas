import type { Quaternion, Vector3 } from './pose';
import type { FlightState } from './flight';
import type { CentralGravity, FrameRotation } from './gravity';
import { add, conjugate, cross, multiplyQuaternions, rotationAbout, subtract } from './math';
import { bodyToWorld } from './orientation';
import { bounded, finite, positive } from './validation';

// Three frames, all right-handed, in metres:
//
// - Body-fixed: centred on the body and turning with it. +Y is the north pole
//   (the spin axis), +X points to latitude 0, longitude 0, and longitude 90° east
//   lies along −Z. The ground never moves here, so landing happens in this frame.
// - Inertial: centred on the body, not turning; its axes match the body-fixed ones
//   at time 0. Orbits are simplest here.
// - Surface: a local frame at a site on the body, +Y up (away from the centre),
//   +X east, and −Z north, so a vehicle facing −Z faces north. It is the body-fixed
//   frame moved and turned, so it turns with the body too.
//
// FlightState.angularVelocity is always the body's rotation relative to inertial
// space, in body axes (what gyroscopes measure), so it is the same in every frame.

/** Size, mass, and spin of a spherical body that a flight can orbit and land on. */
export interface CelestialBody {
  /** Mean radius of the reference sphere, in metres. */
  readonly radius: number;
  /** μ = GM in cubic metres per second squared. */
  readonly gravitationalParameter: number;
  /** Sidereal spin about the body-fixed +Y (north) axis, in radians per second. */
  readonly rotationRate: number;
}

/**
 * The Moon as a sphere: IAU mean radius 1,737.4 km; GM 4,902.800 km³/s² from
 * GRAIL (GL0660B) and the JPL DE440 ephemeris; one sidereal turn every 27.321661
 * days, about the north pole. Libration, axial tilt, and mascons are ignored.
 */
export const MOON: CelestialBody = {
  radius: 1_737_400,
  gravitationalParameter: 4.902_800e12,
  rotationRate: (2 * Math.PI) / (27.321_661 * 86_400),
};

/** Where a point is over a body: angles in radians, altitude in metres above the reference sphere. */
export interface SurfacePosition {
  /** North positive, in [−π/2, π/2]. */
  readonly latitude: number;
  /** East positive, in (−π, π]. */
  readonly longitude: number;
  /** Height above the mean radius, in metres. */
  readonly altitude: number;
}

/**
 * A surface frame located in the body-fixed frame: its origin, and the rotation
 * taking surface coordinates to body-fixed ones.
 */
export interface SurfaceFrame {
  /** The frame's origin in body-fixed metres. */
  readonly origin: Vector3;
  /** Unit quaternion rotating surface-frame coordinates into body-fixed ones. */
  readonly orientation: Quaternion;
}

/** Gravity and rotation for flying in some frame of a body; spread into a `FlightEnvironment`. */
export interface BodyEnvironment {
  readonly gravity: CentralGravity;
  /** Present when the frame turns with the body. */
  readonly rotation?: FrameRotation;
}

const ORIGIN: Vector3 = { x: 0, y: 0, z: 0 };

/** Rejects a body with a non-positive radius or μ, or a non-finite spin. */
export function validateBody(body: CelestialBody): void {
  positive(body.radius, 'radius');
  positive(body.gravitationalParameter, 'gravitationalParameter');
  finite(body.rotationRate, 'rotationRate');
}

/** Gravity for flying in the body-centred inertial frame: no rotation terms. */
export function inertialEnvironment(body: CelestialBody): BodyEnvironment {
  validateBody(body);
  return {
    gravity: {
      kind: 'central',
      centre: ORIGIN,
      gravitationalParameter: body.gravitationalParameter,
    },
  };
}

/** Gravity and spin for flying in the body-fixed frame, where the ground stands still. */
export function bodyFixedEnvironment(body: CelestialBody): BodyEnvironment {
  return {
    ...inertialEnvironment(body),
    rotation: { angularVelocity: { x: 0, y: body.rotationRate, z: 0 }, axisPoint: ORIGIN },
  };
}

/** Body-fixed position of a surface position, in metres. */
export function surfaceToBodyFixed(body: CelestialBody, place: SurfacePosition): Vector3 {
  validateBody(body);
  validatePlace(place);
  const r = body.radius + place.altitude;
  const cosLatitude = Math.cos(place.latitude);
  return {
    x: r * cosLatitude * Math.cos(place.longitude),
    y: r * Math.sin(place.latitude),
    z: -r * cosLatitude * Math.sin(place.longitude),
  };
}

/** Latitude, longitude, and altitude of a body-fixed position (not the centre). */
export function bodyFixedToSurface(body: CelestialBody, position: Vector3): SurfacePosition {
  validateBody(body);
  const horizontal = Math.hypot(position.x, position.z);
  const r = Math.hypot(horizontal, position.y);
  positive(r, 'distance from the centre');
  return {
    latitude: Math.atan2(position.y, horizontal),
    // At a pole every longitude is the same point; atan2(0, 0) gives 0.
    longitude: Math.atan2(-position.z, position.x),
    altitude: r - body.radius,
  };
}

/**
 * The surface frame at a place: origin there, +Y up, +X east, −Z north. Altitude
 * sets the origin's height, such as a landing site's ground level.
 */
export function surfaceFrame(body: CelestialBody, place: SurfacePosition): SurfaceFrame {
  // At latitude 0, longitude 0, surface +X (east) is body −Z, +Y (up) is body +X,
  // and +Z (south) is body −Y. Tilting that frame by the latitude about body +Z
  // (which points west there) carries up toward the north pole; turning it by the
  // longitude about the pole then carries it east.
  const atOrigin: Quaternion = { x: 0.5, y: 0.5, z: -0.5, w: 0.5 };
  const orientation = multiplyQuaternions(
    rotationAbout('y', place.longitude),
    multiplyQuaternions(rotationAbout('z', place.latitude), atOrigin),
  );
  return { origin: surfaceToBodyFixed(body, place), orientation };
}

/** Gravity and spin for flying in a surface frame: the centre lies below, the axis tilted by latitude. */
export function surfaceEnvironment(body: CelestialBody, frame: SurfaceFrame): BodyEnvironment {
  validateBody(body);
  const centre = pointToSurface(ORIGIN, frame);
  return {
    gravity: { kind: 'central', centre, gravitationalParameter: body.gravitationalParameter },
    rotation: {
      angularVelocity: vectorToSurface({ x: 0, y: body.rotationRate, z: 0 }, frame),
      axisPoint: centre,
    },
  };
}

/** A flight state re-expressed from the body-fixed frame into a surface frame. */
export function bodyFixedToSurfaceFrame(state: FlightState, frame: SurfaceFrame): FlightState {
  return {
    ...state,
    position: pointToSurface(state.position, frame),
    velocity: vectorToSurface(state.velocity, frame),
    orientation: multiplyQuaternions(conjugate(frame.orientation), state.orientation),
  };
}

/** A flight state re-expressed from a surface frame into the body-fixed frame. */
export function surfaceFrameToBodyFixed(state: FlightState, frame: SurfaceFrame): FlightState {
  return {
    ...state,
    position: add(bodyToWorld(frame.orientation, state.position), frame.origin),
    velocity: bodyToWorld(frame.orientation, state.velocity),
    orientation: multiplyQuaternions(frame.orientation, state.orientation),
  };
}

/**
 * A body-fixed flight state as seen in the inertial frame `time` seconds after the
 * two frames coincided. Ground at rest picks up the spin's velocity, Ω × r.
 */
export function bodyFixedToInertial(
  state: FlightState,
  body: CelestialBody,
  time: number,
): FlightState {
  validateBody(body);
  // Time may run either way from the moment the frames coincided.
  finite(time, 'time');
  const turn = rotationAbout('y', body.rotationRate * time);
  const spin = cross({ x: 0, y: body.rotationRate, z: 0 }, state.position);
  const velocity = add(state.velocity, spin);
  return {
    ...state,
    position: bodyToWorld(turn, state.position),
    velocity: bodyToWorld(turn, velocity),
    orientation: multiplyQuaternions(turn, state.orientation),
  };
}

/** An inertial flight state as seen in the body-fixed frame `time` seconds after they coincided. */
export function inertialToBodyFixed(
  state: FlightState,
  body: CelestialBody,
  time: number,
): FlightState {
  validateBody(body);
  // Time may run either way from the moment the frames coincided.
  finite(time, 'time');
  const back = rotationAbout('y', -body.rotationRate * time);
  const position = bodyToWorld(back, state.position);
  const turned = bodyToWorld(back, state.velocity);
  const spin = cross({ x: 0, y: body.rotationRate, z: 0 }, position);
  return {
    ...state,
    position,
    velocity: subtract(turned, spin),
    orientation: multiplyQuaternions(back, state.orientation),
  };
}

function pointToSurface(point: Vector3, frame: SurfaceFrame): Vector3 {
  return vectorToSurface(subtract(point, frame.origin), frame);
}

function vectorToSurface(v: Vector3, frame: SurfaceFrame): Vector3 {
  return bodyToWorld(conjugate(frame.orientation), v);
}

function validatePlace(place: SurfacePosition): void {
  bounded(place.latitude, -Math.PI / 2, Math.PI / 2, 'latitude');
  finite(place.longitude, 'longitude');
  finite(place.altitude, 'altitude');
}
