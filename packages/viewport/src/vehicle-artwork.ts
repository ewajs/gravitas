import * as THREE from 'three/webgpu';
import type { ModelShape, VehicleModel } from './vehicle-model';

/** Largest drawn leg compression, in metres; beyond it the hull is already touching. */
const MAX_DRAWN_COMPRESSION = 0.6;
const UP = new THREE.Vector3(0, 1, 0);
/** Sides of a foot pad and of a strut. */
const ROUND_SIDES = 8;

/** A foot pad and its struts, redrawn as the leg compresses. */
interface Leg {
  readonly foot: THREE.Mesh;
  readonly rest: THREE.Vector3;
  readonly struts: readonly { mesh: THREE.Mesh; start: THREE.Vector3; length: number }[];
}

function geometry(shape: ModelShape): THREE.BufferGeometry {
  switch (shape.kind) {
    case 'cylinder':
      return new THREE.CylinderGeometry(
        shape.radiusTop,
        shape.radiusBottom,
        shape.height,
        shape.sides,
        1,
        shape.open ?? false,
      );
    case 'box':
      return new THREE.BoxGeometry(shape.width, shape.height, shape.depth);
    case 'sphere':
      return new THREE.SphereGeometry(shape.radius, shape.widthSegments, shape.heightSegments);
  }
}

// A strut spans from its body attachment to the foot; compression moves the foot end.
function placeStrut(
  strut: THREE.Mesh,
  start: THREE.Vector3,
  end: THREE.Vector3,
  rest: number,
): void {
  const direction = end.clone().sub(start);
  strut.position.copy(start).add(end).multiplyScalar(0.5);
  strut.scale.y = direction.length() / rest;
  strut.quaternion.setFromUnitVectors(UP, direction.normalize());
}

/**
 * Builds a validated model's structure: a group in artwork coordinates, with its
 * feet in the model's leg order. Illustrative artwork, not a specification.
 */
export function buildArtwork(model: VehicleModel) {
  const geometries: THREE.BufferGeometry[] = [];
  const materials = new Map<string, THREE.Material>();
  const artwork = new THREE.Group();
  const finish = (key: string) => {
    let material = materials.get(key);
    if (!material) {
      const { color, metalness, roughness } = model.finishes[key]!;
      material = new THREE.MeshStandardNodeMaterial({ color, metalness, roughness });
      materials.set(key, material);
    }
    return material;
  };
  const mesh = (shape: THREE.BufferGeometry, surface: string) => {
    geometries.push(shape);
    const result = new THREE.Mesh(shape, finish(surface));
    result.castShadow = true;
    result.receiveShadow = true;
    artwork.add(result);
    return result;
  };

  for (const part of model.parts) {
    const { x, y, z } = part.position;
    mesh(geometry(part.shape), part.finish).position.set(x, y, z);
  }

  const { footPad } = model;
  const legs: Leg[] = model.legs.map((leg) => {
    const rest = new THREE.Vector3(leg.foot.x, leg.foot.y, leg.foot.z);
    const foot = mesh(
      new THREE.CylinderGeometry(
        footPad.radiusTop,
        footPad.radiusBottom,
        footPad.height,
        ROUND_SIDES,
      ),
      footPad.finish,
    );
    foot.position.copy(rest);
    const struts = leg.struts.map(({ from, radius }) => {
      const start = new THREE.Vector3(from.x, from.y, from.z);
      const length = rest.distanceTo(start);
      const strut = mesh(
        new THREE.CylinderGeometry(radius, radius, length, ROUND_SIDES),
        model.strutFinish,
      );
      placeStrut(strut, start, rest, length);
      return { mesh: strut, start, length };
    });
    return { foot, rest, struts };
  });
  const footEnd = new THREE.Vector3();

  return {
    artwork,
    /** Foot meshes in leg order; tests inspect them. */
    feet: legs.map((leg) => leg.foot),
    /** Raises each foot by its compression (metres, leg order) and re-aims its struts. */
    setLegCompression(compressions: readonly number[]) {
      legs.forEach((leg, i) => {
        const lift = Math.min(MAX_DRAWN_COMPRESSION, compressions[i] ?? 0);
        footEnd.copy(leg.rest).addScaledVector(UP, lift);
        leg.foot.position.copy(footEnd);
        for (const strut of leg.struts) placeStrut(strut.mesh, strut.start, footEnd, strut.length);
      });
    },
    dispose() {
      for (const shape of geometries) shape.dispose();
      for (const material of materials.values()) material.dispose();
      artwork.clear();
    },
  };
}

export type VehicleArtwork = ReturnType<typeof buildArtwork>;
