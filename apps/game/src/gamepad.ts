import type { InputCommand, InputSource } from './input';
import { stickResponse } from './input';
import type { PilotInput } from './session';

/** The parts of a browser `Gamepad` the game reads; tests supply plain objects. */
export type GamepadReading = Pick<Gamepad, 'index' | 'mapping' | 'connected' | 'axes' | 'buttons'>;

/** Where the game finds gamepads: `navigator` in the browser. */
export interface GamepadProvider {
  getGamepads(): readonly (GamepadReading | null)[];
}

// W3C "standard" mapping: button and axis indices with a fixed physical layout.
const A = 0;
const LB = 4;
const RB = 5;
const LT = 6;
const RT = 7;
const BACK = 8;
const START = 9;
const DPAD_LEFT = 14;
const DPAD_RIGHT = 15;
const RIGHT_X = 2;
const RIGHT_Y = 3;

/** Stick travel ignored around centre, as a fraction of full deflection (worn sticks rest off-centre). */
export const GAMEPAD_STICK_DEAD_ZONE = 0.15;
/** Trigger travel ignored at rest, as a fraction of full pressure. */
export const TRIGGER_DEAD_ZONE = 0.05;

const IDLE: PilotInput = { rates: { x: 0, y: 0, z: 0 }, throttleChange: 0 };

// Trigger pressure in [0, 1] beyond its dead zone, rescaled to [0, 1].
function trigger(value: number | undefined): number {
  if (value === undefined || !(value > TRIGGER_DEAD_ZONE)) return 0;
  return Math.min(1, (value - TRIGGER_DEAD_ZONE) / (1 - TRIGGER_DEAD_ZONE));
}

/**
 * Maps one standard-mapping gamepad to pilot input. The right stick asks for
 * pitch and roll rates in proportion to its deflection (pushed up tilts forward,
 * like W); LB and RB yaw left and right (Q and E); RT raises and LT lowers the
 * lever at a speed in proportion to their pressure.
 */
export function gamepadInput(pad: GamepadReading): PilotInput {
  const stick = stickResponse(
    pad.axes[RIGHT_X] ?? 0,
    pad.axes[RIGHT_Y] ?? 0,
    GAMEPAD_STICK_DEAD_ZONE,
  );
  const pressed = (index: number) => pad.buttons[index]?.pressed === true;
  return {
    // Gamepad Y axes point down: pushing up is negative, which is pitch forward (−X).
    rates: {
      x: stick.y,
      y: (pressed(LB) ? 1 : 0) - (pressed(RB) ? 1 : 0),
      z: 0 - stick.x, // Not -stick.x: no negative zero at rest.
    },
    throttleChange: trigger(pad.buttons[RT]?.value) - trigger(pad.buttons[LT]?.value),
  };
}

// Whether two pilot inputs ask for the same thing.
function same(a: PilotInput, b: PilotInput): boolean {
  return (
    a.rates.x === b.rates.x &&
    a.rates.y === b.rates.y &&
    a.rates.z === b.rates.z &&
    a.throttleChange === b.throttleChange
  );
}

function idle(input: PilotInput): boolean {
  return same(input, IDLE);
}

/**
 * The gamepad input source. Browsers deliver gamepad state only by polling, so
 * the app calls `poll()` once per animation frame before sampling: it reads the
 * first connected pad with the standard mapping (others are ignored) and turns
 * fresh presses of A and Start into commands. `sample()` then returns its input.
 */
export class GamepadControls implements InputSource {
  readonly device = 'gamepad';
  readonly #provider: GamepadProvider;
  readonly #target: Window;
  readonly #onCommand: (command: InputCommand) => void;
  readonly #onConnection: (connected: boolean) => void;
  #input: PilotInput = IDLE;
  #active = false;
  // Buttons held at the previous poll, so a press fires once.
  #held = new Set<number>();
  // Every button pressed at the previous poll, to tell fresh presses from held ones.
  #down = new Set<number>();
  #index: number | undefined;

  /**
   * `onConnection` reports the pad being read appearing or disappearing; the app
   * pauses a flight whose pad is lost.
   */
  constructor(
    provider: GamepadProvider,
    target: Window,
    onCommand: (command: InputCommand) => void,
    onConnection: (connected: boolean) => void,
  ) {
    this.#provider = provider;
    this.#target = target;
    this.#onCommand = onCommand;
    this.#onConnection = onConnection;
    target.addEventListener('gamepaddisconnected', this.#disconnected);
  }

  /**
   * Whether the latest poll saw deliberate use: a fresh button press, or flight
   * input that changed. A drifting unused stick or a button left held does not
   * count, so an idle pad never takes the device away from the keyboard or touch.
   */
  get active(): boolean {
    return this.#active;
  }

  /** Reads the pad and fires commands for fresh A and Start presses. */
  poll(): void {
    const pad = this.#pad();
    if (pad?.index !== this.#index) {
      // A different pad (or none): forget held buttons so nothing fires on a stale edge.
      const lost = this.#index !== undefined;
      this.#index = pad?.index;
      this.#held.clear();
      this.#down.clear();
      if (pad) this.#onConnection(true);
      else if (lost) this.#onConnection(false);
    }
    if (!pad) {
      this.#input = IDLE;
      this.#active = false;
      return;
    }
    const input = gamepadInput(pad);
    const down = new Set<number>();
    pad.buttons.forEach((button, index) => {
      if (button.pressed) down.add(index);
    });
    const pressed = [...down].some((index) => !this.#down.has(index));
    this.#down = down;
    this.#active = pressed || (!idle(input) && !same(input, this.#input));
    this.#input = input;
    const fresh = (index: number) => {
      const pressed = pad.buttons[index]?.pressed === true;
      const wasHeld = this.#held.has(index);
      if (pressed) this.#held.add(index);
      else this.#held.delete(index);
      return pressed && !wasHeld;
    };
    // Read both before acting: a command may clear this source.
    const start = fresh(START);
    const confirm = fresh(A);
    const back = fresh(BACK);
    const slower = fresh(DPAD_LEFT);
    const faster = fresh(DPAD_RIGHT);
    if (start) this.#onCommand('toggle-pause');
    if (confirm) this.#onCommand('confirm');
    if (back) this.#onCommand('toggle-map');
    if (slower) this.#onCommand('warp-slower');
    if (faster) this.#onCommand('warp-faster');
  }

  sample(): PilotInput {
    return this.#input;
  }

  /**
   * Forgets the latest reading. Held stick and triggers come back at the next
   * poll, as a held key does not: a pad's state is read, not evented.
   */
  clear(): void {
    this.#input = IDLE;
  }

  dispose(): void {
    this.clear();
    this.#target.removeEventListener('gamepaddisconnected', this.#disconnected);
  }

  #pad(): GamepadReading | undefined {
    let pads: readonly (GamepadReading | null)[] = [];
    try {
      pads = this.#provider.getGamepads();
    } catch {
      // A permissions policy can forbid the Gamepad API; then there is no pad.
    }
    return (
      pads.find(
        (pad) => pad?.connected && pad.mapping === 'standard' && pad.index === this.#index,
      ) ??
      pads.find((pad) => pad?.connected && pad.mapping === 'standard') ??
      undefined
    );
  }

  // Polling notices a lost pad at the next frame; the event also covers a hidden tab.
  readonly #disconnected = (event: Event): void => {
    const index = (event as GamepadEvent).gamepad?.index;
    if (index === undefined || index !== this.#index) return;
    this.#index = undefined;
    this.#held.clear();
    this.#down.clear();
    this.#input = IDLE;
    this.#active = false;
    this.#onConnection(false);
  };
}
