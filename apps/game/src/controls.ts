import type { Vector3 } from '@gravitas/engine';
import type { PilotInput } from './session';

// Physical key positions (KeyboardEvent.code), so layouts such as AZERTY keep the shape.
// Signs follow body axes: -X rate tilts thrust forward, +Z rate tilts it left, +Y yaws left.
const RATE_KEYS: Readonly<Record<string, readonly [keyof Vector3, 1 | -1]>> = {
  KeyW: ['x', -1],
  KeyS: ['x', 1],
  KeyA: ['z', 1],
  KeyD: ['z', -1],
  KeyQ: ['y', 1],
  KeyE: ['y', -1],
};
const THROTTLE_UP = 'KeyR';
const THROTTLE_DOWN = 'KeyF';
const HELD_KEYS = new Set([...Object.keys(RATE_KEYS), THROTTLE_UP, THROTTLE_DOWN]);
const THROTTLE_SET_KEYS: Readonly<Record<string, 0 | 1>> = { KeyZ: 1, KeyX: 0 };

/** Discrete commands handled immediately by the app rather than at a simulation tick. */
export type KeyCommand = 'toggle-pause' | 'restart';
const COMMAND_KEYS: Readonly<Record<string, KeyCommand>> = {
  KeyP: 'toggle-pause',
  Enter: 'restart',
  NumpadEnter: 'restart',
};

/** Maps currently held physical keys to normalized pilot input; opposite keys cancel. */
export function pilotInput(held: ReadonlySet<string>, throttleSet?: 0 | 1): PilotInput {
  const rates = { x: 0, y: 0, z: 0 };
  for (const [code, [axis, sign]] of Object.entries(RATE_KEYS)) {
    if (held.has(code)) rates[axis] += sign;
  }
  const throttleChange = ((held.has(THROTTLE_UP) ? 1 : 0) - (held.has(THROTTLE_DOWN) ? 1 : 0)) as
    -1 | 0 | 1;
  return throttleSet === undefined
    ? { rates, throttleChange }
    : { rates, throttleChange, throttleSet };
}

// Flight keys must not hijack form controls, the help dialog, or browser shortcuts.
function ignored(event: KeyboardEvent): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey) return true;
  const origin = event.composedPath()[0];
  if (!(origin instanceof Element)) return false;
  if (origin.closest('dialog, select, input, textarea, [contenteditable="true"]')) return true;
  // A focused button already acts on Enter/Space; do not also restart the flight.
  return origin.closest('button') !== null && (event.key === 'Enter' || event.key === ' ');
}

/**
 * Tracks flight keys on a window. Held keys are sampled once per animation frame;
 * one-shot throttle settings are queued until sampled; commands call back at once.
 */
export class KeyboardControls {
  readonly #target: Window;
  readonly #onCommand: (command: KeyCommand) => void;
  readonly #held = new Set<string>();
  #throttleSet: 0 | 1 | undefined;

  constructor(target: Window, onCommand: (command: KeyCommand) => void) {
    this.#target = target;
    this.#onCommand = onCommand;
    target.addEventListener('keydown', this.#keyDown);
    target.addEventListener('keyup', this.#keyUp);
  }

  /** Current held input plus any queued throttle setting, which this call consumes. */
  sample(): PilotInput {
    const input = pilotInput(this.#held, this.#throttleSet);
    this.#throttleSet = undefined;
    return input;
  }

  /** Releases all held keys and queued settings, e.g. on blur, pause, or restart. */
  clear(): void {
    this.#held.clear();
    this.#throttleSet = undefined;
  }

  /** Removes listeners; the instance cannot be reused. */
  dispose(): void {
    this.clear();
    this.#target.removeEventListener('keydown', this.#keyDown);
    this.#target.removeEventListener('keyup', this.#keyUp);
  }

  readonly #keyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || ignored(event)) return;
    const code = event.code;
    if (HELD_KEYS.has(code)) {
      this.#held.add(code);
    } else if (code in THROTTLE_SET_KEYS) {
      if (!event.repeat) this.#throttleSet = THROTTLE_SET_KEYS[code];
    } else if (code in COMMAND_KEYS) {
      if (!event.repeat) this.#onCommand(COMMAND_KEYS[code]!);
    } else {
      return;
    }
    event.preventDefault();
  };

  // Always release, wherever focus moved, so a key cannot stay stuck down.
  readonly #keyUp = (event: KeyboardEvent): void => {
    this.#held.delete(event.code);
  };
}
