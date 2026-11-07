import type { Quaternion, Vector3, VehiclePose } from './pose';
import { bodyToWorld } from './orientation';
import { finite, nonNegative, positive, vector } from './validation';

/** Level ground at a constant world height, in metres. */
export interface FlatSurface {
  readonly kind: 'flat';
  /** World Y of the surface plane, in metres. */
  readonly height: number;
}

/** Ground the vehicle can touch. A union so later terrain kinds can join the same seam. */
export type Surface = FlatSurface;

/**
 * A body point that can touch the surface, modelled as a one-sided spring-damper
 * along the surface normal with regularized Coulomb friction. Legs are designed
 * to touch; hull contact means the structure itself hit the ground.
 */
export interface ContactPoint {
  /** Stable identifier reported in contact facts, e.g. "foot-left-front". */
  readonly id: string;
  readonly kind: 'leg' | 'hull';
  /** Unloaded point relative to the centre of mass, in body metres. */
  readonly position: Vector3;
  /** Normal stiffness in newtons per metre of penetration. */
  readonly stiffness: number;
  /** Damping while compressing, in newton seconds per metre of approach speed. */
  readonly damping: number;
  /**
   * Damping while extending (moving away from the surface), N·s/m. Like a shock
   * absorber's rebound valving: a high value lets the spring's stored energy fade
   * instead of throwing the vehicle back up.
   */
  readonly reboundDamping: number;
  /** Coulomb friction coefficient (dimensionless). */
  readonly friction: number;
}

/** What one contact point is doing in a given state; plain data for rules and presentation. */
export interface ContactFact {
  readonly id: string;
  readonly kind: 'leg' | 'hull';
  /** Point in world metres. */
  readonly position: Vector3;
  /** Depth below the surface in metres (leg compression for legs); 0 when clear. */
  readonly penetration: number;
  /** Surface push on the point in newtons; 0 when clear. */
  readonly normalForce: number;
  /** Point speed into the surface in metres per second (positive approaching). */
  readonly approachSpeed: number;
  /** Point speed along the surface in metres per second. */
  readonly slipSpeed: number;
}

/** Slip speed (m/s) below which friction scales down smoothly instead of switching sign. */
export const FRICTION_SLIP_SCALE = 0.1;

/** Motion needed to evaluate contacts; positions and velocities in world frame. */
export interface ContactMotion extends VehiclePose {
  readonly velocity: Vector3;
  /** Body-axis angular velocity in radians per second. */
  readonly angularVelocity: Vector3;
}

interface SurfaceSample {
  readonly height: number;
  readonly normal: Vector3;
}

// The one place engine learns about the ground. A future terrain kind (or a
// collision library's query) supplies height and normal here.
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- flat ground ignores position; terrain will not
function surfaceBelow(surface: Surface, _x: number, _z: number): SurfaceSample {
  return { height: surface.height, normal: { x: 0, y: 1, z: 0 } };
}

export function validateSurface(surface: Surface): void {
  if (surface.kind !== 'flat') throw new RangeError('Unknown surface kind');
  finite(surface.height, 'surface height');
}

export function validateContacts(contacts: readonly ContactPoint[]): void {
  const ids = new Set<string>();
  for (const point of contacts) {
    if (ids.has(point.id)) throw new RangeError(`Duplicate contact id ${point.id}`);
    ids.add(point.id);
    if (point.kind !== 'leg' && point.kind !== 'hull') throw new RangeError('Unknown contact kind');
    vector(point.position, 'contact position');
    positive(point.stiffness, 'contact stiffness');
    nonNegative(point.damping, 'contact damping');
    nonNegative(point.reboundDamping, 'contact rebound damping');
    nonNegative(point.friction, 'contact friction');
  }
}

function cross(a: Vector3, b: Vector3): Vector3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

