import type { Vector3 } from '@gravitas/engine';
import type { InputDevice } from '@gravitas/ui';
import type { PilotInput } from './session';

/**
 * Discrete commands any input source may issue; the app applies them at once.
 * `confirm` is the gamepad's A: start when ready, resume when paused, and try
 * again after a verdict.
 */
export type InputCommand =
  | 'toggle-pause'
  | 'restart'
  | 'toggle-mute'
  | 'confirm'
  | 'warp-faster'
  | 'warp-slower'
  | 'toggle-map';

/**
 * One input device, such as the keyboard. Held input is sampled once per animation
 * frame and applied to every tick in it; discrete commands go to the callback the
 * source was created with, the same for every source.
 */
export interface InputSource {
  /** The kind of device, so help and on-screen controls can follow the one in use. */
  readonly device: InputDevice;
  /**
   * Whether the latest sample came from deliberate input: something held, or a
   * key, button, or touch since the previous sample.
   */
  readonly active: boolean;
  /**
   * Reads devices that must be polled (gamepads) and issues their commands.
   * Called once per frame before `sample()`, never during it.
   */
  poll?(): void;
  /** This frame's held input plus any queued one-shot setting, which the call consumes. */
  sample(): PilotInput;
  /** Releases everything held or queued, e.g. on blur, pause, or restart. */
  clear(): void;
  /** Removes listeners; the source cannot be reused. */
  dispose(): void;
}

// Whether a sample asks to move the throttle lever this frame.
function movesThrottle(input: PilotInput): boolean {
  return input.throttleChange !== 0 || input.throttleSet !== undefined;
}

/**
 * Shapes a two-axis stick for gentle control near centre: a radial dead zone,
 * rescaled so travel resumes from zero at its edge, then a response curve that
 * blends linear and cubic travel equally (half deflection asks for 31%, full for
 * 100%). The result keeps the stick's direction and is at most 1 long.
 */
export function stickResponse(x: number, y: number, deadZone: number): { x: number; y: number } {
  const length = Math.hypot(x, y);
  if (!(length > deadZone)) return { x: 0, y: 0 };
  const travel = Math.min(1, (length - deadZone) / (1 - deadZone));
  const response = 0.5 * travel + 0.5 * travel ** 3;
  return { x: (x / length) * response, y: (y / length) * response };
}

/**
 * The strongest request on one axis: the largest magnitude wins, so an idle
 * source (zero) never weakens another and two sources never add up. Equal and
 * opposite requests cancel, as opposite keys do.
 */
export function strongest(values: readonly number[]): number {
  let up = 0;
  let down = 0;
  for (const value of values) {
    if (value > up) up = value;
    else if (value < down) down = value;
  }
  if (up === -down) return 0;
  return up > -down ? up : down;
}

/**
 * Merges every input source into one pilot input per frame:
 *
 * - rotation: the strongest request per body axis;
 * - throttle: the source that most recently began moving the lever wins while it
 *   keeps moving it; the others' lever requests are ignored meanwhile;
 * - commands: each source reports its own, so any of them can pause or restart.
 */
export class PilotInputs {
  readonly #sources: readonly InputSource[];
  // Sources moving the lever in the previous frame, and the one in control of it.
  #moving = new Set<InputSource>();
  #throttleOwner: InputSource | undefined;
  #activeDevice: InputDevice | undefined;

  constructor(sources: readonly InputSource[]) {
    this.#sources = sources;
  }

  /**
   * The device that showed deliberate input in the latest sample (the later
   * source in the list if several did), or undefined if none did.
   */
  get activeDevice(): InputDevice | undefined {
    return this.#activeDevice;
  }

  /** Polls the sources that need it; their commands run now, before sampling. */
  poll(): void {
    for (const source of this.#sources) source.poll?.();
  }

  /** Samples every source once (consuming one-shot settings) and merges them. */
  sample(): PilotInput {
    const samples = this.#sources.map((source) => ({ source, input: source.sample() }));
    this.#activeDevice = undefined;
    for (const { source } of samples) if (source.active) this.#activeDevice = source.device;
    const axis = (name: keyof Vector3) => strongest(samples.map(({ input }) => input.rates[name]));
    const rates = { x: axis('x'), y: axis('y'), z: axis('z') };

    const moving = samples.filter(({ input }) => movesThrottle(input));
    const started = moving.filter(({ source }) => !this.#moving.has(source));
    if (started.length > 0) {
      this.#throttleOwner = started[started.length - 1]!.source;
    } else if (!moving.some(({ source }) => source === this.#throttleOwner)) {
      this.#throttleOwner = moving[moving.length - 1]?.source;
    }
    this.#moving = new Set(moving.map(({ source }) => source));

    const owner = moving.find(({ source }) => source === this.#throttleOwner)?.input;
    if (!owner) return { rates, throttleChange: 0 };
    return owner.throttleSet === undefined
      ? { rates, throttleChange: owner.throttleChange }
      : { rates, throttleChange: owner.throttleChange, throttleSet: owner.throttleSet };
  }

  /** Releases every source's held input, e.g. on blur, pause, or restart. */
  clear(): void {
    for (const source of this.#sources) source.clear();
    this.#moving.clear();
    this.#throttleOwner = undefined;
  }

  /** Disposes every source. */
  dispose(): void {
    for (const source of this.#sources) source.dispose();
  }
}
