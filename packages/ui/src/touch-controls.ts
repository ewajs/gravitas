import { LitElement, css, html, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { msg, updateWhenLocaleChanges } from '@lit/localize';
import { clamp } from '@gravitas/engine/math';
import { numberFormats } from './format';
import { icons } from './icons';
import type { Locale } from './localization';
import { uiTokens } from './tokens';
import type { LeverInput, StickInput, YawInput } from './types';

/** Half-width of the lever's hover detent, as a fraction of its travel. */
export const DETENT_HALF_WIDTH = 0.035;
/** Stick knob travel from the centre of its base, in CSS pixels: full deflection. */
export const STICK_RADIUS = 56;
// Lever change per arrow key press when the lever has keyboard focus.
const KEY_STEP = 0.05;

interface Drag {
  readonly pointer: number;
  readonly startY: number;
  readonly startValue: number;
  readonly travel: number;
}

/**
 * On-screen flight controls for touch screens, in the theme: a left-thumb
 * throttle lever, a right-thumb floating stick, and two yaw buttons. It draws
 * them and handles pointers (several at once), and reports plain values as
 * events. It decides nothing about the flight: the host maps the values to its
 * own controls and passes back the lever position it actually applied.
 *
 * - The lever does not centre. A drag moves it relative to where it was, from
 *   wherever the thumb lands on the left zone, so it never jumps to the finger.
 *   Near `hoverThrottle` it snaps to a detent, with a visual tick and, where
 *   the browser supports it, a short vibration. Untouched, it shows `throttle`.
 * - The stick appears where the thumb lands on the right zone and reports its
 *   deflection; it returns to centre (and reports zero) on release.
 * - Lifting a finger, a cancelled pointer, window blur, a hidden page, or
 *   `disabled` release everything, so no input stays stuck.
 *
 * Events, all bubbling and composed: `lever-input` (`LeverInput`), `stick-input`
 * (`StickInput`), and `yaw-input` (`YawInput`).
 */
export class TouchControls extends LitElement {
  /** The lever position the host applied, in [0, 1]; shown while the lever is not held. */
  @property({ type: Number }) throttle = 0;
  /** Lever position that hovers at the current mass; the detent. Above 1, no detent. */
  @property({ type: Number }) hoverThrottle = 2;
  /** Ignore and release all input (for example while paused); drawn dimmed. */
  @property({ type: Boolean, reflect: true }) disabled = false;
  /** Committed display locale, for the lever's percentage. */
  @property() locale: Locale = 'es-AR';

  @state() private lever: number | undefined;
  @state() private stick: { x: number; y: number; originX: number; originY: number } | undefined;
  @state() private yaw = new Set<-1 | 1>();
  @state() private tick = 0;

  #leverDrag: Drag | undefined;
  #inDetent = false;
  #stickPointer: number | undefined;
  #yawPointers = new Map<number, -1 | 1>();

  constructor() {
    super();
    updateWhenLocaleChanges(this);
  }

  /** Lit styling hook. @internal */
  static styles = [
    uiTokens,
    css`
      :host {
        --ease: cubic-bezier(0.2, 0.8, 0.2, 1);
        --touch-top: 30%;
        position: absolute;
        inset: 0;
        pointer-events: none;
        -webkit-user-select: none;
        user-select: none;
        -webkit-touch-callout: none;
        -webkit-tap-highlight-color: transparent;
        animation: appear 200ms var(--ease);
      }
      :host([hidden]) {
        display: none;
      }
      :host([disabled]) .zone,
      :host([disabled]) .yaw {
        opacity: 0.45;
        pointer-events: none;
      }
      .zone {
        position: absolute;
        bottom: 0;
        top: var(--touch-top);
        pointer-events: auto;
        touch-action: none;
      }
      .left {
        left: 0;
        width: min(32%, 240px);
      }
      .right {
        right: 0;
        width: min(46%, 400px);
      }

      /* Lever: a tall glass track with the hover detent and a wide grip. */
      .lever {
        position: absolute;
        left: max(20px, calc(env(safe-area-inset-left) + 8px));
        bottom: max(20px, calc(env(safe-area-inset-bottom) + 8px));
        top: 12px;
        width: 64px;
        display: grid;
        grid-template-rows: auto 1fr;
        justify-items: center;
        gap: 6px;
      }
      .lever:focus-visible {
        outline: 2px solid var(--gravitas-focus);
        outline-offset: 4px;
        border-radius: var(--gravitas-radius);
      }
      .lever-value {
        min-inline-size: 4ch;
        padding: 2px 8px;
        border-radius: 999px;
        background: var(--gravitas-panel);
        -webkit-backdrop-filter: var(--gravitas-panel-filter);
        backdrop-filter: var(--gravitas-panel-filter);
        border: 1px solid var(--gravitas-line);
        font: 600 13px var(--gravitas-font-body);
        font-variant-numeric: tabular-nums;
        text-align: center;
      }
      .track {
        position: relative;
        inline-size: 18px;
        border-radius: 9px;
        background: var(--gravitas-panel);
        -webkit-backdrop-filter: var(--gravitas-panel-filter);
        backdrop-filter: var(--gravitas-panel-filter);
        border: 1px solid var(--gravitas-line);
      }
      .fill {
        position: absolute;
        inset: auto 3px 3px;
        block-size: calc(var(--level) * (100% - 6px));
        border-radius: 6px;
        background: var(--gravitas-accent);
        transition: block-size 200ms var(--ease);
      }
      .detent {
        position: absolute;
        left: -14px;
        right: -14px;
        bottom: calc(3px + var(--hover) * (100% - 6px));
        block-size: 3px;
        margin-bottom: -1.5px;
        border-radius: 1.5px;
        /* A dark rim keeps the notch readable over bright ground and the fill. */
        box-shadow: 0 0 0 1px var(--gravitas-panel-solid);
        background: var(--gravitas-text);
        transition:
          bottom 200ms var(--ease),
          transform 130ms ease,
          background-color 130ms ease;
      }
      /* In the detent: accent. Entering it: a 160 ms tick (two names restart it). */
      .detent.on {
        background: var(--gravitas-accent);
      }
      .detent.tick-a {
        animation: tick-a 160ms ease-out;
      }
      .detent.tick-b {
        animation: tick-b 160ms ease-out;
      }
      .grip {
        position: absolute;
        left: 50%;
        bottom: calc(3px + var(--level) * (100% - 6px));
        inline-size: 52px;
        block-size: 22px;
        margin: 0 0 -11px -26px;
        border-radius: 11px;
        background: var(--gravitas-panel-strong);
        -webkit-backdrop-filter: var(--gravitas-panel-filter);
        backdrop-filter: var(--gravitas-panel-filter);
        border: 1px solid var(--gravitas-line);
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--gravitas-accent) 35%, transparent);
        transition: bottom 200ms var(--ease);
      }
      .held .fill,
      .held .grip {
        transition: none;
      }
      .held .grip {
        border-color: var(--gravitas-accent);
      }

      /* Stick: a hint at rest; base and knob where the thumb lands. */
      .stick-hint,
      .base {
        position: absolute;
        inline-size: calc(2 * var(--radius));
        block-size: calc(2 * var(--radius));
        margin: calc(-1 * var(--radius)) 0 0 calc(-1 * var(--radius));
        border-radius: 50%;
        border: 1px solid var(--gravitas-line);
      }
      .stick-hint {
        left: 50%;
        top: 55%;
        border-style: dashed;
        opacity: 0.7;
      }
      .base {
        left: var(--x);
        top: var(--y);
        background: color-mix(in srgb, var(--gravitas-panel) 70%, transparent);
        -webkit-backdrop-filter: var(--gravitas-panel-filter);
        backdrop-filter: var(--gravitas-panel-filter);
        animation: appear 130ms ease;
      }
      .dead {
        position: absolute;
        inset: 46%;
        border-radius: 50%;
        background: var(--gravitas-track);
      }
      .knob {
        position: absolute;
        left: calc(50% + var(--dx));
        top: calc(50% + var(--dy));
        inline-size: 52px;
        block-size: 52px;
        margin: -26px 0 0 -26px;
        border-radius: 50%;
        background: var(--gravitas-panel-strong);
        border: 1px solid var(--gravitas-accent);
      }

      /* Yaw: two small buttons above the stick zone. */
      .yaw {
        position: absolute;
        right: max(20px, calc(env(safe-area-inset-right) + 8px));
        top: calc(var(--touch-top) - 60px);
        display: flex;
        gap: 12px;
        pointer-events: auto;
        touch-action: none;
      }
      .yaw button {
        display: grid;
        place-items: center;
        inline-size: 48px;
        min-block-size: 48px;
        padding: 0;
        border-radius: 50%;
        background: var(--gravitas-panel);
        -webkit-backdrop-filter: var(--gravitas-panel-filter);
        backdrop-filter: var(--gravitas-panel-filter);
        transition:
          background-color 130ms ease,
          border-color 130ms ease,
          transform 130ms ease;
      }
      .yaw button.pressed {
        border-color: var(--gravitas-accent);
        color: var(--gravitas-accent);
        transform: scale(0.94);
      }
      .yaw svg {
        inline-size: 22px;
        block-size: 22px;
      }

      @keyframes tick-a {
        50% {
          transform: scaleY(3);
        }
      }
      @keyframes tick-b {
        50% {
          transform: scaleY(3);
        }
      }
      @keyframes appear {
        from {
          opacity: 0;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        *,
        *::before,
        *::after,
        :host {
          animation: none !important;
          transition: none !important;
        }
        .yaw button.pressed {
          transform: none;
        }
      }
    `,
  ];

  /** @internal */
  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('blur', this.#releaseAll);
    document.addEventListener('visibilitychange', this.#visibilityChanged);
  }

  /** @internal */
  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('blur', this.#releaseAll);
    document.removeEventListener('visibilitychange', this.#visibilityChanged);
    this.#releaseAll();
  }

  /** @internal */
  protected willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('disabled') && this.disabled) this.#releaseAll();
    // Once released, the host's applied value replaces the last value sent.
    if (changed.has('throttle') && !this.#leverDrag) this.lever = undefined;
  }

  /** Releases every held control and reports neutral values. */
  release(): void {
    this.#releaseAll();
  }

  #emit<T>(type: string, detail: T): void {
    this.dispatchEvent(new CustomEvent<T>(type, { detail, bubbles: true, composed: true }));
  }

  // ---- Lever ----

  #setLever(value: number): void {
    const hover = this.hoverThrottle;
    let next = clamp(value, 0, 1);
    const inDetent = hover <= 1 && Math.abs(next - hover) <= DETENT_HALF_WIDTH;
    if (inDetent) next = hover;
    if (inDetent && !this.#inDetent) {
      // Felt and seen: a short pulse where supported (not iOS Safari), and a tick.
      this.tick++;
      if ('vibrate' in navigator) navigator.vibrate(8);
    }
    this.#inDetent = inDetent;
    if (next === this.lever) return;
    this.lever = next;
    this.#emit<LeverInput>('lever-input', { value: next });
  }

  #leverDown = (event: PointerEvent): void => {
    if (this.disabled || this.#leverDrag) return;
    const track = this.renderRoot.querySelector<HTMLElement>('.track');
    const travel = Math.max(1, track?.getBoundingClientRect().height ?? 1);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.#leverDrag = {
      pointer: event.pointerId,
      startY: event.clientY,
      startValue: this.lever ?? this.throttle,
      travel,
    };
    this.#inDetent = Math.abs(this.#leverDrag.startValue - this.hoverThrottle) <= DETENT_HALF_WIDTH;
    this.lever = this.#leverDrag.startValue;
    event.preventDefault();
  };

  #leverMove = (event: PointerEvent): void => {
    const drag = this.#leverDrag;
    if (!drag || event.pointerId !== drag.pointer) return;
    this.#setLever(drag.startValue + (drag.startY - event.clientY) / drag.travel);
  };

  #leverUp = (event: PointerEvent): void => {
    if (this.#leverDrag?.pointer !== event.pointerId) return;
    this.#endLever();
  };

  #endLever(): void {
    this.#leverDrag = undefined;
    // Keep showing the last value sent until the host reports the applied one,
    // so the grip does not flick back for a frame.
    this.#inDetent = false;
    this.requestUpdate();
  }

  #leverKey = (event: KeyboardEvent): void => {
    if (this.disabled) return;
    const steps: Record<string, number> = {
      ArrowUp: KEY_STEP,
      ArrowRight: KEY_STEP,
      ArrowDown: -KEY_STEP,
      ArrowLeft: -KEY_STEP,
      PageUp: 2 * KEY_STEP,
      PageDown: -2 * KEY_STEP,
    };
    let value: number | undefined;
    if (event.key in steps) value = (this.lever ?? this.throttle) + steps[event.key]!;
    else if (event.key === 'Home') value = 0;
    else if (event.key === 'End') value = 1;
    if (value === undefined) return;
    event.preventDefault();
    this.lever = clamp(value, 0, 1);
    this.#emit<LeverInput>('lever-input', { value: this.lever });
  };

  // ---- Stick ----

  #stickDown = (event: PointerEvent): void => {
    if (this.disabled || this.#stickPointer !== undefined) return;
    const zone = event.currentTarget as HTMLElement;
    zone.setPointerCapture(event.pointerId);
    this.#stickPointer = event.pointerId;
    const box = zone.getBoundingClientRect();
    // Keep the whole base inside the zone, so its edge is always reachable.
    const originX = clamp(event.clientX - box.left, STICK_RADIUS, box.width - STICK_RADIUS);
    const originY = clamp(event.clientY - box.top, STICK_RADIUS, box.height - STICK_RADIUS);
    this.stick = { x: 0, y: 0, originX, originY };
    this.#stickMove(event);
    event.preventDefault();
  };

  #stickMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.#stickPointer || !this.stick) return;
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const dx = event.clientX - box.left - this.stick.originX;
    const dy = event.clientY - box.top - this.stick.originY;
    const length = Math.hypot(dx, dy);
    const scale = length > STICK_RADIUS ? STICK_RADIUS / length : 1;
    // Screen down is +y; report up as +y.
    const x = (dx * scale) / STICK_RADIUS;
    const y = (-dy * scale) / STICK_RADIUS;
    if (x === this.stick.x && y === this.stick.y) return;
    this.stick = { ...this.stick, x, y };
    this.#emit<StickInput>('stick-input', { x, y });
  };

  #stickUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.#stickPointer) return;
    this.#endStick();
  };

  #endStick(): void {
    const moved = this.stick && (this.stick.x !== 0 || this.stick.y !== 0);
    this.#stickPointer = undefined;
    this.stick = undefined;
    if (moved) this.#emit<StickInput>('stick-input', { x: 0, y: 0 });
  }

  // ---- Yaw ----

  #yawDown(direction: -1 | 1, event: PointerEvent): void {
    if (this.disabled) return;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.#yawPointers.set(event.pointerId, direction);
    this.#syncYaw();
    event.preventDefault();
  }

  #yawUp = (event: PointerEvent): void => {
    if (!this.#yawPointers.delete(event.pointerId)) return;
    this.#syncYaw();
  };

  #syncYaw(): void {
    const held = new Set(this.#yawPointers.values());
    const before = this.#yawDirection(this.yaw);
    this.yaw = held;
    const after = this.#yawDirection(held);
    if (after !== before) this.#emit<YawInput>('yaw-input', { direction: after });
  }

  #yawDirection(held: ReadonlySet<-1 | 1>): -1 | 0 | 1 {
    return ((held.has(1) ? 1 : 0) - (held.has(-1) ? 1 : 0)) as -1 | 0 | 1;
  }

  // ---- Release ----

  readonly #releaseAll = (): void => {
    if (this.#leverDrag) this.#endLever();
    if (this.#stickPointer !== undefined || this.stick) this.#endStick();
    if (this.#yawPointers.size > 0) {
      this.#yawPointers.clear();
      this.#syncYaw();
    }
  };

  readonly #visibilityChanged = (): void => {
    if (document.hidden) this.#releaseAll();
  };

  /** Lit template implementation. @internal */
  render() {
    const shown = this.lever ?? this.throttle;
    const level = clamp(shown, 0, 1);
    const hover = this.hoverThrottle;
    const { percent } = numberFormats(this.locale);
    const label = msg('Empuje', { id: 'throttle' });
    const yawLeft = msg('Girar a la izquierda', { id: 'touch-yaw-left' });
    const yawRight = msg('Girar a la derecha', { id: 'touch-yaw-right' });
    return html`
      <div
        class="zone left"
        data-testid="touch-lever-zone"
        @pointerdown=${this.#leverDown}
        @pointermove=${this.#leverMove}
        @pointerup=${this.#leverUp}
        @pointercancel=${this.#leverUp}
        @lostpointercapture=${this.#leverUp}
      >
        <div
          class="lever ${this.#leverDrag ? 'held' : ''}"
          role="slider"
          tabindex="0"
          aria-label=${label}
          aria-orientation="vertical"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow=${Math.round(level * 100)}
          aria-valuetext=${percent.format(level)}
          aria-disabled=${this.disabled ? 'true' : 'false'}
          data-testid="touch-lever"
          style=${styleMap({ '--level': String(level), '--hover': String(clamp(hover, 0, 1)) })}
          @keydown=${this.#leverKey}
        >
          <span class="lever-value" aria-hidden="true">${percent.format(level)}</span>
          <span class="track" aria-hidden="true">
            <span class="fill"></span>
            ${
              hover <= 1
                ? html`<span
                    class="detent ${this.#leverDrag && this.#inDetent ? 'on' : ''} ${this.tick === 0 ? '' : this.tick % 2 ? 'tick-a' : 'tick-b'}"
                    data-testid="touch-detent"
                    title=${msg('Empuje para flotar', { id: 'hover-mark' })}
                  ></span>`
                : nothing
            }
            <span class="grip"></span>
          </span>
        </div>
      </div>
      <div
        class="zone right"
        role="group"
        aria-label=${msg('Palanca de inclinación: arrastrá con el pulgar', { id: 'touch-stick' })}
        data-testid="touch-stick-zone"
        style=${styleMap({ '--radius': `${STICK_RADIUS}px` })}
        @pointerdown=${this.#stickDown}
        @pointermove=${this.#stickMove}
        @pointerup=${this.#stickUp}
        @pointercancel=${this.#stickUp}
        @lostpointercapture=${this.#stickUp}
      >
        ${
          this.stick
            ? html`<div
                class="base"
                data-testid="touch-stick"
                data-x=${this.stick.x.toFixed(2)}
                data-y=${this.stick.y.toFixed(2)}
                style=${styleMap({
                  '--x': `${this.stick.originX}px`,
                  '--y': `${this.stick.originY}px`,
                  '--dx': `${this.stick.x * STICK_RADIUS}px`,
                  '--dy': `${-this.stick.y * STICK_RADIUS}px`,
                })}
              >
                <span class="dead"></span><span class="knob"></span>
              </div>`
            : html`<div class="stick-hint" aria-hidden="true"></div>`
        }
      </div>
      <div class="yaw">${this.#yawButton(-1, yawLeft)} ${this.#yawButton(1, yawRight)}</div>
    `;
  }

  #yawButton(direction: -1 | 1, label: string) {
    return html`<button
      class=${this.yaw.has(direction) ? 'pressed' : ''}
      aria-label=${label}
      title=${label}
      data-testid=${direction === -1 ? 'touch-yaw-left' : 'touch-yaw-right'}
      @pointerdown=${(event: PointerEvent) => this.#yawDown(direction, event)}
      @pointerup=${this.#yawUp}
      @pointercancel=${this.#yawUp}
      @lostpointercapture=${this.#yawUp}
      @contextmenu=${(event: Event) => event.preventDefault()}
    >
      ${direction === -1 ? icons.yawLeft() : icons.yawRight()}
    </button>`;
  }
}
