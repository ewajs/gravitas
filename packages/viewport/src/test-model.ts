import type { VehicleModel } from './vehicle-model';

/**
 * A small lander for the viewport's own tests, shaped like the game's first lander
 * where tests measure it: centre of mass 1.5 m up, feet at ±1.5 m resting on the
 * contact plane, the bell's lip 0.42 m up, thruster quads 0.9 m out and 2.1 m up.
 */
export const TEST_MODEL: VehicleModel = {
  centerOfMassHeight: 1.5,
  finishes: {
    gold: { color: '#d2a650', metalness: 0.65, roughness: 0.42 },
    graphite: { color: '#242c35', metalness: 0.4, roughness: 0.5 },
    silver: { color: '#9aa6b3', metalness: 0.65, roughness: 0.3 },
  },
  parts: [
    {
      shape: { kind: 'cylinder', radiusTop: 0.82, radiusBottom: 0.92, height: 0.75, sides: 8 },
      finish: 'gold',
      position: { x: 0, y: 1.25, z: 0 },
    },
  ],
  footPad: { radiusTop: 0.23, radiusBottom: 0.3, height: 0.08, finish: 'graphite' },
  strutFinish: 'silver',
  legs: [-1, 1].flatMap((x) =>
    [-1, 1].map((z) => ({
      foot: { x: x * 1.5, y: 0.04, z: z * 1.5 },
      struts: [{ from: { x: x * 0.65, y: 1.4, z: z * 0.65 }, radius: 0.045 }],
    })),
  ),
  engine: { bell: { x: 0, y: 0.42, z: 0 }, plumeRadius: 0.46, plumeLength: 4 },
  thrusters: { radius: 0.9, height: 2.1 },
};
