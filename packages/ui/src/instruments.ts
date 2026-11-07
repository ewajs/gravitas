import { html, nothing, type TemplateResult } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import { msg } from '@lit/localize';
import { clamp, toDegrees } from '@gravitas/engine/math';
import { numberFormats } from './format';
import type { Locale } from './localization';
import { RADAR_RADIUS, RADAR_SCALE, radarPoint } from './radar';
import type { FlightTelemetry } from './types';

/** Readouts, fuel and throttle gauges, and the landing radar for one snapshot. */
export function instruments(t: FlightTelemetry, locale: Locale): TemplateResult {
  const { decimal, signed, whole, percent } = numberFormats(locale);
  const item = (id: string, label: string, value: string, unit?: string, primary = false) =>
    html`<div class=${primary ? 'primary' : ''}>
      <dt>${label}</dt>
      <dd data-testid=${id}>
        ${value}${unit ? html`<span class="unit"> ${unit}</span>` : nothing}
      </dd>
    </div>`;
  const share = (fraction: number) => `${clamp(fraction, 0, 1) * 100}%`;
  return html`${landingRadar(t)}
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
        ${item('tilt', msg('Inclinación', { id: 'tilt' }), `${whole.format(toDegrees(t.tilt))}°`)}
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
function landingRadar(t: FlightTelemetry): TemplateResult {
  const lean = radarPoint(t.lean, RADAR_SCALE.lean);
  const drift = radarPoint(t.drift, RADAR_SCALE.drift);
  const pad = radarPoint(t.pad, RADAR_SCALE.pad);
  const driftLength = Math.hypot(drift.x, drift.y);
  const angle = toDegrees(Math.atan2(drift.y, drift.x));
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
