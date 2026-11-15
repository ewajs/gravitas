import type { Vector3, VehiclePose } from './pose';
import {
  add,
  addScaled,
  conjugate,
  cross,
  dot,
  magnitude,
  normalizeQuaternion,
  scale,
  subtract,
} from './math';
import { bodyToWorld } from './orientation';
import { sampleTerrain, validateTerrain, type Terrain } from './terrain';
import { finite, nonNegative, positive, vector } from './validation';

/** Level ground at a constant world height, in metres. */
export interface FlatSurface {
  readonly kind: 'flat';
  /** World Y of the surface plane, in metres. */
  readonly height: number;
}

/**
 * A body's terrain (see createTerrain). The world frame must be the body's fixed
 * frame with the centre at the origin, such as bodyFixedEnvironment's.
 */
export interface TerrainSurface {
  readonly kind: 'terrain';
  readonly terrain: Terrain;
}

/** Ground the vehicle can touch. */
export type Surface = FlatSurface | TerrainSurface;

/**
 * The ground under one contact point as a plane: a point on it and its outward
 * unit normal. Terrain is treated as this tangent plane near each point.
 */
export interface GroundPlane {
  readonly point: Vector3;
  readonly normal: Vector3;
}

/**
 * A body point that can touch the surface, modelled as a one-sided spring-damper
 * along the surface normal with Coulomb friction that holds at rest (see
 * ContactAnchor). Legs are designed to touch; hull contact means the structure
 * itself hit the ground.
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

/**
 * Where a touching contact point grips the ground, in world metres, or null while
 * it is clear. Friction is a spring-damper from the point to its anchor along the
 * surface (the point's own stiffness and compression damping), capped at μN: under
 * the cap the point holds, so a vehicle at rest on a slope stays; at the cap the
 * anchor is dragged along and the point slides against μN, as Coulomb friction.
 */
export type ContactAnchor = Vector3 | null;

/**
 * Slip speed (m/s) below which friction scales down smoothly instead of switching
 * sign, for a point without an anchor yet: the step in which it first touches.
 */
export const FRICTION_SLIP_SCALE = 0.1;

/** Motion needed to evaluate contacts; positions and velocities in world frame. */
export interface ContactMotion extends VehiclePose {
  readonly velocity: Vector3;
  /** Body-axis angular velocity in radians per second. */
  readonly angularVelocity: Vector3;
}

const UP: Vector3 = { x: 0, y: 1, z: 0 };

export function validateSurface(surface: Surface): void {
  if (surface.kind === 'flat') finite(surface.height, 'surface height');
  else if (surface.kind === 'terrain') validateTerrain(surface.terrain);
  else throw new RangeError('Unknown surface kind');
}

/** The terrain's tangent plane straight below (or above) a world point. */
export function terrainPlane(terrain: Terrain, position: Vector3): GroundPlane {
  const ground = sampleTerrain(terrain, position);
  const r = magnitude(position);
  return {
    point: scale(position, (terrain.radius + ground.height) / r),
    normal: ground.normal,
  };
}

/**
 * The terrain's plane under every contact point of a vehicle in `motion`; the
 * flight step samples these once and holds them while its substeps run.
 */