function dot(a: Vector3, b: Vector3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function unit(q: Quaternion): Quaternion {
  const length = Math.hypot(q.x, q.y, q.z, q.w);
  return { x: q.x / length, y: q.y / length, z: q.z / length, w: q.w / length };
}

function conjugate(q: Quaternion): Quaternion {
  return { x: -q.x, y: -q.y, z: -q.z, w: q.w };
}

/** Per-point evaluation shared by forces and facts. */
function evaluate(
  motion: ContactMotion,
  contacts: readonly ContactPoint[],
  surface: Surface,
  visit: (point: ContactPoint, fact: ContactFact, force: Vector3, arm: Vector3) => void,
): void {
  // RK stages may carry a slightly non-unit quaternion; geometry uses its rotation.
  const q = unit(motion.orientation);
  const omega = bodyToWorld(q, motion.angularVelocity);
  for (const point of contacts) {
    const arm = bodyToWorld(q, point.position);
    const position = {
      x: motion.position.x + arm.x,
      y: motion.position.y + arm.y,
      z: motion.position.z + arm.z,
    };
    const spin = cross(omega, arm);
    const velocity = {
      x: motion.velocity.x + spin.x,
      y: motion.velocity.y + spin.y,
      z: motion.velocity.z + spin.z,
    };
    const ground = surfaceBelow(surface, position.x, position.z);
    const n = ground.normal;
    const penetration = Math.max(0, (ground.height - position.y) * n.y);
    const normalVelocity = dot(velocity, n);
    const tangent = {
      x: velocity.x - normalVelocity * n.x,
      y: velocity.y - normalVelocity * n.y,
      z: velocity.z - normalVelocity * n.z,
    };
    const slipSpeed = Math.hypot(tangent.x, tangent.y, tangent.z);
    // One-sided: the ground pushes but never pulls, even while the damper is extending.
    const damping = normalVelocity < 0 ? point.damping : point.reboundDamping;
    const normalForce =
      penetration > 0 ? Math.max(0, point.stiffness * penetration - damping * normalVelocity) : 0;
    // Regularized Coulomb friction: full μN when sliding, proportional near rest.
    const frictionScale =
      (point.friction * normalForce) / Math.hypot(slipSpeed, FRICTION_SLIP_SCALE);
    const force = {
      x: normalForce * n.x - frictionScale * tangent.x,
      y: normalForce * n.y - frictionScale * tangent.y,
      z: normalForce * n.z - frictionScale * tangent.z,
    };
    visit(
      point,
      {
        id: point.id,
        kind: point.kind,
        position,
        penetration,
        normalForce,
        approachSpeed: -normalVelocity,
        slipSpeed,
      },
      force,
      arm,
    );
  }
}

/** Total contact force (world N) and torque about the centre of mass (body N m). */
export function contactLoads(
  motion: ContactMotion,
  contacts: readonly ContactPoint[],
  surface: Surface,
): { readonly force: Vector3; readonly torque: Vector3 } {
  const force = { x: 0, y: 0, z: 0 };
  const torque = { x: 0, y: 0, z: 0 };
  evaluate(motion, contacts, surface, (_point, fact, f, arm) => {
    if (fact.normalForce === 0) return;
    force.x += f.x;
    force.y += f.y;
    force.z += f.z;
    const t = cross(arm, f);
    torque.x += t.x;
    torque.y += t.y;
    torque.z += t.z;
  });
  return { force, torque: bodyToWorld(conjugate(unit(motion.orientation)), torque) };
}

/**
 * What each contact point is doing in this state: depth, push, approach and slip
 * speeds. Pure and cheap; hosts use it for rules (landing outcomes) and presentation
 * (leg compression). The same model produces the forces inside stepFlight.
 */
export function contactFacts(
  motion: ContactMotion,
  contacts: readonly ContactPoint[],
  surface: Surface,
): readonly ContactFact[] {
  validateContacts(contacts);
  validateSurface(surface);
  vector(motion.position, 'position');
  vector(motion.velocity, 'velocity');
  vector(motion.angularVelocity, 'angularVelocity');
  const facts: ContactFact[] = [];
  evaluate(motion, contacts, surface, (_point, fact) => facts.push(fact));
  return facts;
}
