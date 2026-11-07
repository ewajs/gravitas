import {
  MAX_FLIGHT_STEP,
  rateControlTorque,
  stepFlight,
  type AttitudeSettings,
  type FlightEnvironment,
  type FlightState,
  type Vector3,
  type VehicleParameters,
  type VehiclePose,
} from '@gravitas/engine';

/** Fixed simulation step in seconds (60 Hz), independent of display refresh rate. */
export const FIXED_STEP = MAX_FLIGHT_STEP;
/** Most steps run for one animation frame; older wall time is discarded and counted. */
export const MAX_STEPS_PER_FRAME = 5;
/** Throttle lever travel per second while a throttle key is held (full range in 2 s). */
export const THROTTLE_RATE = 0.5;

/** `ready` waits for the first start; `contact` is the placeholder ground halt until M2. */
export type SessionPhase = 'ready' | 'flying' | 'paused' | 'contact';

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
  readonly environment: FlightEnvironment;
  /** Lowest contact point above the surface for a pose, in metres. */
  readonly clearance: (pose: VehiclePose) => number;
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
  #pendingThrottle: 0 | 1 | undefined;
  #accumulator = 0;
  #ticks = 0;
  #discarded = 0;

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
  /** State after the tick before it; equal to `state` after start, restart, or contact. */
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
  }

  /**
   * Adds elapsed wall time and runs every whole fixed step it covers, up to
   * MAX_STEPS_PER_FRAME. Returns the number of steps run. Input outside `flying`
   * is ignored, including one-shot actions.
   */
  advance(elapsedSeconds: number, input: PilotInput): number {
    if (this.#phase !== 'flying') return 0;
    if (input.throttleSet !== undefined) this.#pendingThrottle = input.throttleSet;
    if (!(elapsedSeconds > 0)) return 0;
    this.#accumulator += elapsedSeconds;
    const { vehicle, attitude, environment } = this.#scenario;
    let steps = 0;
    while (this.#accumulator >= FIXED_STEP && steps < MAX_STEPS_PER_FRAME) {
      if (this.#pendingThrottle !== undefined) {
        this.#throttle = this.#pendingThrottle;
        this.#pendingThrottle = undefined;
      }
      this.#throttle = Math.min(
        1,
        Math.max(0, this.#throttle + input.throttleChange * THROTTLE_RATE * FIXED_STEP),
      );
      const bodyTorque = rateControlTorque(
        this.#state.angularVelocity,
        input.rates,
        vehicle,
        attitude,
      );
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
      const clearance = this.#scenario.clearance(next);
      if (clearance <= 0) {
        this.#halt(next, clearance);
        return steps;
      }
      this.#previous = this.#state;
      this.#state = next;
    }
    if (this.#accumulator >= FIXED_STEP) {
      // Overload (slow device, debugger, long task): drop whole steps, keep the remainder.
      const dropped = this.#accumulator - (this.#accumulator % FIXED_STEP);
      this.#discarded += dropped;
      this.#accumulator -= dropped;
    }
    return steps;
  }

  // Placeholder until M2 contact: lift the vehicle so its lowest foot rests on the
  // surface, keep the touchdown velocities for display, and stop simulating.
  #halt(next: FlightState, clearance: number): void {
    const resting: FlightState = {
      ...next,
      position: { ...next.position, y: next.position.y - clearance },
    };
    this.#state = this.#previous = resting;
    this.#accumulator = 0;
    this.#pendingThrottle = undefined;
    this.#phase = 'contact';
  }
}
