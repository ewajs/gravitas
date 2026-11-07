import { html, nothing, type TemplateResult } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import { msg } from '@lit/localize';
import { clamp, toDegrees } from '@gravitas/engine/math';
import { numberFormats } from './format';
import { icons } from './icons';
import type { Locale } from './localization';
import { RADAR_RADIUS, RADAR_SCALE, radarPoint } from './radar';
import type { FlightTelemetry } from './types';

/** Full scale of the safe-sink scale under vertical speed, in m/s. */
const SINK_SCALE = 10;

/**
 * Two panels for one snapshot: readouts with the safe-sink scale and fuel on the
 * left; the landing radar, pad distance, and throttle on the right. Gauge levels
 * are CSS custom properties, so styles decide orientation and easing.
 */
export function instruments(t: FlightTelemetry, locale: Locale): TemplateResult {
  const { decimal, signed, whole, percent } = numberFormats(locale);
  const item = (id: string, label: string, value: string, unit?: string) =>
    html`<div>
      <dt>${label}</dt>
      <dd data-testid=${id}>
        ${value}${unit ? html`<span class="unit"> ${unit}</span>` : nothing}
      </dd>
    </div>`;
  const level = (fraction: number) => String(clamp(fraction, 0, 1));
  const sinking = -t.verticalSpeed;
  const tooFast = t.safeSink !== undefined && sinking > t.safeSink;
  return html`<div class="panel flight-panel">
      <dl class="headline">
        ${item('altitude', msg('Altitud', { id: 'altitude' }), decimal.format(t.altitude), 'm')}
        <div class=${tooFast ? 'too-fast' : ''}>
          <dt>
            ${msg('Vel. vertical', { id: 'vertical-speed' })}
            ${
              tooFast
                ? html`<span
                    class="caution"
                    role="img"
                    aria-label=${msg('Más rápido que el descenso seguro', { id: 'too-fast' })}
                    >${icons.caution(14)}</span
                  >`
                : nothing
            }
          </dt>
          <dd data-testid="vertical-speed">
            ${signedValue(signed.format(t.verticalSpeed))}<span class="unit"> m/s</span>
          </dd>
        </div>
      </dl>
      ${t.safeSink === undefined ? nothing : sinkScale(t.safeSink, sinking, tooFast, locale)}
      <dl class="details">
        ${item(
          'horizontal-speed',
          msg('Vel. horizontal', { id: 'horizontal-speed' }),
          decimal.format(t.horizontalSpeed),
          'm/s',
        )}
        ${item('tilt', msg('Inclinación', { id: 'tilt' }), `${whole.format(toDegrees(t.tilt))}°`)}
        ${item('fuel', msg('Combustible', { id: 'fuel' }), percent.format(t.fuel))}
      </dl>
      <span class="bar fuel" aria-hidden="true" style=${styleMap({ '--level': level(t.fuel) })}>
        <span class="fill"></span>
      </span>
    </div>
    <div class="panel navigation-panel">
      <div class="navigation">
        ${landingRadar(t)}
        <dl class="pad-readout">
          ${item(
            'pad-distance',
            msg('A la plataforma', { id: 'pad-distance' }),
            decimal.format(t.padDistance),
            'm',
          )}
        </dl>
      </div>
      <div
        class="throttle"
        style=${styleMap({ '--level': level(t.throttle), '--hover': level(t.hoverThrottle) })}
      >
        <span class="gauge-label">${msg('Empuje', { id: 'throttle' })}</span>
        <span class="bar" aria-hidden="true">
          <span class="fill"></span>
          ${
            t.hoverThrottle <= 1
              ? html`<span
                  class="hover-mark"
                  data-testid="hover-mark"
                  title=${msg('Empuje para flotar', { id: 'hover-mark' })}
                  ><span class="hover-label">${msg('Flotar', { id: 'hover-label' })}</span></span
                >`
              : nothing
          }
        </span>
        <span class="gauge-value" data-testid="throttle">${percent.format(t.throttle)}</span>
      </div>
    </div>`;
}

// The sign in its own span (same text), so it can be set without tabular spacing.
function signedValue(text: string) {
  const sign = /^[-+−]/.test(text) ? text[0] : '';
  return sign ? html`<span class="sign">${sign}</span>${text.slice(1)}` : text;
}

// A hint, not a limit: the shaded band is the host's advised sink rate here, the
// tick is the current sink. Position carries the meaning; colour only repeats it.
function sinkScale(safe: number, sinking: number, tooFast: boolean, locale: Locale) {
  const { decimal } = numberFormats(locale);
  const fraction = (speed: number) => String(clamp(speed / SINK_SCALE, 0, 1));
  return html`<div
    class="sink ${tooFast ? 'too-fast' : ''}"
    data-testid="sink-scale"
    role="img"
    aria-label="${msg('Descenso seguro hasta', { id: 'safe-sink-up-to' })} ${decimal.format(safe)} m/s"
    style=${styleMap({ '--safe': fraction(safe), '--sink': fraction(sinking) })}
  >
    <span class="sink-track"><span class="safe"></span><span class="tick"></span></span>
    <span class="sink-labels" aria-hidden="true">
      <span>0</span><span>${msg('Descenso seguro', { id: 'safe-sink' })}</span>
      <span class="scale-unit">${SINK_SCALE} m/s</span>
    </span>
  </div>`;
}

// Heading-up radar: lean (sin of tilt), drift arrow, and the pad, each at its own scale.
function landingRadar(t: FlightTelemetry): TemplateResult {
  const lean = radarPoint(t.lean, RADAR_SCALE.lean);
  const drift = radarPoint(t.drift, RADAR_SCALE.drift);
  const pad = radarPoint(t.pad, RADAR_SCALE.pad);
  const driftLength = Math.hypot(drift.x, drift.y);
  const angle = toDegrees(Math.atan2(drift.y, drift.x));
  const r = RADAR_RADIUS;
  // Lean and pad move by CSS transform, so their position eases between snapshots.
  const at = (point: { x: number; y: number }) =>
    styleMap({ transform: `translate(${point.x}px, ${point.y}px)` });
  return html`<figure>
    <svg
      class="radar"
      viewBox="${-r - 6} ${-r - 6} ${2 * r + 12} ${2 * r + 12}"
      role="img"
      aria-label=${msg('Radar de aterrizaje: inclinación, deriva y plataforma', { id: 'radar' })}
    >
      <circle class="face" r=${r}></circle>
      <circle class="ring" r=${(r * 2) / 3}></circle>
      <circle class="ring" r=${r / 3}></circle>
      <path class="cross" d="M${-r} 0H${r}M0 ${-r}V${r}"></path>
      <path class="forward" d="M0 ${-r - 6} L4 ${-r + 1} L-4 ${-r + 1} Z"></path>
      <path
        class="pad ${pad.clamped ? 'far' : ''}"
        data-testid="radar-pad"
        data-x=${pad.x.toFixed(1)}
        data-y=${pad.y.toFixed(1)}
        style=${at(pad)}
        d="M0 -6 L6 0 L0 6 L-6 0 Z"
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
        style=${at(lean)}
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
