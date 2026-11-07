import { css } from 'lit';

/** Shared UI tokens. Hosts can override these custom properties on the component. */
export const uiTokens = css`
  :host {
    --gravitas-panel: #111923f2;
    --gravitas-text: #edf1f5;
    --gravitas-muted: #b3bfcb;
    --gravitas-line: #3c4857;
    --gravitas-accent: #efd0a1;
    --gravitas-focus: #bfe5ff;
    --gravitas-good: #9fe0a8;
    --gravitas-bad: #ffa08f;
    --gravitas-radius: 10px;
    color: var(--gravitas-text);
    font-family: system-ui, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    color-scheme: dark;
  }
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }
  button,
  select {
    min-height: 44px;
    border: 1px solid var(--gravitas-line);
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
    background: var(--gravitas-panel);
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  button:hover,
  select:hover {
    border-color: var(--gravitas-accent);
  }
  :focus-visible {
    outline: 2px solid var(--gravitas-focus);
    outline-offset: 3px;
  }
  :disabled,
  [aria-disabled='true'] {
    opacity: 0.65;
    cursor: wait;
  }
  h1,
  h2,
  p {
    margin: 0;
  }
  .muted {
    color: var(--gravitas-muted);
  }
`;
