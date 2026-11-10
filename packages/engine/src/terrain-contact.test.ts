import { describe, expect, it } from 'vitest';
import {
  bodyToWorld,
  contactFacts,
  createTerrain,
  MAX_FLIGHT_STEP,
  multiplyQuaternions,
  rotationAbout,
  sampleTerrain,
  stepFlight,
  terrainHeight,
  type ContactPoint,
  type FlightEnvironment,
  type FlightState,
  type Quaternion,
  type Terrain,
  type VehicleParameters,
} from './index';

// Contact with a body's terrain (5.4a): the same legs as the flat-ground references
// in contact.test.ts, now on a sphere with a height function.

const R = 1_737_400;
const g = 1.62;
const zero = { x: 0, y: 0, z: 0 };
const coast = { throttle: 0, bodyTorque: zero };
const leg = (id: string, x: number, z: number, friction = 0.6): ContactPoint => ({
  id,
  kind: 'leg',
  position: { x, y: -1.5, z },
  stiffness: 20000,
  damping: 2800,
  reboundDamping: 2800,
  friction,
});
const legs = (friction?: number) => [
  leg('lf', -1.5, -1.5, friction),
  leg('lb', -1.5, 1.5, friction),
  leg('rf', 1.5, -1.5, friction),
  leg('rb', 1.5, 1.5, friction),
];
const vehicle = (friction?: number): VehicleParameters => ({
  dryMass: 1200,
  fuelCapacity: 300,
  maxThrust: 4500,
  exhaustVelocity: 3000,
  inertia: { x: 1800, y: 1200, z: 1800 },
  maxTorque: { x: 900, y: 600, z: 900 },
  attitudeLeverArm: { x: 0.9, y: 0.9, z: 0.9 },
  attitudeExhaustVelocity: 2800,
  contacts: legs(friction),
});

/** A grid of one value per column (constant along each meridian), in metres. */
function meridianGrid(height: (longitude: number) => number) {
  const columns = 360;
  const rows = 180;
  const samples = new Float64Array(rows * columns);
  for (let column = 0; column < columns; column++) {
    const value = height(((column + 0.5) * 2 * Math.PI) / columns);
    for (let row = 0; row < rows; row++) samples[row * columns + column] = value;
  }
  return { columns, rows, samples, scale: 1 };
}

const level = createTerrain({ radius: R, grid: meridianGrid(() => 0), seed: 1, detail: false });

/** Central gravity of g at the reference radius. */
const central = (terrain: Terrain): FlightEnvironment => ({
  gravity: { kind: 'central', centre: zero, gravitationalParameter: g * R * R },
  surface: { kind: 'terrain', terrain },
});

function simulate(
  s: FlightState,
  seconds: number,
  v: VehicleParameters,
  environment: FlightEnvironment,
): FlightState {
  for (let n = 0; n < Math.round(seconds / MAX_FLIGHT_STEP); n++) {
    s = stepFlight(s, coast, v, environment, MAX_FLIGHT_STEP);
  }
  return s;
}

const start = (position: FlightState['position'], orientation: Quaternion): FlightState => ({
  position,
  orientation,
  velocity: zero,
  angularVelocity: zero,
  fuelMass: 300,
});

describe('contact with level terrain matches flat ground where curvature is negligible', () => {
  it('drops from a metre and settles exactly as on the flat reference', () => {
    // At the north pole the body-fixed +Y is up, as in the flat world.
    const upright = { x: 0, y: 0, z: 0, w: 1 };
    const flat = simulate(start({ x: 0, y: 2.5, z: 0 }, upright), 6, vehicle(), {
      gravity: { kind: 'uniform', acceleration: { x: 0, y: -g, z: 0 } },
      surface: { kind: 'flat', height: 0 },
    });
    const sphere = simulate(start({ x: 0, y: R + 2.5, z: 0 }, upright), 6, vehicle(), {
      gravity: { kind: 'uniform', acceleration: { x: 0, y: -g, z: 0 } },
      surface: { kind: 'terrain', terrain: level },
    });
    // Over the legs' 1.5 m, the sphere drops 1.5² / 2R ≈ 0.6 µm below the plane.
    expect(sphere.position.y - R).toBeCloseTo(flat.position.y, 5);
    expect(sphere.velocity.y).toBeCloseTo(flat.velocity.y, 6);
    const facts = contactFacts(sphere, legs(), { kind: 'terrain', terrain: level });
    const flatFacts = contactFacts(flat, legs(), { kind: 'flat', height: 0 });
    facts.forEach((fact, n) => {
      expect(fact.penetration).toBeCloseTo(flatFacts[n]!.penetration, 5);
      expect(fact.normalForce).toBeCloseTo(flatFacts[n]!.normalForce, 1);
    });
  });

  it('samples nothing far above the ground: free flight is unchanged to the bit', () => {
    const high = start({ x: 0, y: R + 5000, z: 0 }, { x: 0, y: 0, z: 0, w: 1 });
    const moving = { ...high, velocity: { x: 1600, y: -20, z: 0 } };
    const free: FlightEnvironment = {
      gravity: { kind: 'central', centre: zero, gravitationalParameter: g * R * R },
    };
    expect(simulate(moving, 2, vehicle(), central(level))).toEqual(
      simulate(moving, 2, vehicle(), free),
    );
  });
});

