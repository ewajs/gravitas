import type { Vector3 } from './pose';
import { cross, dot, scale, subtract } from './math';
import { positive, vector } from './validation';

/**
 * The same acceleration everywhere: the flat-ground approximation, good while
 * distances are small next to the body's radius.
 */
export interface UniformGravity {
  readonly kind: 'uniform';
  /** Acceleration in world metres per second squared, such as (0, −1.62, 0) on the Moon. */
  readonly acceleration: Vector3;
}

/**
 * A spherical body's gravity: the inverse-square pull of a point mass at
 * `centre`, which outside a sphere of uniform layers is exact (Newton's shell
 * theorem). Mascons, oblateness, and third bodies are ignored.
 */
export interface CentralGravity {
  readonly kind: 'central';
  /** The body's centre in world metres. */
  readonly centre: Vector3;
  /** μ = GM in cubic metres per second squared. */
  readonly gravitationalParameter: number;
}

/** Gravity a host chooses for a flight; see {@link gravityAcceleration}. */
export type GravityField = UniformGravity | CentralGravity;

/**
 * A world frame that turns at a constant rate relative to an inertial one, such
 * as axes fixed to a spinning moon. Flying in it adds the Coriolis and centrifugal
 * accelerations, and orientation is measured against its turning axes.
 */
export interface FrameRotation {
  /** The frame's angular velocity relative to inertial space, in world axes, radians per second. */
  readonly angularVelocity: Vector3;
  /** Any point on the rotation axis, in world metres (the body's centre). */
  readonly axisPoint: Vector3;
}

/** Gravitational acceleration at a world position, in metres per second squared. */
export function gravityAcceleration(field: GravityField, position: Vector3): Vector3 {
  if (field.kind === 'uniform') return field.acceleration;
  const offset = subtract(position, field.centre);
  const r2 = dot(offset, offset);
  // −μ r̂ / r² = −μ r / r³.
  return scale(offset, -field.gravitationalParameter / (r2 * Math.sqrt(r2)));
}

/**
 * Coriolis plus centrifugal acceleration seen in a rotating frame, in metres per
 * second squared: −2Ω × v − Ω × (Ω × r), with r measured from the axis.
 */
export function rotatingFrameAcceleration(
  rotation: FrameRotation,
  position: Vector3,
  velocity: Vector3,
): Vector3 {
  const omega = rotation.angularVelocity;
  const r = subtract(position, rotation.axisPoint);
  const coriolis = cross(omega, velocity);
  const centrifugal = cross(omega, cross(omega, r));
  return subtract(scale(coriolis, -2), centrifugal);
}

/** Rejects a field with non-finite or non-physical values. */
export function validateGravity(field: GravityField): void {
  if (field.kind === 'uniform') {
    vector(field.acceleration, 'gravity acceleration');
    return;
  }
  vector(field.centre, 'gravity centre');
  positive(field.gravitationalParameter, 'gravitationalParameter');
}

/** Rejects a rotation with non-finite values. */
export function validateRotation(rotation: FrameRotation): void {
  vector(rotation.angularVelocity, 'rotation angularVelocity');
  vector(rotation.axisPoint, 'rotation axisPoint');
}

/** Rejects a position at a central field's centre, where gravity is undefined. */
export function validateGravityPosition(field: GravityField, position: Vector3): void {
  if (field.kind === 'uniform') return;
  const atCentre =
    position.x === field.centre.x && position.y === field.centre.y && position.z === field.centre.z;
  if (atCentre) throw new RangeError('position must not be at the gravity centre');
}
