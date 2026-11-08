import {
  clamp,
  classifyTouchdown,
  coastOnRails,
  contactFacts,
  magnitude,
  MAX_FLIGHT_STEP,
  NO_TOUCHDOWN,
  rateControlTorque,
  stepFlight,
  timeToAltitude,
  toRadians,
  updateTouchdown,
  type ContactFact,
  type TouchdownLimits,
  type TouchdownOutcome,
  type TouchdownRecord,
  type AttitudeSettings,
  type CelestialBody,
  type FlightEnvironment,
  type FlightState,
  type OrbitFrame,
  type Vector3,
  type VehicleParameters,
} from '@gravitas/engine';

/** Fixed simulation step in seconds (60 Hz), independent of display refresh rate. */
export const FIXED_STEP = MAX_FLIGHT_STEP;
/** Most steps run for one animation frame; older wall time is discarded and counted. */
export const MAX_STEPS_PER_FRAME = 5;
/** Fastest throttle lever travel per second, as when a throttle key is held (full range in 2 s). */
export const THROTTLE_RATE = 0.5;

/**
 * Time-warp factors a session offers. Up to PHYSICS_WARP_LIMIT the physics runs
 * faster, so thrust and rotation still work; above it the vehicle coasts on
 * rails along its Kepler orbit (ADR 0019).
 */
export const WARP_LEVELS = [1, 2, 4, 10, 100, 1000] as const;
/** A factor from WARP_LEVELS: simulated seconds per wall-clock second. */
export type WarpLevel = (typeof WARP_LEVELS)[number];
/** Highest warp that still steps the physics. */
export const PHYSICS_WARP_LIMIT = 4;
/**
 * Fastest rotation, in radians per second (0.1°/s), at which rails warp may begin.
 * The spin then continues, torque-free; braking first keeps attitude predictable.
 */
export const RAILS_MAX_RATE = toRadians(0.1);

/**
 * Why rails warp is unavailable: no orbit in this scenario, not flying, the
 * engine lever is open, the vehicle is turning too fast, or it is at or below
 * the scenario's rails floor.
 */
export type RailsBlocker = 'no-orbit' | 'not-flying' | 'throttle' | 'rotation' | 'altitude';

// Metres above the rails floor that still count as at it; see railsBlocker.
const FLOOR_MARGIN = 1e-3;

/** What a flight around a body adds to its scenario, for on-rails time warp. */
export interface OrbitScenario {
  /** The body flown around; its gravity must match the environment's. */
  readonly body: CelestialBody;
  /** Frame of `start` and the environment; the frames coincide at the scenario start. */
  readonly frame: OrbitFrame;
  /**
   * Altitude above the body's reference sphere, in metres, below which rails warp
   * is unavailable; coasting down through it drops back to 1×.
   */
  readonly railsFloor: number;
}

/**
 * `ready` waits for the first start. `flying` and `complete` advance simulation
 * time; `complete` follows a final touchdown verdict, with the engine cut and
 * input ignored while the vehicle comes to rest.
 */
export type SessionPhase = 'ready' | 'flying' | 'paused' | 'complete';

/** Pilot input for one animation frame. Held values apply to every tick in that frame. */
export interface PilotInput {
  /** Normalized body-axis rate requests in [-1, 1]. */
  readonly rates: Vector3;
  /**
   * Lever speed as a fraction of THROTTLE_RATE in [-1, 1]: +1 raises it at full
   * rate (a held key), −0.5 lowers it at half rate (a half-pressed trigger), 0 holds
   * it. Values outside the range are clamped; non-finite values hold the lever.
   */
  readonly throttleChange: number;
  /**
   * One-shot lever position in [0, 1] (clamped), applied once at the next tick: a
   * discrete key or a touch lever. Non-finite values are ignored.
   */
  readonly throttleSet?: number;
}

/** Everything a session needs; values come from the app's vehicle and scenario. */
export interface FlightScenario {
  readonly start: FlightState;
  readonly vehicle: VehicleParameters;
  readonly attitude: AttitudeSettings;
  /** Gravity and the surface the vehicle's contact points can touch. */
  readonly environment: FlightEnvironment;
  /** Thresholds that judge the touchdown. */
  readonly limits: TouchdownLimits;
  /** Present for flights around a body; enables rails warp. */
  readonly orbit?: OrbitScenario;
}

