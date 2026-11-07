import { LitElement, html, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { msg, updateWhenLocaleChanges } from '@lit/localize';
import { helpDialog, quickCard } from './help';
import { icons } from './icons';
import { instruments } from './instruments';
import { type Locale, viewportMessages } from './localization';
import { reportCard, verdictTitle } from './report-card';
import { hudStyles } from './styles';
import { uiTokens } from './tokens';
import type {
  AppearanceRequest,
  FlightPhase,
  FlightRequest,
  FlightTelemetry,
  LandingReport,
  LocaleRequest,
  SoundRequest,
} from './types';

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
  /**
   * Solid panels without backdrop blur, as the player chose in Help. The system's
   * `prefers-reduced-transparency` has the same effect without it.
   */
  @property({ type: Boolean, reflect: true, attribute: 'reduce-transparency' })
  reduceTransparency = false;

  constructor() {
    super();
    // Lit's controller subscribes only while this element is connected.
    updateWhenLocaleChanges(this);
  }

  /** Lit styling hook; hosts customize the documented CSS tokens. @internal */
  static styles = [uiTokens, hudStyles];

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

  private requestAppearance(reduceTransparency: boolean) {
    this.dispatchEvent(
      new CustomEvent<AppearanceRequest>('appearance-request', {
        detail: { reduceTransparency },
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
        return this.report ? verdictTitle(this.report.verdict) : '';
      case 'flying':
        return '';
    }
  }

  // Icon buttons beside the view options while a flight is under way.
  private flightActions() {
    if (this.phase !== 'flying' && this.phase !== 'paused') return nothing;
    const flying = this.phase === 'flying';
    const toggle = flying ? msg('Pausar', { id: 'pause' }) : msg('Reanudar', { id: 'resume' });
    const restart = msg('Reiniciar', { id: 'restart' });
    return html`<div class="actions">
      <button
        class="icon"
        @click=${() => this.request(flying ? 'pause' : 'resume')}
        aria-label=${toggle}
        title=${toggle}
        aria-keyshortcuts="P"
      >
        ${flying ? icons.pause() : icons.play()}
      </button>
      <button
        class="icon"
        @click=${() => this.request('restart')}
        aria-label=${restart}
        title=${restart}
        aria-keyshortcuts="Enter"
      >
        ${icons.restart()}
      </button>
    </div>`;
  }

  /** Lit template implementation, separate from the host-facing property/event contract. @internal */
  render() {
    const text = viewportMessages();
    const mute = msg('Silenciar', { id: 'mute' });
    const help = msg('Ayuda', { id: 'help' });
    const underway = this.phase === 'flying' || this.phase === 'paused';
    // The live region always exists, so later messages are announced. It is only
    // visually hidden when empty, and after a verdict, when the card shows the title.
    const message = this.phaseMessage();
    const quiet = !message || this.phase === 'complete';
    return html`
      <header class=${underway ? 'underway' : ''}>
        <div class="brand">
          <div class="identity">
            <h1>${this.heading}</h1>
          </div>
          <p class="mission">
            <span class="dot ${this.phase}" aria-hidden="true"></span>
            <span id="subtitle">${text.subtitle}</span>
          </p>
        </div>
        ${this.flightActions()}
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
          <button
            class="icon"
            @click=${this.toggleSound}
            aria-pressed=${this.muted ? 'true' : 'false'}
            aria-label=${mute}
            title=${mute}
            aria-keyshortcuts="M"
          >
            ${this.muted ? icons.muted() : icons.sound()}
          </button>
          <button
            class="icon"
            @click=${this.openHelp}
            aria-haspopup="dialog"
            aria-label=${help}
            title=${help}
          >
            ${icons.help()}
          </button>
        </nav>
      </header>
      ${this.localeError ? html`<p class="locale-error" role="alert">${msg('No pudimos cambiar el idioma. Actualizá la página para volver a intentarlo.', { id: 'locale-failed' })}</p>` : nothing}
      ${this.status !== 'ready' ? html`<p id="status" class="status" role=${this.status === 'failed' ? 'alert' : 'status'}>${this.status === 'failed' ? text.failed : text.loading}</p>` : nothing}
      ${
        this.status === 'ready'
          ? html`<div class="overlay">
                <p id="phase" role="status" class=${quiet ? 'sr' : ''}>${message}</p>
                ${this.phase === 'ready' && this.showControls ? quickCard() : nothing}
                ${
                  this.phase === 'ready'
                    ? html`<div class="actions">
                        <button
                          class="primary"
                          @click=${() => this.request('start')}
                          aria-keyshortcuts="P"
                        >
                          ${msg('Comenzar', { id: 'start' })}<kbd aria-hidden="true">P</kbd>
                        </button>
                      </div>`
                    : nothing
                }
              </div>
              ${
                this.telemetry
                  ? html`<section
                      class="instruments"
                      aria-label=${msg('Instrumentos de vuelo', { id: 'instruments' })}
                    >
                      ${instruments(this.telemetry, this.locale)}
                    </section>`
                  : nothing
              }
              <p id="controls">${text.controls}</p>
              ${
                this.phase === 'complete' && this.report
                  ? html`<div class="results">
                      ${reportCard(this.report, this.locale, this.manualHref, () => this.request('restart'))}
                    </div>`
                  : nothing
              }`
          : nothing
      }
      ${helpDialog(
        this.manualHref,
        this.reduceTransparency,
        () => this.closeHelp(),
        (reduce) => this.requestAppearance(reduce),
      )}
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
