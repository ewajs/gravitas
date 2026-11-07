import { css } from 'lit';

/** The flight HUD's layout and instrument styles, after the shared tokens. */
export const hudStyles = css`
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
  nav,
  .actions {
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
    display: grid;
    grid-template-columns: auto auto;
    align-items: center;
    gap: 20px;
    background: var(--gravitas-panel);
    border: 1px solid var(--gravitas-line);
    border-radius: var(--gravitas-radius);
    padding: 14px 20px;
  }
  .readouts {
    display: grid;
    grid-template-columns: repeat(3, auto);
    gap: 10px 28px;
    margin: 0;
  }
  .primary dd {
    font-size: 30px;
  }
  figure {
    margin: 0;
    display: grid;
    justify-items: center;
    gap: 6px;
  }
  .radar {
    inline-size: 136px;
    block-size: 136px;
    overflow: visible;
  }
  .radar .ring {
    fill: none;
    stroke: var(--gravitas-line);
  }
  .radar .face {
    fill: #0b1219;
    stroke: var(--gravitas-muted);
  }
  .radar .forward {
    fill: var(--gravitas-muted);
  }
  .radar .lean {
    fill: var(--gravitas-accent);
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
    fill: var(--gravitas-text);
    stroke: var(--gravitas-text);
    stroke-width: 1.5;
  }
  .radar .pad.far {
    fill: none;
  }
  figcaption {
    display: flex;
    gap: 10px;
    font-size: 11px;
    color: var(--gravitas-muted);
  }
  .swatch {
    display: inline-block;
    inline-size: 8px;
    block-size: 8px;
    margin-inline-end: 4px;
    vertical-align: 1px;
  }
  .swatch.lean {
    border-radius: 50%;
    background: var(--gravitas-accent);
  }
  .swatch.drift {
    block-size: 2px;
    inline-size: 10px;
    vertical-align: 3px;
    background: var(--gravitas-focus);
  }
  .swatch.pad {
    transform: rotate(45deg) scale(0.8);
    background: var(--gravitas-text);
  }
  .gauges {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 8px 12px;
    margin-top: 12px;
  }
  .gauge-label {
    font-size: 12px;
    color: var(--gravitas-muted);
  }
  .bar {
    position: relative;
    block-size: 8px;
    min-inline-size: 120px;
    border-radius: 4px;
    background: #0b1219;
    border: 1px solid var(--gravitas-line);
  }
  .fill {
    position: absolute;
    inset-block: 0;
    inset-inline-start: 0;
    border-radius: 3px;
    background: var(--gravitas-accent);
  }
  .fill.throttle {
    background: var(--gravitas-focus);
  }
  .hover-mark {
    position: absolute;
    inset-block: -4px;
    inline-size: 2px;
    margin-inline-start: -1px;
    background: var(--gravitas-text);
  }
  .gauge-value {
    min-inline-size: 4ch;
    text-align: end;
    font-size: 16px;
    font-variant-numeric: tabular-nums;
  }
  dt {
    font-size: 12px;
    color: var(--gravitas-muted);
  }
  dd {
    margin: 2px 0 0;
    font-size: 24px;
    font-variant-numeric: tabular-nums;
    line-height: 1.2;
    white-space: nowrap;
  }
  .unit {
    font-size: 14px;
    color: var(--gravitas-muted);
  }
  .side {
    display: grid;
    justify-items: end;
    gap: 8px;
  }
  #controls {
    max-width: 380px;
    padding: 10px 14px;
    border-radius: 6px;
    background: var(--gravitas-panel);
    font-size: 12px;
    color: var(--gravitas-muted);
  }
  .overlay {
    position: absolute;
    top: calc(max(24px, env(safe-area-inset-top)) + 96px);
    left: 24px;
    right: 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }
  .card {
    pointer-events: auto;
    width: min(440px, 100%);
    padding: 16px 20px;
    border: 1px solid var(--gravitas-line);
    border-radius: var(--gravitas-radius);
    background: var(--gravitas-panel);
  }
  .card h2 {
    font-size: 18px;
    margin-bottom: 8px;
  }
  .quick-keys {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 14px;
    margin: 0 0 10px;
  }
  .quick-keys dt,
  .quick-keys dd {
    margin: 0;
    font-size: 13px;
    color: var(--gravitas-text);
    white-space: normal;
  }
  .quick-keys kbd {
    letter-spacing: 0.15em;
  }
  .goal,
  .summary,
  .meta {
    font-size: 13px;
    color: var(--gravitas-muted);
  }
  .checks {
    list-style: none;
    padding: 0;
    margin: 12px 0;
    display: grid;
    gap: 6px;
  }
  .checks li {
    display: grid;
    grid-template-columns: 1.2em 1fr auto;
    gap: 8px;
    font-size: 13px;
    align-items: baseline;
  }
  .checks .value {
    font-variant-numeric: tabular-nums;
    text-align: end;
  }
  .checks .limit {
    grid-column: 2 / -1;
    font-size: 11px;
    color: var(--gravitas-muted);
    margin-top: -4px;
  }
  .pass .mark {
    color: var(--gravitas-good);
  }
  .fail .mark {
    color: var(--gravitas-bad);
  }
  .report.landed h2 {
    color: var(--gravitas-good);
  }
  .report.crashed h2,
  .report.rough h2 {
    color: var(--gravitas-bad);
  }
  .report button {
    margin-top: 12px;
  }
  .sr {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .status,
  #phase {
    position: absolute;
    top: 40%;
    left: 24px;
    right: 24px;
    width: fit-content;
    max-width: min(520px, calc(100% - 48px));
    margin: 0 auto;
    padding: 16px 20px;
    border-radius: var(--gravitas-radius);
    background: var(--gravitas-panel);
    text-align: center;
  }
  /* In the overlay column below the header, clear of the vehicle. */
  .overlay #phase {
    position: static;
    margin: 0;
  }
  /* After a verdict the region only speaks; the results card shows the title. */
  .overlay #phase.sr {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    padding: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  #phase:empty {
    display: none;
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
  kbd {
    font: inherit;
    font-weight: 600;
    color: var(--gravitas-text);
  }
  dialog {
    pointer-events: auto;
    color: inherit;
    background: #111923;
    border: 1px solid var(--gravitas-line);
    border-radius: var(--gravitas-radius);
    width: min(480px, calc(100% - 32px));
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
    gap: 10px;
    margin: 20px 0;
  }
  .help-list div {
    display: grid;
    grid-template-columns: 3fr 2fr;
    gap: 16px;
  }
  .help-list dd,
  .help-list dt {
    font: inherit;
    margin: 0;
    white-space: normal;
  }
  .help-list dt {
    color: var(--gravitas-muted);
  }
  button[aria-pressed='true'] {
    border-color: var(--gravitas-accent);
    color: var(--gravitas-accent);
  }
  .manual a {
    color: var(--gravitas-focus);
  }
  .about {
    border-top: 1px solid var(--gravitas-line);
    padding-top: 16px;
    font-size: 13px;
    color: var(--gravitas-muted);
  }
  @media (max-width: 700px) {
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
    nav,
    .actions {
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
      grid-template-columns: auto 1fr;
      gap: 8px 14px;
      padding: 10px 14px;
    }
    .readouts {
      grid-template-columns: repeat(2, auto);
      gap: 6px 16px;
    }
    dd,
    .primary dd {
      font-size: 18px;
    }
    .radar {
      inline-size: 96px;
      block-size: 96px;
    }
    figcaption {
      display: none;
    }
    /* Readouts sit beside the radar; gauges take the full width below both. */
    .data {
      display: contents;
    }
    .gauges {
      grid-column: 1 / -1;
      margin-top: 0;
    }
    .bar {
      min-inline-size: 0;
    }
    .unit {
      font-size: 12px;
    }
    .side {
      justify-items: stretch;
    }
    .actions {
      justify-content: flex-end;
    }
    .overlay {
      top: calc(max(16px, env(safe-area-inset-top)) + 72px);
      left: 16px;
      right: 16px;
      gap: 6px;
    }
    #phase {
      font-size: 13px;
      padding: 10px 14px;
    }
    .card {
      padding: 12px 14px;
    }
    .goal {
      display: none;
    }
    /* Keyboard hints duplicate Help; keep the narrow view on the flight. */
    #controls {
      display: none;
    }
  }
  @media (max-height: 500px) {
    header {
      top: 12px;
    }
    .bottom {
      bottom: 12px;
      flex-direction: row;
      align-items: flex-end;
    }
    #controls {
      display: none;
    }
    .instruments {
      padding: 8px 12px;
    }
  }
`;
