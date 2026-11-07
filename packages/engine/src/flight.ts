import type { Vector3, VehiclePose } from './pose';
import {
  contactLoads,
  validateContacts,
  validateSurface,
  type ContactPoint,
  type Surface,
} from './contact';
import {
  gravityAcceleration,
  rotatingFrameAcceleration,
  validateGravity,
  validateGravityPosition,
  validateRotation,
  type FrameRotation,
  type GravityField,
} from './gravity';
import {
  add,
  addScaled,
  addScaledQuaternion,
  multiplyQuaternions,
  normalizeQuaternion,
} from './math';
import { angularAcceleration, quaternionRate } from './rotation';
import { bounded, positive, unitQuaternion, vector } from './validation';

/** Physical state owned by the host; all vectors are independent immutable snapshots. */
export interface FlightState extends VehiclePose {
  /** Centre-of-mass velocity in world metres per second. */
  readonly velocity: Vector3;
  /**
   * Angular velocity relative to inertial space about body +X/+Y/+Z, in radians per
   * second (right-hand rule): what gyroscopes measure, the same in every world frame.
   */
  readonly angularVelocity: Vector3;
  /** Remaining propellant in the shared main/attitude tank, in kilograms. */
  readonly fuelMass: number;
}

/** Fixed physical properties supplied by the host; no particular mission is built in. */
export interface VehicleParameters {
  /** Mass with empty tanks, in kilograms. */
  readonly dryMass: number;
  /** Maximum propellant mass shared by main engine and attitude thrusters, in kilograms. */
  readonly fuelCapacity: number;
  /** Main-engine force at full throttle, in newtons, along body +Y through the centre of mass. */
  readonly maxThrust: number;
  /** Main-engine effective exhaust velocity in metres per second; mass flow is thrust divided by this. */
  readonly exhaustVelocity: number;
  /** Constant principal moments about body axes through the centre of mass, in kg m². */
  readonly inertia: Vector3;
  /** Independent symmetric body-axis torque limits, in newton metres. */
  readonly maxTorque: Vector3;
  /**
   * Moment arm of the ideal thruster couple producing torque about each body axis,
   * in metres. A couple's total thruster force is |torque| divided by this arm.
   */
  readonly attitudeLeverArm: Vector3;
  /** Attitude-thruster effective exhaust velocity in metres per second. */
  readonly attitudeExhaustVelocity: number;
  /** Points that can touch a surface; omit for a vehicle that never meets the ground. */
  readonly contacts?: readonly ContactPoint[];
}

/** Constant environment during a step; the host chooses gravity, frame, and scenario. */
export interface FlightEnvironment {
  /** Uniform gravity, or a central body's inverse-square pull. */
  readonly gravity: GravityField;
  /**
   * The world frame's spin relative to inertial space, such as a moon's frame where
   * the ground stands still; omit for a non-rotating frame.
   */
  readonly rotation?: FrameRotation;
  /** Ground the vehicle's contact points can touch; omit for free flight. */
  readonly surface?: Surface;
}

/** Actuator commands held constant during one step. Assistance computes torque separately. */
export interface FlightCommand {
  /** Main-engine fraction in [0, 1]. Empty tanks prevent thrust. */
  readonly throttle: number;
  /** Requested body torque in newton metres, within per-axis limits. Empty tanks prevent torque. */
  readonly bodyTorque: Vector3;
}

/** Largest supported integration step in seconds; hosts may use smaller steps for convergence. */
export const MAX_FLIGHT_STEP = 1 / 60;

/** Contact springs are stiff: with a surface, RK4 substeps never exceed this, in seconds. */
export const CONTACT_SUBSTEP = MAX_FLIGHT_STEP / 4;

const ZERO: Vector3 = { x: 0, y: 0, z: 0 };

