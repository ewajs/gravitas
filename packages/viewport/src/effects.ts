import * as THREE from 'three/webgpu';
import { float, oneMinus, smoothstep, uniform, uv } from 'three/tsl';
import type { Vector3 } from '@gravitas/engine';

/** What the vehicle's actuators are doing, for presentation only. */
export interface Actuators {
  /** Main-engine throttle in [0, 1]; zero when no thrust acts. */
  readonly throttle: number;
  /** Attitude torque per body axis as a fraction of its limit, in [−1, 1]. */
  readonly attitude: Vector3;
}

export const NO_ACTUATORS: Actuators = { throttle: 0, attitude: { x: 0, y: 0, z: 0 } };

/** Tunable effect values; presentation only. Lengths in metres. */
export const EFFECTS = {
  /** Engine bell lip relative to the centre of mass, body metres. */
  bell: new THREE.Vector3(0, -1.08, 0),
  /** Plume length at full throttle. */
  plumeLength: 4,
  /** Attitude thruster quads: body positions at the ascent-stage rim (0.9 m arm). */
  quadRadius: 0.9,
  quadHeight: 0.6,
  /** Dust appears when the feet are lower than this while the engine fires. */
  dustAltitude: 12,
} as const;

// Exhaust direction (scaled by command) for each quad, from τ = r × F: positive
// pitch needs upward force at the front quad, so its exhaust points down; yaw
// thrusters fire tangentially.
type Triple = [number, number, number];
const QUADS = [
  { at: [0, -1], exhaust: (a: Vector3): Triple => [a.y, -a.x, 0] }, // front (−Z)
  { at: [0, 1], exhaust: (a: Vector3): Triple => [-a.y, a.x, 0] }, // back (+Z)
  { at: [-1, 0], exhaust: (a: Vector3): Triple => [0, a.z, -a.y] }, // left (−X)
  { at: [1, 0], exhaust: (a: Vector3): Triple => [0, -a.z, a.y] }, // right (+X)
] as const;

const UP = new THREE.Vector3(0, 1, 0);

/**
 * Builds the engine plume, its light, attitude-thruster puffs, and ground dust.
 * Plume and puffs ride on the vehicle (centre-of-mass frame); dust lies on the
 * ground below it. Returns an update function and disposal.
 */
export function createEffects(vehicle: THREE.Object3D, scene: THREE.Scene, surfaceY: number) {
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const glow = (color: number, opacity: number) => {
    // Emissive light keeps its colour: tone mapping would wash flame toward grey.
    const material = new THREE.MeshBasicNodeMaterial({
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    materials.push(material);
    return material;
  };

  // Plume: two nested open cones, apex down, unit length scaled by throttle.
  const plume = new THREE.Group();
  plume.position.copy(EFFECTS.bell);
  vehicle.add(plume);
  const cone = (radius: number, material: THREE.Material) => {
    const geometry = new THREE.ConeGeometry(radius, 1, 20, 1, true);
    geometry.rotateX(Math.PI); // Apex toward −Y.
    geometry.translate(0, -0.5, 0); // Base at the bell lip.
    geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    plume.add(mesh);
    return mesh;
  };
  cone(0.46, glow(0xff5a12, 0.6));
  cone(0.18, glow(0xffd27a, 0.75));
  plume.visible = false;
  const light = new THREE.PointLight(0xffb36b, 0, 30, 2);
  vehicle.add(light);

  // Attitude puffs: a small stretched glow at each quad, aimed along its exhaust.
  const puffGeometry = new THREE.SphereGeometry(0.14, 10, 8);
  geometries.push(puffGeometry);
  const puffMaterial = glow(0xf2f8ff, 0.9);
  const puffs = QUADS.map(({ at }) => {
    const mesh = new THREE.Mesh(puffGeometry, puffMaterial);
    const base = new THREE.Vector3(
      at[0] * EFFECTS.quadRadius,
      EFFECTS.quadHeight,
      at[1] * EFFECTS.quadRadius,
    );
    mesh.visible = false;
    vehicle.add(mesh);
    return { mesh, base };
  });

  // Dust: a soft ring on the ground that widens as the engine nears it. Opacity
  // fades in from the centre and out at the rim, so it reads as a cloud, not a disc.
  const dustGeometry = new THREE.CircleGeometry(1, 48);
  geometries.push(dustGeometry);
  const dustAmount = uniform(0);
  const radial = uv().sub(0.5).length().mul(2);
  const dustMaterial = new THREE.MeshBasicNodeMaterial({
    color: 0xc3bcae,
    transparent: true,
    depthWrite: false,
  });
  dustMaterial.opacityNode = float(dustAmount)
    .mul(smoothstep(0.25, 0.65, radial))
    .mul(oneMinus(smoothstep(0.7, 1, radial)));
  materials.push(dustMaterial);
  const dust = new THREE.Mesh(dustGeometry, dustMaterial);
  dust.rotation.x = -Math.PI / 2;
  dust.visible = false;
  scene.add(dust);

  const exhaust = new THREE.Vector3();
  let time = 0;
  return {
    /**
     * Applies actuator state. `altitude` is the feet's height above the surface,
     * which lies at world height `groundY` below the vehicle; `dt` advances flicker
     * and dust motion unless motion is reduced.
     */
    update(
      actuators: Actuators,
      position: THREE.Vector3,
      altitude: number,
      dt: number,
      reduceMotion: boolean,
      groundY = surfaceY,
    ) {
      if (!reduceMotion) time += dt;
      const throttle = actuators.throttle;
      const flicker = reduceMotion
        ? 1
        : 1 + 0.08 * Math.sin(time * 37) + 0.05 * Math.sin(time * 61);
      plume.visible = throttle > 0.01;
      plume.scale.set(
        0.6 + 0.4 * throttle,
        EFFECTS.plumeLength * throttle * flicker,
        0.6 + 0.4 * throttle,
      );
      light.position.set(0, EFFECTS.bell.y - 1, 0);
      light.intensity = 60 * throttle * flicker;

      for (const [i, { exhaust: direction }] of QUADS.entries()) {
        const [x, y, z] = direction(actuators.attitude);
        exhaust.set(x, y, z);
        const strength = Math.min(1, exhaust.length());
        const puff = puffs[i]!;
        puff.mesh.visible = strength > 0.05;
        if (!puff.mesh.visible) continue;
        exhaust.normalize();
        puff.mesh.quaternion.setFromUnitVectors(UP, exhaust);
        puff.mesh.scale.set(0.6 + 0.4 * strength, 1 + 2.5 * strength, 0.6 + 0.4 * strength);
        puff.mesh.position.copy(puff.base).addScaledVector(exhaust, 0.2 + 0.15 * strength);
      }

      const near = Math.max(0, 1 - altitude / EFFECTS.dustAltitude);
      const amount = throttle * near;
      dust.visible = amount > 0.02;
      if (dust.visible) {
        const swell = reduceMotion ? 0 : 0.6 * Math.sin(time * 2.3);
        const radius = 2.5 + 6 * near + swell;
        dust.position.set(position.x, groundY + 0.03, position.z);
        dust.scale.set(radius, radius, 1);
        dustAmount.value = 0.55 * amount;
      }
    },
    /** Objects inspected by tests; not part of any public API. */
    parts: { plume, light, puffs: puffs.map((p) => p.mesh), dust, dustAmount },
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      light.dispose();
    },
  };
}
