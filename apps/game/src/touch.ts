import type { LeverInput, StickInput, YawInput } from '@gravitas/ui';
import { stickResponse, type InputSource } from './input';
import type { PilotInput } from './session';

/** Stick deflection ignored around centre, as a fraction of full travel. */
export const TOUCH_STICK_DEAD_ZONE = 0.08;

/**
 * Maps the touch stick and yaw buttons to body-rate requests. Stick up tilts
 * forward (W), right rolls right (D); yaw +1 turns right (E), −1 left (Q).
 */
export function touchRates(stick: StickInput, yaw: YawInput['direction']): PilotInput['rates'] {
  const response = stickResponse(stick.x, stick.y, TOUCH_STICK_DEAD_ZONE);
  // 0 − v rather than −v: no negative zero at rest.
  return { x: 0 - response.y, y: 0 - yaw, z: 0 - response.x };
}

/**
 * The touch input source: listens to the UI's touch-controls element and keeps
 * the latest stick and yaw, plus a lever position the player has just set, which
 * the next sample consumes as a one-shot setting. The element owns pointers and
 * releases them on lift, cancel, blur, and hidden pages, reporting neutral values.
 */
export class TouchControlsSource implements InputSource {
  readonly device = 'touch';
  readonly #element: HTMLElement;
  #stick: StickInput = { x: 0, y: 0 };
  #yaw: YawInput['direction'] = 0;
  #lever: number | undefined;
  #touched = false;
  #active = false;

  constructor(element: HTMLElement) {
    this.#element = element;
    element.addEventListener('lever-input', this.#leverInput);
    element.addEventListener('stick-input', this.#stickInput);
    element.addEventListener('yaw-input', this.#yawInput);
  }

  /** Whether the latest sample had the stick or a yaw button held, or followed any touch input. */
  get active(): boolean {
    return this.#active;
  }

  sample(): PilotInput {
    const rates = touchRates(this.#stick, this.#yaw);
    const lever = this.#lever;
    this.#active = this.#touched || this.#stick.x !== 0 || this.#stick.y !== 0 || this.#yaw !== 0;
    this.#lever = undefined;
    this.#touched = false;
    return lever === undefined
      ? { rates, throttleChange: 0 }
      : { rates, throttleChange: 0, throttleSet: lever };
  }

  clear(): void {
    this.#stick = { x: 0, y: 0 };
    this.#yaw = 0;
    this.#lever = undefined;
    this.#touched = false;
  }

  dispose(): void {
    this.clear();
    this.#element.removeEventListener('lever-input', this.#leverInput);
    this.#element.removeEventListener('stick-input', this.#stickInput);
    this.#element.removeEventListener('yaw-input', this.#yawInput);
  }

  // Event details are external data: accept only finite numbers in range.
  readonly #leverInput = (event: Event): void => {
    const value = (event as CustomEvent<LeverInput>).detail?.value;
    if (typeof value !== 'number' || !Number.isFinite(value)) return;
    this.#lever = Math.min(1, Math.max(0, value));
    this.#touched = true;
  };

  readonly #stickInput = (event: Event): void => {
    const { x, y } = (event as CustomEvent<StickInput>).detail ?? {};
    if (typeof x !== 'number' || typeof y !== 'number') return;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    this.#stick = { x, y };
    this.#touched = true;
  };

  readonly #yawInput = (event: Event): void => {
    const direction = (event as CustomEvent<YawInput>).detail?.direction;
    if (direction !== -1 && direction !== 0 && direction !== 1) return;
    this.#yaw = direction;
    this.#touched = true;
  };
}