const ZERO = { x: 0, y: 0, z: 0 } as const;

/** What the actuators actually did in the latest tick, normalized for presentation. */
export interface Actuation {
  /** Main-engine throttle in [0, 1]; zero when the tank is empty. */
  readonly throttle: number;
  /** Attitude torque per body axis as a fraction of its limit, in [−1, 1]. */
  readonly attitude: Vector3;
}

const IDLE_ACTUATION: Actuation = { throttle: 0, attitude: { x: 0, y: 0, z: 0 } };
const AIRBORNE: TouchdownOutcome = { status: 'airborne' };

/** A touchdown judgement that ends the flight. */
export type Verdict = Extract<
  TouchdownOutcome,
  { readonly status: 'landed' | 'rough' | 'crashed' }
>;

/** Whether an outcome is final (`landed`, `rough`, or `crashed`): the flight is over. */
export function isVerdict(outcome: TouchdownOutcome): outcome is Verdict {
  return outcome.status === 'landed' || outcome.status === 'rough' || outcome.status === 'crashed';
}

/**
 * Owns one flight's authoritative state and fixed-step clock. Pure TypeScript:
 * the browser loop passes elapsed wall time and sampled input; nothing here reads
 * clocks, DOM, or rendering state.
 */
export class FlightSession {
  readonly #scenario: FlightScenario;
  #phase: SessionPhase = 'ready';
  #state: FlightState;
  #previous: FlightState;
  #throttle = 0;
  #pendingThrottle: number | undefined;
  #accumulator = 0;
  #ticks = 0;
  #discarded = 0;
  #record: TouchdownRecord = NO_TOUCHDOWN;
  #outcome: TouchdownOutcome = AIRBORNE;
  // Simulated seconds at the verdict.
  #completedAt: number | undefined;
  #warp: WarpLevel = 1;
  // Simulated seconds spent on rails; physics time is ticks × FIXED_STEP.
  #railsTime = 0;
  #verdictState: FlightState | undefined;
  // Actuators applied during the latest tick, for presentation.
  #applied: Actuation = IDLE_ACTUATION;
  // Contact facts of the latest tick, reused as the next tick's starting facts.
  #facts: readonly ContactFact[] | undefined;

  constructor(scenario: FlightScenario) {
    this.#scenario = scenario;
    this.#state = this.#previous = scenario.start;
  }

  /** Current phase; only `flying` advances simulation time. */
  get phase(): SessionPhase {
    return this.#phase;
  }
  /** State after the latest completed tick. */
  get state(): FlightState {
    return this.#state;
  }
  /** State after the tick before it; equal to `state` after start or restart. */
  get previous(): FlightState {
    return this.#previous;
  }
  /** Main-engine lever position in [0, 1]. */
  get throttle(): number {
    return this.#throttle;
  }
  /** Completed simulation ticks since the last restart. */
  get ticks(): number {
    return this.#ticks;
  }
  /** Wall-clock seconds dropped by the per-frame step limit since the last restart. */
  get discardedSeconds(): number {
    return this.#discarded;
  }
  /** Actuators applied in the latest tick; zero before start, while paused, or dry. */
  get actuation(): Actuation {
    return this.#phase === 'flying' || this.#phase === 'complete' ? this.#applied : IDLE_ACTUATION;
  }
  /** The scenario this session flies. */
  get scenario(): FlightScenario {
    return this.#scenario;
  }

