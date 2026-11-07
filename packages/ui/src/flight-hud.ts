import { LitElement, css, html, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { msg, updateWhenLocaleChanges } from '@lit/localize';
import { type Locale, viewportMessages } from './localization';
import { uiTokens } from './tokens';

/** A requested locale; the host loads it and commits the successful selection. */
export interface LocaleRequest {
  /** Requested supported locale; the host commits it after loading succeeds. */
  readonly locale: Locale;
}

/** Session phase decided by the host; the HUD only presents it. */
export type FlightPhase = 'ready' | 'flying' | 'paused' | 'contact';

/** A player action the host may apply to its flight session. */
export interface FlightRequest {
  /** Start from ready, pause or resume flight, or restart from the scenario's start. */
  readonly action: 'start' | 'pause' | 'resume' | 'restart';
}

/**
 * Presentation snapshot calculated by the host at a deliberate, low rate.
 * SI values; the HUD converts only for display.
 */
export interface FlightTelemetry {
  /** Lowest contact point above the surface plane, in metres. */
  readonly altitude: number;
  /** World vertical velocity in metres per second; negative is descending. */
  readonly verticalSpeed: number;
  /** Horizontal speed magnitude in metres per second. */
  readonly horizontalSpeed: number;
  /** Horizontal distance from the pad reference, in metres. */
  readonly padDistance: number;
  /** Angle between body +Y and world +Y, in radians. */
  readonly tilt: number;
  /** Remaining fuel as a fraction of capacity, in [0, 1]. */
  readonly fuel: number;
  /** Main-engine throttle lever in [0, 1]. */
  readonly throttle: number;
}

/** Optional flight HUD. Receives presentation snapshots; owns no renderer or simulation. */
export class FlightHud extends LitElement {
  /** Branding supplied by the application. */
  @property() heading = '';
  /** Latest immutable telemetry snapshot, never authoritative flight state. */
  @property({ attribute: false }) telemetry?: FlightTelemetry;
  /** Current session phase owned by the application. */
  @property() phase: FlightPhase = 'ready';
  /** Committed display locale, set after setLocale() resolves. */
  @property() locale: Locale = 'es-AR';
  /** Rendering status owned by the application. */
  @property() status: 'loading' | 'ready' | 'failed' = 'loading';
  /** Disables new locale requests while the host loads translations. */
  @property({ type: Boolean }) localePending = false;
  /** Whether the last locale request failed; the current locale stays usable. */
  @property({ type: Boolean }) localeError = false;

  constructor() {
    super();
    // Lit's controller subscribes only while this element is connected.
    updateWhenLocaleChanges(this);
  }

  /** Lit styling hook; hosts customize the documented CSS tokens. @internal */
  static styles = [
    uiTokens,
    css`
      :host {
        display: block;
        position: absolute;
        inset: 0;
        pointer-events: none;
      }
      header {
        position: absolute;
        top: max(24px, env(safe-area-inset-top));
        left: max(24px, env(safe-area-inset-left));
        right: max(24px, env(safe-area-inset-right));
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 16px;
      }
      .identity {
        background: var(--gravitas-panel);
        border-radius: var(--gravitas-radius);
        padding: 14px 20px;
      }
      h1 {
        font-size: 25px;
        font-weight: 500;
        letter-spacing: 0.08em;
        line-height: 1.2;
      }
      #subtitle {
        margin-top: 6px;
        color: var(--gravitas-muted);
        font-size: 12px;
      }
      nav,
      .actions {
        display: flex;
        gap: 8px;
        pointer-events: auto;
      }
      .bottom {
        position: absolute;
        bottom: max(24px, env(safe-area-inset-bottom));
        left: max(24px, env(safe-area-inset-left));
        right: max(24px, env(safe-area-inset-right));
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 16px;
      }
      .instruments {
        background: var(--gravitas-panel);
        border: 1px solid var(--gravitas-line);
        border-radius: var(--gravitas-radius);
        padding: 14px 20px;
      }
      .readouts {
        display: grid;
        grid-template-columns: repeat(4, auto);
        gap: 10px 28px;
        margin: 0;
      }
      dt {
        font-size: 12px;
        color: var(--gravitas-muted);
      }
      dd {
        margin: 2px 0 0;
        font-size: 24px;
        font-variant-numeric: tabular-nums;
        line-height: 1.2;
        white-space: nowrap;
      }
      .unit {
        font-size: 14px;
        color: var(--gravitas-muted);
      }
      .side {
        display: grid;
        justify-items: end;
        gap: 8px;
      }
      #controls {
        max-width: 380px;
        padding: 10px 14px;
        border-radius: 6px;
        background: var(--gravitas-panel);
        font-size: 12px;
        color: var(--gravitas-muted);
      }
      .status,
      #phase {
        position: absolute;
        top: 40%;
        left: 24px;
        right: 24px;
        width: fit-content;
        max-width: min(520px, calc(100% - 48px));
        margin: 0 auto;
        padding: 16px 20px;
        border-radius: var(--gravitas-radius);
        background: var(--gravitas-panel);
        text-align: center;
      }
      /* Below the header, clear of the vehicle the camera keeps centred. */
      #phase {
        top: calc(max(24px, env(safe-area-inset-top)) + 96px);
      }
      #phase:empty {
        display: none;
      }
      .locale-error {
        position: absolute;
        top: 116px;
        right: 24px;
        left: 24px;
        background: var(--gravitas-panel);
        padding: 12px;
        border-radius: 6px;
      }
      kbd {
        font: inherit;
        font-weight: 600;
        color: var(--gravitas-text);
      }
      dialog {
        pointer-events: auto;
        color: inherit;
        background: #111923;
        border: 1px solid var(--gravitas-line);
        border-radius: var(--gravitas-radius);
        width: min(480px, calc(100% - 32px));
        max-height: calc(100svh - 32px);
        padding: 24px;
      }
      dialog::backdrop {
        background: #020609b3;
      }
      .dialog-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
      }
      h2 {
        font-size: 20px;
        font-weight: 500;
      }
      .help-list {
        display: grid;
        gap: 10px;
        margin: 20px 0;
      }
      .help-list div {
        display: grid;
        grid-template-columns: 3fr 2fr;
        gap: 16px;
      }
      .help-list dd,
      .help-list dt {
        font: inherit;
        margin: 0;
        white-space: normal;
      }
      .help-list dt {
        color: var(--gravitas-muted);
      }
      .about {
        border-top: 1px solid var(--gravitas-line);
        padding-top: 16px;
        font-size: 13px;
        color: var(--gravitas-muted);
      }
      @media (max-width: 700px) {
        header {
          top: max(16px, env(safe-area-inset-top));
          left: max(16px, env(safe-area-inset-left));
          right: max(16px, env(safe-area-inset-right));
          gap: 8px;
        }
        .identity {
          padding: 10px 12px;
        }
        h1 {
          font-size: 20px;
        }
        nav,
        .actions {
          gap: 6px;
        }
        button,
        select {
          padding-inline: 8px;
        }
        .bottom {
          bottom: max(16px, env(safe-area-inset-bottom));
          left: max(16px, env(safe-area-inset-left));
          right: max(16px, env(safe-area-inset-right));
          flex-direction: column;
          align-items: stretch;
          gap: 8px;
        }
        .instruments {
          padding: 10px 14px;
        }
        .readouts {
          grid-template-columns: repeat(3, 1fr);
          gap: 6px 12px;
        }
        dd {
          font-size: 18px;
        }
        .unit {
          font-size: 12px;
        }
        .side {
          justify-items: stretch;
        }
        .actions {
          justify-content: flex-end;
        }
        #phase {
          top: calc(max(16px, env(safe-area-inset-top)) + 72px);
          font-size: 13px;
          padding: 10px 14px;
        }
        /* Keyboard hints duplicate Help; keep the narrow view on the flight. */
        #controls {
          display: none;
        }
      }
      @media (max-height: 500px) {
        header {
          top: 12px;
        }
        .bottom {
          bottom: 12px;
          flex-direction: row;
          align-items: flex-end;
        }
        #controls {
          display: none;
        }
        .instruments {
          padding: 8px 12px;
        }
      }
    `,
  ];

  private requestLocale(event: Event) {
    const select = event.currentTarget as HTMLSelectElement;
    const locale = select.value;
    // The selected value remains the committed locale until the host finishes loading.
    select.value = this.locale;
    if (this.localePending) return;
    if (locale !== 'es-AR' && locale !== 'en') return;
    this.dispatchEvent(
      new CustomEvent<LocaleRequest>('locale-request', {
        detail: { locale },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private request(action: FlightRequest['action']) {
    this.dispatchEvent(
      new CustomEvent<FlightRequest>('flight-request', {
        detail: { action },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private openHelp() {
    // Reading help should never cost the player their flight.
    if (this.phase === 'flying') this.request('pause');
    this.renderRoot.querySelector('dialog')?.showModal();
  }
  private closeHelp() {
    this.renderRoot.querySelector('dialog')?.close();
  }

  private phaseMessage() {
    switch (this.phase) {
      case 'ready':
        return msg('Listo para descender. Pulsá P o Comenzar.', { id: 'phase-ready' });
      case 'paused':
        return msg('En pausa. Pulsá P o Reanudar.', { id: 'phase-paused' });
      case 'contact':
        return msg(
          'Contacto con la superficie. Revisá las velocidades finales y pulsá Enter para reintentar.',
          { id: 'phase-contact' },
        );
      case 'flying':
        return '';
    }
  }

  private primaryAction() {
    switch (this.phase) {
      case 'ready':
        return html`<button @click=${() => this.request('start')}>
          ${msg('Comenzar', { id: 'start' })}
        </button>`;
      case 'flying':
        return html`<button @click=${() => this.request('pause')}>
          ${msg('Pausar', { id: 'pause' })}
        </button>`;
      case 'paused':
        return html`<button @click=${() => this.request('resume')}>
          ${msg('Reanudar', { id: 'resume' })}
        </button>`;
      case 'contact':
        return nothing;
    }
  }

  private readouts(t: FlightTelemetry) {
    const decimal = new Intl.NumberFormat(this.locale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    const signed = new Intl.NumberFormat(this.locale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
      signDisplay: 'exceptZero',
    });
    const whole = new Intl.NumberFormat(this.locale, { maximumFractionDigits: 0 });
    const percent = new Intl.NumberFormat(this.locale, {
      style: 'percent',
      maximumFractionDigits: 0,
    });
    // Intl supplies each locale's grouping, decimal mark, and percent pattern.
    const item = (id: string, label: string, value: string, unit?: string) =>
      html`<div>
        <dt>${label}</dt>
        <dd data-testid=${id}>
          ${value}${unit ? html`<span class="unit"> ${unit}</span>` : nothing}
        </dd>
      </div>`;
    return html`<dl class="readouts">
      ${item('altitude', msg('Altitud', { id: 'altitude' }), decimal.format(t.altitude), 'm')}
      ${item(
        'vertical-speed',
        msg('Vel. vertical', { id: 'vertical-speed' }),
        signed.format(t.verticalSpeed),
        'm/s',
      )}
      ${item(
        'horizontal-speed',
        msg('Vel. horizontal', { id: 'horizontal-speed' }),
        decimal.format(t.horizontalSpeed),
        'm/s',
      )}
      ${item(
        'pad-distance',
        msg('A la plataforma', { id: 'pad-distance' }),
        decimal.format(t.padDistance),
        'm',
      )}
      ${item('tilt', msg('Inclinación', { id: 'tilt' }), `${whole.format((t.tilt * 180) / Math.PI)}°`)}
      ${item('fuel', msg('Combustible', { id: 'fuel' }), percent.format(t.fuel))}
      ${item('throttle', msg('Empuje', { id: 'throttle' }), percent.format(t.throttle))}
    </dl>`;
  }

  /** Lit template implementation, separate from the host-facing property/event contract. @internal */
  render() {
    const text = viewportMessages();
    const key = (label: string, keys: string) =>
      html`<div>
        <dt>${label}</dt>
        <dd><kbd>${keys}</kbd></dd>
      </div>`;
    return html`
      <header>
        <div class="identity">
          <h1>${this.heading}</h1>
          <p id="subtitle">${text.subtitle}</p>
        </div>
        <nav aria-label=${msg('Opciones de vista', { id: 'view-options' })}>
          <select
            aria-label=${msg('Idioma', { id: 'language' })}
            .value=${this.locale}
            aria-disabled=${this.localePending}
            aria-busy=${this.localePending}
            @change=${this.requestLocale}
          >
            <option value="es-AR">ES</option>
            <option value="en">EN</option>
          </select>
          <button @click=${this.openHelp} aria-haspopup="dialog">
            ${msg('Ayuda', { id: 'help' })}
          </button>
        </nav>
      </header>
      ${this.localeError ? html`<p class="locale-error" role="alert">${msg('No pudimos cambiar el idioma. Actualizá la página para volver a intentarlo.', { id: 'locale-failed' })}</p>` : nothing}
      ${this.status !== 'ready' ? html`<p id="status" class="status" role=${this.status === 'failed' ? 'alert' : 'status'}>${this.status === 'failed' ? text.failed : text.loading}</p>` : nothing}
      ${
        this.status === 'ready'
          ? html`<p id="phase" role="status">${this.phaseMessage()}</p>
              <div class="bottom">
                ${
                  this.telemetry
                    ? html`<section
                        class="instruments"
                        aria-label=${msg('Instrumentos de vuelo', { id: 'instruments' })}
                      >
                        ${this.readouts(this.telemetry)}
                      </section>`
                    : nothing
                }
                <div class="side">
                  <div class="actions">
                    ${this.primaryAction()}
                    ${
                      this.phase === 'ready'
                        ? nothing
                        : html`<button @click=${() => this.request('restart')}>
                            ${msg('Reiniciar', { id: 'restart' })}
                          </button>`
                    }
                  </div>
                  <p id="controls">${text.controls}</p>
                </div>
              </div>`
          : nothing
      }
      <dialog aria-labelledby="help-title">
        <div class="dialog-heading">
          <h2 id="help-title">${msg('Controles de vuelo', { id: 'help-title' })}</h2>
          <button @click=${this.closeHelp} autofocus>${msg('Cerrar', { id: 'close' })}</button>
        </div>
        <dl class="help-list">
          ${key(msg('Cabeceo: adelante / atrás', { id: 'help-pitch' }), 'W / S')}
          ${key(msg('Alabeo: izquierda / derecha', { id: 'help-roll' }), 'A / D')}
          ${key(msg('Guiñada: izquierda / derecha', { id: 'help-yaw' }), 'Q / E')}
          ${key(msg('Subir / bajar empuje (mantené)', { id: 'help-throttle' }), 'R / F')}
          ${key(msg('Empuje máximo / cortar', { id: 'help-throttle-set' }), 'Z / X')}
          ${key(msg('Pausa', { id: 'help-pause' }), 'P')}
          ${key(msg('Reiniciar', { id: 'restart' }), 'Enter')}
          <div>
            <dt>${msg('Cámara', { id: 'help-camera' })}</dt>
            <dd>${msg('Arrastrá para girar · rueda para acercar', { id: 'help-camera-keys' })}</dd>
          </div>
        </dl>
        <p class="about">
          ${msg('Las teclas de rotación piden una velocidad de giro. Al soltarlas, el control de actitud frena el giro, pero no endereza el módulo. Girar consume combustible del mismo tanque que el motor. La altitud se mide desde la pata más baja.', { id: 'flight-help' })}
        </p>
      </dialog>
    `;
  }
}

/** Registers the optional component once; safe for repeated application mounts. */
export function registerUi(): void {
  if (!customElements.get('gravitas-flight-hud'))
    customElements.define('gravitas-flight-hud', FlightHud);
}

declare global {
  interface HTMLElementTagNameMap {
    'gravitas-flight-hud': FlightHud;
  }
}