describe('contact on a slope', () => {
  // Heights rising eastward by tan θ per metre around longitude 90°E, where up is
  // −Z, east is −X, and downhill is +X.
  const tilt = (degrees: number) => {
    const s = Math.tan((degrees * Math.PI) / 180);
    return createTerrain({
      radius: R,
      grid: meridianGrid((longitude) => s * R * (longitude - Math.PI / 2)),
      seed: 1,
      detail: false,
    });
  };
  /** Standing on the slope, legs perpendicular to it, feet touching. */
  const standing = (terrain: Terrain, degrees: number): FlightState => {
    const down = (-degrees * Math.PI) / 180;
    const orientation = multiplyQuaternions(
      rotationAbout('y', down),
      rotationAbout('x', -Math.PI / 2),
    );
    const ground = sampleTerrain(terrain, { x: 0, y: 0, z: -1 });
    const up = bodyToWorld(orientation, { x: 0, y: 1, z: 0 });
    expect(up.x).toBeCloseTo(ground.normal.x, 9);
    expect(up.z).toBeCloseTo(ground.normal.z, 9);
    const surface = R + ground.height;
    return start({ x: 1.505 * up.x, y: 0, z: -surface + 1.505 * up.z }, orientation);
  };

  it('samples the slope: 10° of grid slope is a normal leaning 10°, downhill +X', () => {
    const ground = sampleTerrain(tilt(10), { x: 0, y: 0, z: -1 });
    expect((ground.slope * 180) / Math.PI).toBeCloseTo(10, 6);
    expect(ground.normal.x).toBeGreaterThan(0);
  });

  it('rests on a 10° slope with friction 0.6 and stays: static friction holds', () => {
    const terrain = tilt(10);
    const θ = (10 * Math.PI) / 180;
    const first = standing(terrain, 10);
    const rest = simulate(first, 6, vehicle(0.6), central(terrain));
    // tan 10° = 0.18 is well under μ = 0.6: each foot holds at its anchor.
    expect(Math.hypot(rest.velocity.x, rest.velocity.y, rest.velocity.z)).toBeLessThan(1e-4);
    expect(rest.contactAnchors?.filter((anchor) => anchor !== null)).toHaveLength(4);
    // A minute later it has not moved a millimetre (it used to creep 1.8 m).
    const later = simulate(rest, 60, vehicle(0.6), central(terrain));
    expect(
      Math.hypot(
        later.position.x - rest.position.x,
        later.position.y - rest.position.y,
        later.position.z - rest.position.z,
      ),
    ).toBeLessThan(1e-3);
    // Upright on its legs, which carry the weight's normal part, m·g·cos θ.
    const up = bodyToWorld(rest.orientation, { x: 0, y: 1, z: 0 });
    expect(Math.acos(up.x * Math.sin(θ) - up.z * Math.cos(θ))).toBeLessThan(0.01);
    const facts = contactFacts(rest, legs(0.6), { kind: 'terrain', terrain });
    const total = facts.reduce((sum, fact) => sum + fact.normalForce, 0);
    expect(total / (1500 * g * Math.cos(θ))).toBeCloseTo(1, 3);
  });

  it('holds up to the friction angle and slides beyond it: 25° stays, 35° goes', () => {
    // μ = 0.6 holds slopes up to atan 0.6 = 31°. Legs along the slope's normal.
    const speedAfter = (degrees: number) => {
      const terrain = tilt(degrees);
      const state = simulate(standing(terrain, degrees), 4, vehicle(0.6), central(terrain));
      return Math.hypot(state.velocity.x, state.velocity.y, state.velocity.z);
    };
    expect(speedAfter(25)).toBeLessThan(1e-3);
    expect(speedAfter(35)).toBeGreaterThan(0.3);
  });

  it('slides a low-friction lander downhill at g (sin θ − μ cos θ)', () => {
    const terrain = tilt(10);
    const θ = (10 * Math.PI) / 180;
    // Past what the anchors can hold, friction is the full μN against the slide.
    const sliding = simulate(standing(terrain, 10), 3, vehicle(0.1), central(terrain));
    const later = simulate(sliding, 2, vehicle(0.1), central(terrain));
    const expected = g * (Math.sin(θ) - 0.1 * Math.cos(θ));
    // Downhill along the slope: mostly +X, a little inward (+Z).
    const along = (state: FlightState) =>
      state.velocity.x * Math.cos(θ) + state.velocity.z * Math.sin(θ);
    expect(along(sliding)).toBeGreaterThan(0.2);
    expect((along(later) - along(sliding)) / 2).toBeCloseTo(expected, 2);
  });

  it('measures penetration along the normal, below the tangent plane', () => {
    const terrain = tilt(20);
    const ground = sampleTerrain(terrain, { x: 0, y: 0, z: -1 });
    const surface = R + terrainHeight(terrain, { x: 0, y: 0, z: -1 });
    // A foot 3 cm into the ground along the normal.
    const foot = { x: -0.03 * ground.normal.x, y: 0, z: -surface - 0.03 * ground.normal.z };
    const [fact] = contactFacts(
      { ...start({ x: foot.x, y: 1.5, z: foot.z }, { x: 0, y: 0, z: 0, w: 1 }) },
      [leg('foot', 0, 0)],
      { kind: 'terrain', terrain },
    );
    expect(fact!.penetration).toBeCloseTo(0.03, 6);
    expect(fact!.normalForce).toBeCloseTo(20000 * 0.03, 3);
  });
});