export function contactPlanes(
  motion: VehiclePose,
  contacts: readonly ContactPoint[],
  terrain: Terrain,
): readonly GroundPlane[] {
  const q = normalizeQuaternion(motion.orientation);
  return contacts.map((point) =>
    terrainPlane(terrain, add(motion.position, bodyToWorld(q, point.position))),
  );
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

/**
 * Per-point evaluation shared by forces and facts. Terrain uses `planes` when
 * given (one per contact) and otherwise samples the ground under each point.
 * Friction pulls toward `anchors` where given, capped at μN; a point without one
 * gets regularized friction against its slip.
 */
function evaluate(
  motion: ContactMotion,
  contacts: readonly ContactPoint[],
  surface: Surface,
  planes: readonly GroundPlane[] | undefined,
  anchors: readonly ContactAnchor[] | undefined,
  visit: (
    point: ContactPoint,
    fact: ContactFact,
    force: Vector3,
    arm: Vector3,
    normal: Vector3,
    index: number,
  ) => void,
): void {
  // RK stages may carry a slightly non-unit quaternion; geometry uses its rotation.
  const q = normalizeQuaternion(motion.orientation);
  const omega = bodyToWorld(q, motion.angularVelocity);
  for (let index = 0; index < contacts.length; index++) {
    const point = contacts[index]!;
    const arm = bodyToWorld(q, point.position);
    const position = add(motion.position, arm);
    const velocity = add(motion.velocity, cross(omega, arm));
    let n: Vector3;
    let penetration: number;
    if (surface.kind === 'flat') {
      n = UP;
      penetration = Math.max(0, (surface.height - position.y) * n.y);
    } else {
      // Depth below the ground's tangent plane, measured along its normal.
      const plane = planes?.[index] ?? terrainPlane(surface.terrain, position);
      n = plane.normal;
      penetration = Math.max(0, dot(subtract(plane.point, position), n));
    }
    const normalVelocity = dot(velocity, n);
    // Velocity along the surface: the normal component removed.
    const tangent = addScaled(velocity, n, -normalVelocity);
    const slipSpeed = magnitude(tangent);
    // One-sided: the ground pushes but never pulls, even while the damper is extending.
    const damping = normalVelocity < 0 ? point.damping : point.reboundDamping;
    const normalForce =
      penetration > 0 ? Math.max(0, point.stiffness * penetration - damping * normalVelocity) : 0;
    const anchor = anchors?.[index];
    let force: Vector3;
    if (anchor && normalForce > 0) {
      // Held by its anchor: a spring-damper along the surface, capped at μN.
      const offset = subtract(position, anchor);
      const along = addScaled(offset, n, -dot(offset, n));
      const fx = -point.stiffness * along.x - point.damping * tangent.x;
      const fy = -point.stiffness * along.y - point.damping * tangent.y;
      const fz = -point.stiffness * along.z - point.damping * tangent.z;
      const pull = Math.sqrt(fx * fx + fy * fy + fz * fz);
      const limit = point.friction * normalForce;
      const capped = pull > limit ? limit / pull : 1;
      force = {
        x: normalForce * n.x + capped * fx,
        y: normalForce * n.y + capped * fy,
        z: normalForce * n.z + capped * fz,
      };
    } else {
      // Regularized Coulomb friction: full μN when sliding, proportional near rest.
      const frictionScale =
        (point.friction * normalForce) / Math.hypot(slipSpeed, FRICTION_SLIP_SCALE);
      force = {
        x: normalForce * n.x - frictionScale * tangent.x,
        y: normalForce * n.y - frictionScale * tangent.y,
        z: normalForce * n.z - frictionScale * tangent.z,
      };
    }
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
      n,
      index,
    );
  }
}

/**
 * Total contact force (world N) and torque about the centre of mass (body N m).
 * On terrain, `planes` (one per contact, from contactPlanes) replace sampling;
 * `anchors` (one per contact) are where touching points grip the ground.
 */
export function contactLoads(
  motion: ContactMotion,
  contacts: readonly ContactPoint[],
  surface: Surface,
  planes?: readonly GroundPlane[],
  anchors?: readonly ContactAnchor[],
): { readonly force: Vector3; readonly torque: Vector3 } {
  const force = { x: 0, y: 0, z: 0 };
  const torque = { x: 0, y: 0, z: 0 };
  evaluate(motion, contacts, surface, planes, anchors, (_point, fact, f, arm) => {
    if (fact.normalForce === 0) return;
    force.x += f.x;
    force.y += f.y;
    force.z += f.z;
    const t = cross(arm, f);
    torque.x += t.x;
    torque.y += t.y;
    torque.z += t.z;
  });
  return {
    force,
    torque: bodyToWorld(conjugate(normalizeQuaternion(motion.orientation)), torque),
  };
}

/**
 * The anchors after a step that ended in `motion`: a point that touches keeps its
 * anchor, or grips where it is if it had none; one pulled past what friction can
 * hold (μN over its stiffness) drags its anchor to that distance, so it slides.
 * A clear point has none. Returns undefined when nothing touches.
 */
export function nextAnchors(
  motion: ContactMotion,
  contacts: readonly ContactPoint[],
  surface: Surface,
  planes: readonly GroundPlane[] | undefined,
  anchors: readonly ContactAnchor[] | undefined,
): readonly ContactAnchor[] | undefined {
  const next: ContactAnchor[] = [];
  let touching = false;
  evaluate(motion, contacts, surface, planes, undefined, (point, fact, _force, _arm, n, index) => {
    if (fact.penetration <= 0) {
      next.push(null);
      return;
    }
    touching = true;
    const anchor = anchors?.[index];
    if (!anchor) {
      next.push(fact.position);
      return;
    }
    const offset = subtract(fact.position, anchor);
    const along = addScaled(offset, n, -dot(offset, n));
    const stretch = magnitude(along);
    const reach = (point.friction * fact.normalForce) / point.stiffness;
    next.push(stretch > reach ? addScaled(fact.position, along, -reach / stretch) : anchor);
  });
  return touching ? next : undefined;
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
  evaluate(motion, contacts, surface, undefined, undefined, (_point, fact) => facts.push(fact));
  return facts;
}
