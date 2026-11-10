import type { ContactPoint, Vector3 } from '@gravitas/engine';
import type { ModelLeg, ModelPart } from '@gravitas/viewport/model';
import type { VehicleDefinition } from './vehicle';

// The first lander (ADR 0023): the opening's vehicle, a fictional first-flight
// lander. Its values are tunable gameplay numbers, not historical Apollo ones.

/** Body centre of mass above the level foot-contact plane, in metres. */
const CENTER_OF_MASS_HEIGHT = 1.5;

/**
 * Landing legs: about 3 cm of static compression each at full mass
 * (1500 kg × 1.62 m/s² / 4 legs / 20 kN/m). Damping near ζ ≈ 0.7 for the vertical
 * mode stands in for crushable struts: a firm touchdown barely hops. Feet in
 * artwork order: left-front, left-back, right-front, right-back (front is body −Z).
 */
const LEG = {
  kind: 'leg',
  stiffness: 20000,
  damping: 4000,
  // Strong rebound valving: after a hard landing the legs re-extend over about
  // c/k = 1.25 s instead of springing the vehicle back up.
  reboundDamping: 25000,
  friction: 0.6,
} as const;
/**
 * Structure: ten times stiffer and overdamped (ζ ≈ 1.15 at full mass), because a
 * hull striking the ground crumples rather than springing back. Touching it means
 * the legs were not enough.
 */
const HULL = {
  kind: 'hull',
  stiffness: 200000,
  damping: 40000,
  reboundDamping: 40000,
  friction: 0.5,
} as const;
const H = CENTER_OF_MASS_HEIGHT;

/**
 * Contact points measured from the artwork, relative to the centre of mass:
 * feet at ±1.5 m, the engine bell's lip 0.42 m above the feet, the descent-stage
 * base 0.875 m up (radius 0.92 m), the ascent-stage roof 2.445 m up (radius
 * 0.58 m), and the antenna tip 3.055 m up.
 */
const CONTACTS: readonly ContactPoint[] = [
  { ...LEG, id: 'foot-left-front', position: { x: -1.5, y: -H, z: -1.5 } },
  { ...LEG, id: 'foot-left-back', position: { x: -1.5, y: -H, z: 1.5 } },
  { ...LEG, id: 'foot-right-front', position: { x: 1.5, y: -H, z: -1.5 } },
  { ...LEG, id: 'foot-right-back', position: { x: 1.5, y: -H, z: 1.5 } },
  { ...HULL, id: 'engine-bell', position: { x: 0, y: 0.42 - H, z: 0 } },
  ...[0, 1, 2, 3]
    .map((i) => {
      const angle = (i * Math.PI) / 2;
      return [
        {
          ...HULL,
          id: `descent-stage-${i}`,
          position: { x: 0.92 * Math.sin(angle), y: 0.875 - H, z: 0.92 * Math.cos(angle) },
        },
        {
          ...HULL,
          id: `ascent-roof-${i}`,
          position: { x: 0.58 * Math.sin(angle), y: 2.445 - H, z: 0.58 * Math.cos(angle) },
        },
      ];
    })
    .flat(),
  { ...HULL, id: 'antenna', position: { x: 0.35, y: 3.055 - H, z: 0 } },
];

const at = (x: number, y: number, z: number): Vector3 => ({ x, y, z });

// The artwork, from its feet (see vehicle-model.ts in the viewport): a gold
// descent stage, a white ascent stage with its window and antenna, and four legs.
const PARTS: readonly ModelPart[] = [
  {
    shape: { kind: 'cylinder', radiusTop: 0.82, radiusBottom: 0.92, height: 0.75, sides: 8 },
    finish: 'gold',
    position: at(0, 1.25, 0),
  },
  {
    shape: { kind: 'cylinder', radiusTop: 0.58, radiusBottom: 0.74, height: 0.85, sides: 8 },
    finish: 'white',
    position: at(0, 2.02, 0),
  },
  {
    shape: { kind: 'cylinder', radiusTop: 0.76, radiusBottom: 0.76, height: 0.09, sides: 8 },
    finish: 'graphite',
    position: at(0, 1.65, 0),
  },
  {
    shape: {
      kind: 'cylinder',
      radiusTop: 0.24,
      radiusBottom: 0.4,
      height: 0.44,
      sides: 12,
      open: true,
    },
    finish: 'graphite',
    position: at(0, 0.64, 0),
  },
  {
    shape: { kind: 'box', width: 0.62, height: 0.25, depth: 0.05 },
    finish: 'glass',
    position: at(0, 2.1, -0.64),
  },
  {
    shape: { kind: 'cylinder', radiusTop: 0.018, radiusBottom: 0.018, height: 0.55, sides: 6 },
    finish: 'silver',
    position: at(0.35, 2.7, 0),
  },
  {
    shape: { kind: 'sphere', radius: 0.055, widthSegments: 8, heightSegments: 6 },
    finish: 'white',
    position: at(0.35, 3, 0),
  },
];

// Legs in foot order (left-front, left-back, right-front, right-back), each with a
// main strut from the descent stage's top corner and a thinner one from its base.
const LEGS: readonly ModelLeg[] = [-1, 1].flatMap((x) =>
  [-1, 1].map((z) => ({
    foot: at(x * 1.5, 0.04, z * 1.5),
    struts: [
      { from: at(x * 0.65, 1.4, z * 0.65), radius: 0.045 },
      { from: at(x * 0.72, 0.94, z * 0.72), radius: 0.025 },
    ],
  })),
);

/** The opening's lander: about 0.67 km/s of delta-v, hovering at 54% throttle when full. */
export const FIRST_LANDER: VehicleDefinition = {
  id: 'first-lander',
  parameters: {
    dryMass: 1200,
    fuelCapacity: 300,
    maxThrust: 4500,
    exhaustVelocity: 3000,
    inertia: { x: 1800, y: 1200, z: 1800 },
    maxTorque: { x: 900, y: 600, z: 900 },
    // Thruster quads near the ascent-stage rim; storable-propellant performance.
    attitudeLeverArm: { x: 0.9, y: 0.9, z: 0.9 },
    attitudeExhaustVelocity: 2800,
    contacts: CONTACTS,
  },
  // Body-axis rate assist, independent of camera position and keyboard bindings.
  attitude: {
    maxRate: { x: Math.PI / 6, y: Math.PI / 6, z: Math.PI / 6 },
    responseTime: 0.3,
  },
  model: {
    centerOfMassHeight: CENTER_OF_MASS_HEIGHT,
    finishes: {
      gold: { color: '#d2a650', metalness: 0.65, roughness: 0.42 },
      white: { color: '#e5e7e5', metalness: 0.3, roughness: 0.4 },
      graphite: { color: '#242c35', metalness: 0.4, roughness: 0.5 },
      silver: { color: '#9aa6b3', metalness: 0.65, roughness: 0.3 },
      glass: { color: '#102f42', metalness: 0.6, roughness: 0.2 },
    },
    parts: PARTS,
    footPad: { radiusTop: 0.23, radiusBottom: 0.3, height: 0.08, finish: 'graphite' },
    strutFinish: 'silver',
    legs: LEGS,
    // The bell's lip 0.42 m above the feet; a 4 m plume at full throttle.
    engine: { bell: at(0, 0.42, 0), plumeRadius: 0.46, plumeLength: 4 },
    // Quads at the ascent-stage rim, 0.9 m out, 2.1 m up.
    thrusters: { radius: 0.9, height: 2.1 },
  },
};
