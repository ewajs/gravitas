import { LitElement, css, html, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { msg, updateWhenLocaleChanges } from '@lit/localize';
import type { VehiclePose } from '@gravitas/engine';
import { type Locale, viewportMessages } from './localization';
import { inspectionValues } from './inspection-values';
import { uiTokens } from './tokens';

/** A requested locale; the host loads it and commits the successful selection. */
export interface LocaleRequest {
  readonly locale: Locale;
}

/** Optional inspection UI. Receives pose snapshots; owns no renderer or simulation. */
export class InspectionHud extends LitElement {
  /** Branding supplied by the application. */
  @property() heading = '';
  /** Latest immutable pose snapshot, never an authoritative reactive flight state. */
  @property({ attribute: false }) pose?: VehiclePose;
  /** Pad reference supplied by the scenario, in world metres. */
  @property({ attribute: false }) padPosition?: VehiclePose['position'];
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
      nav {
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
      .eyebrow {
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-size: 10px;
        color: var(--gravitas-accent);
      }
      dl {
        display: flex;
        gap: 28px;
        margin: 8px 0 0;
      }
      dt {
        font-size: 12px;
        color: var(--gravitas-muted);
      }
      dd {
        margin: 2px 0 0;
        font-size: 26px;
        font-variant-numeric: tabular-nums;
        line-height: 1.2;
      }
      .unit {
        font-size: 14px;
        color: var(--gravitas-muted);
      }
      #controls {
        max-width: 300px;
        padding: 10px 14px;
        border-radius: 6px;
        background: var(--gravitas-panel);
        font-size: 12px;
        color: var(--gravitas-muted);
      }
      .status {
        position: absolute;
        top: 45%;
        left: 24px;
        right: 24px;
        width: fit-content;
        max-width: calc(100% - 48px);
        margin: 0 auto;
        padding: 20px;
        border-radius: var(--gravitas-radius);
        background: var(--gravitas-panel);
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
      dialog {
        pointer-events: auto;
        color: inherit;
        background: #111923;
        border: 1px solid var(--gravitas-line);
        border-radius: var(--gravitas-radius);
        width: min(440px, calc(100% - 32px));
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
        gap: 16px;
        margin: 24px 0;
      }
      .help-list div {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }
      .help-list dd {
        font: inherit;
        margin: 0;
      }
      .help-list dt {
        font: inherit;
      }
      .about {
        border-top: 1px solid var(--gravitas-line);
        padding-top: 16px;
        font-size: 13px;
        color: var(--gravitas-muted);
      }
      @media (max-width: 600px) {
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
        nav {
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
          padding: 12px 16px;
        }
        dl {
          gap: 16px;
          justify-content: space-between;
        }
        dd {
          font-size: 24px;
        }
        #controls {
          max-width: none;
          text-align: center;
        }
      }
      @media (max-height: 450px) {
        header {
          top: 12px;
        }
        .bottom {
          bottom: 12px;
          flex-direction: row;
          align-items: flex-end;
        }
        #controls {
          max-width: 230px;
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

  private openHelp() {
    this.renderRoot.querySelector('dialog')?.showModal();
  }
  private closeHelp() {
    this.renderRoot.querySelector('dialog')?.close();
  }

  render() {
    const text = viewportMessages();
    const values =
      this.pose && this.padPosition ? inspectionValues(this.pose, this.padPosition) : undefined;
    const number = new Intl.NumberFormat(this.locale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
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
          ? html` <div class="bottom">
              ${
                values
                  ? html`<section
                      class="instruments"
                      aria-label=${msg('Posición y orientación', { id: 'instruments' })}
                    >
                      <p class="eyebrow">
                        ${msg('Inspección · Vehículo estático', { id: 'inspection-status' })}
                      </p>
                      <dl>
                        <div>
                          <dt>${msg('Desvío de la plataforma', { id: 'pad-offset' })}</dt>
                          <dd data-testid="offset">
                            ${number.format(values.offsetMetres)} <span class="unit">m</span>
                          </dd>
                        </div>
                        <div>
                          <dt>${msg('Inclinación', { id: 'tilt' })}</dt>
                          <dd data-testid="tilt">
                            ${number.format((values.tiltRadians * 180) / Math.PI)}<span class="unit"
                              >°</span
                            >
                          </dd>
                        </div>
                      </dl>
                    </section>`
                  : nothing
              }
              <p id="controls">${text.controls}</p>
            </div>`
          : nothing
      }
      <dialog aria-labelledby="help-title">
        <div class="dialog-heading">
          <h2 id="help-title">${msg('Explorá la escena', { id: 'help-title' })}</h2>
          <button @click=${this.closeHelp} autofocus>${msg('Cerrar', { id: 'close' })}</button>
        </div>
        <dl class="help-list">
          <div>
            <dt>${msg('Girar la cámara', { id: 'orbit' })}</dt>
            <dd>${msg('Arrastrá la escena', { id: 'orbit-help' })}</dd>
          </div>
          <div>
            <dt>${msg('Acercar o alejar', { id: 'zoom' })}</dt>
            <dd>${msg('Usá la rueda', { id: 'zoom-help' })}</dd>
          </div>
          <div>
            <dt>${msg('Desplazar la vista', { id: 'pan' })}</dt>
            <dd>${msg('Enfocá la escena y usá las flechas', { id: 'pan-help' })}</dd>
          </div>
        </dl>
        <p class="about">
          ${msg('Esta es una vista de inspección. El vehículo está quieto: todavía no hay controles de vuelo. El desvío mide la distancia horizontal al centro de la plataforma; la inclinación se mide desde la vertical.', { id: 'inspection-help' })}
        </p>
      </dialog>
    `;
  }
}

/** Registers the optional component once; safe for repeated application mounts. */
export function registerUi(): void {
  if (!customElements.get('gravitas-inspection-hud'))
    customElements.define('gravitas-inspection-hud', InspectionHud);
}

declare global {
  interface HTMLElementTagNameMap {
    'gravitas-inspection-hud': InspectionHud;
  }
}
