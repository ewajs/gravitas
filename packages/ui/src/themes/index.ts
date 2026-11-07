/**
 * Typed colour themes as plain data, and the CSS custom properties they generate.
 * Pure TypeScript with no Lit or DOM dependency, so pages that do not load the HUD
 * (the manual, build tooling) can use the same values.
 * @module
 */

/** CSS colours (`#rrggbb` or `#rrggbbaa`) for each role in the interface. */
export interface ThemeColors {
  /** Page background behind everything, shown before and around the 3D view. */
  readonly surface: string;
  /** Panel fill; may be translucent over the scene. */
  readonly panel: string;
  /** Denser panel fill for cards and dialogs that hold reading, such as results. */
  readonly panelStrong: string;
  /** Opaque panel fill: the fallback when transparency is reduced. */
  readonly panelSolid: string;
  /** Panel borders and hairlines. */
  readonly line: string;
  /** Primary text. */
  readonly text: string;
  /** Secondary text: labels, units, notes. */
  readonly muted: string;
  /** Emphasis colour: highlighted marks, pressed controls, fills. */
  readonly accent: string;
  /** Text and icons drawn on an `accent` fill. */
  readonly accentInk: string;
  /** Accent fill under the pointer: a lighter step of `accent`. */
  readonly accentHover: string;
  /** Keyboard focus rings and secondary marks. */
  readonly focus: string;
  /** Success: passed checks, a clean landing. */
  readonly good: string;
  /** Caution: approaching a limit. */
  readonly warn: string;
  /** Failure: missed checks, a crash. */
  readonly bad: string;
  /** Recessed instrument backgrounds, such as the radar face. */
  readonly well: string;
  /** Unfilled part of gauges and scales. */
  readonly track: string;
  /** Dims the page behind a modal dialog. */
  readonly backdrop: string;
}

/**
 * Colours for the scene's non-physical marks, handed to the viewport by the host.
 * Physical materials (regolith, foil, rock, flame) are not themed.
 */
export interface SceneAccents {
  /** Background behind the scene (space). */
  readonly sky: string;
  /** Landing pad ring and markings. */
  readonly pad: string;
  /** Ring and drop line marking the ground below the vehicle. */
  readonly marker: string;
}

/** One complete look: interface colours, type, shape, and scene accents. */
export interface Theme {
  /** Stable identifier, for settings and tests. */
  readonly id: string;
  /** Whether the theme is drawn light-on-dark or dark-on-light. */
  readonly colorScheme: 'dark' | 'light';
  readonly colors: ThemeColors;
  /**
   * CSS `font-family` lists. The host loads any web fonts named here (the HUD lives
   * in a shadow root, where `@font-face` rules do not apply).
   */
  readonly fonts: {
    /** Body text and numbers; should have tabular numerals. */
    readonly body: string;
    /** Labels, headings, and the wordmark. */
    readonly display: string;
  };
  /** Panel corner radius, in CSS pixels; controls and cards derive theirs from it. */
  readonly radius: number;
  /**
   * CSS `backdrop-filter` behind translucent panels, or `none`. Dropped, with
   * `panelSolid` fills, when transparency is reduced.
   */
  readonly panelFilter: string;
  readonly scene: SceneAccents;
}

/**
 * The Gravitas house theme, "Glass": frosted translucent panels, a deep cyan
 * accent, Space Grotesk labels, and Inter numbers.
 */
export const gravitasTheme: Theme = {
  id: 'gravitas',
  colorScheme: 'dark',
  colors: {
    surface: '#04060b',
    panel: '#0c14208c', // rgba(12, 20, 32, 0.55)
    // Cards over a scrim: results, help, and the start card.
    panelStrong: '#0c1420bd',
    panelSolid: '#0c1420',
    line: '#96d7ff24',
    text: '#eaf2fa',
    muted: '#9fb1c4',
    accent: '#4cc3e0',
    accentInk: '#04121a',
    accentHover: '#7dd5ea',
    // Lighter than the accent: rings float over the scene, and the accent reaches
    // only 2.8:1 against sunlit ground.
    focus: '#82d5e9',
    good: '#5ee3a1',
    warn: '#ffc857',
    bad: '#ff7a6b',
    well: '#040a1273',
    track: '#96d7ff1a',
    backdrop: '#02050980',
  },
  fonts: {
    body: "'Inter Variable', Inter, system-ui, sans-serif",
    display: "'Space Grotesk Variable', 'Space Grotesk', system-ui, sans-serif",
  },
  radius: 18,
  panelFilter: 'blur(16px) saturate(140%)',
  scene: { sky: '#04060b', pad: '#4cc3e0', marker: '#eaf2fa' },
};

/** Every available theme, by id. One for now; more join this list. */
export const themes: readonly Theme[] = [gravitasTheme];

// Role → custom property. The HUD's documented names; order is the declaration order.
const PROPERTIES: readonly (readonly [string, (theme: Theme) => string])[] = [
  ['--gravitas-panel', (t) => t.colors.panel],
  ['--gravitas-text', (t) => t.colors.text],
  ['--gravitas-muted', (t) => t.colors.muted],
  ['--gravitas-line', (t) => t.colors.line],
  ['--gravitas-accent', (t) => t.colors.accent],
  ['--gravitas-focus', (t) => t.colors.focus],
  ['--gravitas-good', (t) => t.colors.good],
  ['--gravitas-bad', (t) => t.colors.bad],
  ['--gravitas-radius', (t) => `${t.radius}px`],
  ['--gravitas-surface', (t) => t.colors.surface],
  ['--gravitas-panel-strong', (t) => t.colors.panelStrong],
  ['--gravitas-panel-solid', (t) => t.colors.panelSolid],
  ['--gravitas-accent-ink', (t) => t.colors.accentInk],
  ['--gravitas-accent-hover', (t) => t.colors.accentHover],
  ['--gravitas-warn', (t) => t.colors.warn],
  ['--gravitas-well', (t) => t.colors.well],
  ['--gravitas-track', (t) => t.colors.track],
  ['--gravitas-backdrop', (t) => t.colors.backdrop],
  ['--gravitas-font-body', (t) => t.fonts.body],
  ['--gravitas-font-display', (t) => t.fonts.display],
  ['--gravitas-panel-filter', (t) => t.panelFilter],
];

/** The theme as CSS custom properties (`--gravitas-text` and so on), in a stable order. */
export function themeProperties(theme: Theme): Readonly<Record<string, string>> {
  return Object.fromEntries(PROPERTIES.map(([name, value]) => [name, value(theme)]));
}

/** The theme's custom properties as CSS declarations, for a rule body. */
export function themeDeclarations(theme: Theme): string {
  return Object.entries(themeProperties(theme))
    .map(([name, value]) => `${name}: ${value};`)
    .join('\n');
}

/** A complete CSS rule declaring the theme's custom properties on `selector`. */
export function themeCss(theme: Theme, selector = ':root'): string {
  return `${selector} {\n${themeDeclarations(theme)}\n}\n`;
}
