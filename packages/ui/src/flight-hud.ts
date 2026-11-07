import { LitElement, html, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { msg, updateWhenLocaleChanges } from '@lit/localize';
import { helpDialog, quickCard } from './help';
import { instruments } from './instruments';
import { type Locale, viewportMessages } from './localization';
import { reportCard, verdictTitle } from './report-card';
import { hudStyles } from './styles';
import { uiTokens } from './tokens';
import type {
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

  /** Lit template implementation, separate from the host-facing property/event contract. @internal */
  render() {
    const text = viewportMessages();
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
                ${this.phase === 'ready' && this.showControls ? quickCard() : nothing}
                ${this.phase === 'complete' && this.report ? reportCard(this.report, this.locale, () => this.request('restart')) : nothing}
              </div>
              <div class="bottom">
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
      ${helpDialog(this.manualHref, () => this.closeHelp())}
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
