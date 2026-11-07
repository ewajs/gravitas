import { html, nothing, type TemplateResult } from 'lit';
import { msg } from '@lit/localize';
import { icons } from './icons';
import type { InputDevice } from './types';

/** The right stick's name on a gamepad, as a key label. */
function rightStick(): string {
  return msg('Stick derecho', { id: 'pad-right-stick' });
}

/** The key or button that starts, resumes, and retries on each device. */
export function confirmKey(device: InputDevice): string {
  return device === 'gamepad' ? 'A' : 'P';
}

/**
 * "How to fly", shown before the first start: the host's mark and name (the
 * `mark-large` slot and `heading`), the essential controls of the device in use,
 * and the goal.
 */
export function quickCard(heading: string, device: InputDevice): TemplateResult {
  const row = (keys: readonly string[], action: string) =>
    html`<dt>${keys.map((key) => html`<kbd>${key}</kbd> `)}</dt>
      <dd>${action}</dd>`;
  const tilt = msg('Inclinar el módulo', { id: 'quick-tilt' });
  const turn = msg('Girar', { id: 'quick-turn' });
  const throttle = msg('Subir / bajar empuje', { id: 'quick-throttle' });
  const rows =
    device === 'gamepad'
      ? [
          row([rightStick()], tilt),
          row(['LB', 'RB'], turn),
          row(['RT', 'LT'], throttle),
          row(['Start'], msg('Pausa', { id: 'help-pause' })),
        ]
      : [
          row(['W', 'A', 'S', 'D'], tilt),
          row(['Q', 'E'], turn),
          row(['R', 'F'], throttle),
          row(['Z', 'X'], msg('Empuje máximo / cortar', { id: 'help-throttle-set' })),
        ];
  return html`<aside class="card quick" aria-labelledby="quick-title">
    <div class="lockup" aria-hidden="true">
      <slot name="mark-large"></slot>
      <span class="wordmark">${heading}</span>
    </div>
    <h2 id="quick-title">${msg('Cómo volar', { id: 'quick-title' })}</h2>
    <dl class="quick-keys" data-device=${device}>${rows}</dl>
    <p class="goal">
      ${msg('Posate en la plataforma a 2 m/s o menos, casi vertical. Para frenar la deriva, inclinate contra la flecha del radar.', { id: 'quick-goal' })}
    </p>
  </aside>`;
}

/**
 * The control reference for the device in use in a native modal dialog, with the
 * landing rules, flight notes, and the display setting.
 */
export function helpDialog(
  manualHref: string,
  reduceTransparency: boolean,
  device: InputDevice,
  onClose: () => void,
  onReduceTransparency: (reduce: boolean) => void,
): TemplateResult {
  const key = (label: string, keys: string) =>
    html`<div>
      <dt>${label}</dt>
      <dd><kbd>${keys}</kbd></dd>
    </div>`;
  return html`<dialog aria-labelledby="help-title">
    <div class="dialog-heading">
      <h2 id="help-title">${msg('Controles de vuelo', { id: 'help-title' })}</h2>
      <button
        class="icon"
        @click=${onClose}
        autofocus
        aria-label=${msg('Cerrar', { id: 'close' })}
        title=${msg('Cerrar', { id: 'close' })}
      >
        ${icons.close()}
      </button>
    </div>
    <dl class="help-list" data-device=${device}>
      ${
        device === 'gamepad'
          ? [
              key(msg('Cabeceo y alabeo', { id: 'help-tilt-pad' }), rightStick()),
              key(msg('Guiñada: izquierda / derecha', { id: 'help-yaw' }), 'LB / RB'),
              key(
                msg('Subir / bajar empuje (más presión, más rápido)', { id: 'help-throttle-pad' }),
                'RT / LT',
              ),
              key(msg('Comenzar, reanudar o reintentar', { id: 'help-confirm-pad' }), 'A'),
              key(msg('Pausa', { id: 'help-pause' }), 'Start'),
            ]
          : [
              key(msg('Cabeceo: adelante / atrás', { id: 'help-pitch' }), 'W / S'),
              key(msg('Alabeo: izquierda / derecha', { id: 'help-roll' }), 'A / D'),
              key(msg('Guiñada: izquierda / derecha', { id: 'help-yaw' }), 'Q / E'),
              key(msg('Subir / bajar empuje (mantené)', { id: 'help-throttle' }), 'R / F'),
              key(msg('Empuje máximo / cortar', { id: 'help-throttle-set' }), 'Z / X'),
              key(msg('Pausa', { id: 'help-pause' }), 'P'),
              key(msg('Silenciar / activar sonido', { id: 'help-mute' }), 'M'),
              key(msg('Reiniciar', { id: 'restart' }), 'Enter'),
            ]
      }
      <div>
        <dt>${msg('Cámara', { id: 'help-camera' })}</dt>
        <dd>
          ${msg('Arrastrá para mirar alrededor (vuelve sola) · rueda para acercar', { id: 'help-camera-keys' })}
        </dd>
      </div>
    </dl>
    ${
      manualHref
        ? html`<p class="manual">
            <a href=${manualHref} target="_blank" rel="noopener">
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
      ${msg('La escala bajo la velocidad vertical sombrea cuán rápido conviene bajar a tu altitud. Es una guía: los límites de aterrizaje no cambian.', { id: 'sink-help' })}
    </p>
    <p class="about">
      ${msg('Los controles de rotación piden una velocidad de giro; un stick, en proporción a cuánto lo movés. Al soltarlos, el control de actitud frena el giro, pero no endereza el módulo. Girar consume combustible del mismo tanque que el motor. La altitud se mide desde la pata más baja.', { id: 'flight-help' })}
    </p>
    <section class="display" aria-labelledby="display-title">
      <h3 id="display-title">${msg('Pantalla', { id: 'display-title' })}</h3>
      <label class="toggle">
        <input
          type="checkbox"
          .checked=${reduceTransparency}
          aria-describedby="transparency-note"
          @change=${(event: Event) =>
            onReduceTransparency((event.currentTarget as HTMLInputElement).checked)}
        />
        ${msg('Reducir transparencia', { id: 'reduce-transparency' })}
      </label>
      <p id="transparency-note" class="note">
        ${msg('Paneles sólidos, sin desenfoque. Se activa igual si tu sistema pide menos transparencia.', { id: 'reduce-transparency-note' })}
      </p>
    </section>
  </dialog>`;
}
