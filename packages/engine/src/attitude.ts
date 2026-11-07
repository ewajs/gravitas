import type { Vector3 } from './pose';
import { MAX_FLIGHT_STEP, validateVehicle, type VehicleParameters } from './flight';
import { bounded, positive, vector } from './validation';

/** Tuning for proportional body-rate assistance, supplied by the host. */
export interface AttitudeSettings {
  /** Requested rate at full input for each body axis, in radians per second. */
  readonly maxRate: Vector3;
  /** Time constant in seconds before torque saturation; must be at least MAX_FLIGHT_STEP. */
  readonly responseTime: number;
}

/**
 * Converts normalized body-axis rate requests in [-1, 1] to bounded torque (Nm).
 * Zero input brakes rotation, never levels the vehicle or cancels linear velocity.
 * The host samples this controller once per fixed tick, then passes torque to stepFlight,
 * which charges its propellant to the shared tank. With empty tanks no torque is applied,
 * so existing rotation continues.
 */
export function rateControlTorque(
  angularVelocity: Vector3,
  input: Vector3,
  vehicle: VehicleParameters,
  settings: AttitudeSettings,
): Vector3 {
  validateVehicle(vehicle);
  vector(angularVelocity, 'angularVelocity');
  positive(settings.responseTime, 'responseTime');
  if (settings.responseTime < MAX_FLIGHT_STEP)
    throw new RangeError('responseTime must be at least MAX_FLIGHT_STEP');
  const axisTorque = (axis: 'x' | 'y' | 'z') => {
    bounded(input[axis], -1, 1, 'attitude input');
    positive(settings.maxRate[axis], 'maxRate');
    const torque =
      (vehicle.inertia[axis] * (input[axis] * settings.maxRate[axis] - angularVelocity[axis])) /
      settings.responseTime;
    return Math.max(-vehicle.maxTorque[axis], Math.min(vehicle.maxTorque[axis], torque));
  };
  return { x: axisTorque('x'), y: axisTorque('y'), z: axisTorque('z') };
}
