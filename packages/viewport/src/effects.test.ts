import { describe, expect, it } from 'vitest';
import * as THREE from 'three/webgpu';
import { createScene } from './scene';
import { TEST_MODEL } from './test-model';

const at = new THREE.Vector3(0, 41.5, 0);
const still = (x = 0, y = 0, z = 0) => ({ x, y, z });

describe('actuator effects', () => {
  it('shows no plume or light at zero throttle, and full length at full throttle', () => {
    const art = createScene(TEST_MODEL);
    try {
      const { plume, light } = art.effects.parts;
      art.effects.update({ throttle: 0, attitude: still() }, at, 40, 1 / 60, true);
      expect(plume.visible).toBe(false);
      expect(light.intensity).toBe(0);
      art.effects.update({ throttle: 1, attitude: still() }, at, 40, 1 / 60, true);
      expect(plume.visible).toBe(true);
      expect(plume.scale.y).toBeCloseTo(TEST_MODEL.engine.plumeLength, 12); // Steady: reduced motion.
      art.effects.update({ throttle: 0.5, attitude: still() }, at, 40, 1 / 60, true);
      expect(plume.scale.y).toBeCloseTo(TEST_MODEL.engine.plumeLength / 2, 12);
    } finally {
      art.dispose();
    }
  });

  it('fires the pitch quads front and back in opposite vertical directions', () => {
    const art = createScene(TEST_MODEL);
    try {
      art.effects.update({ throttle: 0, attitude: still(1) }, at, 40, 1 / 60, true);
      const [front, back, left, right] = art.effects.parts.puffs;
      expect([front!.visible, back!.visible, left!.visible, right!.visible]).toEqual([
        true,
        true,
        false,
        false,
      ]);
      // +X torque: upward force at the front, so exhaust (and puff) points down there.
      expect(front!.position.y).toBeLessThan(
        TEST_MODEL.thrusters.height - TEST_MODEL.centerOfMassHeight,
      );
      expect(back!.position.y).toBeGreaterThan(
        TEST_MODEL.thrusters.height - TEST_MODEL.centerOfMassHeight,
      );
    } finally {
      art.dispose();
    }
  });

  it('fires all four quads sideways for yaw', () => {
    const art = createScene(TEST_MODEL);
    try {
      art.effects.update({ throttle: 0, attitude: still(0, 1) }, at, 40, 1 / 60, true);
      const [front, , left] = art.effects.parts.puffs;
      expect(art.effects.parts.puffs.every((puff) => puff.visible)).toBe(true);
      // +Y torque: the front quad pushes toward −X, so its exhaust trails toward +X.
      expect(front!.position.x).toBeGreaterThan(0);
      expect(left!.position.z).toBeLessThan(0);
    } finally {
      art.dispose();
    }
  });

  it('raises dust only near the ground while the engine fires', () => {
    const art = createScene(TEST_MODEL);
    try {
      const { dust } = art.effects.parts;
      art.effects.update({ throttle: 1, attitude: still() }, at, 20, 1 / 60, true);
      expect(dust.visible).toBe(false);
      art.effects.update({ throttle: 0, attitude: still() }, at, 2, 1 / 60, true);
      expect(dust.visible).toBe(false);
      art.effects.update({ throttle: 1, attitude: still() }, at, 3, 1 / 60, true);
      expect(dust.visible).toBe(true);
      expect(art.effects.parts.dustAmount.value).toBeCloseTo(0.55 * 0.75, 12);
      expect(dust.position.x).toBe(at.x);
    } finally {
      art.dispose();
    }
  });
});
