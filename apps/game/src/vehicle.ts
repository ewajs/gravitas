import {
  validateAttitude,
  validateVehicle,
  type AttitudeSettings,
  type ContactPoint,
  type VehicleParameters,
} from '@gravitas/engine';
import { validateVehicleModel, type VehicleModel } from '@gravitas/viewport/model';

// A vehicle as one piece of plain data (ADR 0023): what the engine flies, how the
// rate assist feels, and what the viewport draws. The game reads a flight's
// vehicle from its scenario, never from a particular vehicle's constants.

/** Everything about one vehicle; check it with {@link validateDefinition}. */
export interface VehicleDefinition {
  /** Stable identifier, for tests and future saves. */
  readonly id: string;
  /** Mass, engines, thrusters, and contact points; legs are `kind: 'leg'` contacts. */
  readonly parameters: VehicleParameters;
  /** Body-rate assist: rate at full input and response time. */
  readonly attitude: AttitudeSettings;
  /** The drawn model, its legs in the same order as the leg contacts. */
  readonly model: VehicleModel;
}

/** The vehicle's leg contacts, in the order its model draws them. */
export function legContacts(vehicle: VehicleDefinition): ContactPoint[] {
  return (vehicle.parameters.contacts ?? []).filter((point) => point.kind === 'leg');
}

/** Centre of mass above the level foot-contact plane, in metres: how high it rests. */
export function centerOfMassHeight(vehicle: VehicleDefinition): number {
  return vehicle.model.centerOfMassHeight;
}

/** Propellant mass flow at full throttle, in kilograms per second. */
export function fullMassFlow(vehicle: VehicleDefinition): number {
  return vehicle.parameters.maxThrust / vehicle.parameters.exhaustVelocity;
}

/** Ideal velocity change on the main engine from a full tank to empty (rocket equation), m/s. */
export function deltaV(vehicle: VehicleDefinition): number {
  const { dryMass, fuelCapacity, exhaustVelocity } = vehicle.parameters;
  return exhaustVelocity * Math.log((dryMass + fuelCapacity) / dryMass);
}

/** Throttle that balances weight under gravity `g` with `fuelMass` aboard. */
export function hoverThrottle(vehicle: VehicleDefinition, fuelMass: number, g: number): number {
  return ((vehicle.parameters.dryMass + fuelMass) * g) / vehicle.parameters.maxThrust;
}

const EPSILON = 1e-9;

/**
 * Throws a RangeError naming the first problem: the engine's and the viewport's
 * own checks, then that the two agree. The legs stand level at the centre of
 * mass's height below it, the model draws one leg per leg contact above it, and
 * each foot pad rests on the contact plane.
 */
export function validateDefinition(vehicle: VehicleDefinition): void {
  if (!vehicle.id) throw new RangeError('a vehicle needs an id');
  validateVehicle(vehicle.parameters);
  validateAttitude(vehicle.attitude);
  validateVehicleModel(vehicle.model);
  const legs = legContacts(vehicle);
  if (legs.length < 3) throw new RangeError(`${vehicle.id} needs at least three legs`);
  const { model } = vehicle;
  if (model.legs.length !== legs.length) {
    throw new RangeError(`${vehicle.id} draws ${model.legs.length} legs for ${legs.length}`);
  }
  legs.forEach((leg, n) => {
    if (Math.abs(leg.position.y + model.centerOfMassHeight) > EPSILON) {
      throw new RangeError(`${vehicle.id} leg ${leg.id} is not level with the centre of mass`);
    }
    const foot = model.legs[n]!.foot;
    if (
      Math.abs(foot.x - leg.position.x) > EPSILON ||
      Math.abs(foot.z - leg.position.z) > EPSILON
    ) {
      throw new RangeError(`${vehicle.id} draws leg ${leg.id} away from its contact`);
    }
    if (Math.abs(foot.y - model.footPad.height / 2) > EPSILON) {
      throw new RangeError(`${vehicle.id} draws leg ${leg.id} off the contact plane`);
    }
  });
}