export function validateVehicle(vehicle: VehicleParameters): void {
  positive(vehicle.dryMass, 'dryMass');
  positive(vehicle.fuelCapacity, 'fuelCapacity');
  positive(vehicle.maxThrust, 'maxThrust');
  positive(vehicle.exhaustVelocity, 'exhaustVelocity');
  positive(vehicle.attitudeExhaustVelocity, 'attitudeExhaustVelocity');
  positive(vehicle.dryMass + vehicle.fuelCapacity, 'total mass');
  positive(vehicle.maxThrust / vehicle.exhaustVelocity, 'full-throttle mass flow');
  for (const axis of ['x', 'y', 'z'] as const) {
    positive(vehicle.inertia[axis], 'inertia');
    positive(vehicle.maxTorque[axis], 'maxTorque');
    positive(vehicle.attitudeLeverArm[axis], 'attitudeLeverArm');
  }
  const { x, y, z } = vehicle.inertia;
  if (x > y + z || y > x + z || z > x + y) {
    throw new RangeError('principal moments must satisfy the triangle inequalities');
  }
  if (vehicle.contacts) validateContacts(vehicle.contacts);
}

function validateState(state: FlightState, capacity: number): void {
  vector(state.position, 'position');
  vector(state.velocity, 'velocity');
  vector(state.angularVelocity, 'angularVelocity');
  unitQuaternion(state.orientation);
  bounded(state.fuelMass, 0, capacity, 'fuelMass');
}

// Each axis is a pure couple: equal opposite thrusters, no net force, total force |torque| / arm.
// Continuous torque stands in for the time-average of pulsed thruster firings.
function attitudeMassFlow(torque: Vector3, v: VehicleParameters): number {
  const force =
    Math.abs(torque.x) / v.attitudeLeverArm.x +
    Math.abs(torque.y) / v.attitudeLeverArm.y +
    Math.abs(torque.z) / v.attitudeLeverArm.z;
  return force / v.attitudeExhaustVelocity;
}

function advance(s: FlightState, d: FlightState, h: number): FlightState {
  return {
    position: addScaled(s.position, d.position, h),
    velocity: addScaled(s.velocity, d.velocity, h),
    angularVelocity: addScaled(s.angularVelocity, d.angularVelocity, h),
    orientation: addScaledQuaternion(s.orientation, d.orientation, h),
    fuelMass: s.fuelMass + d.fuelMass * h,
  };
}

/** Actuator output held constant over one integration interval. */
interface Actuation {
  /** Main-engine force in newtons. */
  readonly thrust: number;
  /** Applied body torque in newton metres. */
  readonly torque: Vector3;
  /** Combined main-engine and attitude propellant flow in kilograms per second. */
  readonly massFlow: number;
}

const IDLE: Actuation = { thrust: 0, torque: ZERO, massFlow: 0 };

// Same component layout as state, but values here are derivatives with respect to seconds.
function derivative(
  s: FlightState,
  v: VehicleParameters,
  environment: FlightEnvironment,
  a: Actuation,
): FlightState {
  const q = s.orientation;
  const gravity = gravityAcceleration(environment.gravity, s.position);
  const mass = v.dryMass + Math.max(0, s.fuelMass);
  const contact =
    environment.surface && v.contacts
      ? contactLoads(s, v.contacts, environment.surface)
      : { force: ZERO, torque: ZERO };
  const torque = add(a.torque, contact.torque);
  // Intermediate RK stages need a unit rotation for thrust, but q-dot uses the raw stage q.
  const normSquared = q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w;
  const acceleration = a.thrust / mass;
  const derivatives: FlightState = {
    position: s.velocity,
    velocity: {
      x:
        gravity.x +
        contact.force.x / mass +
        (acceleration * 2 * (q.x * q.y - q.z * q.w)) / normSquared,
      y:
        gravity.y +
        contact.force.y / mass +
        acceleration * (1 - (2 * (q.x * q.x + q.z * q.z)) / normSquared),
      z:
        gravity.z +
        contact.force.z / mass +
        (acceleration * 2 * (q.y * q.z + q.x * q.w)) / normSquared,
    },
    angularVelocity: angularAcceleration(s.angularVelocity, v.inertia, torque),
    orientation: quaternionRate(q, s.angularVelocity),
    fuelMass: -a.massFlow,
  };
  return environment.rotation ? inRotatingFrame(s, derivatives, environment.rotation) : derivatives;
}

// The same derivatives seen from a turning frame: velocity gains the Coriolis and
// centrifugal terms, and orientation, measured against the turning axes, falls
// behind by the frame's own spin: q-dot = 1/2 q * omega_body - 1/2 Omega_world * q.
function inRotatingFrame(s: FlightState, d: FlightState, rotation: FrameRotation): FlightState {
  const fictitious = rotatingFrameAcceleration(rotation, s.position, s.velocity);
  const frameSpin = multiplyQuaternions({ ...rotation.angularVelocity, w: 0 }, s.orientation);
  return {
    ...d,
    velocity: add(d.velocity, fictitious),
    orientation: addScaledQuaternion(d.orientation, frameSpin, -0.5),
  };
}

