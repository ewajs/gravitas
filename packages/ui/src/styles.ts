import { css } from 'lit';

/**
 * The flight HUD's layout, instruments, and motion, after the shared tokens.
 *
 * Motion rules: controls respond in 130 ms with a small press; gauges ease to new
 * values in 200 ms on one curve; the results card rises in 280 ms with its rows
 * 50 ms apart; numbers never animate; only the phase dot loops, while flying.
 * Reduced motion turns all of it off.
 */
export const hudStyles = css`
  :host {
    --ease: cubic-bezier(0.2, 0.8, 0.2, 1);
    --control-radius: calc(var(--gravitas-radius) - 4px);
    --gap: 24px;
    display: block;
    position: absolute;
    inset: 0;
    pointer-events: none;
    font-variant-numeric: tabular-nums;
  }
  /* Solid panels: on request, or when the system asks for less transparency. */
  :host([reduce-transparency]) {
    --gravitas-panel: var(--gravitas-panel-solid);
    --gravitas-panel-strong: var(--gravitas-panel-solid);
    --gravitas-panel-filter: none;
  }
  @media (prefers-reduced-transparency: reduce) {
    :host {
      --gravitas-panel: var(--gravitas-panel-solid);
      --gravitas-panel-strong: var(--gravitas-panel-solid);
      --gravitas-panel-filter: none;
    }
  }

  /* Glass: every panel and control shares one surface treatment. */
  .identity,
  .mission,
  .panel,
  #phase,
  .notice,
  .warp-level,
  .status,
  .locale-error,
  #controls,
  .card,
  dialog,
  button,
  select,
  .button {
    background: var(--gravitas-panel);
    -webkit-backdrop-filter: var(--gravitas-panel-filter);
    backdrop-filter: var(--gravitas-panel-filter);
    border: 1px solid var(--gravitas-line);
  }
  .card,
  dialog {
    background: var(--gravitas-panel-strong);
  }

  /* Labels in the display face, small capitals with tracking. */
  dt,
  .gauge-label,
  .sink-labels,
  .hover-label,
  .totals dt,
  figcaption {
    font-family: var(--gravitas-font-display);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--gravitas-muted);
  }

  /* Controls */
  button,
  select,
  .button {
    min-height: 44px;
    border-radius: var(--control-radius);
    padding: 0 16px;
    color: var(--gravitas-text);
    font: 500 15px var(--gravitas-font-body);
    cursor: pointer;
    transition:
      background-color 130ms ease,
      border-color 130ms ease,
      color 130ms ease,
      transform 130ms ease;
  }
  select {
    padding-inline: 12px 8px;
  }
  .button {
    display: inline-flex;
    align-items: center;
    text-decoration: none;
  }
  button:hover,
  select:hover,
  .button:hover {
    border-color: color-mix(in srgb, var(--gravitas-accent) 60%, transparent);
    background: var(--gravitas-panel-strong);
  }
  button:active,
  .button:active {
    transform: scale(0.96);
  }
  button.icon {
    display: grid;
    place-items: center;
    inline-size: 44px;
    padding: 0;
  }
  button[aria-pressed='true'] {
    border-color: var(--gravitas-accent);
    color: var(--gravitas-accent);
  }
  .primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    border-color: var(--gravitas-accent);
    background: var(--gravitas-accent);
    color: var(--gravitas-accent-ink);
    font-weight: 600;
  }
  .primary:hover {
    border-color: var(--gravitas-accent-hover);
    background: var(--gravitas-accent-hover);
  }
  kbd {
    font: 600 12px var(--gravitas-font-display);
    color: var(--gravitas-text);
    padding: 2px 6px;
    border: 1px solid var(--gravitas-line);
    border-radius: 5px;
    background: var(--gravitas-track);
  }
  .primary kbd {
    color: inherit;
    border-color: transparent;
    background: color-mix(in srgb, var(--gravitas-accent-ink) 14%, transparent);
  }

  /* Header: identity and mission on the left, flight actions and view options right. */
  header {
    position: absolute;
    top: max(var(--gap), env(safe-area-inset-top));
    left: max(var(--gap), env(safe-area-inset-left));
    right: max(var(--gap), env(safe-area-inset-right));
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }
  .brand {
    display: flex;
    gap: 10px;
    margin-inline-end: auto;
    min-inline-size: 0;
  }
  .identity,
  .mission {
    display: flex;
    align-items: center;
    gap: 10px;
    block-size: 44px;
    padding: 0 18px;
    border-radius: var(--control-radius);
  }
  .identity {
    padding-inline-start: 14px;
  }
  /* The host's mark: the small cut beside the name, a larger one on the start card. */
  ::slotted([slot='mark']) {
    display: block;
    inline-size: 22px;
    block-size: 22px;
    flex: none;
  }
  .lockup {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--gravitas-line);
  }
  ::slotted([slot='mark-large']) {
    display: block;
    inline-size: 34px;
    block-size: 34px;
    flex: none;
  }
  .wordmark {
    font: 600 18px var(--gravitas-font-display);
    letter-spacing: 0.22em;
    text-transform: uppercase;
  }
  h1 {
    font: 600 14px var(--gravitas-font-display);
    letter-spacing: 0.22em;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .mission {
    margin: 0;
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
  }
  .dot {
    inline-size: 8px;
    block-size: 8px;
    border-radius: 50%;
    background: var(--gravitas-accent);
  }
  .dot.paused,
  .dot.complete {
    background: var(--gravitas-muted);
  }
  /* The one loop: a quiet breath while the flight runs. */
  .dot.flying {
    animation: breathe 2s ease-in-out infinite;
  }
  nav,
  .actions {
    display: flex;
    gap: 8px;
    pointer-events: auto;
  }
  header .actions {
    padding-inline-end: 8px;
    border-inline-end: 1px solid var(--gravitas-line);
  }
  /* Time warp: slower, the factor, faster, joined into one control. */
  .warp {
    display: flex;
    align-items: stretch;
  }
  .warp button.icon {
    inline-size: 36px;
  }
  .warp button:first-child {
    border-start-end-radius: 0;
    border-end-end-radius: 0;
  }
  .warp button:last-child {
    border-start-start-radius: 0;
    border-end-start-radius: 0;
  }
  .warp button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .warp-level {
    display: grid;
    place-items: center;
    min-inline-size: 58px;
    padding: 0 6px;
    border-block: 1px solid var(--gravitas-line);
    font: 600 14px var(--gravitas-font-display);
    font-variant-numeric: tabular-nums;
  }

  /* Phase, start card, and Start: a column below the header. */
  .overlay {
    position: absolute;
    top: calc(max(var(--gap), env(safe-area-inset-top)) + 64px);
    left: max(var(--gap), env(safe-area-inset-left));
    right: max(var(--gap), env(safe-area-inset-right));
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  #phase,
  .status {
    margin: 0;
    padding: 10px 18px;
    border-radius: var(--control-radius);
    font-size: 14px;
    font-weight: 500;
    text-align: center;
  }
  .status {
    position: absolute;
    top: 40%;
    left: var(--gap);
    right: var(--gap);
    width: fit-content;
    max-width: min(520px, calc(100% - 48px));
    margin: 0 auto;
    padding: 16px 20px;
  }
  /* A transient explanation from the host (a refused warp), under the phase line. */
  .notice {
    margin: 0;
    padding: 8px 16px;
    border-radius: var(--control-radius);
    border: 1px solid color-mix(in srgb, var(--gravitas-warn) 55%, transparent);
    font-size: 13px;
    text-align: center;
    animation: fade 200ms ease-out both;
  }
  /* After a verdict the region only speaks; the results card shows the title. */
  #phase.sr,
  .sr {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    padding: 0;
    border: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .overlay .actions button {
    min-inline-size: 160px;
  }
  .card {
    pointer-events: auto;
    width: min(440px, 100%);
    padding: 20px 22px;
    border-radius: calc(var(--gravitas-radius) + 4px);
  }
  .card h2 {
    font: 600 18px var(--gravitas-font-display);
    margin-bottom: 12px;
  }
  .quick-keys {
    display: grid;
    /* minmax(0, …): the descriptions wrap in a narrow card instead of widening it. */
    grid-template-columns: auto minmax(0, 1fr);
    gap: 8px 16px;
    align-items: center;
    margin: 0 0 12px;
  }
  .quick-keys dt {
    letter-spacing: 0;
    text-transform: none;
    white-space: nowrap;
  }
  kbd .icon {
    display: inline-block;
    vertical-align: -2px;
  }
  .quick-keys dd {
    margin: 0;
    font-size: 14px;
    white-space: normal;
  }
  .goal {
    font-size: 13px;
    color: var(--gravitas-muted);
  }
  .locale-error {
    position: absolute;
    top: calc(max(var(--gap), env(safe-area-inset-top)) + 56px);
    right: var(--gap);
    left: var(--gap);
    padding: 12px 16px;
    border-radius: var(--control-radius);
    border-color: var(--gravitas-bad);
  }

  /* Instruments: two panels at the bottom corners. */
  .instruments {
    position: absolute;
    bottom: max(var(--gap), env(safe-area-inset-bottom));
    left: max(var(--gap), env(safe-area-inset-left));
    right: max(var(--gap), env(safe-area-inset-right));
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 16px;
  }
  .panel {
    border-radius: var(--gravitas-radius);
    padding: 18px 22px;
  }
  dl {
    margin: 0;
  }
  dd {
    margin: 4px 0 0;
    font-weight: 600;
    line-height: 1.1;
    white-space: nowrap;
  }
  .unit {
    margin-inline-start: 2px;
    font-size: 12px;
    font-weight: 500;
    color: var(--gravitas-muted);
  }
  .flight-panel {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-inline-size: 400px;
  }
  .headline,
  .details {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  .details {
    grid-template-columns: 1fr 1fr 1fr;
    gap: 16px;
    padding-top: 14px;
    border-top: 1px solid var(--gravitas-line);
  }
  dl.headline dd {
    font-size: 40px;
    letter-spacing: -0.02em;
  }
  dl.headline .unit {
    font-size: 16px;
    letter-spacing: 0;
  }
  .details dd,
  .pad-readout dd {
    font-size: 20px;
  }
  .too-fast dd {
    color: var(--gravitas-warn);
  }
  .caution {
    display: inline-flex;
    vertical-align: -2px;
    margin-inline-start: 4px;
    color: var(--gravitas-warn);
  }

  /* Gauges: levels arrive as --level and --hover in [0, 1] and ease between snapshots. */
  .bar {
    position: relative;
    display: block;
    block-size: 6px;
    border-radius: 3px;
    background: var(--gravitas-track);
  }
  .fill {
    position: absolute;
    inset-block: 0;
    inset-inline-start: 0;
    inline-size: calc(var(--level) * 100%);
    border-radius: inherit;
    background: var(--gravitas-accent);
    transition: inline-size 200ms var(--ease);
  }

  .sink {
    display: grid;
    gap: 4px;
  }
  .sink-track {
    position: relative;
    block-size: 12px;
  }
  .sink-track::before {
    content: '';
    position: absolute;
    inset-inline: 0;
    top: 5px;
    block-size: 2px;
    border-radius: 1px;
    background: var(--gravitas-track);
  }
  .safe {
    position: absolute;
    inset-block: 1px;
    inset-inline-start: 0;
    inline-size: calc(var(--safe) * 100%);
    border-inline: 1px solid var(--gravitas-good);
    background: color-mix(in srgb, var(--gravitas-good) 20%, transparent);
    transition: inline-size 200ms var(--ease);
  }
  .tick {
    position: absolute;
    inset-block: -1px;
    inset-inline-start: calc(var(--sink) * 100%);
    inline-size: 3px;
    margin-inline-start: -1.5px;
    border-radius: 2px;
    background: var(--gravitas-text);
    transition: inset-inline-start 200ms var(--ease);
  }
  .sink.too-fast .tick {
    background: var(--gravitas-warn);
  }
  .sink-labels {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    letter-spacing: 0.1em;
  }

  .navigation-panel {
    display: flex;
    align-items: stretch;
    gap: 22px;
  }
  .navigation {
    display: grid;
    gap: 10px;
    justify-items: center;
  }
  .pad-readout,
  .orbit-readout {
    justify-self: stretch;
  }
  .orbit-readout {
    display: grid;
    gap: 6px;
    margin: 0;
  }
  .orbit-readout dd {
    margin: 0;
    font-size: 16px;
  }
  .orbit-readout .time {
    color: var(--gravitas-muted);
    font-size: 13px;
  }
  figure {
    margin: 0;
    display: grid;
    justify-items: center;
    gap: 8px;
  }
  .radar {
    inline-size: 168px;
    block-size: 168px;
    overflow: visible;
  }
  .radar .face {
    fill: var(--gravitas-well);
    stroke: var(--gravitas-line);
  }
  .radar .ring {
    fill: none;
    stroke: var(--gravitas-track);
  }
  .radar .cross {
    stroke: var(--gravitas-track);
  }
  .radar .forward {
    fill: var(--gravitas-muted);
  }
  .radar .lean {
    fill: var(--gravitas-text);
    stroke: var(--gravitas-panel-solid);
    stroke-width: 1.5;
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
    fill: var(--gravitas-accent);
    stroke: var(--gravitas-accent);
    stroke-width: 1.5;
  }
  .radar .pad.far {
    fill: none;
  }
  .radar .lean,
  .radar .pad {
    transition: transform 200ms var(--ease);
  }
  figcaption {
    display: flex;
    gap: 10px;
    font-size: 10px;
    letter-spacing: 0.08em;
  }
  .swatch {
    display: inline-block;
    inline-size: 8px;
    block-size: 8px;
    margin-inline-end: 5px;
    vertical-align: 0;
  }
  .swatch.lean {
    border-radius: 50%;
    background: var(--gravitas-text);
  }
  .swatch.drift {
    block-size: 2px;
    inline-size: 10px;
    vertical-align: 3px;
    background: var(--gravitas-focus);
  }
  .swatch.pad {
    transform: rotate(45deg) scale(0.8);
    background: var(--gravitas-accent);
  }

  /* Throttle: a vertical gauge beside the radar, with the hover mark. */
  .throttle {
    display: grid;
    grid-template-rows: auto 1fr auto;
    justify-items: center;
    gap: 10px;
  }
  .throttle .bar {
    inline-size: 14px;
    block-size: auto;
    min-block-size: 140px;
    border-radius: 7px;
  }
  .throttle .fill {
    inset-block: auto 0;
    inset-inline: 0;
    inline-size: auto;
    block-size: calc(var(--level) * 100%);
    transition: block-size 200ms var(--ease);
  }
  .hover-mark {
    position: absolute;
    inset-inline-start: -7px;
    inset-block-end: calc(var(--hover) * 100%);
    inline-size: 28px;
    block-size: 2px;
    margin-block-end: -1px;
    border-radius: 1px;
    background: var(--gravitas-text);
    transition: inset-block-end 200ms var(--ease);
  }
  /* Left of the mark, toward the radar, so it never leaves the panel. */
  .hover-label {
    position: absolute;
    inset-inline-end: calc(100% + 4px);
    top: -6px;
    font-size: 9px;
    letter-spacing: 0.12em;
  }
  .gauge-value {
    font-size: 15px;
    font-weight: 600;
    min-inline-size: 4ch;
    text-align: center;
  }
  /* Inter's tabular figures give the minus a figure-wide box; keep it snug. */
  .sign {
    font-variant-numeric: normal;
    margin-inline-end: 0.04em;
  }
  .sink-labels .scale-unit {
    text-transform: none;
  }

  /* Key hints, where there is room between the panels. */
  #controls {
    display: none;
    position: absolute;
    bottom: max(var(--gap), env(safe-area-inset-bottom));
    left: 50%;
    transform: translateX(-50%);
    max-inline-size: 360px;
    margin: 0;
    padding: 8px 14px;
    border-radius: var(--control-radius);
    font-size: 12px;
    text-align: center;
    color: var(--gravitas-muted);
  }
  @media (min-width: 1240px) {
    #controls {
      display: block;
    }
  }

  /* Results: the scene dims and the card rises into the middle. */
  .results {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    padding: max(var(--gap), env(safe-area-inset-top)) max(var(--gap), env(safe-area-inset-right))
      max(var(--gap), env(safe-area-inset-bottom)) max(var(--gap), env(safe-area-inset-left));
    background: var(--gravitas-backdrop);
    animation: fade 240ms ease-out both;
  }
  /* Missions: the picker over the dimmed scene, one button per mission. */
  .missions {
    display: flex;
    flex-direction: column;
    gap: 14px;
    width: min(480px, 100%);
    max-block-size: 100%;
    overflow-y: auto;
    background: var(--gravitas-track);
  }
  .missions h2 {
    margin: 0;
  }
  .missions ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 10px;
  }
  button.mission-choice {
    display: grid;
    gap: 4px;
    inline-size: 100%;
    min-height: 0;
    padding: 14px 16px;
    border-radius: var(--gravitas-radius);
    text-align: start;
  }
  button.mission-choice.focused,
  button.mission-choice:hover {
    border-color: var(--gravitas-accent);
  }
  .mission-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font: 600 16px var(--gravitas-font-display);
  }
  .mission-goal {
    font-size: 14px;
    white-space: normal;
  }
  .mission-facts {
    font-size: 12px;
    color: var(--gravitas-muted);
  }
  .preview {
    padding: 2px 8px;
    border: 1px solid var(--gravitas-warn);
    border-radius: 999px;
    color: var(--gravitas-warn);
    font: 500 10px var(--gravitas-font-display);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .report {
    display: flex;
    flex-direction: column;
    gap: 18px;
    width: min(468px, 100%);
    max-block-size: 100%;
    overflow-y: auto;
    padding: 26px 28px;
    animation: rise 280ms var(--ease) both;
  }
  .verdict {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .badge {
    flex: none;
    display: grid;
    place-items: center;
    inline-size: 44px;
    block-size: 44px;
    border-radius: 50%;
    border: 2px solid currentColor;
  }
  .report.good .badge {
    color: var(--gravitas-good);
  }
  .report.warn .badge {
    color: var(--gravitas-warn);
  }
  .report.bad .badge {
    color: var(--gravitas-bad);
  }
  .report h2 {
    margin: 0 0 4px;
    font-size: 24px;
    letter-spacing: -0.01em;
  }
  .summary {
    font-size: 14px;
    color: var(--gravitas-muted);
  }
  .checks {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .checks li {
    display: grid;
    grid-template-columns: 24px 1fr auto;
    align-items: center;
    gap: 12px;
    padding: 10px 0;
    border-top: 1px solid var(--gravitas-line);
    font-size: 14px;
    animation: rise 280ms var(--ease) both;
    animation-delay: calc(80ms + var(--row) * 50ms);
  }
  .mark {
    display: grid;
    place-items: center;
  }
  .pass .mark {
    color: var(--gravitas-good);
  }
  .fail .mark,
  .fail .value {
    color: var(--gravitas-bad);
  }
  .result {
    display: grid;
    justify-items: end;
    gap: 2px;
  }
  .value {
    font-weight: 600;
  }
  .limit {
    font-size: 12px;
    color: var(--gravitas-muted);
  }
  .totals {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    animation: rise 280ms var(--ease) both;
    animation-delay: calc(80ms + var(--row) * 50ms);
  }
  .totals div {
    padding: 12px 14px;
    border-radius: 12px;
    background: var(--gravitas-track);
  }
  .totals dd {
    font-size: 18px;
  }
  /* Try again, Missions, and the manual: one row even on the narrowest phone. */
  .card-actions {
    display: flex;
    gap: 10px;
  }
  .card-actions button,
  .card-actions .button {
    padding-inline: 12px;
  }
  .card-actions .primary {
    flex: 1;
  }

  /* Help */
  dialog {
    pointer-events: auto;
    color: inherit;
    border-radius: calc(var(--gravitas-radius) + 4px);
    width: min(500px, calc(100% - 32px));
    max-height: calc(100svh - 32px);
    padding: 24px;
  }
  dialog::backdrop {
    background: var(--gravitas-backdrop);
  }
  .dialog-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }
  h2 {
    font: 600 20px var(--gravitas-font-display);
  }
  h3 {
    margin: 0 0 8px;
    font: 600 15px var(--gravitas-font-display);
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
    align-items: baseline;
  }
  .help-list dd,
  .help-list dt {
    font: inherit;
    letter-spacing: normal;
    text-transform: none;
    margin: 0;
    white-space: normal;
  }
  .help-list dt {
    color: var(--gravitas-muted);
  }
  .help-list dd {
    font-weight: 400;
  }
  .manual a {
    color: var(--gravitas-focus);
  }
  .about,
  .display {
    border-top: 1px solid var(--gravitas-line);
    padding-top: 16px;
    margin-top: 16px;
    font-size: 13px;
    color: var(--gravitas-muted);
  }
  .display h3 {
    color: var(--gravitas-text);
  }
  .toggle {
    display: flex;
    align-items: center;
    gap: 12px;
    min-block-size: 44px;
    font-size: 14px;
    color: var(--gravitas-text);
    cursor: pointer;
  }
  .setting {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 12px;
    font-size: 14px;
    color: var(--gravitas-text);
  }
  .toggle input {
    inline-size: 20px;
    block-size: 20px;
    margin: 0;
    accent-color: var(--gravitas-accent);
    cursor: pointer;
  }

  @keyframes breathe {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.35;
    }
  }
  @keyframes fade {
    from {
      opacity: 0;
    }
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(10px) scale(0.985);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation: none !important;
      transition: none !important;
    }
  }

  /* Narrow screens: one combined instrument panel; the flight keeps the header to itself. */
  @media (max-width: 700px) {
    :host {
      --gap: 16px;
    }
    header {
      gap: 6px;
    }
    .mission,
    header.underway .brand {
      display: none;
    }
    nav,
    .actions {
      gap: 6px;
    }
    header .actions {
      margin-inline-start: auto;
      padding-inline-end: 6px;
    }
    .overlay {
      top: calc(max(var(--gap), env(safe-area-inset-top)) + 56px);
      gap: 8px;
    }
    #phase {
      font-size: 13px;
      padding: 8px 14px;
    }
    .card {
      padding: 14px 16px;
    }
    /* The header already shows the mark and name; keep the card short. */
    .goal,
    .lockup,
    #controls {
      display: none;
    }
    .instruments {
      flex-direction: column;
      align-items: stretch;
      gap: 10px;
      padding: 12px 14px;
      border-radius: var(--gravitas-radius);
      background: var(--gravitas-panel);
      -webkit-backdrop-filter: var(--gravitas-panel-filter);
      backdrop-filter: var(--gravitas-panel-filter);
      border: 1px solid var(--gravitas-line);
    }
    .instruments .panel {
      padding: 0;
      border: 0;
      border-radius: 0;
      background: none;
      -webkit-backdrop-filter: none;
      backdrop-filter: none;
    }
    .flight-panel {
      min-inline-size: 0;
      gap: 8px;
    }
    dl.headline dd {
      font-size: 26px;
    }
    dl.headline .unit {
      font-size: 13px;
    }
    .details {
      padding-top: 8px;
      gap: 10px;
    }
    .details dd,
    .pad-readout dd {
      font-size: 16px;
    }
    dt {
      font-size: 10px;
      letter-spacing: 0.1em;
    }
    .navigation-panel {
      display: grid;
      grid-template-columns: auto 1fr;
      align-items: center;
      gap: 6px 16px;
    }
    .navigation {
      display: contents;
    }
    figure {
      grid-row: 1 / 3;
    }
    .radar {
      inline-size: 88px;
      block-size: 88px;
    }
    figcaption {
      display: none;
    }
    .pad-readout {
      align-self: end;
    }
    /* The throttle lies flat beside the radar. */
    .throttle {
      grid-template-columns: auto 1fr auto;
      grid-template-rows: none;
      justify-items: stretch;
      align-items: center;
      gap: 10px;
      align-self: start;
    }
    .throttle .bar {
      inline-size: auto;
      block-size: 8px;
      min-block-size: 0;
      border-radius: 4px;
    }
    .throttle .fill {
      inset-block: 0;
      inset-inline: 0 auto;
      block-size: auto;
      inline-size: calc(var(--level) * 100%);
      transition: inline-size 200ms var(--ease);
    }
    .hover-mark {
      inset-block: -4px;
      inset-inline-start: calc(var(--hover) * 100%);
      inline-size: 2px;
      block-size: auto;
      margin: 0 0 0 -1px;
      transition: inset-inline-start 200ms var(--ease);
    }
    .hover-label {
      display: none;
    }

    .report {
      padding: 18px;
      gap: 14px;
    }
  }

  /* Short landscape screens (phones on their side): tighter spacing, the start
     card without the instruments behind it, and a two-column results card. */
  @media (max-height: 500px) {
    :host {
      --gap: 12px;
    }
    .overlay {
      top: calc(max(var(--gap), env(safe-area-inset-top)) + 52px);
      gap: 8px;
    }
    /* Before the first start, the card explains; the opening readouts can wait. */
    .instruments.behind-card {
      display: none;
    }
    .card {
      padding: 12px 18px;
    }
    .card h2 {
      margin-bottom: 8px;
    }
    .quick-keys {
      gap: 6px 14px;
      margin-bottom: 8px;
    }
    #phase {
      padding: 8px 14px;
      font-size: 13px;
    }
    .mission {
      display: none;
    }
    .panel {
      padding: 12px 16px;
    }
    .flight-panel {
      gap: 8px;
      min-inline-size: 340px;
    }
    dl.headline dd {
      font-size: 28px;
    }
    .details {
      padding-top: 8px;
    }
    .radar {
      inline-size: 112px;
      block-size: 112px;
    }
    .throttle .bar {
      min-block-size: 90px;
    }
    figcaption,
    .sink-labels,
    .lockup,
    #controls {
      display: none;
    }
    .report {
      padding: 16px 20px;
      gap: 12px;
    }
  }
  @media (max-height: 500px) and (min-width: 600px) {
    .report {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
      grid-template-areas:
        'verdict checks'
        'totals checks'
        'actions checks';
      align-content: start;
      column-gap: 22px;
      width: min(760px, 100%);
    }
    .verdict {
      grid-area: verdict;
    }
    .checks {
      grid-area: checks;
      align-self: start;
    }
    .totals {
      grid-area: totals;
    }
    .card-actions {
      grid-area: actions;
      align-self: end;
    }
    .checks li {
      padding: 8px 0;
    }
    .report h2 {
      font-size: 20px;
    }
  }

  /* Touch controls showing on a tablet or larger screen: the lower part of each
     side belongs to a thumb, so the readouts become one strip along the top, the
     radar sits between the thumbs, and the throttle gauge gives way to the lever.
     Landscape phones use the corner layout further down instead. */
  @media (min-height: 501px), (orientation: portrait) {
    :host([touch-controls]) {
      --gap: 12px;
    }
    :host([touch-controls]) header .brand,
    :host([touch-controls]) #controls,
    :host([touch-controls]) .throttle,
    :host([touch-controls]) figcaption,
    :host([touch-controls]) .sink,
    :host([touch-controls]) .bar.fuel {
      display: none;
    }
    :host([touch-controls]) header .actions {
      margin-inline-start: auto;
    }
    :host([touch-controls]) .instruments {
      position: static;
      display: block;
      padding: 0;
      border: 0;
      background: none;
      -webkit-backdrop-filter: none;
      backdrop-filter: none;
    }
    :host([touch-controls]) .instruments .panel {
      position: absolute;
      border: 1px solid var(--gravitas-line);
      border-radius: var(--gravitas-radius);
      background: var(--gravitas-panel);
      -webkit-backdrop-filter: var(--gravitas-panel-filter);
      backdrop-filter: var(--gravitas-panel-filter);
    }
    :host([touch-controls]) .flight-panel {
      top: max(var(--gap), env(safe-area-inset-top));
      left: max(var(--gap), env(safe-area-inset-left));
      /* Room for the five icon buttons on the right of the header. */
      right: auto;
      inline-size: max-content;
      max-inline-size: calc(
        100% - max(var(--gap), env(safe-area-inset-left)) - max(
            var(--gap),
            env(safe-area-inset-right)
          ) -
          284px
      );
      min-inline-size: 0;
      flex-direction: row;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px 14px;
      padding: 6px 14px;
    }
    :host([touch-controls]) .headline,
    :host([touch-controls]) .details {
      display: flex;
      gap: 14px;
      padding: 0;
      border: 0;
    }
    :host([touch-controls]) .details {
      padding-inline-start: 14px;
      border-inline-start: 1px solid var(--gravitas-line);
    }
    :host([touch-controls]) .instruments dt {
      font-size: 9px;
      letter-spacing: 0.06em;
      white-space: nowrap;
    }
    :host([touch-controls]) .instruments dd {
      margin-top: 1px;
    }
    :host([touch-controls]) dl.headline dd {
      font-size: 22px;
    }
    :host([touch-controls]) dl.headline .unit,
    :host([touch-controls]) .instruments .unit {
      font-size: 11px;
    }
    :host([touch-controls]) .details dd,
    :host([touch-controls]) .pad-readout dd {
      font-size: 15px;
    }
    :host([touch-controls]) .navigation-panel {
      bottom: max(var(--gap), env(safe-area-inset-bottom));
      /* Centred between the thumb zones of the touch controls. */
      left: min(32%, 240px);
      right: min(46%, 400px);
      inline-size: fit-content;
      margin-inline: auto;
      padding: 8px 12px;
    }
    :host([touch-controls]) .navigation {
      display: grid;
      gap: 4px;
    }
    :host([touch-controls]) .radar {
      inline-size: 92px;
      block-size: 92px;
    }
    :host([touch-controls]) .overlay {
      top: calc(max(var(--gap), env(safe-area-inset-top)) + 64px);
    }
  }

  /* The phone menu (⋯): hidden on larger screens; on phones it replaces the view
     options. Its popover sits in the top layer below the ⋯ button. */
  header .menu-toggle,
  .turn-hint,
  .short {
    display: none;
  }
  header .menu-toggle,
  .menu {
    pointer-events: auto;
  }
  .menu {
    position: fixed;
    inset: auto;
    top: calc(var(--phone-top, 10px) + 46px);
    right: var(--phone-right, 10px);
    margin: 0;
    padding: 6px;
    min-inline-size: 196px;
    max-block-size: calc(100% - var(--phone-top, 10px) - 56px);
    overflow-y: auto;
    border-radius: 14px;
    color: var(--gravitas-text);
    background: var(--gravitas-panel-strong);
    -webkit-backdrop-filter: var(--gravitas-panel-filter);
    backdrop-filter: var(--gravitas-panel-filter);
    border: 1px solid var(--gravitas-line);
    animation: fade 130ms ease-out both;
  }
  .menu:popover-open {
    display: grid;
    gap: 2px;
  }
  .menu-item {
    display: flex;
    align-items: center;
    gap: 12px;
    inline-size: 100%;
    min-height: 44px;
    padding: 0 12px;
    border-color: transparent;
    border-radius: 10px;
    background: none;
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
    font: 500 15px var(--gravitas-font-body);
    text-align: start;
  }
  label.menu-item {
    justify-content: space-between;
    cursor: default;
  }
  .menu-item select {
    min-height: 36px;
  }
  .menu-item[aria-pressed='true'] {
    border-color: transparent;
  }
  button.menu-item:hover {
    border-color: transparent;
    background: var(--gravitas-track);
  }

  /* Phones on their side with the touch layout ("corner chips"): the centre, from
     the lander down to the pad, stays clear. One readout card top left, pause and
     ⋯ top right, the radar card under them; the touch controls (their own element)
     put the yaw buttons left of the radar, the lever on the left edge, and the
     stick bottom right. The same layout holds before the start and behind the
     results card. In Safari the browser insets the page; installed, the safe-area
     insets keep the notch and home indicator clear. */
  @media (max-height: 500px) and (orientation: landscape) {
    :host([touch-layout]) {
      --phone-top: calc(env(safe-area-inset-top) + 10px);
      --phone-left: calc(env(safe-area-inset-left) + 10px);
      --phone-right: calc(env(safe-area-inset-right) + 10px);
      --phone-bottom: max(10px, env(safe-area-inset-bottom));
    }
    :host([touch-layout]) header {
      top: var(--phone-top);
      left: var(--phone-left);
      right: var(--phone-right);
      justify-content: flex-end;
      gap: 6px;
    }
    :host([touch-layout]) header .brand,
    :host([touch-layout]) header nav,
    :host([touch-layout]) header .restart,
    :host([touch-layout]) header .view,
    :host([touch-layout]) .orbit-readout .secondary,
    :host([touch-layout]) .orbit-readout .time,
    :host([touch-layout]) #controls,
    :host([touch-layout]) .instruments .throttle,
    :host([touch-layout]) .instruments figcaption,
    :host([touch-layout]) .instruments .sink-labels,
    :host([touch-layout]) .instruments .bar.fuel {
      display: none;
    }
    :host([touch-layout]) header .actions {
      margin-inline-start: auto;
      padding: 0;
      border: 0;
    }
    :host([touch-layout]) header .menu-toggle {
      display: grid;
    }
    :host([touch-layout]) header button.icon {
      inline-size: 40px;
      min-height: 40px;
      block-size: 40px;
      border-radius: 12px;
    }

    /* Phase line and Start in the top band between the corner chips; the start
       card, which hides the readouts behind it, may use the width. */
    :host([touch-layout]) .overlay {
      top: var(--phone-top);
      left: calc(var(--phone-left) + 232px);
      right: calc(var(--phone-right) + 232px);
      gap: 8px;
    }
    :host([touch-layout]) .overlay.with-card {
      left: calc(var(--phone-left) + 50px);
      right: calc(var(--phone-right) + 50px);
    }
    :host([touch-layout]) #phase {
      padding: 8px 14px;
      font-size: 13px;
      white-space: nowrap;
    }
    /* Start says it; the live region still announces "ready". */
    :host([touch-layout]) #phase.ready {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      padding: 0;
      border: 0;
      overflow: hidden;
      clip-path: inset(50%);
    }
    :host([touch-layout]) .overlay .actions button {
      min-height: 40px;
    }

    :host([touch-layout]) .instruments {
      position: static;
      display: block;
      padding: 0;
      border: 0;
      background: none;
      -webkit-backdrop-filter: none;
      backdrop-filter: none;
    }
    :host([touch-layout]) .instruments.behind-card {
      display: none;
    }
    :host([touch-layout]) .instruments .panel {
      position: absolute;
      border: 1px solid var(--gravitas-line);
      border-radius: 14px;
      background: var(--gravitas-panel);
      -webkit-backdrop-filter: var(--gravitas-panel-filter);
      backdrop-filter: var(--gravitas-panel-filter);
    }

    /* The readout card: altitude and vertical speed large, the safe-sink bar,
       then one short line. Never wider than its content, never wrapping. */
    :host([touch-layout]) .flight-panel {
      top: var(--phone-top);
      left: var(--phone-left);
      inline-size: max-content;
      min-inline-size: 0;
      max-inline-size: none;
      flex-direction: column;
      flex-wrap: nowrap;
      gap: 5px;
      padding: 8px 14px 9px;
      white-space: nowrap;
    }
    :host([touch-layout]) .headline,
    :host([touch-layout]) .details {
      display: flex;
      gap: 18px;
      padding: 0;
      border: 0;
    }
    :host([touch-layout]) .instruments dt {
      font-size: 9px;
      letter-spacing: 0.12em;
      line-height: 1.3;
      white-space: nowrap;
    }
    :host([touch-layout]) .instruments dd {
      margin-top: 1px;
    }
    :host([touch-layout]) dl.headline dd {
      font-size: 22px;
      line-height: 1;
    }
    :host([touch-layout]) .instruments .unit {
      font-size: 11px;
    }
    :host([touch-layout]) .caution svg {
      inline-size: 11px;
      block-size: 11px;
    }
    :host([touch-layout]) .sink {
      display: block;
    }
    :host([touch-layout]) .sink-track {
      display: block;
      block-size: 9px;
    }
    :host([touch-layout]) .sink-track::before {
      top: 3px;
      block-size: 3px;
      border-radius: 2px;
    }
    :host([touch-layout]) .safe {
      inset-block: 3px;
      border-inline-width: 0;
      border-radius: 2px;
    }
    :host([touch-layout]) .tick {
      inset-block: 0;
      inline-size: 2px;
      margin-inline-start: -1px;
    }
    :host([touch-layout]) .details {
      gap: 12px;
    }
    :host([touch-layout]) .details > div {
      display: flex;
      align-items: baseline;
      gap: 4px;
    }
    :host([touch-layout]) .details dd {
      margin: 0;
      font-size: 12px;
      font-weight: 500;
    }
    :host([touch-layout]) .long {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }
    :host([touch-layout]) .short {
      display: inline;
    }

    /* The radar card, under the top-right buttons, with the pad distance. */
    :host([touch-layout]) .navigation-panel {
      top: calc(var(--phone-top) + 48px);
      right: var(--phone-right);
      left: auto;
      bottom: auto;
      inline-size: 86px;
      display: block;
      padding: 6px 6px 5px;
    }
    :host([touch-layout]) .navigation {
      display: grid;
      gap: 2px;
      justify-items: center;
    }
    :host([touch-layout]) .radar {
      inline-size: 72px;
      block-size: 72px;
    }
    :host([touch-layout]) .pad-readout {
      text-align: center;
    }
    :host([touch-layout]) .pad-readout dt {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }
    :host([touch-layout]) .pad-readout dd {
      margin: 0;
      font-size: 11px;
      font-weight: 500;
    }
    :host([touch-layout]) .pad-readout .unit {
      font-size: 11px;
    }
    /* Around a body the radar card shows Ap and Pe on two short lines. */
    :host([touch-layout]) .orbit-readout {
      gap: 0;
      text-align: center;
    }
    :host([touch-layout]) .orbit-readout > div {
      display: flex;
      justify-content: center;
      align-items: baseline;
      gap: 3px;
    }
    :host([touch-layout]) .orbit-readout dd,
    :host([touch-layout]) .orbit-readout .unit {
      font-size: 11px;
      font-weight: 500;
    }
    :host([touch-layout]) .warp button.icon {
      inline-size: 34px;
    }
    :host([touch-layout]) .warp-level {
      min-inline-size: 46px;
      font-size: 12px;
    }
    :host([touch-layout]) .notice {
      white-space: normal;
      font-size: 12px;
      padding: 6px 12px;
    }
  }

  /* Phones upright with the touch layout, before a flight or after it: a slim
     header (mark and name, ⋯), "How to fly" that wraps, a hint to turn the phone,
     and Start. No instruments: they return in landscape. */
  @media (max-width: 500px) and (orientation: portrait) {
    :host([touch-layout]) {
      --phone-top: calc(env(safe-area-inset-top) + 12px);
      --phone-left: calc(env(safe-area-inset-left) + 16px);
      --phone-right: calc(env(safe-area-inset-right) + 16px);
    }
    :host([touch-layout]) header {
      top: var(--phone-top);
      left: var(--phone-left);
      right: var(--phone-right);
      align-items: center;
      gap: 6px;
    }
    :host([touch-layout]) header nav,
    :host([touch-layout]) header .restart,
    :host([touch-layout]) .instruments {
      display: none;
    }
    :host([touch-layout]) header .actions {
      margin-inline-start: auto;
      padding: 0;
      border: 0;
    }
    :host([touch-layout]) header .menu-toggle {
      display: grid;
    }
    :host([touch-layout]) header button.icon {
      inline-size: 40px;
      min-height: 40px;
      block-size: 40px;
      border-radius: 12px;
    }
    :host([touch-layout]) .identity {
      block-size: 40px;
      gap: 8px;
      padding: 0 14px 0 10px;
      border-radius: 12px;
    }
    :host([touch-layout]) h1 {
      font-size: 13px;
    }
    :host([touch-layout]) ::slotted([slot='mark']) {
      inline-size: 20px;
      block-size: 20px;
    }
    :host([touch-layout]) .overlay {
      top: calc(var(--phone-top) + 60px);
      left: var(--phone-left);
      right: var(--phone-right);
      gap: 12px;
    }
    :host([touch-layout]) #phase.ready {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      padding: 0;
      border: 0;
      overflow: hidden;
      clip-path: inset(50%);
    }
    :host([touch-layout]) .card {
      width: 100%;
      padding: 18px;
      border-radius: 18px;
    }
    :host([touch-layout]) .quick-keys {
      gap: 10px 12px;
    }
    :host([touch-layout]) .goal {
      display: block;
    }
    :host([touch-layout]) .turn-hint {
      display: flex;
      align-items: center;
      gap: 12px;
      inline-size: 100%;
      margin: 0;
      padding: 12px 14px;
      border-radius: 14px;
      background: var(--gravitas-panel);
      -webkit-backdrop-filter: var(--gravitas-panel-filter);
      backdrop-filter: var(--gravitas-panel-filter);
      border: 1px solid var(--gravitas-line);
      font-size: 14px;
    }
    :host([touch-layout]) .turn-hint .icon {
      flex: none;
      color: var(--gravitas-accent);
    }
    :host([touch-layout]) .overlay .actions button {
      min-inline-size: 220px;
      min-height: 50px;
      border-radius: 14px;
      font-size: 17px;
    }
  }

  /* Portrait during a flight on a phone: ask for landscape over a dimmed scene,
     keeping the header (language, sound, Help) usable. */
  .rotate {
    position: absolute;
    inset: calc(max(var(--gap), env(safe-area-inset-top)) + 56px) 0 0;
    display: grid;
    place-items: center;
    padding: var(--gap);
    background: var(--gravitas-backdrop);
    pointer-events: auto;
    animation: fade 200ms ease-out both;
  }
  .rotate .card {
    display: grid;
    justify-items: center;
    gap: 10px;
    max-inline-size: 320px;
    text-align: center;
  }
  .rotate .icon {
    color: var(--gravitas-accent);
  }
  .rotate h2 {
    margin: 0;
  }
  .rotate p {
    font-size: 14px;
    color: var(--gravitas-muted);
  }
`;
