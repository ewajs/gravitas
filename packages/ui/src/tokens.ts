import { css, unsafeCSS } from 'lit';
import { gravitasTheme, themeDeclarations } from './themes';

/**
 * Shared UI tokens: the house theme's custom properties, generated from its typed
 * values. Hosts can override any of them on the component.
 */
export const uiTokens = css`
  :host {
    ${unsafeCSS(themeDeclarations(gravitasTheme))}
    color: var(--gravitas-text);
    font-family: var(--gravitas-font-body);
    font-size: 14px;
    line-height: 1.5;
    color-scheme: ${unsafeCSS(gravitasTheme.colorScheme)};
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
