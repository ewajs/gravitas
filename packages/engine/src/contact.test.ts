import { describe, expect, it } from 'vitest';
import {
  contactFacts,
  MAX_FLIGHT_STEP,
  rotationAbout,
  stepFlight,
  tiltAngle,
  toRadians,
  type ContactPoint,
  type FlightEnvironment,
  type FlightState,
  type VehicleParameters,
} from './index';

const k = 20000;
const c = 2800;
const leg = (id: string, x: number, z: number): ContactPoint => ({
  id,
  kind: 'leg',
  position: { x, y: -1.5, z },
  stiffness: k,
  damping: c,
  reboundDamping: c,
  friction: 0.6,
});
const legs = [
  leg('lf', -1.5, -1.5),
  leg('lb', -1.5, 1.5),
  leg('rf', 1.5, -1.5),
  leg('rb', 1.5, 1.5),
];
const bell: ContactPoint = {
  id: 'bell',
  kind: 'hull',
  position: { x: 0, y: -1.08, z: 0 },
  stiffness: 200000,
  damping: 8000,
  reboundDamping: 8000,
  friction: 0.5,
};
const vehicle: VehicleParameters = {
  dryMass: 1200,
  fuelCapacity: 300,
  maxThrust: 4500,
  exhaustVelocity: 3000,
  inertia: { x: 1800, y: 1200, z: 1800 },
  maxTorque: { x: 900, y: 600, z: 900 },
  attitudeLeverArm: { x: 0.9, y: 0.9, z: 0.9 },
  attitudeExhaustVelocity: 2800,
  contacts: [...legs, bell],
};
const mass = 1500;
const g = 1.62;
const lunar: FlightEnvironment = {
  gravity: { kind: 'uniform', acceleration: { x: 0, y: -g, z: 0 } },
  surface: { kind: 'flat', height: 0 },
};
const zero = { x: 0, y: 0, z: 0 };
const upright = { x: 0, y: 0, z: 0, w: 1 };
const coast = { throttle: 0, bodyTorque: zero };
const state = (changes: Partial<FlightState> = {}): FlightState => ({
  position: { x: 0, y: 1.5, z: 0 },
  orientation: upright,
  velocity: zero,
  angularVelocity: zero,
  fuelMass: 300,
  ...changes,
});
function simulate(
  s: FlightState,
  seconds: number,
  options: {
    vehicle?: VehicleParameters;
    environment?: FlightEnvironment;
    dt?: number;
    visit?: (s: FlightState) => void;
  } = {},
): FlightState {
  const dt = options.dt ?? MAX_FLIGHT_STEP;
  for (let n = 0; n < Math.round(seconds / dt); n++) {
    s = stepFlight(s, coast, options.vehicle ?? vehicle, options.environment ?? lunar, dt);
    options.visit?.(s);
  }
  return s;
}

