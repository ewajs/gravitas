import { describe, expect, it } from 'vitest';
import { Box3, Vector3 } from 'three/webgpu';
import { createScene } from './scene';
import { TEST_MODEL } from './test-model';
import { validateVehicleModel, type VehicleModel } from './vehicle-model';

describe('vehicle models', () => {
  it('accept a well-formed model', () => {
    expect(() => validateVehicleModel(TEST_MODEL)).not.toThrow();
  });

  it('name the first thing wrong with a model', () => {
    const part = TEST_MODEL.parts[0]!;
    const bad: [VehicleModel, RegExp][] = [
      [{ ...TEST_MODEL, centerOfMassHeight: 0 }, /centerOfMassHeight/],
      [{ ...TEST_MODEL, finishes: {} }, /finish/],
      [
        {
          ...TEST_MODEL,
          finishes: { ...TEST_MODEL.finishes, gold: { color: 'gold', metalness: 0, roughness: 0 } },
        },
        /colour/,
      ],
      [
        {
          ...TEST_MODEL,
          finishes: {
            ...TEST_MODEL.finishes,
            gold: { color: '#d2a650', metalness: 2, roughness: 0 },
          },
        },
        /metalness/,
      ],
      [{ ...TEST_MODEL, parts: [] }, /part/],
      [{ ...TEST_MODEL, parts: [{ ...part, finish: 'chrome' }] }, /unknown finish chrome/],
      [
        {
          ...TEST_MODEL,
          parts: [{ ...part, shape: { kind: 'box', width: 1, height: 0, depth: 1 } }],
        },
        /height/,
      ],
      [
        {
          ...TEST_MODEL,
          parts: [
            {
              ...part,
              shape: { kind: 'cylinder', radiusTop: 1, radiusBottom: 1, height: 1, sides: 2 },
            },
          ],
        },
        /sides/,
      ],
      [{ ...TEST_MODEL, parts: [{ ...part, position: { x: NaN, y: 0, z: 0 } }] }, /position/],
      [{ ...TEST_MODEL, legs: [] }, /leg/],
      [{ ...TEST_MODEL, legs: [{ ...TEST_MODEL.legs[0]!, struts: [] }] }, /strut/],
      [{ ...TEST_MODEL, engine: { ...TEST_MODEL.engine, plumeLength: -1 } }, /plumeLength/],
      [{ ...TEST_MODEL, thrusters: { radius: 0.9, height: Infinity } }, /thrusters/],
    ];
    for (const [model, message] of bad) expect(() => validateVehicleModel(model)).toThrow(message);
  });

  it('swaps the drawn vehicle: new artwork, legs, plume, and thrusters', () => {
    const art = createScene(TEST_MODEL);
    try {
      // A taller tripod: centre of mass 2 m up, feet 2.2 m out, the bell 0.45 m up.
      const tripod: VehicleModel = {
        ...TEST_MODEL,
        centerOfMassHeight: 2,
        legs: [0, 1, 2].map((n) => {
          const angle = (n * 2 * Math.PI) / 3;
          const x = 2.2 * Math.sin(angle);
          const z = 2.2 * Math.cos(angle);
          return {
            foot: { x, y: 0.04, z },
            struts: [{ from: { x: x / 3, y: 1.6, z: z / 3 }, radius: 0.05 }],
          };
        }),
        engine: { bell: { x: 0, y: 0.45, z: 0 }, plumeRadius: 0.7, plumeLength: 7 },
        thrusters: { radius: 1.3, height: 2.2 },
      };
      const before = art.artwork;
      art.setVehicle(tripod);
      expect(art.artwork).not.toBe(before);
      expect(before.parent).toBeNull();
      expect(art.legCount).toBe(3);
      expect(art.feet).toHaveLength(3);
      // Poses act at the new centre of mass: resting there, the feet touch y = 0.
      art.vehicle.position.y = 2;
      art.vehicle.updateMatrixWorld(true);
      expect(new Box3().setFromObject(art.artwork, true).min.y).toBeCloseTo(0, 6);
      const { plume, puffs } = art.effects.parts;
      expect(plume.position.toArray()).toEqual([0, 0.45 - 2, 0]);
      art.effects.update(
        { throttle: 1, attitude: { x: 0, y: 1, z: 0 } },
        new Vector3(),
        40,
        1 / 60,
        true,
      );
      expect(plume.scale.y).toBeCloseTo(7, 12);
      expect(plume.scale.x).toBeCloseTo(0.7, 12);
      // Yaw puffs sit at the new quads, 1.3 m out, 0.2 m above the centre of mass.
      expect(Math.hypot(puffs[2]!.position.x, puffs[2]!.position.z)).toBeGreaterThan(1.3);
      expect(puffs[2]!.position.y).toBeCloseTo(0.2, 12);
    } finally {
      art.dispose();
    }
  });
});