  /** Latest touchdown judgement; final once the phase is `complete`. */
  get outcome(): TouchdownOutcome {
    return this.#outcome;
  }
  /** State at the tick the verdict was reached, before any crash plays out. */
  get verdictState(): FlightState | undefined {
    return this.#verdictState;
  }
  /** Simulated seconds from start to the final verdict (or to now, while flying). */
  get flightTime(): number {
    return this.#completedAt ?? this.time;
  }
  /** Simulated seconds since the start, physics ticks and rails together; frames coincide at 0. */
  get time(): number {
    return this.#ticks * FIXED_STEP + this.#railsTime;
  }
  /** Current time-warp factor; 1 is real time. */
  get warp(): WarpLevel {
    return this.#warp;
  }
  /** Why rails warp cannot start now, or undefined if it can. */
  get railsBlocker(): RailsBlocker | undefined {
    const orbit = this.#scenario.orbit;
    if (!orbit) return 'no-orbit';
    if (this.#phase !== 'flying') return 'not-flying';
    if (this.#throttle > 0 || (this.#pendingThrottle ?? 0) > 0) return 'throttle';
    if (magnitude(this.#state.angularVelocity) > RAILS_MAX_RATE) return 'rotation';
    // Both orbit frames are centred on the body.
    const altitude = magnitude(this.#state.position) - orbit.body.radius;
    // A rails stop lands on the floor give or take rounding (nanometres); within a
    // millimetre counts as on it, so rails cannot restart for a zero-length coast.
    if (altitude <= orbit.railsFloor + FLOOR_MARGIN) return 'altitude';
    return undefined;
  }
  /** Fraction of a step accumulated but not yet simulated, in [0, 1): the render blend. */
  get alpha(): number {
    return Math.min(1, this.#accumulator / FIXED_STEP);
  }

  /** Begins the descent from `ready`. */
  start(): void {
    if (this.#phase === 'ready') this.#phase = 'flying';
  }
  /** Freezes simulation time and returns to 1×; the sub-step remainder is kept so the picture does not jump. */
  pause(): void {
    if (this.#phase === 'flying') {
      this.#phase = 'paused';
      this.#warp = 1;
    }
  }

  /**
   * Asks for a warp factor while flying. Physics warp is always allowed; rails
   * warp only when `railsBlocker` is undefined. Returns whether the factor applies.
   */
  requestWarp(level: WarpLevel): boolean {
    if (!WARP_LEVELS.includes(level)) throw new RangeError(`warp ${level} is not a warp level`);
    if (level === 1) {
      this.#warp = 1;
      return true;
    }
    if (this.#phase !== 'flying') return false;
    if (level > PHYSICS_WARP_LIMIT && this.railsBlocker !== undefined) return false;
    this.#warp = level;
    return true;
  }
  /** Continues after a pause. The host must not pass paused wall time to advance(). */
  resume(): void {
    if (this.#phase === 'paused') this.#phase = 'flying';
  }
  /** Returns to the scenario start, resetting lever, clock, history, and counters. */
  restart(): void {
    this.#phase = 'ready';
    this.#state = this.#previous = this.#scenario.start;
    this.#throttle = 0;
    this.#pendingThrottle = undefined;
    this.#accumulator = 0;
    this.#ticks = 0;
    this.#discarded = 0;
    this.#record = NO_TOUCHDOWN;
    this.#outcome = AIRBORNE;
    this.#completedAt = undefined;
    this.#verdictState = undefined;
    this.#facts = undefined;
    this.#applied = IDLE_ACTUATION;
    this.#warp = 1;
    this.#railsTime = 0;
  }

  /**
   * Adds elapsed wall time, scaled by the warp factor, and runs every whole fixed
   * step it covers, up to MAX_STEPS_PER_FRAME per unit of warp. Returns the number
   * of steps run. On rails it instead coasts the whole span analytically and runs
   * no steps; any pilot input first drops to 1× and is flown normally. Input
   * outside `flying` is ignored, including one-shot actions; after a verdict the
   * vehicle coasts with the engine and attitude thrusters off until restart.
   */
  advance(elapsedSeconds: number, pilot: PilotInput): number {
    if (this.#phase !== 'flying' && this.#phase !== 'complete') return 0;
    if (
      this.#phase === 'flying' &&
      pilot.throttleSet !== undefined &&
      Number.isFinite(pilot.throttleSet)
    ) {
      this.#pendingThrottle = clamp(pilot.throttleSet, 0, 1);
    }
    if (!(elapsedSeconds > 0)) return 0;
    const leverSpeed = Number.isFinite(pilot.throttleChange)
      ? clamp(pilot.throttleChange, -1, 1)
      : 0;
    if (this.#warp > PHYSICS_WARP_LIMIT) {
      if (this.#phase !== 'flying' || hasInput(pilot) || this.railsBlocker !== undefined) {
        this.#warp = 1;
      } else {
        this.#coast(elapsedSeconds * this.#warp);
        return 0;
      }
    }
    this.#accumulator += elapsedSeconds * this.#warp;
    const { vehicle, attitude, environment, limits } = this.#scenario;
    let steps = 0;
    while (this.#accumulator >= FIXED_STEP && steps < MAX_STEPS_PER_FRAME * this.#warp) {
      // Decided per tick: a verdict can land mid-frame, and from then on the engine
      // and attitude thrusters are off (no lever ramp, no rate-hold torque).
      let bodyTorque: Vector3 = ZERO;
      if (this.#phase === 'flying') {
        if (this.#pendingThrottle !== undefined) {
          this.#throttle = this.#pendingThrottle;
          this.#pendingThrottle = undefined;
        }
        this.#throttle = clamp(this.#throttle + leverSpeed * THROTTLE_RATE * FIXED_STEP, 0, 1);
        bodyTorque = rateControlTorque(this.#state.angularVelocity, pilot.rates, vehicle, attitude);
      }
      const next = stepFlight(
        this.#state,
        { throttle: this.#throttle, bodyTorque },
        vehicle,
        environment,
        FIXED_STEP,
      );
      this.#accumulator -= FIXED_STEP;
      this.#ticks++;
      steps++;
      // Thrust and torque only act while propellant remains during the tick.
      const fueled = this.#state.fuelMass > 0;
      this.#applied = fueled
        ? {
            throttle: this.#throttle,
            attitude: {
              x: bodyTorque.x / vehicle.maxTorque.x,
              y: bodyTorque.y / vehicle.maxTorque.y,
              z: bodyTorque.z / vehicle.maxTorque.z,
            },
          }
        : IDLE_ACTUATION;
      const before = this.#state;
      this.#previous = this.#state;
      this.#state = next;
      if (this.#phase === 'flying' && environment.surface && vehicle.contacts) {
        const beforeFacts =
          this.#facts ?? contactFacts(before, vehicle.contacts, environment.surface);
        const facts = contactFacts(next, vehicle.contacts, environment.surface);
        this.#facts = facts;
        this.#record = updateTouchdown(
          this.#record,
          { before, beforeFacts, after: next, afterFacts: facts },
          FIXED_STEP,
          limits,
        );
        this.#outcome = classifyTouchdown(this.#record, limits);
        // Touching the ground ends physics warp, so the landing plays in real time.
        if (this.#outcome.status !== 'airborne') this.#warp = 1;
        if (isVerdict(this.#outcome)) {
          this.#phase = 'complete';
          this.#completedAt = this.time;
          this.#verdictState = next;
          this.#throttle = 0;
          this.#pendingThrottle = undefined;
        }
      }
    }
    if (this.#accumulator >= FIXED_STEP) {
      // Overload (slow device, debugger, long task): drop whole steps, keep the remainder.
      const dropped = this.#accumulator - (this.#accumulator % FIXED_STEP);
      // Count wall-clock seconds, as the debug overlay reports them.
      this.#discarded += dropped / this.#warp;
      this.#accumulator -= dropped;
    }
    return steps;
  }

  // Coasts `span` simulated seconds on rails, stopping exactly at the rails floor on
  // the way down. The picture shows the result directly: there is nothing to blend.
  #coast(span: number): void {
    const { body, frame, railsFloor } = this.#scenario.orbit!;
    const time = this.time;
    const untilFloor = timeToAltitude(this.#state, body, frame, time, railsFloor);
    let dt = span;
    if (untilFloor !== undefined && untilFloor <= span) {
      dt = untilFloor;
      this.#warp = 1;
    }
    const next = coastOnRails(this.#state, this.#scenario.vehicle.inertia, body, frame, time, dt);
    this.#state = this.#previous = next;
    this.#railsTime += dt;
    this.#accumulator = 0;
    this.#applied = IDLE_ACTUATION;
    this.#facts = undefined;
  }
}

/** Whether a frame's input asks for anything: rotation, lever movement, or a lever setting. */
function hasInput(pilot: PilotInput): boolean {
  return (
    pilot.rates.x !== 0 ||
    pilot.rates.y !== 0 ||
    pilot.rates.z !== 0 ||
    (Number.isFinite(pilot.throttleChange) && pilot.throttleChange !== 0) ||
    (pilot.throttleSet !== undefined && Number.isFinite(pilot.throttleSet))
  );
}