function rk4(
  s: FlightState,
  v: VehicleParameters,
  environment: FlightEnvironment,
  actuation: Actuation,
  h: number,
): FlightState {
  const d = (state: FlightState) => derivative(state, v, environment, actuation);
  const k1 = d(s);
  const k2 = d(advance(s, k1, h / 2));
  const k3 = d(advance(s, k2, h / 2));
  const k4 = d(advance(s, k3, h));
  const result = advance(advance(advance(advance(s, k1, h / 6), k2, h / 3), k3, h / 3), k4, h / 6);
  return { ...result, orientation: normalizeQuaternion(result.orientation) };
}

function integrate(
  s: FlightState,
  v: VehicleParameters,
  environment: FlightEnvironment,
  actuation: Actuation,
  h: number,
): FlightState {
  // Equal substeps when contacts may act; free flight keeps a single step.
  const substeps =
    environment.surface && v.contacts?.length ? Math.ceil(h / CONTACT_SUBSTEP - 1e-9) : 1;
  let next = s;
  for (let n = 0; n < substeps; n++) next = rk4(next, v, environment, actuation, h / substeps);
  return {
    ...next,
    // Mass flow is constant within an interval, so the exact update is linear.
    fuelMass: Math.max(0, s.fuelMass - actuation.massFlow * h),
  };
}

/**
 * Advances flight with RK4; returns new state without mutating inputs.
 * Main engine and attitude thrusters draw from one tank. A step that empties it
 * splits into a powered interval and an unpowered coast, ending with exactly zero
 * fuel. With an environment surface and vehicle contacts, spring-damper contact
 * forces act at each point and the step is integrated in CONTACT_SUBSTEP pieces.
 * With an environment rotation, the world frame turns relative to inertial space and
 * the Coriolis and centrifugal accelerations act.
 * Rejects invalid inputs or a timestep outside (0, MAX_FLIGHT_STEP].
 */
export function stepFlight(
  state: FlightState,
  command: FlightCommand,
  vehicle: VehicleParameters,
  environment: FlightEnvironment,
  dt: number,
): FlightState {
  positive(dt, 'dt');
  if (dt > MAX_FLIGHT_STEP) throw new RangeError('dt exceeds MAX_FLIGHT_STEP');
  validateVehicle(vehicle);
  validateState(state, vehicle.fuelCapacity);
  validateGravity(environment.gravity);
  validateGravityPosition(environment.gravity, state.position);
  if (environment.rotation) validateRotation(environment.rotation);
  if (environment.surface) validateSurface(environment.surface);
  bounded(command.throttle, 0, 1, 'throttle');
  for (const axis of ['x', 'y', 'z'] as const) {
    bounded(
      command.bodyTorque[axis],
      -vehicle.maxTorque[axis],
      vehicle.maxTorque[axis],
      'bodyTorque',
    );
  }
  const thrust = command.throttle * vehicle.maxThrust;
  const powered: Actuation = {
    thrust,
    torque: command.bodyTorque,
    massFlow: thrust / vehicle.exhaustVelocity + attitudeMassFlow(command.bodyTorque, vehicle),
  };
  const exhausted = powered.massFlow > 0 && state.fuelMass <= powered.massFlow * dt;
  if (!exhausted) {
    // With no demand, the "powered" interval has zero thrust, torque, and flow.
    const next = integrate(state, vehicle, environment, powered, dt);
    validateState(next, vehicle.fuelCapacity);
    return next;
  }
  const burn = Math.min(dt, state.fuelMass / powered.massFlow);
  let next = state;
  if (burn > 0) next = integrate(next, vehicle, environment, powered, burn);
  // Division rounding can leave ~1e-18 kg; empty tanks are exactly empty.
  next = { ...next, fuelMass: 0 };
  if (burn < dt) next = integrate(next, vehicle, environment, IDLE, dt - burn);
  validateState(next, vehicle.fuelCapacity);
  return next;
}
