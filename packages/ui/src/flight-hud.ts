import { LitElement, css, html, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { msg, updateWhenLocaleChanges } from '@lit/localize';
import { type Locale, viewportMessages } from './localization';
import { RADAR_RADIUS, RADAR_SCALE, radarPoint } from './radar';
import { uiTokens } from './tokens';

/** A requested locale; the host loads it and commits the successful selection. */
export interface LocaleRequest {
  /** Requested supported locale; the host commits it after loading succeeds. */
  readonly locale: Locale;
}

/** A requested sound setting; the host applies and persists it, then sets `muted`. */
export interface SoundRequest {
  readonly muted: boolean;
}

/** Session phase decided by the host; the HUD only presents it. */
export type FlightPhase = 'ready' | 'flying' | 'paused' | 'complete';

/** One judged quantity: SI value (m/s, rad, or m), its limit, and whether it passed. */
export interface LandingCheck {
  readonly id: 'vertical-speed' | 'horizontal-speed' | 'tilt' | 'pad-distance';
  readonly value: number;
  readonly limit: number;
  readonly pass: boolean;
}

/** Final result explained to the player; decided by the host, presented by the HUD. */
export interface LandingReport {
  readonly verdict: 'landed' | 'landed-off-pad' | 'rough' | 'crashed';
  /** Why a crash happened. */
  readonly cause?: 'hull' | 'impact' | 'tipped';
  readonly checks: readonly LandingCheck[];
  /** Remaining fuel as a fraction of capacity. */
  readonly fuel: number;
  /** Seconds from start to the verdict. */
  readonly flightTime: number;
}

/** A player action the host may apply to its flight session. */
export interface FlightRequest {
  /** Start from ready, pause or resume flight, or restart from the scenario's start. */
  readonly action: 'start' | 'pause' | 'resume' | 'restart';
}

/**
 * Horizontal vector in the vehicle's heading frame: x to its right, y forward.
 * The radar draws +y up, matching a camera that follows the heading.
 */
export interface RadarVector {
  /** Rightward component. */
  readonly x: number;
  /** Forward component. */
  readonly y: number;
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
  /** Throttle that balances gravity when upright at the current mass (may exceed 1). */
  readonly hoverThrottle: number;
  /** Horizontal part of the thrust axis (unit length, so magnitude is sin of tilt). */
  readonly lean: RadarVector;
  /** Horizontal velocity in metres per second. */
  readonly drift: RadarVector;
  /** Pad reference relative to the vehicle, in metres. */
  readonly pad: RadarVector;
}

/** Optional flight HUD. Receives presentation snapshots; owns no renderer or simulation. */
export class FlightHud extends LitElement {
  /** Branding supplied by the application. */
  @property() heading = '';
  /** Latest immutable telemetry snapshot, never authoritative flight state. */
  @property({ attribute: false }) telemetry?: FlightTelemetry;
  /** Current session phase owned by the application. */
  @property() phase: FlightPhase = 'ready';
  /** Whether sound is muted; the Mute button shows it as pressed. */
  @property({ type: Boolean }) muted = false;
  /** Show the "How to fly" card while ready; hosts hide it once the player has read it. */
  @property({ type: Boolean }) showControls = true;
  /** Player manual for the current locale; Help links to it when set. */
  @property() manualHref = '';
  /** Result shown while `phase` is `complete`. */
  @property({ attribute: false }) report: LandingReport | undefined;
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
        display: grid;
        grid-template-columns: auto auto;
        align-items: center;
        gap: 20px;
        background: var(--gravitas-panel);
        border: 1px solid var(--gravitas-line);
        border-radius: var(--gravitas-radius);
        padding: 14px 20px;
      }
      .readouts {
        display: grid;
        grid-template-columns: repeat(3, auto);
        gap: 10px 28px;
        margin: 0;
      }
      .primary dd {
        font-size: 30px;
      }
      figure {
        margin: 0;
        display: grid;
        justify-items: center;
        gap: 6px;
      }
      .radar {
        inline-size: 136px;
        block-size: 136px;
        overflow: visible;
      }
      .radar .ring {
        fill: none;
        stroke: var(--gravitas-line);
      }
      .radar .face {
        fill: #0b1219;
        stroke: var(--gravitas-muted);
      }
      .radar .forward {
        fill: var(--gravitas-muted);
      }
      .radar .lean {
        fill: var(--gravitas-accent);
      }
      .radar .drift {
        stroke: var(--gravitas-focus);
        stroke-width: 2.5;
        stroke-linecap: round;
      }
      .radar .arrowhead {
        fill: var(--gravitas-focus);
      }
      .radar .pad {
        fill: var(--gravitas-text);
        stroke: var(--gravitas-text);
        stroke-width: 1.5;
      }
      .radar .pad.far {
        fill: none;
      }
      figcaption {
        display: flex;
        gap: 10px;
        font-size: 11px;
        color: var(--gravitas-muted);
      }
      .swatch {
        display: inline-block;
        inline-size: 8px;
        block-size: 8px;
        margin-inline-end: 4px;
        vertical-align: 1px;
      }
      .swatch.lean {
        border-radius: 50%;
        background: var(--gravitas-accent);
      }
      .swatch.drift {
        block-size: 2px;
        inline-size: 10px;
        vertical-align: 3px;
        background: var(--gravitas-focus);
      }
      .swatch.pad {
        transform: rotate(45deg) scale(0.8);
        background: var(--gravitas-text);
      }
      .gauges {
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: 8px 12px;
        margin-top: 12px;
      }
      .gauge-label {
        font-size: 12px;
        color: var(--gravitas-muted);
      }
      .bar {
        position: relative;
        block-size: 8px;
        min-inline-size: 120px;
        border-radius: 4px;
        background: #0b1219;
        border: 1px solid var(--gravitas-line);
      }
      .fill {
        position: absolute;
        inset-block: 0;
        inset-inline-start: 0;
        border-radius: 3px;
        background: var(--gravitas-accent);
      }
      .fill.throttle {
        background: var(--gravitas-focus);
      }
      .hover-mark {
        position: absolute;
        inset-block: -4px;
        inline-size: 2px;
        margin-inline-start: -1px;
        background: var(--gravitas-text);
      }
      .gauge-value {
        min-inline-size: 4ch;
        text-align: end;
        font-size: 16px;
        font-variant-numeric: tabular-nums;
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
      .overlay {
        position: absolute;
        top: calc(max(24px, env(safe-area-inset-top)) + 96px);
        left: 24px;
        right: 24px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
      }
      .card {
        pointer-events: auto;
        width: min(440px, 100%);
        padding: 16px 20px;
        border: 1px solid var(--gravitas-line);
        border-radius: var(--gravitas-radius);
        background: var(--gravitas-panel);
      }
      .card h2 {
        font-size: 18px;
        margin-bottom: 8px;
      }
      .quick-keys {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 4px 14px;
        margin: 0 0 10px;
      }
      .quick-keys dt,
      .quick-keys dd {
        margin: 0;
        font-size: 13px;
        color: var(--gravitas-text);
        white-space: normal;
      }
      .quick-keys kbd {
        letter-spacing: 0.15em;
      }
      .goal,
      .summary,
      .meta {
        font-size: 13px;
        color: var(--gravitas-muted);
      }
      .checks {
        list-style: none;
        padding: 0;
        margin: 12px 0;
        display: grid;
        gap: 6px;
      }
      .checks li {
        display: grid;
        grid-template-columns: 1.2em 1fr auto;
        gap: 8px;
        font-size: 13px;
        align-items: baseline;
      }
      .checks .value {
        font-variant-numeric: tabular-nums;
        text-align: end;
      }
      .checks .limit {
        grid-column: 2 / -1;
        font-size: 11px;
        color: var(--gravitas-muted);
        margin-top: -4px;
      }
      .pass .mark {
        color: var(--gravitas-good);
      }
      .fail .mark {
        color: var(--gravitas-bad);
      }
      .report.landed h2 {
        color: var(--gravitas-good);
      }
      .report.crashed h2,
      .report.rough h2 {
        color: var(--gravitas-bad);
      }
      .report button {
        margin-top: 12px;
      }
      .sr {
        position: absolute;
        inline-size: 1px;
        block-size: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
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
      /* In the overlay column below the header, clear of the vehicle. */
      .overlay #phase {
        position: static;
        margin: 0;
      }
      /* After a verdict the region only speaks; the results card shows the title. */
      .overlay #phase.sr {
        position: absolute;
        inline-size: 1px;
        block-size: 1px;
        padding: 0;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
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
      button[aria-pressed='true'] {
        border-color: var(--gravitas-accent);
        color: var(--gravitas-accent);
      }
      .manual a {
        color: var(--gravitas-focus);
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
          grid-template-columns: auto 1fr;
          gap: 8px 14px;
          padding: 10px 14px;
        }
        .readouts {
          grid-template-columns: repeat(2, auto);
          gap: 6px 16px;
        }
        dd,
        .primary dd {
          font-size: 18px;
        }
        .radar {
          inline-size: 96px;
          block-size: 96px;
        }
        figcaption {
          display: none;
        }
        /* Readouts sit beside the radar; gauges take the full width below both. */
        .data {
          display: contents;
        }
        .gauges {
          grid-column: 1 / -1;
          margin-top: 0;
        }
        .bar {
          min-inline-size: 0;
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
        .overlay {
          top: calc(max(16px, env(safe-area-inset-top)) + 72px);
          left: 16px;
          right: 16px;
          gap: 6px;
        }
        #phase {
          font-size: 13px;
          padding: 10px 14px;
        }
        .card {
          padding: 12px 14px;
        }
        .goal {
          display: none;
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

  private toggleSound() {
    this.dispatchEvent(
      new CustomEvent<SoundRequest>('sound-request', {
        detail: { muted: !this.muted },
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
      case 'complete':
        // The live region announces the verdict; the card shows it, so it is hidden here.
        return this.report ? this.reportTitle(this.report.verdict) : '';
      case 'flying':
        return '';
    }
  }

  private reportTitle(verdict: LandingReport['verdict']) {
    switch (verdict) {
      case 'landed':
        return msg('¡Aterrizaje en la plataforma!', { id: 'report-landed' });
      case 'landed-off-pad':
        return msg('Aterrizaje fuera de la plataforma', { id: 'report-off-pad' });
      case 'rough':
        return msg('Aterrizaje demasiado duro', { id: 'report-rough' });
      case 'crashed':
        return msg('Accidente', { id: 'report-crashed' });
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
      case 'complete':
        return nothing;
    }
  }

  // Shown before the first start: the essential keys and the goal.
  private quickCard() {
    const row = (keys: string, action: string) =>
      html`<dt><kbd>${keys}</kbd></dt>
        <dd>${action}</dd>`;
    return html`<aside class="card quick" aria-labelledby="quick-title">
      <h2 id="quick-title">${msg('Cómo volar', { id: 'quick-title' })}</h2>
      <dl class="quick-keys">
        ${row('W A S D', msg('Inclinar el módulo', { id: 'quick-tilt' }))}
        ${row('Q E', msg('Girar', { id: 'quick-turn' }))}
        ${row('R F', msg('Subir / bajar empuje', { id: 'quick-throttle' }))}
        ${row('Z X', msg('Empuje máximo / cortar', { id: 'help-throttle-set' }))}
      </dl>
      <p class="goal">
        ${msg('Posate en la plataforma a 2 m/s o menos, casi vertical. Para frenar la deriva, inclinate contra la flecha del radar.', { id: 'quick-goal' })}
      </p>
    </aside>`;
  }

  // The verdict and why: each judged quantity against its limit.
  private reportCard(report: LandingReport) {
    const whole = new Intl.NumberFormat(this.locale, { maximumFractionDigits: 0 });
    const percent = new Intl.NumberFormat(this.locale, {
      style: 'percent',
      maximumFractionDigits: 0,
    });
    const summaries = {
      landed: msg('Tocaste suave y quedaste quieto sobre las cuatro patas.', {
        id: 'summary-landed',
      }),
      'landed-off-pad': msg('Un aterrizaje seguro, pero lejos del objetivo.', {
        id: 'summary-off-pad',
      }),
      rough: msg('El módulo quedó en pie, pero el contacto superó un límite.', {
        id: 'summary-rough',
      }),
      hull: msg('La estructura del módulo golpeó el suelo.', { id: 'cause-hull' }),
      impact: msg('Una pata golpeó el suelo demasiado rápido para resistirlo.', {
        id: 'cause-impact',
      }),
      tipped: msg('El módulo volcó.', { id: 'cause-tipped' }),
    };
    const labels = {
      'vertical-speed': msg('Vel. vertical al tocar', { id: 'check-vertical' }),
      'horizontal-speed': msg('Vel. horizontal al tocar', { id: 'check-horizontal' }),
      tilt: msg('Inclinación al tocar', { id: 'check-tilt' }),
      'pad-distance': msg('Distancia al centro de la plataforma', { id: 'check-pad' }),
    };
    // Tilt in whole degrees, others to 0.1. A failing value never displays as if it
    // met its limit (2.04 m/s would round to "2.0"): it gains decimals until it reads above.
    const display = (check: LandingCheck) =>
      check.id === 'tilt'
        ? { scale: 180 / Math.PI, unit: '°', digits: 0 }
        : { scale: 1, unit: check.id === 'pad-distance' ? ' m' : ' m/s', digits: 1 };
    const shown = (check: LandingCheck, value: number, digits: number) => {
      const { scale, unit } = display(check);
      const format = new Intl.NumberFormat(this.locale, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });
      return `${format.format(value * scale)}${unit}`;
    };
    const valueDigits = (check: LandingCheck) => {
      const { scale, digits } = display(check);
      const rounded = (d: number) => Math.round(check.value * scale * 10 ** d) / 10 ** d;
      let d = digits;
      while (!check.pass && d < digits + 3 && rounded(d) <= check.limit * scale) d++;
      return d;
    };
    const summary =
      report.verdict === 'crashed' ? summaries[report.cause ?? 'hull'] : summaries[report.verdict];
    return html`<section
      id="report"
      class="card report ${report.verdict}"
      role="status"
      aria-labelledby="report-title"
    >
      <h2 id="report-title" data-testid="report-title">${this.reportTitle(report.verdict)}</h2>
      <p class="summary">${summary}</p>
      <ul class="checks">
        ${report.checks.map(
          (check) =>
            html`<li class=${check.pass ? 'pass' : 'fail'} data-testid="check-${check.id}">
              <span class="mark" aria-hidden="true">${check.pass ? '✓' : '✗'}</span>
              <span>
                ${labels[check.id]}
                <span class="sr">
                  ${check.pass ? msg('dentro del límite', { id: 'check-pass' }) : msg('fuera del límite', { id: 'check-fail' })}
                </span>
              </span>
              <span class="value">${shown(check, check.value, valueDigits(check))}</span>
              <span class="limit">
                ${msg('Límite', { id: 'check-limit' })}:
                ${shown(check, check.limit, display(check).digits)}
              </span>
            </li>`,
        )}
      </ul>
      <p class="meta">
        ${msg('Combustible restante', { id: 'fuel-left' })}: ${percent.format(report.fuel)} ·
        ${msg('Tiempo de vuelo', { id: 'flight-time' })}: ${whole.format(report.flightTime)} s
      </p>
      <button @click=${() => this.request('restart')}>${msg('Reintentar', { id: 'retry' })}</button>
    </section>`;
  }

  private instruments(t: FlightTelemetry) {
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
    const item = (id: string, label: string, value: string, unit?: string, primary = false) =>
      html`<div class=${primary ? 'primary' : ''}>
        <dt>${label}</dt>
        <dd data-testid=${id}>
          ${value}${unit ? html`<span class="unit"> ${unit}</span>` : nothing}
        </dd>
      </div>`;
    const share = (fraction: number) => `${Math.min(1, Math.max(0, fraction)) * 100}%`;
    return html`${this.radar(t)}
      <div class="data">
        <dl class="readouts">
          ${item('altitude', msg('Altitud', { id: 'altitude' }), decimal.format(t.altitude), 'm', true)}
          ${item(
            'vertical-speed',
            msg('Vel. vertical', { id: 'vertical-speed' }),
            signed.format(t.verticalSpeed),
            'm/s',
            true,
          )}
          ${item('tilt', msg('Inclinación', { id: 'tilt' }), `${whole.format((t.tilt * 180) / Math.PI)}°`)}
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
        </dl>
        <div class="gauges">
          <span class="gauge-label">${msg('Combustible', { id: 'fuel' })}</span>
          <span class="bar" aria-hidden="true">
            <span class="fill" style=${styleMap({ inlineSize: share(t.fuel) })}></span>
          </span>
          <span class="gauge-value" data-testid="fuel">${percent.format(t.fuel)}</span>
          <span class="gauge-label">${msg('Empuje', { id: 'throttle' })}</span>
          <span class="bar" aria-hidden="true">
            <span class="fill throttle" style=${styleMap({ inlineSize: share(t.throttle) })}></span>
            ${
              t.hoverThrottle <= 1
                ? html`<span
                    class="hover-mark"
                    data-testid="hover-mark"
                    title=${msg('Empuje para flotar', { id: 'hover-mark' })}
                    style=${styleMap({ insetInlineStart: share(t.hoverThrottle) })}
                  ></span>`
                : nothing
            }
          </span>
          <span class="gauge-value" data-testid="throttle">${percent.format(t.throttle)}</span>
        </div>
      </div>`;
  }

  // Heading-up radar: lean (sin of tilt), drift arrow, and the pad, each at its own scale.
  private radar(t: FlightTelemetry) {
    const lean = radarPoint(t.lean, RADAR_SCALE.lean);
    const drift = radarPoint(t.drift, RADAR_SCALE.drift);
    const pad = radarPoint(t.pad, RADAR_SCALE.pad);
    const driftLength = Math.hypot(drift.x, drift.y);
    const angle = (Math.atan2(drift.y, drift.x) * 180) / Math.PI;
    const r = RADAR_RADIUS;
    return html`<figure>
      <svg
        class="radar"
        viewBox="${-r - 6} ${-r - 6} ${2 * r + 12} ${2 * r + 12}"
        role="img"
        aria-label=${msg('Radar de aterrizaje: inclinación, deriva y plataforma', { id: 'radar' })}
      >
        <circle class="face" r=${r}></circle>
        <circle class="ring" r=${r / 2}></circle>
        <line class="ring" x1=${-r} x2=${r}></line>
        <line class="ring" y1=${-r} y2=${r}></line>
        <path class="forward" d="M0 ${-r - 6} L4 ${-r + 1} L-4 ${-r + 1} Z"></path>
        <path
          class="pad ${pad.clamped ? 'far' : ''}"
          data-testid="radar-pad"
          data-x=${pad.x.toFixed(1)}
          data-y=${pad.y.toFixed(1)}
          transform="translate(${pad.x} ${pad.y})"
          d="M0 -5 L5 0 L0 5 L-5 0 Z"
        ></path>
        <g
          data-testid="radar-drift"
          data-x=${drift.x.toFixed(1)}
          data-y=${drift.y.toFixed(1)}
          visibility=${driftLength < 1 ? 'hidden' : 'visible'}
        >
          <line class="drift" x2=${drift.x} y2=${drift.y}></line>
          <path
            class="arrowhead"
            transform="translate(${drift.x} ${drift.y}) rotate(${angle})"
            d="M2 0 L-6 -4 L-6 4 Z"
          ></path>
        </g>
        <circle
          class="lean"
          data-testid="radar-lean"
          data-x=${lean.x.toFixed(1)}
          data-y=${lean.y.toFixed(1)}
          cx=${lean.x}
          cy=${lean.y}
          r="5"
        ></circle>
      </svg>
      <figcaption aria-hidden="true">
        <span><span class="swatch lean"></span>${msg('Inclinación', { id: 'tilt' })}</span>
        <span><span class="swatch drift"></span>${msg('Deriva', { id: 'legend-drift' })}</span>
        <span><span class="swatch pad"></span>${msg('Plataforma', { id: 'legend-pad' })}</span>
      </figcaption>
    </figure>`;
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
          <button @click=${this.toggleSound} aria-pressed=${this.muted ? 'true' : 'false'}>
            ${msg('Silenciar', { id: 'mute' })}
          </button>
          <button @click=${this.openHelp} aria-haspopup="dialog">
            ${msg('Ayuda', { id: 'help' })}
          </button>
        </nav>
      </header>
      ${this.localeError ? html`<p class="locale-error" role="alert">${msg('No pudimos cambiar el idioma. Actualizá la página para volver a intentarlo.', { id: 'locale-failed' })}</p>` : nothing}
      ${this.status !== 'ready' ? html`<p id="status" class="status" role=${this.status === 'failed' ? 'alert' : 'status'}>${this.status === 'failed' ? text.failed : text.loading}</p>` : nothing}
      ${
        this.status === 'ready'
          ? html`<div class="overlay">
                <p id="phase" role="status" class=${this.phase === 'complete' ? 'sr' : ''}>
                  ${this.phaseMessage()}
                </p>
                ${this.phase === 'ready' && this.showControls ? this.quickCard() : nothing}
                ${this.phase === 'complete' && this.report ? this.reportCard(this.report) : nothing}
              </div>
              <div class="bottom">
                ${
                  this.telemetry
                    ? html`<section
                        class="instruments"
                        aria-label=${msg('Instrumentos de vuelo', { id: 'instruments' })}
                      >
                        ${this.instruments(this.telemetry)}
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
                            ${
                              this.phase === 'complete'
                                ? msg('Reintentar', { id: 'retry' })
                                : msg('Reiniciar', { id: 'restart' })
                            }
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
          ${key(msg('Silenciar / activar sonido', { id: 'help-mute' }), 'M')}
          ${key(msg('Reiniciar', { id: 'restart' }), 'Enter')}
          <div>
            <dt>${msg('Cámara', { id: 'help-camera' })}</dt>
            <dd>
              ${msg('Arrastrá para mirar alrededor (vuelve sola) · rueda para acercar', { id: 'help-camera-keys' })}
            </dd>
          </div>
        </dl>
        ${
          this.manualHref
            ? html`<p class="manual">
                <a href=${this.manualHref} target="_blank" rel="noopener">
                  ${msg('Abrir el manual (pestaña nueva)', { id: 'open-manual' })}
                </a>
              </p>`
            : nothing
        }
        <p class="about">
          ${msg('Aterrizaje limpio: tocar a 2 m/s o menos hacia abajo, a 1 m/s o menos de costado y con 10° de inclinación o menos, y quedarse quieto sobre las cuatro patas un segundo. Si la estructura toca el suelo, una pata golpea a más de 5 m/s o el módulo vuelca, es un accidente.', { id: 'rules-help' })}
        </p>
        <p class="about">
          ${msg('El radar mira hacia donde apunta el módulo: arriba es adelante (W). El punto muestra hacia dónde se inclina el empuje; la flecha, tu deriva horizontal; el rombo, la plataforma (hueco a más de 60 m). Para frenar la deriva, inclinate en contra de la flecha. La marca en la barra de empuje indica cuánto hace falta para flotar.', { id: 'radar-help' })}
        </p>
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
