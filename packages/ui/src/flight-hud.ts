import { LitElement, html, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { msg, updateWhenLocaleChanges } from '@lit/localize';
import { confirmKey, helpDialog, quickCard } from './help';
import { icons } from './icons';
import { instruments } from './instruments';
import { type Locale, viewportMessages } from './localization';
import { reportCard, verdictTitle } from './report-card';
import { hudStyles } from './styles';
import { uiTokens } from './tokens';
import { TouchControls } from './touch-controls';
import type {
  AppearanceRequest,
  FlightNotice,
  FlightPhase,
  FlightRequest,
  FlightTelemetry,
  InputDevice,
  LandingReport,
  LocaleRequest,
  SoundRequest,
  TouchControlsMode,
  ViewRequest,
  WarpRequest,
} from './types';

/** Optional flight HUD. Receives presentation snapshots; owns no renderer or simulation. */
export class FlightHud extends LitElement {
  /** Branding supplied by the application. */
  @property() heading = '';
  /** The flight's subtitle under the heading; the localized "Lunar descent" when empty. */
  @property() subtitle = '';
  /** Latest immutable telemetry snapshot, never authoritative flight state. */
  @property({ attribute: false }) telemetry?: FlightTelemetry;
  /** Current session phase owned by the application. */
  @property() phase: FlightPhase = 'ready';
  /** The device the player is using; the start card, Help, and hints describe its controls. */
  @property() inputDevice: InputDevice = 'keyboard';
  /** The player's touch-controls setting, shown and changed in Help's Display section. */
  @property() touchControlsMode: TouchControlsMode = 'auto';
  /**
   * Whether the host is showing on-screen touch controls; the HUD keeps their
   * thumb zones clear.
   */
  @property({ type: Boolean, reflect: true, attribute: 'touch-controls' }) touchControls = false;
  /**
   * Whether the player flies with the on-screen touch controls, in every phase
   * (the controls themselves show only during a flight). On a phone-sized screen
   * the HUD then keeps one compact layout from the start to the results: corner
   * readouts and radar that leave the centre clear, and a menu (⋯) for the view
   * options. Tablets and larger screens keep their layout.
   */
  @property({ type: Boolean, reflect: true, attribute: 'touch-layout' }) touchLayout = false;
  /**
   * Ask the player to turn the device sideways: the host shows it while a flight
   * is under way in portrait on a phone, and pauses the flight meanwhile.
   */
  @property({ type: Boolean }) rotatePrompt = false;
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

  /**
   * Time-warp factor, shown beside the slower and faster buttons when
   * `warpAvailable`. The host decides it; the buttons request a change.
   */
  @property({ type: Number }) warp = 1;
  /** Whether this flight offers time warp (flights around a body). */
  @property({ type: Boolean }) warpAvailable = false;
  /** Whether this flight offers the map view; a button (⋯ menu on phones) toggles it. */
  @property({ type: Boolean }) mapAvailable = false;
  /** The camera the host is showing. */
  @property() camera: 'chase' | 'map' = 'chase';
  /** A short message the host shows, then clears; see {@link FlightNotice}. */
  @property() notice: FlightNotice | '' = '';

  /** Whether the phone menu (⋯) is open; mirrors its popover for `aria-expanded`. */
  @state() private menuOpen = false;
  // Where focus returns when Help closes after being opened from the menu, whose
  // Help button is hidden by then; otherwise the dialog restores focus itself.
  #helpReturn: HTMLElement | undefined;

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

  private requestWarp(direction: 1 | -1) {
    this.dispatchEvent(
      new CustomEvent<WarpRequest>('warp-request', {
        detail: { direction },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private toggleView() {
    this.dispatchEvent(
      new CustomEvent<ViewRequest>('view-request', {
        detail: { camera: this.camera === 'map' ? 'chase' : 'map' },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private mapFromMenu() {
    this.closeMenu();
    this.toggleView();
  }

  private noticeText(): string {
    switch (this.notice) {
      case 'warp-throttle':
        return msg('Cerrá el empuje para acelerar más el tiempo.', { id: 'notice-warp-throttle' });
      case 'warp-rotation':
        return msg('Frená el giro para acelerar más el tiempo.', { id: 'notice-warp-rotation' });
      case 'warp-altitude':
        return msg('Demasiado bajo para acelerar más el tiempo.', { id: 'notice-warp-altitude' });
      case 'surface':
        return msg(
          'Llegaste al suelo. Tocarlo llega con el próximo paso; reiniciá para volver a empezar.',
          { id: 'notice-surface' },
        );
      default:
        return '';
    }
  }

  private requestAppearance(detail: AppearanceRequest) {
    this.dispatchEvent(
      new CustomEvent<AppearanceRequest>('appearance-request', {
        detail,
        bubbles: true,
        composed: true,
      }),
    );
  }

  /**
   * Whether Help is open. Hosts ignore flight commands from devices that do not
   * move focus (a gamepad) while it is, as keys inside the dialog are ignored.
   */
  get helpOpen(): boolean {
    return this.renderRoot.querySelector('dialog')?.open ?? false;
  }

  private openHelp() {
    // Reading help should never cost the player their flight.
    if (this.phase === 'flying') this.request('pause');
    this.renderRoot.querySelector('dialog')?.showModal();
  }
  private closeHelp() {
    this.renderRoot.querySelector('dialog')?.close();
  }
  private helpClosed() {
    const target = this.#helpReturn;
    this.#helpReturn = undefined;
    target?.focus();
  }

  // ---- Phone menu ----
  // A native popover: Escape or a tap outside closes it and focus returns to ⋯.

  private get menu(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('#menu');
  }
  private menuToggled(event: Event) {
    this.menuOpen = (event as ToggleEvent).newState === 'open';
    // Like Help: opening the menu mid-flight pauses, so a thumb can leave the controls.
    if (this.menuOpen && this.phase === 'flying') this.request('pause');
  }
  private closeMenu() {
    if (this.menu?.matches(':popover-open')) this.menu.hidePopover();
  }
  private helpFromMenu() {
    this.closeMenu();
    this.#helpReturn = this.renderRoot.querySelector<HTMLElement>('.menu-toggle') ?? undefined;
    this.openHelp();
  }
  private restartFromMenu() {
    this.closeMenu();
    this.request('restart');
  }

  /** @internal */
  protected firstUpdated(): void {
    // Escape closes the dialog without its Close button, so listen for the close itself.
    this.renderRoot.querySelector('dialog')?.addEventListener('close', () => this.helpClosed());
  }

  /** @internal */
  protected updated(changed: Map<PropertyKey, unknown>): void {
    // The menu belongs to the touch layout; leaving it (a key press) closes the menu.
    if (changed.has('touchLayout') && !this.touchLayout) this.closeMenu();
  }

  private phaseMessage() {
    const device = this.inputDevice;
    switch (this.phase) {
      case 'ready':
        return device === 'touch'
          ? msg('Listo para descender. Tocá Comenzar.', { id: 'phase-ready-touch' })
          : device === 'gamepad'
            ? msg('Listo para descender. Pulsá A o Comenzar.', { id: 'phase-ready-pad' })
            : msg('Listo para descender. Pulsá P o Comenzar.', { id: 'phase-ready' });
      case 'paused':
        return device === 'touch'
          ? msg('En pausa. Tocá Reanudar.', { id: 'phase-paused-touch' })
          : device === 'gamepad'
            ? msg('En pausa. Pulsá A o Reanudar.', { id: 'phase-paused-pad' })
            : msg('En pausa. Pulsá P o Reanudar.', { id: 'phase-paused' });
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
      ${this.warpAvailable ? this.warpStepper() : nothing}
      ${
        this.mapAvailable
          ? html`<button
              class="icon view"
              @click=${this.toggleView}
              aria-pressed=${this.camera === 'map' ? 'true' : 'false'}
              aria-label=${msg('Mapa', { id: 'map-view' })}
              title=${msg('Mapa', { id: 'map-view' })}
              aria-keyshortcuts="V"
            >
              ${icons.map()}
            </button>`
          : nothing
      }
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
        class="icon restart"
        @click=${() => this.request('restart')}
        aria-label=${restart}
        title=${restart}
        aria-keyshortcuts="Enter"
      >
        ${icons.restart()}
      </button>
    </div>`;
  }

  // Slower, the current factor, faster. The factor is a live region: a refused or
  // automatic return to real time is announced.
  private warpStepper() {
    const slower = msg('Tiempo más lento', { id: 'warp-slower' });
    const faster = msg('Tiempo más rápido', { id: 'warp-faster' });
    return html`<div
      class="warp"
      role="group"
      aria-label=${msg('Aceleración del tiempo', { id: 'warp' })}
    >
      <button
        class="icon"
        @click=${() => this.requestWarp(-1)}
        ?disabled=${this.warp <= 1}
        aria-label=${slower}
        title=${slower}
        aria-keyshortcuts=","
      >
        ${icons.slower()}
      </button>
      <output class="warp-level" data-testid="warp" aria-live="polite">×${this.warp}</output>
      <button
        class="icon"
        @click=${() => this.requestWarp(1)}
        ?disabled=${this.phase !== 'flying'}
        aria-label=${faster}
        title=${faster}
        aria-keyshortcuts="."
      >
        ${icons.faster()}
      </button>
    </div>`;
  }

  // The view options (and restart) on phones: one ⋯ button and a popover, so the
  // top corner holds two buttons. Desktop and tablet styles hide it.
  private phoneMenu(underway: boolean, mute: string, help: string) {
    const label = msg('Menú', { id: 'menu' });
    const language = msg('Idioma', { id: 'language' });
    const restart = msg('Reiniciar', { id: 'restart' });
    return html`<button
        class="icon menu-toggle"
        popovertarget="menu"
        aria-controls="menu"
        aria-expanded=${this.menuOpen ? 'true' : 'false'}
        aria-label=${label}
        title=${label}
      >
        ${icons.more()}
      </button>
      <div
        id="menu"
        class="menu"
        popover
        role="group"
        aria-label=${label}
        @toggle=${this.menuToggled}
      >
        <label class="menu-item">
          <span>${language}</span>
          <select
            aria-label=${language}
            .value=${this.locale}
            aria-disabled=${this.localePending}
            aria-busy=${this.localePending}
            @change=${this.requestLocale}
          >
            <option value="es-AR">ES</option>
            <option value="en">EN</option>
          </select>
        </label>
        <button
          class="menu-item"
          @click=${this.toggleSound}
          aria-pressed=${this.muted ? 'true' : 'false'}
          aria-keyshortcuts="M"
        >
          ${this.muted ? icons.muted() : icons.sound()}<span>${mute}</span>
        </button>
        ${
          underway
            ? html`<button
                class="menu-item"
                @click=${this.restartFromMenu}
                aria-keyshortcuts="Enter"
              >
                ${icons.restart()}<span>${restart}</span>
              </button>`
            : nothing
        }
        ${
          this.mapAvailable
            ? html`<button
                class="menu-item"
                @click=${this.mapFromMenu}
                aria-pressed=${this.camera === 'map' ? 'true' : 'false'}
                aria-keyshortcuts="V"
              >
                ${icons.map()}<span>${msg('Mapa', { id: 'map-view' })}</span>
              </button>`
            : nothing
        }
        <button class="menu-item" @click=${this.helpFromMenu} aria-haspopup="dialog">
          ${icons.help()}<span>${help}</span>
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
            <slot name="mark"></slot>
            <h1>${this.heading}</h1>
          </div>
          <p class="mission">
            <span class="dot ${this.phase}" aria-hidden="true"></span>
            <span id="subtitle">${this.subtitle || text.subtitle}</span>
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
        ${this.phoneMenu(underway, mute, help)}
      </header>
      ${this.localeError ? html`<p class="locale-error" role="alert">${msg('No pudimos cambiar el idioma. Actualizá la página para volver a intentarlo.', { id: 'locale-failed' })}</p>` : nothing}
      ${this.status !== 'ready' ? html`<p id="status" class="status" role=${this.status === 'failed' ? 'alert' : 'status'}>${this.status === 'failed' ? text.failed : text.loading}</p>` : nothing}
      ${
        this.status === 'ready'
          ? html`<div
                class="overlay ${this.phase === 'ready' && this.showControls ? 'with-card' : ''}"
              >
                <p id="phase" role="status" class="${quiet ? 'sr' : ''} ${this.phase}">
                  ${message}
                </p>
                <p id="notice" role="status" class="notice ${this.notice ? '' : 'sr'}">
                  ${this.noticeText()}
                </p>
                ${this.phase === 'ready' && this.showControls ? quickCard(this.heading, this.inputDevice) : nothing}
                ${
                  this.phase === 'ready'
                    ? html`<p class="turn-hint">
                        ${icons.rotate(30)}<span
                          >${msg('Girá el teléfono para volar: en horizontal entran los dos pulgares.', { id: 'turn-hint' })}</span
                        >
                      </p>`
                    : nothing
                }
                ${
                  this.phase === 'ready'
                    ? html`<div class="actions">
                        <button
                          class="primary"
                          @click=${() => this.request('start')}
                          aria-keyshortcuts="P"
                        >
                          ${msg('Comenzar', { id: 'start' })}${
                            this.inputDevice === 'touch'
                              ? nothing
                              : html`<kbd aria-hidden="true">${confirmKey(this.inputDevice)}</kbd>`
                          }
                        </button>
                      </div>`
                    : nothing
                }
              </div>
              ${
                this.telemetry
                  ? html`<section
                      class="instruments ${this.phase === 'ready' && this.showControls ? 'behind-card' : ''}"
                      aria-label=${msg('Instrumentos de vuelo', { id: 'instruments' })}
                    >
                      ${instruments(this.telemetry, this.locale)}
                    </section>`
                  : nothing
              }
              <p id="controls" ?hidden=${this.inputDevice === 'touch'}>
                ${
                  this.inputDevice === 'gamepad'
                    ? msg('Stick derecho: inclinar · LB/RB: girar · RT/LT: empuje · Start: pausa', {
                        id: 'controls-pad',
                      })
                    : text.controls
                }
              </p>
              ${
                this.phase === 'complete' && this.report
                  ? html`<div class="results">
                      ${reportCard(this.report, this.locale, this.manualHref, { keyboard: 'Enter', gamepad: 'A', touch: '' }[this.inputDevice], () => this.request('restart'))}
                    </div>`
                  : nothing
              }`
          : nothing
      }
      ${
        this.rotatePrompt
          ? html`<div class="rotate" role="alert" data-testid="rotate-prompt">
              <div class="card">
                ${icons.rotate()}
                <h2>${msg('Girá el teléfono', { id: 'rotate-title' })}</h2>
                <p>
                  ${msg('Se vuela en horizontal. El vuelo queda en pausa hasta que lo reanudes.', { id: 'rotate-body' })}
                </p>
              </div>
            </div>`
          : nothing
      }
      ${helpDialog(
        this.manualHref,
        { reduceTransparency: this.reduceTransparency, touchControls: this.touchControlsMode },
        this.inputDevice,
        () => this.closeHelp(),
        (request) => this.requestAppearance(request),
        this.warpAvailable,
      )}
    `;
  }
}

/**
 * Registers the optional components (`gravitas-flight-hud` and
 * `gravitas-touch-controls`) once; safe for repeated application mounts.
 */
export function registerUi(): void {
  if (!customElements.get('gravitas-flight-hud'))
    customElements.define('gravitas-flight-hud', FlightHud);
  if (!customElements.get('gravitas-touch-controls'))
    customElements.define('gravitas-touch-controls', TouchControls);
}

declare global {
  interface HTMLElementTagNameMap {
    'gravitas-flight-hud': FlightHud;
    'gravitas-touch-controls': TouchControls;
  }
}
