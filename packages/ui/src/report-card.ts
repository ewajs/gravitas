import { html, nothing, type TemplateResult } from 'lit';
import { msg } from '@lit/localize';
import { toDegrees } from '@gravitas/engine/math';
import { numberFormats } from './format';
import { icons } from './icons';
import type { Locale } from './localization';
import type { LandingCheck, LandingReport } from './types';

/** Localized verdict title, shared by the results card and the phase live region. */
export function verdictTitle(verdict: LandingReport['verdict']): string {
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

// Each verdict pairs its colour with an icon; the title says it in words.
const BADGES = {
  landed: { tone: 'good', icon: () => icons.check(22) },
  'landed-off-pad': { tone: 'warn', icon: () => icons.caution(22) },
  rough: { tone: 'bad', icon: () => icons.cross(20) },
  crashed: { tone: 'bad', icon: () => icons.cross(20) },
} as const;

/**
 * The verdict and why: each judged quantity against its limit, fuel and time,
 * Try again, and the manual when `manualHref` is set.
 */
export function reportCard(
  report: LandingReport,
  locale: Locale,
  manualHref: string,
  onRetry: () => void,
): TemplateResult {
  const { whole, percent, fixed } = numberFormats(locale);
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
      ? { scale: toDegrees(1), unit: '°', digits: 0 } // Degrees per radian.
      : { scale: 1, unit: check.id === 'pad-distance' ? ' m' : ' m/s', digits: 1 };
  const shown = (check: LandingCheck, value: number, digits: number) => {
    const { scale, unit } = display(check);
    return `${fixed(digits).format(value * scale)}${unit}`;
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
  const badge = BADGES[report.verdict];
  return html`<section
    id="report"
    class="card report ${report.verdict} ${badge.tone}"
    role="status"
    aria-labelledby="report-title"
  >
    <div class="verdict">
      <span class="badge" aria-hidden="true">${badge.icon()}</span>
      <div>
        <h2 id="report-title" data-testid="report-title">${verdictTitle(report.verdict)}</h2>
        <p class="summary">${summary}</p>
      </div>
    </div>
    <ul class="checks">
      ${report.checks.map(
        (check, index) =>
          html`<li
            class=${check.pass ? 'pass' : 'fail'}
            data-testid="check-${check.id}"
            style="--row: ${index}"
          >
            <span class="mark" aria-hidden="true"
              >${check.pass ? icons.check() : icons.cross()}</span
            >
            <span>
              ${labels[check.id]}
              <span class="sr">
                ${check.pass ? msg('dentro del límite', { id: 'check-pass' }) : msg('fuera del límite', { id: 'check-fail' })}
              </span>
            </span>
            <span class="result">
              <span class="value">${shown(check, check.value, valueDigits(check))}</span>
              <span class="limit">
                ${msg('Límite', { id: 'check-limit' })}:
                ${shown(check, check.limit, display(check).digits)}
              </span>
            </span>
          </li>`,
      )}
    </ul>
    <dl class="totals" style="--row: ${report.checks.length}">
      <div>
        <dt>${msg('Combustible restante', { id: 'fuel-left' })}</dt>
        <dd data-testid="fuel-left">${percent.format(report.fuel)}</dd>
      </div>
      <div>
        <dt>${msg('Tiempo de vuelo', { id: 'flight-time' })}</dt>
        <dd data-testid="flight-time">${whole.format(report.flightTime)} s</dd>
      </div>
    </dl>
    <div class="card-actions">
      <button class="primary" @click=${onRetry} aria-keyshortcuts="Enter">
        ${msg('Reintentar', { id: 'retry' })}<kbd aria-hidden="true">Enter</kbd>
      </button>
      ${
        manualHref
          ? html`<a
              class="button"
              href=${manualHref}
              target="_blank"
              rel="noopener"
              aria-label=${msg('Abrir el manual (pestaña nueva)', { id: 'open-manual' })}
              >Manual</a
            >`
          : nothing
      }
    </div>
  </section>`;
}
