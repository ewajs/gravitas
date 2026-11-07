import type { Vector3 } from '@gravitas/engine';
import type { PilotInput } from './session';

/** Discrete commands any input source may issue; the app applies them at once. */
export type InputCommand = 'toggle-pause' | 'restart' | 'toggle-mute';

/**
 * One input device, such as the keyboard. Held input is sampled once per animation
 * frame and applied to every tick in it; discrete commands go to the callback the
 * source was created with, the same for every source.
 */
export interface InputSource {
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

  constructor(sources: readonly InputSource[]) {
    this.#sources = sources;
  }

  /** Samples every source once (consuming one-shot settings) and merges them. */
  sample(): PilotInput {
    const samples = this.#sources.map((source) => ({ source, input: source.sample() }));
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
