import type { ContactPoint, Vector3 } from '@gravitas/engine';
import type { ModelLeg, ModelPart } from '@gravitas/viewport/model';
import type { VehicleDefinition } from './vehicle';

// The descent vehicle (ADR 0023): a larger, fictional lander for landing from
// lunar orbit. About 2 km/s on the main engine covers braking from a 100 km orbit
// (about 1.75 km/s at the least) with roughly 250 m/s, some two and a half minutes
// of hovering, to choose a spot. Gameplay numbers, not a real vehicle's.

/** Centre of mass above the level foot-contact plane, in metres. */
const CENTER_OF_MASS_HEIGHT = 2;
const H = CENTER_OF_MASS_HEIGHT;

/**
 * Legs: about 3 cm of static compression each at full mass (3,900 kg × 1.62 m/s²
 * / 4 legs / 50 kN/m), damped near ζ ≈ 0.7 per leg, and re-extending over about
 * 1.2 s after a hard landing, like the first lander's.
 */
const LEG = {
  kind: 'leg',
  stiffness: 50000,
  damping: 10000,
  reboundDamping: 60000,
  friction: 0.6,
} as const;
/** Structure: ten times stiffer and overdamped (ζ ≈ 1.1 at full mass). */
const HULL = {
  kind: 'hull',
  stiffness: 500000,
  damping: 100000,
  reboundDamping: 100000,
  friction: 0.5,
} as const;

/** Feet this far out along each axis: a 4.4 m square stance. */
const STANCE = 2.2;

const at = (x: number, y: number, z: number): Vector3 => ({ x, y, z });

/**
 * Contact points relative to the centre of mass, measured from the artwork: feet
 * at ±2.2 m, the bell's lip 0.45 m above the feet, the descent stage's base 1.05 m
 * up (radius 1.3 m), the module's roof 3.15 m up (radius 0.78 m), and the antenna
 * tip 3.95 m up.
 */
const CONTACTS: readonly ContactPoint[] = [
  { ...LEG, id: 'foot-left-front', position: at(-STANCE, -H, -STANCE) },
  { ...LEG, id: 'foot-left-back', position: at(-STANCE, -H, STANCE) },
  { ...LEG, id: 'foot-right-front', position: at(STANCE, -H, -STANCE) },
  { ...LEG, id: 'foot-right-back', position: at(STANCE, -H, STANCE) },
  { ...HULL, id: 'engine-bell', position: at(0, 0.45 - H, 0) },
  ...[0, 1, 2, 3].flatMap((i) => {
    const angle = (i * Math.PI) / 2;
    return [
      {
        ...HULL,
        id: `descent-stage-${i}`,
        position: at(1.3 * Math.sin(angle), 1.05 - H, 1.3 * Math.cos(angle)),
      },
      {
        ...HULL,
        id: `module-roof-${i}`,
        position: at(0.78 * Math.sin(angle), 3.15 - H, 0.78 * Math.cos(angle)),
      },
    ];
  }),
  { ...HULL, id: 'antenna', position: at(0.45, 3.95 - H, 0) },
];

// A broad bronze-foil descent stage under a white crew module with a window and
// an antenna, on four wide-set legs.
const PARTS: readonly ModelPart[] = [
  {
    shape: { kind: 'cylinder', radiusTop: 1.2, radiusBottom: 1.3, height: 1, sides: 8 },
    finish: 'foil',
    position: at(0, 1.55, 0),
  },
  {
    shape: { kind: 'cylinder', radiusTop: 1.22, radiusBottom: 1.22, height: 0.1, sides: 8 },
    finish: 'graphite',
    position: at(0, 2.1, 0),
  },
  {
    shape: { kind: 'cylinder', radiusTop: 0.78, radiusBottom: 0.95, height: 1, sides: 8 },
    finish: 'white',
    position: at(0, 2.65, 0),
  },
  {
    shape: {
      kind: 'cylinder',
      radiusTop: 0.36,
      radiusBottom: 0.62,
      height: 0.62,
      sides: 16,
      open: true,
    },
    finish: 'graphite',
    position: at(0, 0.76, 0),
  },
  {
    shape: { kind: 'box', width: 0.7, height: 0.28, depth: 0.05 },
    finish: 'glass',
    position: at(0, 2.8, -0.85),
  },
  {
    shape: { kind: 'cylinder', radiusTop: 0.022, radiusBottom: 0.022, height: 0.7, sides: 6 },
    finish: 'silver',
    position: at(0.45, 3.5, 0),
  },
  {
    shape: { kind: 'sphere', radius: 0.07, widthSegments: 8, heightSegments: 6 },
    finish: 'white',
    position: at(0.45, 3.88, 0),
  },
];

// Legs in foot order (left-front, left-back, right-front, right-back): a main
// strut from the stage's top corner and a thinner one from lower down.
const LEGS: readonly ModelLeg[] = [-1, 1].flatMap((x) =>
  [-1, 1].map((z) => ({
    foot: at(x * STANCE, 0.05, z * STANCE),
    struts: [
      { from: at(x * 0.88, 1.95, z * 0.88), radius: 0.065 },
      { from: at(x * 0.95, 1.15, z * 0.95), radius: 0.035 },
    ],
  })),
);

/** The descent vehicle: 2.0 km/s of delta-v, hovering at 42% throttle when full. */
export const DESCENT_VEHICLE: VehicleDefinition = {
  id: 'descent-vehicle',
  parameters: {
    dryMass: 2000,
    fuelCapacity: 1900,
    maxThrust: 15000,
    // Storable propellants, like the Apollo descent engine's (about 3,050 m/s).
    exhaustVelocity: 3000,
    inertia: { x: 6000, y: 4200, z: 6000 },
    // About 0.35 rad/s² in pitch and roll: heavier to turn than the first lander.
    maxTorque: { x: 2100, y: 1500, z: 2100 },
    // Thruster quads at the module's base, 1.3 m out.
    attitudeLeverArm: { x: 1.3, y: 1.3, z: 1.3 },
    attitudeExhaustVelocity: 2800,
    contacts: CONTACTS,
  },
  attitude: {
    maxRate: { x: Math.PI / 8, y: Math.PI / 8, z: Math.PI / 8 },
    responseTime: 0.4,
  },
  model: {
    centerOfMassHeight: CENTER_OF_MASS_HEIGHT,
    finishes: {
      foil: { color: '#b8893e', metalness: 0.7, roughness: 0.45 },
      white: { color: '#e8eaec', metalness: 0.3, roughness: 0.4 },
      graphite: { color: '#242c35', metalness: 0.4, roughness: 0.5 },
      silver: { color: '#9aa6b3', metalness: 0.65, roughness: 0.3 },
      glass: { color: '#102f42', metalness: 0.6, roughness: 0.2 },
    },
    parts: PARTS,
    footPad: { radiusTop: 0.32, radiusBottom: 0.4, height: 0.1, finish: 'graphite' },
    strutFinish: 'silver',
    legs: LEGS,
    // The bell's lip 0.45 m above the feet; a 7 m plume at full throttle.
    engine: { bell: at(0, 0.45, 0), plumeRadius: 0.7, plumeLength: 7 },
    // Quads at the module's base, 1.3 m out, 2.2 m up.
    thrusters: { radius: 1.3, height: 2.2 },
  },
};
