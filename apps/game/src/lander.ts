import type { AttitudeSettings, ContactPoint, VehicleParameters } from '@gravitas/engine';

/** Body centre of mass above the level foot-contact plane, in metres. */
export const CENTER_OF_MASS_HEIGHT = 1.5;

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
export const CONTACTS: readonly ContactPoint[] = [
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

/** Leg contact points, in the artwork's foot order. */
export const FEET = CONTACTS.filter((point) => point.kind === 'leg');

/** Fictional first-flight vehicle; these tunable values are not historical Apollo specifications. */
export const LANDER: VehicleParameters = {
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
};

/** Body-axis rate assist, independent of camera position and keyboard bindings. */
export const ATTITUDE: AttitudeSettings = {
  maxRate: { x: Math.PI / 6, y: Math.PI / 6, z: Math.PI / 6 },
  responseTime: 0.3,
};