describe('surface contact references', () => {
  it('rests on four legs compressed by m·g / 4k with no hull contact', () => {
    const rest = simulate(state(), 10);
    const compression = (mass * g) / (4 * k); // 0.030375 m
    expect(rest.position.y).toBeCloseTo(1.5 - compression, 6);
    expect(Math.hypot(rest.velocity.x, rest.velocity.y, rest.velocity.z)).toBeLessThan(1e-6);
    const facts = contactFacts(rest, vehicle.contacts!, lunar.surface!);
    for (const fact of facts.filter((f) => f.kind === 'leg')) {
      expect(fact.penetration).toBeCloseTo(compression, 6);
      expect(fact.normalForce).toBeCloseTo((mass * g) / 4, 3);
    }
    expect(facts.find((f) => f.id === 'bell')!.normalForce).toBe(0);
  });

  it('bounces elastically without damping: same speed out, contact lasting π/ω', () => {
    const elastic = {
      ...vehicle,
      contacts: legs.map((point) => ({ ...point, damping: 0, reboundDamping: 0, friction: 0 })),
    };
    const space = { ...lunar, gravity: { kind: 'uniform', acceleration: zero } } as const;
    const dt = 1 / 2400;
    let contactTicks = 0;
    const after = simulate(
      state({ position: { x: 0, y: 1.51, z: 0 }, velocity: { x: 0, y: -2, z: 0 } }),
      1,
      {
        vehicle: elastic,
        environment: space,
        dt,
        visit: (s) => {
          if (s.position.y < 1.5) contactTicks++;
        },
      },
    );
    expect(after.velocity.y).toBeCloseTo(2, 4);
    // Four legs in parallel: ω = √(4k / m) ≈ 7.30 rad/s; half a period in contact.
    const halfPeriod = Math.PI / Math.sqrt((4 * k) / mass);
    expect(Math.abs(contactTicks * dt - halfPeriod)).toBeLessThan(2 * dt);
  });

  it('absorbs most impact energy with damped legs', () => {
    const space = { ...lunar, gravity: { kind: 'uniform', acceleration: zero } } as const;
    const after = simulate(
      state({ position: { x: 0, y: 1.51, z: 0 }, velocity: { x: 0, y: -2, z: 0 } }),
      1,
      { environment: space },
    );
    // ζ ≈ 0.51 per leg pair; the rebound keeps well under half the approach speed.
    expect(after.velocity.y).toBeGreaterThan(0);
    expect(after.velocity.y).toBeLessThan(1);
  });

  it('keeps a hard hit from springing back when rebound damping is strong', () => {
    const space = { ...lunar, gravity: { kind: 'uniform', acceleration: zero } } as const;
    const valved = {
      ...vehicle,
      contacts: legs.map((point) => ({ ...point, reboundDamping: 40000 })),
    };
    const start = state({ position: { x: 0, y: 1.51, z: 0 }, velocity: { x: 0, y: -6, z: 0 } });
    const after = simulate(start, 1, { environment: space, vehicle: valved });
    // The force can only fade while extending, so the exit speed stays below k·d/c_rebound.
    expect(after.velocity.y).toBeGreaterThanOrEqual(0);
    expect(after.velocity.y).toBeLessThan(0.3);
  });

  it('slides to a stop at μ·g while sliding', () => {
    const rest = simulate(state(), 5);
    const sliding = { ...rest, velocity: { x: 3, y: 0, z: 0 } };
    const after = simulate(sliding, 0.5);
    // Regularized friction and small pitching shift loads; the sum stays near m·g.
    expect(after.velocity.x).toBeCloseTo(3 - 0.6 * g * 0.5, 1);
    const stopped = simulate(after, 4);
    expect(Math.abs(stopped.velocity.x)).toBeLessThan(0.02);
  });

  it.each([
    [38, false],
    [52, true],
  ])('released at %s° on two feet, tips over: %s (static limit 45°)', (degrees, tips) => {
    const angle = toRadians(degrees);
    // Rolled about +Z, the −X feet are lowest; place them on the surface.
    const footY = -1.5 * Math.sin(angle) - 1.5 * Math.cos(angle);
    const start = state({
      position: { x: 0, y: -footY, z: 0 },
      orientation: rotationAbout('z', angle),
    });
    const end = simulate(start, 6);
    if (tips) expect(tiltAngle(end.orientation)).toBeGreaterThan(toRadians(60));
    else expect(tiltAngle(end.orientation)).toBeLessThan(toRadians(3));
  });

  it('reaches the engine bell only on a hard impact', () => {
    const bellTouches = (speed: number) => {
      let touched = false;
      simulate(
        state({ position: { x: 0, y: 1.52, z: 0 }, velocity: { x: 0, y: -speed, z: 0 } }),
        2,
        {
          visit: (s) => {
            const fact = contactFacts(s, vehicle.contacts!, lunar.surface!).find(
              (f) => f.id === 'bell',
            )!;
            touched ||= fact.normalForce > 0;
          },
        },
      );
      return touched;
    };
    expect(bellTouches(2)).toBe(false);
    expect(bellTouches(8)).toBe(true);
  });

  it('applies no contact effect above the surface', () => {
    const high = state({ position: { x: 0, y: 50, z: 0 }, velocity: { x: 1, y: -3, z: 0.5 } });
    const free = { gravity: lunar.gravity };
    const a = simulate(high, 1);
    const b = simulate(high, 1, { environment: free });
    expect(a.position.y).toBeCloseTo(b.position.y, 9);
    expect(a.velocity.x).toBeCloseTo(b.velocity.x, 12);
  });
});

describe('contact facts', () => {
  it('reports clear points with zero push and the point velocities', () => {
    const facts = contactFacts(
      state({
        position: { x: 0, y: 10, z: 0 },
        velocity: { x: 0, y: -2, z: 0 },
        angularVelocity: { x: 0, y: 1, z: 0 },
      }),
      legs,
      lunar.surface!,
    );
    for (const fact of facts) {
      expect(fact.penetration).toBe(0);
      expect(fact.normalForce).toBe(0);
      expect(fact.approachSpeed).toBeCloseTo(2, 12);
      // Spin about +Y at 1 rad/s moves each foot at r = 1.5·√2 along the surface.
      expect(fact.slipSpeed).toBeCloseTo(1.5 * Math.SQRT2, 12);
    }
  });

  it('rejects invalid contact data and surfaces', () => {
    expect(() => contactFacts(state(), [legs[0]!, legs[0]!], lunar.surface!)).toThrow(/Duplicate/);
    expect(() => contactFacts(state(), [{ ...bell, damping: -1 }], lunar.surface!)).toThrow(
      RangeError,
    );
    expect(() => contactFacts(state(), legs, { kind: 'flat', height: NaN })).toThrow(RangeError);
    expect(() =>
      stepFlight(
        state(),
        coast,
        { ...vehicle, contacts: [{ ...bell, stiffness: 0 }] },
        lunar,
        MAX_FLIGHT_STEP,
      ),
    ).toThrow(RangeError);
  });
});
