import {
  classifyTouchdown,
  contactFacts,
  MAX_FLIGHT_STEP,
  NO_TOUCHDOWN,
  rateControlTorque,
  stepFlight,
  updateTouchdown,
  type ContactFact,
  type TouchdownLimits,
  type TouchdownOutcome,
  type TouchdownRecord,
  type AttitudeSettings,
  type FlightEnvironment,
  type FlightState,
  type Vector3,
  type VehicleParameters,
} from '@gravitas/engine';

/** Fixed simulation step in seconds (60 Hz), independent of display refresh rate. */
export const FIXED_STEP = MAX_FLIGHT_STEP;
/** Most steps run for one animation frame; older wall time is discarded and counted. */
export const MAX_STEPS_PER_FRAME = 5;
/** Throttle lever travel per second while a throttle key is held (full range in 2 s). */
export const THROTTLE_RATE = 0.5;

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
  /** Held throttle direction: raise (+1), lower (-1), or hold the lever (0). */
  readonly throttleChange: -1 | 0 | 1;
  /** One-shot lever position from a discrete key, applied once at the next tick. */
  readonly throttleSet?: 0 | 1;
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
}

const ZERO = { x: 0, y: 0, z: 0 } as const;
const AIRBORNE: TouchdownOutcome = { status: 'airborne' };

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
  #pendingThrottle: 0 | 1 | undefined;
  #accumulator = 0;
  #ticks = 0;
  #discarded = 0;
  #record: TouchdownRecord = NO_TOUCHDOWN;
  #outcome: TouchdownOutcome = AIRBORNE;
  #completedAt: number | undefined;
  #verdictState: FlightState | undefined;
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
    return (this.#completedAt ?? this.#ticks) * FIXED_STEP;
  }
  /** Fraction of a step accumulated but not yet simulated, in [0, 1): the render blend. */
  get alpha(): number {
    return Math.min(1, this.#accumulator / FIXED_STEP);
  }

  /** Begins the descent from `ready`. */
  start(): void {
    if (this.#phase === 'ready') this.#phase = 'flying';
  }
  /** Freezes simulation time; the sub-step remainder is kept so the picture does not jump. */
  pause(): void {
    if (this.#phase === 'flying') this.#phase = 'paused';
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
  }

  /**
   * Adds elapsed wall time and runs every whole fixed step it covers, up to
   * MAX_STEPS_PER_FRAME. Returns the number of steps run. Input outside `flying`
   * is ignored, including one-shot actions; after a verdict the vehicle coasts
   * with the engine and attitude thrusters off until restart.
   */
  advance(elapsedSeconds: number, pilot: PilotInput): number {
    if (this.#phase !== 'flying' && this.#phase !== 'complete') return 0;
    if (this.#phase === 'flying' && pilot.throttleSet !== undefined) {
      this.#pendingThrottle = pilot.throttleSet;
    }
    if (!(elapsedSeconds > 0)) return 0;
    this.#accumulator += elapsedSeconds;
    const { vehicle, attitude, environment, limits } = this.#scenario;
    let steps = 0;
    while (this.#accumulator >= FIXED_STEP && steps < MAX_STEPS_PER_FRAME) {
      // Decided per tick: a verdict can land mid-frame, and from then on the engine
      // and attitude thrusters are off (no lever ramp, no rate-hold torque).
      let bodyTorque: Vector3 = ZERO;
      if (this.#phase === 'flying') {
        if (this.#pendingThrottle !== undefined) {
          this.#throttle = this.#pendingThrottle;
          this.#pendingThrottle = undefined;
        }
        this.#throttle = Math.min(
          1,
          Math.max(0, this.#throttle + pilot.throttleChange * THROTTLE_RATE * FIXED_STEP),
        );
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
        const status = this.#outcome.status;
        if (status === 'landed' || status === 'rough' || status === 'crashed') {
          this.#phase = 'complete';
          this.#completedAt = this.#ticks;
          this.#verdictState = next;
          this.#throttle = 0;
          this.#pendingThrottle = undefined;
        }
      }
    }
    if (this.#accumulator >= FIXED_STEP) {
      // Overload (slow device, debugger, long task): drop whole steps, keep the remainder.
      const dropped = this.#accumulator - (this.#accumulator % FIXED_STEP);
      this.#discarded += dropped;
      this.#accumulator -= dropped;
    }
    return steps;
  }
}
