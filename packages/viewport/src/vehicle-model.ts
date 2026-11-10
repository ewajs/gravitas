import type { Vector3 } from '@gravitas/engine';

// A vehicle's look as plain data (ADR 0023): simple shapes in metres, so a vehicle
// definition can carry its model and the viewport builds it. No Three.js here, so
// hosts and tests can describe and check a model without loading the renderer.
//
// Artwork coordinates: the origin is the centre of the level foot-contact plane,
// +Y up through the centre of mass, and the vehicle's front toward −Z.

/** A physically based surface: a CSS hex colour (`#rrggbb`), metalness and roughness in [0, 1]. */
export interface ModelFinish {
  readonly color: string;
  readonly metalness: number;
  readonly roughness: number;
}

/** A primitive shape, centred on its part's position, axis along +Y. */
export type ModelShape =
  | {
      readonly kind: 'cylinder';
      readonly radiusTop: number;
      readonly radiusBottom: number;
      readonly height: number;
      /** Sides around the axis: 8 draws an octagonal stage. */
      readonly sides: number;
      /** No end caps, as for an engine bell. */
      readonly open?: boolean;
    }
  | {
      readonly kind: 'box';
      readonly width: number;
      readonly height: number;
      readonly depth: number;
    }
  | {
      readonly kind: 'sphere';
      readonly radius: number;
      readonly widthSegments: number;
      readonly heightSegments: number;
    };

/** One rigid piece of the structure. */
export interface ModelPart {
  readonly shape: ModelShape;
  /** A key of the model's finishes. */
  readonly finish: string;
  readonly position: Vector3;
}

/** A strut from its attachment on the body to the foot, which compression moves. */
export interface ModelStrut {
  readonly from: Vector3;
  readonly radius: number;
}

/** A landing leg: a foot pad at rest on the contact plane and its struts. */
export interface ModelLeg {
  /** Centre of the foot pad at rest. */
  readonly foot: Vector3;
  readonly struts: readonly ModelStrut[];
}

/** A vehicle's drawn model; see the file comment for its coordinates. */
export interface VehicleModel {
  /** Centre of mass above the contact plane, in metres; poses act there. */
  readonly centerOfMassHeight: number;
  readonly finishes: Readonly<Record<string, ModelFinish>>;
  readonly parts: readonly ModelPart[];
  /** Foot pads (an 8-sided frustum), shared by every leg. */
  readonly footPad: {
    readonly radiusTop: number;
    readonly radiusBottom: number;
    readonly height: number;
    readonly finish: string;
  };
  readonly strutFinish: string;
  /** In the host's foot order: leg compressions are given in this order. */
  readonly legs: readonly ModelLeg[];
  /** The main engine: its bell's lip centre and the plume it draws at full throttle. */
  readonly engine: {
    readonly bell: Vector3;
    readonly plumeRadius: number;
    readonly plumeLength: number;
  };
  /** Four attitude-thruster quads at front, back, left, and right, this far out and up. */
  readonly thrusters: { readonly radius: number; readonly height: number };
}

const HEX = /^#[0-9a-f]{6}$/i;

function positive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be positive`);
}

function point(value: Vector3, name: string): void {
  if (![value?.x, value?.y, value?.z].every(Number.isFinite)) {
    throw new RangeError(`${name} must be a finite point`);
  }
}

function shape(value: ModelShape, name: string): void {
  if (value.kind === 'cylinder') {
    // A cone's tip has radius 0; both ends cannot.
    if (!(value.radiusTop >= 0 && value.radiusBottom >= 0)) {
      throw new RangeError(`${name} radii must not be negative`);
    }
    positive(Math.max(value.radiusTop, value.radiusBottom), `${name} radius`);
    positive(value.height, `${name} height`);
    if (!Number.isInteger(value.sides) || value.sides < 3) {
      throw new RangeError(`${name} needs at least 3 sides`);
    }
  } else if (value.kind === 'box') {
    positive(value.width, `${name} width`);
    positive(value.height, `${name} height`);
    positive(value.depth, `${name} depth`);
  } else if (value.kind === 'sphere') {
    positive(value.radius, `${name} radius`);
    if (!Number.isInteger(value.widthSegments) || value.widthSegments < 3) {
      throw new RangeError(`${name} needs at least 3 width segments`);
    }
    if (!Number.isInteger(value.heightSegments) || value.heightSegments < 2) {
      throw new RangeError(`${name} needs at least 2 height segments`);
    }
  } else {
    throw new RangeError(`${name} has an unknown shape`);
  }
}

/** Throws a RangeError naming the first thing wrong with `model`. */
export function validateVehicleModel(model: VehicleModel): void {
  positive(model.centerOfMassHeight, 'centerOfMassHeight');
  const finishes = Object.entries(model.finishes);
  if (finishes.length === 0) throw new RangeError('a model needs at least one finish');
  for (const [name, finish] of finishes) {
    if (!HEX.test(finish.color)) throw new RangeError(`finish ${name} needs a #rrggbb colour`);
    for (const key of ['metalness', 'roughness'] as const) {
      const value = finish[key];
      if (!(value >= 0 && value <= 1))
        throw new RangeError(`finish ${name} ${key} must be in [0, 1]`);
    }
  }
  const finish = (key: string, name: string) => {
    if (!Object.hasOwn(model.finishes, key))
      throw new RangeError(`${name} uses unknown finish ${key}`);
  };
  if (model.parts.length === 0) throw new RangeError('a model needs at least one part');
  model.parts.forEach((part, n) => {
    shape(part.shape, `part ${n}`);
    finish(part.finish, `part ${n}`);
    point(part.position, `part ${n} position`);
  });
  positive(model.footPad.radiusTop, 'footPad radiusTop');
  positive(model.footPad.radiusBottom, 'footPad radiusBottom');
  positive(model.footPad.height, 'footPad height');
  finish(model.footPad.finish, 'footPad');
  finish(model.strutFinish, 'struts');
  if (model.legs.length === 0) throw new RangeError('a model needs at least one leg');
  model.legs.forEach((leg, n) => {
    point(leg.foot, `leg ${n} foot`);
    if (leg.struts.length === 0) throw new RangeError(`leg ${n} needs at least one strut`);
    leg.struts.forEach((strut, k) => {
      point(strut.from, `leg ${n} strut ${k}`);
      positive(strut.radius, `leg ${n} strut ${k} radius`);
    });
  });
  point(model.engine.bell, 'engine bell');
  positive(model.engine.plumeRadius, 'engine plumeRadius');
  positive(model.engine.plumeLength, 'engine plumeLength');
  positive(model.thrusters.radius, 'thrusters radius');
  finiteHeight(model.thrusters.height);
}

function finiteHeight(value: number): void {
  if (!Number.isFinite(value)) throw new RangeError('thrusters height must be finite');
}
