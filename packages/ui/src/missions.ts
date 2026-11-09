import { html, nothing, type TemplateResult } from 'lit';
import { msg } from '@lit/localize';
import type { MissionChoice, MissionId } from './types';

/** A mission's localized copy: its name, what the player does, and the vehicle and start. */
export function missionText(id: MissionId): { title: string; goal: string; facts: string } {
  switch (id) {
    case 'quick-landing':
      return {
        title: msg('Aterrizaje rápido', { id: 'mission-quick' }),
        goal: msg('Bajá 80 metros y posá el primer módulo en la plataforma.', {
          id: 'mission-quick-goal',
        }),
        facts: msg('Primer módulo · desde 80 m', { id: 'mission-quick-facts' }),
      };
    case 'orbit-landing':
      return {
        title: msg('Aterrizaje desde órbita', { id: 'mission-orbit' }),
        goal: msg('Desde una órbita de 100 km, frená, bajá y posate donde elijas en la Luna.', {
          id: 'mission-orbit-goal',
        }),
        facts: msg('Módulo de descenso · desde 100 km', { id: 'mission-orbit-facts' }),
      };
  }
}

/**
 * The mission picker: a card of missions, each a button that requests it. The
 * focused one (from the keyboard, or a gamepad through the host) is marked.
 */
export function missionPicker(
  missions: readonly MissionChoice[],
  focus: MissionId | '',
  onPick: (mission: MissionId) => void,
): TemplateResult {
  return html`<section class="card missions" aria-labelledby="missions-title">
    <h2 id="missions-title">${msg('Elegí una misión', { id: 'missions-title' })}</h2>
    <ul role="list">
      ${missions.map(({ id, preview }) => {
        const { title, goal, facts } = missionText(id);
        return html`<li>
          <button
            class="mission-choice ${focus === id ? 'focused' : ''}"
            data-mission=${id}
            @click=${() => onPick(id)}
          >
            <span class="mission-title">
              ${title}
              ${
                preview
                  ? html`<span class="preview"
                      >${msg('Vista previa', { id: 'mission-preview' })}</span
                    >`
                  : nothing
              }
            </span>
            <span class="mission-goal">${goal}</span>
            <span class="mission-facts">${facts}</span>
          </button>
        </li>`;
      })}
    </ul>
  </section>`;
}
